import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import type {
  AIProviderId,
  NormalizedProviderResponse,
  ProviderError,
  StreamRequest,
  TokenUsage
} from "@contracts/ai";
import { DEFAULT_PRIVACY_SETTINGS } from "@contracts/settings";
import { AiGateway } from "@main/ai/ai-gateway";
import type {
  ProviderAdapter,
  ProviderAdapterCapabilities,
  ProviderAdapterConfig,
  ProviderStreamCallbacks
} from "@main/ai/provider-adapter";
import { ProviderAdapterError } from "@main/ai/provider-adapter";
import { createDatabaseConnection } from "@main/db/connection";
import { migrateDatabase } from "@main/db/migrate";
import { createRepositories } from "@main/db/service";
import type { RepositoryRegistry } from "@main/db/service";
import { exportDiagnosticsBundle } from "@main/diagnostics/diagnostics-service";
import {
  parseProviderChapterCheckBudget,
  ProviderChapterCheckService,
  shouldRunProviderChapterCheck
} from "@main/e2e/provider-chapter-check-service";
import { CredentialService } from "@main/providers/credential-service";
import {
  parseProviderCheckBudget,
  renderProviderCheckReport,
  shouldRunRealProviderChecks
} from "@main/providers/provider-check-service";
import { ProviderSmokeService } from "@main/providers/provider-smoke-service";
import { RedactionService } from "@main/security/redaction-service";
import { SecretEncryptionService } from "@main/security/secret-encryption-service";
import {
  redactSensitiveDiagnosticsText,
  scanSensitiveDiagnosticsText
} from "@main/diagnostics/sensitive-value-scan";

let tempDir = "";

class SequenceProviderAdapter implements ProviderAdapter {
  readonly displayName = "Sequence Provider";
  readonly capabilities: ProviderAdapterCapabilities = {
    streaming: true,
    json: true,
    tools: false,
    vision: false,
    promptCaching: false
  };
  private index = 0;

  constructor(
    readonly id: AIProviderId,
    private readonly responses: Array<string | ProviderError>
  ) {}

  validateConfig(config: ProviderAdapterConfig): void {
    if (!config.apiKey) {
      throw new ProviderAdapterError({ code: "auth_error", message: "Missing API key" });
    }
  }

  async streamChat(
    request: StreamRequest,
    callbacks: ProviderStreamCallbacks,
    abortSignal: AbortSignal
  ): Promise<NormalizedProviderResponse> {
    const response = await this.generateText(request, abortSignal);
    callbacks.onDelta?.(response.text);
    if (response.usage) {
      callbacks.onUsage?.(response.usage);
    }
    return response;
  }

  async generateText(
    request: StreamRequest,
    abortSignal: AbortSignal
  ): Promise<NormalizedProviderResponse> {
    void abortSignal;
    const next = this.responses[Math.min(this.index, this.responses.length - 1)] ?? "";
    this.index += 1;
    if (typeof next !== "string") {
      throw new ProviderAdapterError(next);
    }
    return {
      text: next,
      usage: {
        inputTokens: request.messages.reduce((total, message) => total + message.content.length, 0),
        outputTokens: next.length
      }
    };
  }

  normalizeUsage(raw: unknown): TokenUsage | null {
    return raw && typeof raw === "object" ? (raw as TokenUsage) : null;
  }

  normalizeError(error: unknown): ProviderError {
    if (error instanceof ProviderAdapterError) return error.providerError;
    return { code: "provider_error", message: "Provider failed", retryable: true };
  }
}

afterEach(() => {
  if (tempDir) {
    rmSync(tempDir, { recursive: true, force: true });
    tempDir = "";
  }
});

describe("phase 15c privacy-safe provider connectivity diagnostics", () => {
  it("keeps local provider check inputs and reports ignored with empty env placeholders", () => {
    const gitignore = readFileSync(".gitignore", "utf8");
    const example = readFileSync(".env.example", "utf8");

    expect(gitignore).toContain(".env.local");
    expect(gitignore).toContain(".env.*.local");
    expect(gitignore).toContain("reports/");
    expect(gitignore).toContain("diagnostics-local/");
    expect(example).toContain("RUN_REAL_PROVIDER_CHECKS=false");
    expect(example).toContain("REAL_PROVIDER_CHECK_BUDGET_USD=2");
    expect(example).toContain("REAL_E2E_CHECK_BUDGET_USD=3");
    expect(example).not.toMatch(/sk-[A-Za-z0-9]/);
    expect(example).not.toMatch(/AIza[A-Za-z0-9_-]{10,}/);
  });

  it("skips real provider checks unless explicitly opted in outside CI", () => {
    expect(shouldRunRealProviderChecks({ RUN_REAL_PROVIDER_CHECKS: "false" })).toBe(false);
    expect(shouldRunRealProviderChecks({ RUN_REAL_PROVIDER_CHECKS: "TRUE" })).toBe(true);
    expect(shouldRunRealProviderChecks({ CI: "true", RUN_REAL_PROVIDER_CHECKS: "true" })).toBe(
      false
    );
    expect(parseProviderCheckBudget({ REAL_PROVIDER_CHECK_BUDGET_USD: "0.25" })).toBe(0.25);
    expect(parseProviderCheckBudget({ REAL_PROVIDER_CHECK_BUDGET_USD: "-1" })).toBe(2);
  });

  it("runs a budget-capped fake provider connection check and creates llm_runs", async () => {
    const { service, repositories } = createProviderHarness([
      new SequenceProviderAdapter("openai", ['{"ok":true,"message":"pong"}'])
    ]);

    const result = await service.runProviderSmoke({
      provider: "openai",
      confirmed: true,
      budgetCapUsd: 0.5
    });

    expect(result.status).toBe("passed");
    expect(result.runIds).toHaveLength(2);
    expect(result.finalCost).not.toBeNull();
    expect(repositories.cost.summarizeRuns({}).runCount).toBe(2);
  });

  it("blocks provider checks before calls when the cap is too small", async () => {
    const { service, repositories } = createProviderHarness(
      [new SequenceProviderAdapter("openai", ['{"ok":true,"message":"pong"}'])],
      { inputPricePerMillion: 100_000, outputPricePerMillion: 100_000 }
    );

    const result = await service.runProviderSmoke({
      provider: "openai",
      confirmed: true,
      budgetCapUsd: 0.00001
    });

    expect(result.status).toBe("blocked");
    expect(result.error).toMatch(/budget/i);
    expect(repositories.cost.summarizeRuns({}).runCount).toBe(0);
  });

  it("redacts provider check reports and diagnostics bundles", () => {
    const fakeSecret = "sk-test-redaction-1234567890";
    const report = renderProviderCheckReport({
      appVersion: "0.1.0",
      routePreset: "balanced",
      results: [
        {
          provider: "openai",
          model: "check-model",
          configured: true,
          tested: true,
          status: "failed",
          streamingSupported: true,
          nonStreamingSupported: true,
          usageParsed: false,
          finalCostComputed: false,
          fallbackEligible: false,
          error: `Authorization: Bearer ${fakeSecret}`,
          testedAt: "2026-05-26T00:00:00.000Z",
          latencyMs: null,
          estimatedCost: null,
          finalCost: null,
          runIds: ["llm_safe"]
        }
      ],
      createdAt: "2026-05-26T00:00:00.000Z"
    });
    const diagnostics = exportDiagnosticsBundle({
      appVersion: "0.1.0",
      platform: "darwin",
      environment: "test",
      dbMigrationVersion: "hash",
      safeStorageAvailable: true,
      providerHealth: [],
      recentErrors: [`api_key=${fakeSecret}`],
      logs: [`Authorization: Bearer ${fakeSecret}`],
      settings: { encryptedSecretBase64: "local-blob", normal: "value" }
    });

    expect(report).toContain("Sensitive values omitted: true");
    expect(report).not.toContain(fakeSecret);
    expect(JSON.stringify(diagnostics)).not.toContain(fakeSecret);
    expect(JSON.stringify(diagnostics)).not.toContain("encryptedSecretBase64");
    expect(scanSensitiveDiagnosticsText(report).ok).toBe(true);
    expect(redactSensitiveDiagnosticsText(`Gemini AIzaFakeProviderKey1234567890`)).not.toContain(
      "AIzaFakeProviderKey"
    );
  });

  it("skips real E2E provider chapter checks unless explicitly opted in and parses budget caps", () => {
    expect(shouldRunProviderChapterCheck({ RUN_REAL_PROVIDER_CHECKS: "false" })).toBe(false);
    expect(shouldRunProviderChapterCheck({ RUN_REAL_PROVIDER_CHECKS: "true" })).toBe(true);
    expect(shouldRunProviderChapterCheck({ CI: "1", RUN_REAL_PROVIDER_CHECKS: "true" })).toBe(
      false
    );
    expect(parseProviderChapterCheckBudget({ REAL_E2E_CHECK_BUDGET_USD: "1.25" })).toBe(1.25);
    expect(parseProviderChapterCheckBudget({ REAL_E2E_CHECK_BUDGET_USD: "nope" })).toBe(3);
  });

  it("runs an E2E provider chapter check with fake adapters and leaves canon/story bible unchanged", async () => {
    const { connection, repositories, gateway, credentialService } = createProviderHarness(
      [
        new SequenceProviderAdapter("openai", [
          '{"chapter_promise":"测试承诺","scene_plan":["一","二"]}',
          '[{"scene_index":1,"goal":"调查","obstacle":"雨夜"}]',
          "雨声压在旧楼上，沈照听见门后传来自己的声音。",
          '{"findings":[]}',
          '{"ending_hook_score":9,"actionable_suggestions":[]}',
          "雨声压在旧楼上，沈照听见门后有人用他的声音问候。",
          '{"proposals":[{"item_type":"chapter_summary","confidence":0.8}]}'
        ])
      ],
      { inputPricePerMillion: 0.01, outputPricePerMillion: 0.01 }
    );
    seedWorkflowProjectAndRoutes(repositories, credentialService);
    const service = new ProviderChapterCheckService({
      database: connection.db,
      repositories,
      aiGateway: gateway,
      credentialService,
      privacy: DEFAULT_PRIVACY_SETTINGS,
      appVersion: "0.1.0"
    });

    const result = await service.run({
      confirmed: true,
      budgetCapUsd: 1,
      qualityMode: "balanced"
    });

    expect(result.status).toBe("passed");
    expect(result.canonicalManuscriptChanged).toBe(false);
    expect(result.storyBibleChanged).toBe(false);
    expect(result.llmRunIds).toHaveLength(7);
    expect(result.generatedArtifactIds.length).toBeGreaterThanOrEqual(7);
    expect(result.settlementProposalItemCount).toBeGreaterThanOrEqual(2);
    expect(result.savedNonCanonicalVersionId).toMatch(/^manuscript_/);
    expect(result.reportMarkdown).toContain("canonical manuscript changed: false");
    expect(result.reportMarkdown).not.toContain("雨声压在旧楼上");
  });
});

function createProviderHarness(
  adapters: ProviderAdapter[],
  price: { inputPricePerMillion: number; outputPricePerMillion: number } = {
    inputPricePerMillion: 0.01,
    outputPricePerMillion: 0.01
  }
) {
  tempDir = mkdtempSync(join(tmpdir(), "wenforge-phase15c-"));
  const connection = createDatabaseConnection(join(tempDir, "test.sqlite"));
  migrateDatabase(connection.sqlite);
  const repositories = createRepositories(connection.db);
  const credentialService = new CredentialService({
    repository: repositories.providerCredentials,
    encryption: new SecretEncryptionService({
      isEncryptionAvailable: () => true,
      encryptString: (value) => Buffer.from([...value].reverse().join(""), "utf8"),
      decryptString: (value) => [...value.toString("utf8")].reverse().join("")
    }),
    redaction: new RedactionService()
  });
  credentialService.saveCredential({
    provider: "openai",
    displayName: "OpenAI test credential",
    apiKey: "sk-unit-redacted-1234567890"
  });
  repositories.modelProfiles.create({
    provider: "openai",
    model: "check-model",
    displayName: "Check model",
    supportsStreaming: true,
    supportsJson: true,
    enabled: true
  });
  repositories.modelPrices.upsert({
    provider: "openai",
    model: "check-model",
    inputPricePerMillion: price.inputPricePerMillion,
    outputPricePerMillion: price.outputPricePerMillion,
    currency: "USD",
    effectiveDate: "2026-05-26",
    sourceNote: "Unit test editable placeholder.",
    enabled: true
  });
  const gateway = new AiGateway({
    repositories,
    credentialService,
    adapters
  });
  return {
    connection,
    repositories,
    credentialService,
    gateway,
    service: new ProviderSmokeService({
      repositories,
      aiGateway: gateway,
      adapters
    })
  };
}

function seedWorkflowProjectAndRoutes(
  repositories: RepositoryRegistry,
  credentialService: CredentialService
): void {
  const project = repositories.projects.create({
    name: "Provider check demo",
    description: "Tiny local QA fixture"
  });
  const book = repositories.books.create({
    projectId: project.id,
    title: "雨夜检查",
    genre: "都市异能"
  });
  const volume = repositories.volumes.create({
    bookId: book.id,
    title: "短测卷",
    volumeIndex: 1
  });
  const chapter = repositories.chapters.create({
    bookId: book.id,
    volumeId: volume.id,
    chapterIndex: 1,
    title: "连接检查章节",
    targetWords: 1600
  });
  repositories.manuscripts.saveManualVersion({
    chapterId: chapter.id,
    title: "检查前 canon",
    contentMarkdown: "这是检查前的正稿。",
    isCanonical: true
  });
  repositories.storyBible.createEntry({
    bookId: book.id,
    entryType: "world_rule",
    title: "检查规则",
    content: "这条事实不应被 provider 检查自动改变。"
  });
  credentialService.saveCredential({
    provider: "openai",
    displayName: "OpenAI workflow credential",
    apiKey: "sk-workflow-redacted-1234567890"
  });
  const profile =
    repositories.modelProfiles.list().find((item) => item.provider === "openai") ??
    repositories.modelProfiles.create({
      provider: "openai",
      model: "check-model",
      displayName: "Check model",
      supportsStreaming: true,
      supportsJson: true,
      enabled: true
    });
  for (const taskType of [
    "chapter_outline",
    "scene_cards",
    "draft_chapter",
    "continuity_audit",
    "suspense_hook_audit",
    "revise_chapter",
    "state_settlement"
  ] as const) {
    repositories.taskRoutes.upsert({
      taskType,
      qualityMode: "balanced",
      primaryModelProfileId: profile.id,
      temperature: 0,
      maxOutputTokens: 1600,
      enabled: true
    });
  }
}

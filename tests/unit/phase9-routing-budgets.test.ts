import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import type {
  AIProviderId,
  ChatMessage,
  LLMTaskType,
  NormalizedProviderResponse,
  ProviderError,
  TokenUsage
} from "@contracts/ai";
import { DEFAULT_PRIVACY_SETTINGS } from "@contracts/settings";
import { AiGateway } from "@main/ai/ai-gateway";
import { CostCalculator } from "@main/ai/cost-calculator";
import type {
  ProviderAdapter,
  ProviderAdapterCapabilities,
  ProviderAdapterConfig,
  ProviderStreamCallbacks
} from "@main/ai/provider-adapter";
import { ProviderAdapterError } from "@main/ai/provider-adapter";
import { TokenEstimator } from "@main/ai/token-estimator";
import { createDatabaseConnection } from "@main/db/connection";
import { migrateDatabase } from "@main/db/migrate";
import { createRepositories } from "@main/db/service";
import type { RepositoryRegistry } from "@main/db/service";
import { CredentialService } from "@main/providers/credential-service";
import { ModelRouter } from "@main/providers/model-router";
import { RedactionService } from "@main/security/redaction-service";
import { SecretEncryptionService } from "@main/security/secret-encryption-service";
import { ChapterWorkflowRuntime } from "@main/workflows/chapter-workflow-runtime";
import { WorkflowModelExecutor } from "@main/workflows/workflow-model-executor";

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
    request: Parameters<ProviderAdapter["streamChat"]>[0],
    callbacks: ProviderStreamCallbacks,
    abortSignal: AbortSignal
  ): Promise<NormalizedProviderResponse> {
    return this.generateText(request, abortSignal).then((response) => {
      callbacks.onDelta?.(response.text);
      if (response.usage) callbacks.onUsage?.(response.usage);
      return response;
    });
  }

  async generateText(
    request: Parameters<ProviderAdapter["generateText"]>[0],
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

function mockSafeStorage() {
  return {
    isEncryptionAvailable: () => true,
    encryptString: (value: string) => Buffer.from([...value].reverse().join(""), "utf8"),
    decryptString: (value: Buffer) => [...value.toString("utf8")].reverse().join("")
  };
}

function createHarness(adapters: ProviderAdapter[]) {
  tempDir = mkdtempSync(join(tmpdir(), "wenforge-phase9-"));
  const connection = createDatabaseConnection(join(tempDir, "test.sqlite"));
  migrateDatabase(connection.sqlite);
  const repositories = createRepositories(connection.db);
  const credentialService = new CredentialService({
    repository: repositories.providerCredentials,
    encryption: new SecretEncryptionService(mockSafeStorage()),
    redaction: new RedactionService()
  });
  const gateway = new AiGateway({
    repositories,
    credentialService,
    adapters,
    tokenEstimator: new TokenEstimator(),
    costCalculator: new CostCalculator()
  });
  const executor = new WorkflowModelExecutor({
    aiGateway: gateway,
    repositories,
    credentialService,
    retryDelayMs: 0
  });
  const project = repositories.projects.create({ name: "P" });
  const book = repositories.books.create({ projectId: project.id, title: "B" });
  const chapter = repositories.chapters.create({ bookId: book.id, chapterIndex: 1, title: "C" });
  const run = repositories.generation.createRun({
    projectId: project.id,
    bookId: book.id,
    chapterId: chapter.id,
    status: "running"
  });

  return {
    connection,
    repositories,
    credentialService,
    gateway,
    executor,
    project,
    book,
    chapter,
    run
  };
}

function seedRoute(
  repositories: RepositoryRegistry,
  credentialService: CredentialService,
  input: {
    provider: "openai" | "deepseek";
    model: string;
    taskType?: "draft_chapter" | "chapter_outline" | "state_settlement";
    qualityMode?: "economy" | "balanced" | "premium";
    fallbackProfileId?: string | null;
    price?: { input: number; output: number };
  }
) {
  credentialService.saveCredential({
    provider: input.provider,
    displayName: input.provider,
    apiKey: `${input.provider}-secret`
  });
  const profile = repositories.modelProfiles.create({
    provider: input.provider,
    model: input.model,
    displayName: input.model,
    supportsStreaming: true,
    supportsJson: true,
    enabled: true
  });
  repositories.modelPrices.upsert({
    provider: input.provider,
    model: input.model,
    inputPricePerMillion: input.price?.input ?? 1,
    outputPricePerMillion: input.price?.output ?? 3,
    currency: "USD",
    effectiveDate: "2026-05-25",
    sourceNote: "Unit test price",
    enabled: true
  });
  repositories.taskRoutes.upsert({
    taskType: input.taskType ?? "draft_chapter",
    qualityMode: input.qualityMode ?? "balanced",
    primaryModelProfileId: profile.id,
    fallbackModelProfileId1: input.fallbackProfileId ?? null,
    temperature: 0.7,
    maxOutputTokens: 4000,
    enabled: true
  });
  return profile;
}

const WORKFLOW_TASKS: LLMTaskType[] = [
  "chapter_outline",
  "scene_cards",
  "draft_chapter",
  "continuity_audit",
  "suspense_hook_audit",
  "revise_chapter",
  "state_settlement"
];

function seedWorkflowRoutes(
  repositories: RepositoryRegistry,
  credentialService: CredentialService,
  input: {
    provider: "openai" | "deepseek";
    model: string;
    price?: { input: number; output: number };
  }
) {
  credentialService.saveCredential({
    provider: input.provider,
    displayName: input.provider,
    apiKey: `${input.provider}-secret`
  });
  const profile = repositories.modelProfiles.create({
    provider: input.provider,
    model: input.model,
    displayName: input.model,
    supportsStreaming: true,
    supportsJson: true,
    enabled: true
  });
  repositories.modelPrices.upsert({
    provider: input.provider,
    model: input.model,
    inputPricePerMillion: input.price?.input ?? 1,
    outputPricePerMillion: input.price?.output ?? 3,
    currency: "USD",
    effectiveDate: "2026-05-25",
    sourceNote: "Unit test price",
    enabled: true
  });
  for (const taskType of WORKFLOW_TASKS) {
    repositories.taskRoutes.upsert({
      taskType,
      qualityMode: "balanced",
      primaryModelProfileId: profile.id,
      temperature: 0.7,
      maxOutputTokens: 4000,
      enabled: true
    });
  }
  return profile;
}

function messages(): ChatMessage[] {
  return [{ role: "user", content: "写一个雨夜章节" }];
}

afterEach(() => {
  if (tempDir) {
    rmSync(tempDir, { recursive: true, force: true });
    tempDir = "";
  }
});

describe("phase 9 provider routing, fallback, and budgets", () => {
  it("resolves route previews with fallback models, health, and cost estimates", () => {
    const { repositories, credentialService } = createHarness([]);
    const fallback = seedRoute(repositories, credentialService, {
      provider: "deepseek",
      model: "deepseek-v4-flash"
    });
    const primary = seedRoute(repositories, credentialService, {
      provider: "openai",
      model: "gpt-5.4-mini",
      fallbackProfileId: fallback.id
    });
    repositories.providerHealth.recordSuccess("openai", "gpt-5.4-mini", "bootstrap");

    const preview = new ModelRouter({
      credentials: repositories.providerCredentials,
      modelProfiles: repositories.modelProfiles,
      prices: repositories.modelPrices,
      routes: repositories.taskRoutes,
      providerHealth: repositories.providerHealth,
      settings: { priceStaleAfterDays: 180, missingPriceBehavior: "warn" }
    }).resolveRoute("draft_chapter", "balanced", {
      chapterImportance: "climax",
      budgetMode: "flexible",
      expectedTokens: { inputTokens: 1000, outputTokens: 2000 }
    });

    expect(preview.available).toBe(true);
    expect(preview.modelProfile?.id).toBe(primary.id);
    expect(preview.fallbackModels.map((model) => model.id)).toEqual([fallback.id]);
    expect(preview.estimatedCostRange.maxCost).toBeGreaterThan(0);
    expect(preview.providerHealth?.status).toBe("healthy");
  });

  it("falls back on rate limits and records provider health outcomes", async () => {
    const { repositories, credentialService, executor, run, chapter } = createHarness([
      new SequenceProviderAdapter("openai", [
        { code: "rate_limit", message: "Rate limit", retryable: true }
      ]),
      new SequenceProviderAdapter("deepseek", ["fallback success"])
    ]);
    const fallback = seedRoute(repositories, credentialService, {
      provider: "deepseek",
      model: "deepseek-v4-flash"
    });
    seedRoute(repositories, credentialService, {
      provider: "openai",
      model: "gpt-5.4-mini",
      fallbackProfileId: fallback.id
    });

    const result = await executor.runNode({
      generationRunId: run.id,
      taskType: "draft_chapter",
      qualityMode: "balanced",
      projectId: run.projectId ?? undefined,
      bookId: run.bookId ?? undefined,
      chapterId: chapter.id,
      messages: messages(),
      expectedOutputTokens: 100
    });

    expect(result.text).toBe("fallback success");
    expect(result.attempts.map((attempt) => `${attempt.provider}:${attempt.status}`)).toEqual([
      "openai:failed",
      "deepseek:succeeded"
    ]);
    expect(repositories.providerHealth.get("openai", "gpt-5.4-mini")?.status).toBe("degraded");
    expect(repositories.providerHealth.get("deepseek", "deepseek-v4-flash")?.status).toBe(
      "healthy"
    );
    expect(repositories.cost.listRunsByChapter(chapter.id)).toHaveLength(2);
  });

  it("does not retry or fallback on auth errors", async () => {
    const { repositories, credentialService, executor, run, chapter } = createHarness([
      new SequenceProviderAdapter("openai", [
        { code: "auth_error", message: "Bad key sk-secret-should-redact", retryable: false }
      ]),
      new SequenceProviderAdapter("deepseek", ["should not run"])
    ]);
    const fallback = seedRoute(repositories, credentialService, {
      provider: "deepseek",
      model: "deepseek-v4-flash"
    });
    seedRoute(repositories, credentialService, {
      provider: "openai",
      model: "gpt-5.4-mini",
      fallbackProfileId: fallback.id
    });

    await expect(
      executor.runNode({
        generationRunId: run.id,
        taskType: "draft_chapter",
        qualityMode: "balanced",
        chapterId: chapter.id,
        messages: messages(),
        expectedOutputTokens: 100
      })
    ).rejects.toMatchObject({ code: "auth_error" });

    expect(repositories.cost.listRunsByChapter(chapter.id)).toHaveLength(1);
    expect(repositories.cost.listRunsByChapter(chapter.id)[0]?.errorMessage).not.toContain(
      "sk-secret-should-redact"
    );
  });

  it("retries invalid structured JSON once with the json-repair prompt", async () => {
    const { repositories, credentialService, executor, run, chapter } = createHarness([
      new SequenceProviderAdapter("openai", ["{not valid json", '{"ok":true}'])
    ]);
    seedRoute(repositories, credentialService, {
      provider: "openai",
      model: "gpt-5.4-mini",
      taskType: "chapter_outline"
    });

    const result = await executor.runNode({
      generationRunId: run.id,
      taskType: "chapter_outline",
      qualityMode: "balanced",
      chapterId: chapter.id,
      messages: messages(),
      expectedOutputTokens: 100,
      requireJson: true
    });

    expect(result.text).toBe('{"ok":true}');
    expect(result.repairedJson).toBe(true);
    expect(result.attempts).toHaveLength(2);
    expect(repositories.cost.listRunsByChapter(chapter.id)).toHaveLength(2);
  });

  it("blocks provider workflows when preflight budget policy is exceeded", async () => {
    const { connection, repositories, credentialService, gateway, project, book, chapter } =
      createHarness([new SequenceProviderAdapter("openai", ["won't run"])]);
    seedWorkflowRoutes(repositories, credentialService, {
      provider: "openai",
      model: "expensive-model",
      price: { input: 10_000, output: 10_000 }
    });
    repositories.budgetPolicies.update({
      perWorkflowBudgetCap: 0.000001,
      onBudgetExceeded: "abort"
    });
    const runtime = new ChapterWorkflowRuntime({
      database: connection.db,
      repositories,
      privacy: DEFAULT_PRIVACY_SETTINGS,
      aiGateway: gateway
    });

    await expect(
      runtime.startChapterWorkflow({
        projectId: project.id,
        bookId: book.id,
        chapterId: chapter.id,
        qualityMode: "balanced",
        executionMode: "provider",
        confirmed: true
      })
    ).rejects.toThrow(/预算|budget/i);
  });

  it("returns the configured live budget action when actual cost exceeds the preflight threshold", async () => {
    const { repositories, credentialService, executor, run, chapter } = createHarness([
      new SequenceProviderAdapter("openai", ["expensive generated text"])
    ]);
    seedRoute(repositories, credentialService, {
      provider: "openai",
      model: "gpt-5.4-mini",
      price: { input: 5000, output: 5000 }
    });
    repositories.budgetPolicies.update({
      warningThresholdPercent: 1,
      onBudgetExceeded: "pause"
    });

    const result = await executor.runNode({
      generationRunId: run.id,
      taskType: "draft_chapter",
      qualityMode: "balanced",
      chapterId: chapter.id,
      messages: messages(),
      expectedOutputTokens: 100,
      preflightMaxCost: 0.000001
    });

    expect(result.budgetAction).toBe("pause");
  });

  it("keeps mock workflow mode available without credentials", async () => {
    const { connection, repositories, project, book, chapter } = createHarness([]);
    const runtime = new ChapterWorkflowRuntime({
      database: connection.db,
      repositories,
      privacy: DEFAULT_PRIVACY_SETTINGS
    });

    const run = await runtime.startChapterWorkflow({
      projectId: project.id,
      bookId: book.id,
      chapterId: chapter.id,
      qualityMode: "balanced",
      executionMode: "mock",
      confirmed: true
    });

    expect(run.status).toBe("paused");
    expect(runtime.getRun(run.id)?.llmRuns.every((llmRun) => llmRun.provider === "fake")).toBe(
      true
    );
  });
});

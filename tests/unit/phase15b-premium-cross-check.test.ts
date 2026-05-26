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
import { createRepositories, seedModelRoutingData } from "@main/db/service";
import type { RepositoryRegistry } from "@main/db/service";
import {
  applyPremiumWebnovelPreset,
  exportPremiumWebnovelPreset,
  importPremiumWebnovelPreset
} from "@main/providers/premium-webnovel-preset";
import { CredentialService } from "@main/providers/credential-service";
import { ModelRouter } from "@main/providers/model-router";
import { RedactionService } from "@main/security/redaction-service";
import { SecretEncryptionService } from "@main/security/secret-encryption-service";
import { CrossCheckService } from "@main/workflows/cross-check-service";

let tempDir = "";

afterEach(() => {
  if (tempDir) {
    rmSync(tempDir, { recursive: true, force: true });
    tempDir = "";
  }
});

describe("phase 15b premium webnovel routing and cross-checks", () => {
  it("seeds editable model aliases and the premium webnovel route preset", () => {
    const { repositories, credentials } = createHarness([]);
    seedAllPremiumCredentials(credentials);
    seedModelRoutingData(repositories);
    applyPremiumWebnovelPreset(repositories);

    for (const alias of [
      "gpt-5.5",
      "claude-opus-4.7",
      "deepseek-v4-pro",
      "qwen3.7-max",
      "kimi-k2.6"
    ]) {
      const profile = repositories.modelProfiles.findByAlias(alias);
      expect(profile?.alias).toBe(alias);
      expect(profile?.enabled).toBe(true);
    }

    const qwen = repositories.modelProfiles.findByAlias("qwen3.7-max");
    expect(qwen).toMatchObject({
      provider: "dashscope_qwen",
      displayName: "Qwen3.7-Max"
    });
    const qwenPrice = repositories.modelPrices.findActive("dashscope_qwen", qwen?.model ?? "");
    expect(qwenPrice?.sourceNote).toContain("User must confirm in provider console.");

    const router = new ModelRouter({
      credentials: repositories.providerCredentials,
      modelProfiles: repositories.modelProfiles,
      prices: repositories.modelPrices,
      routes: repositories.taskRoutes,
      providerHealth: repositories.providerHealth,
      settings: { missingPriceBehavior: "block", priceStaleAfterDays: 3650 }
    });

    const expectedPrimaryAliases: Record<string, string> = {
      story_bible: "gpt-5.5",
      volume_outline: "gpt-5.5",
      chapter_outline: "deepseek-v4-pro",
      scene_cards: "deepseek-v4-pro",
      draft_chapter: "qwen3.7-max",
      webnovel_style_rewrite: "qwen3.7-max",
      suspense_hook_audit: "qwen3.7-max",
      continuity_audit: "deepseek-v4-pro",
      revise_chapter: "claude-opus-4.7",
      state_settlement: "deepseek-v4-pro",
      summarize_chapter: "deepseek-v4-pro"
    };

    for (const [taskType, alias] of Object.entries(expectedPrimaryAliases)) {
      const resolution = router.resolveRoute(taskType as never, "premium_webnovel", {
        expectedTokens: { inputTokens: 2000, outputTokens: 1000 }
      });
      expect(resolution.available, `${taskType}: ${resolution.errors.join(",")}`).toBe(true);
      expect(resolution.modelProfile?.alias).toBe(alias);
    }
  });

  it("exports and imports the premium preset without hardcoding a single route shape", () => {
    const { repositories, credentials } = createHarness([]);
    seedAllPremiumCredentials(credentials);
    seedModelRoutingData(repositories);
    const exported = exportPremiumWebnovelPreset(repositories);

    expect(exported.quality_mode).toBe("premium_webnovel");
    const imported = importPremiumWebnovelPreset(repositories, {
      ...exported,
      routes: {
        ...exported.routes,
        draft_chapter: {
          primary: "kimi-k2.6",
          fallback: ["qwen3.7-max", "claude-opus-4.7"]
        }
      }
    });

    expect(imported.routes.draft_chapter?.primary).toBe("kimi-k2.6");
    const draftRoute = repositories.taskRoutes.find("draft_chapter", "premium_webnovel");
    const primary = draftRoute
      ? repositories.modelProfiles.get(draftRoute.primaryModelProfileId)
      : null;
    expect(primary?.alias).toBe("kimi-k2.6");
  });

  it("runs independent director calls before sending both outputs to the aggregator", async () => {
    const adapters = [
      new RecordingAdapter("openai", "GPT director output"),
      new RecordingAdapter("anthropic", "Claude director output"),
      new RecordingAdapter(
        "deepseek",
        JSON.stringify({
          agreements: ["世界规则需要代价"],
          disagreements: ["主角能力边界不一致"],
          logical_contradictions: ["雨夜规则与白天触发冲突"],
          originality_risks: ["灵气复苏开篇过熟"],
          trope_cliche_risks: ["退婚流标签需谨慎"],
          unresolved_decisions: ["能力代价"],
          recommended_final_plan: "保留雨夜限制，删除全时触发。",
          human_decision_points: ["是否保留退婚元素"],
          cost_summary: { estimated_total: 0.0001, currency: "USD" }
        })
      ),
      new RecordingAdapter("dashscope_qwen", "市场适配：章末钩子需要更具体")
    ];
    const { repositories, service, project, book, chapter } = createCrossCheckHarness(adapters);

    const result = await service.run({
      type: "worldbuilding_cross_check",
      projectId: project.id,
      bookId: book.id,
      chapterId: chapter.id,
      contextText: "都市异能，雨夜觉醒，主角听见城市电流低语。",
      budgetCapUsd: 1,
      confirmed: true
    });

    expect(result.status).toBe("proposed");
    expect(result.llmRunIds).toHaveLength(4);
    expect(repositories.cost.summarizeRuns({}).runCount).toBe(4);

    const openaiPrompt = adapters[0]?.requests[0]?.messages.map((message) => message.content).join("\n") ?? "";
    const anthropicPrompt =
      adapters[1]?.requests[0]?.messages.map((message) => message.content).join("\n") ?? "";
    const aggregatorPrompt =
      adapters[2]?.requests[0]?.messages.map((message) => message.content).join("\n") ?? "";

    expect(openaiPrompt).not.toContain("Claude director output");
    expect(anthropicPrompt).not.toContain("GPT director output");
    expect(aggregatorPrompt).toContain("GPT director output");
    expect(aggregatorPrompt).toContain("Claude director output");

    const artifacts = repositories.generation.listArtifacts(result.generationRunId);
    expect(artifacts).toHaveLength(5);
    expect(artifacts.every((artifact) => artifact.artifactType.startsWith("cross_check"))).toBe(
      true
    );
    expect(artifacts.every((artifact) => JSON.parse(artifact.contentJson ?? "{}").status === "proposed")).toBe(
      true
    );
    expect(repositories.manuscripts.listVersions(chapter.id)).toHaveLength(0);
  });

  it("blocks a cross-check before provider calls when a required credential is missing", async () => {
    const adapters = [
      new RecordingAdapter("openai", "GPT director output"),
      new RecordingAdapter("anthropic", "Claude director output"),
      new RecordingAdapter("deepseek", "{}")
    ];
    const { repositories, service, project, book, chapter } = createCrossCheckHarness(adapters, {
      omitCredential: "anthropic"
    });

    await expect(
      service.run({
        type: "main_plot_logic_audit",
        projectId: project.id,
        bookId: book.id,
        chapterId: chapter.id,
        contextText: "主线逻辑检查。",
        budgetCapUsd: 1,
        confirmed: true
      })
    ).rejects.toThrow(/missing credential.*claude-opus-4\.7/i);
    expect(adapters.flatMap((adapter) => adapter.requests)).toHaveLength(0);
    expect(repositories.cost.summarizeRuns({}).runCount).toBe(0);
  });

  it("blocks expensive parallel cross-checks before creating llm_runs", async () => {
    const adapters = [
      new RecordingAdapter("openai", "GPT director output"),
      new RecordingAdapter("anthropic", "Claude director output"),
      new RecordingAdapter("deepseek", "{}")
    ];
    const { repositories, service, project, book, chapter } = createCrossCheckHarness(adapters, {
      expensivePrices: true
    });

    await expect(
      service.run({
        type: "originality_audit",
        projectId: project.id,
        bookId: book.id,
        chapterId: chapter.id,
        contextText: "原创性检查。",
        budgetCapUsd: 0.0001,
        confirmed: true
      })
    ).rejects.toThrow(/budget/i);
    expect(adapters.flatMap((adapter) => adapter.requests)).toHaveLength(0);
    expect(repositories.cost.summarizeRuns({}).runCount).toBe(0);
  });

  it("adds original cross-check prompt templates without reference-repo markers", () => {
    const promptPaths = [
      "skills/wenforge-webnovel-writer/prompts/worldbuilding-gpt-director.zh.md",
      "skills/wenforge-webnovel-writer/prompts/worldbuilding-claude-director.zh.md",
      "skills/wenforge-webnovel-writer/prompts/worldbuilding-aggregator.zh.md",
      "skills/wenforge-webnovel-writer/prompts/originality-audit.zh.md",
      "skills/wenforge-webnovel-writer/prompts/plot-logic-audit.zh.md",
      "skills/wenforge-webnovel-writer/prompts/webnovel-market-fit-audit.zh.md"
    ];

    for (const path of promptPaths) {
      const content = readFileSync(path, "utf8");
      expect(content).toContain("version:");
      expect(content).toContain("{{");
      expect(content).not.toMatch(/inkos|Maliang|LongWriter|chinese-novelist-skill|Codex/i);
    }
  });

  it("keeps routing and cross-check UI away from decrypted credentials", () => {
    const settingsPanel = readFileSync("src/renderer/features/settings/SettingsPanel.tsx", "utf8");
    const workflowPanel = readFileSync(
      "src/renderer/features/workflows/WorkflowGeneratePanel.tsx",
      "utf8"
    );

    expect(settingsPanel).toContain("Premium Webnovel");
    expect(settingsPanel).toContain("Export preset");
    expect(settingsPanel).toContain("Import preset");
    expect(workflowPanel).toContain("世界观交叉检查");
    expect(workflowPanel).toContain("关键章预检");
    expect(`${settingsPanel}\n${workflowPanel}`).not.toContain("encryptedSecretBase64");
    expect(`${settingsPanel}\n${workflowPanel}`).not.toContain("decrypted");
  });
});

class RecordingAdapter implements ProviderAdapter {
  readonly displayName = "Recording Provider";
  readonly capabilities: ProviderAdapterCapabilities = {
    streaming: true,
    json: true,
    tools: false,
    vision: false,
    promptCaching: false
  };
  readonly requests: StreamRequest[] = [];

  constructor(
    readonly id: AIProviderId,
    private readonly responseText: string
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
    if (response.usage) callbacks.onUsage?.(response.usage);
    return response;
  }

  async generateText(
    request: StreamRequest,
    abortSignal: AbortSignal
  ): Promise<NormalizedProviderResponse> {
    void abortSignal;
    this.requests.push(request);
    return {
      text: this.responseText,
      usage: {
        inputTokens: request.messages.reduce((total, message) => total + message.content.length, 0),
        outputTokens: this.responseText.length
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

function createHarness(adapters: ProviderAdapter[]) {
  tempDir = mkdtempSync(join(tmpdir(), "wenforge-phase15b-"));
  const connection = createDatabaseConnection(join(tempDir, "test.sqlite"));
  migrateDatabase(connection.sqlite);
  const repositories = createRepositories(connection.db);
  const credentials = new CredentialService({
    repository: repositories.providerCredentials,
    encryption: new SecretEncryptionService({
      isEncryptionAvailable: () => true,
      encryptString: (value) => Buffer.from([...value].reverse().join(""), "utf8"),
      decryptString: (value) => [...value.toString("utf8")].reverse().join("")
    }),
    redaction: new RedactionService()
  });
  const gateway = new AiGateway({
    repositories,
    credentialService: credentials,
    adapters
  });
  return { connection, repositories, credentials, gateway };
}

function createCrossCheckHarness(
  adapters: RecordingAdapter[],
  options: { omitCredential?: AIProviderId; expensivePrices?: boolean } = {}
) {
  const harness = createHarness(adapters);
  seedModelRoutingData(harness.repositories);
  applyPremiumWebnovelPreset(harness.repositories);
  seedAllPremiumCredentials(harness.credentials, options.omitCredential);
  if (options.expensivePrices) {
    markPremiumPricesExpensive(harness.repositories);
  }
  const project = harness.repositories.projects.create({ name: "P" });
  const book = harness.repositories.books.create({ projectId: project.id, title: "B" });
  const chapter = harness.repositories.chapters.create({
    bookId: book.id,
    chapterIndex: 1,
    title: "C"
  });
  const service = new CrossCheckService({
    repositories: harness.repositories,
    aiGateway: harness.gateway
  });
  return { ...harness, project, book, chapter, service };
}

function seedAllPremiumCredentials(
  credentialService: CredentialService,
  omitProvider?: AIProviderId
): void {
  for (const provider of [
    "openai",
    "anthropic",
    "deepseek",
    "dashscope_qwen",
    "moonshot_kimi"
  ] as const) {
    if (provider === omitProvider) continue;
    credentialService.saveCredential({
      provider,
      displayName: provider,
      apiKey: `${provider}-secret`
    });
  }
}

function markPremiumPricesExpensive(repositories: RepositoryRegistry): void {
  for (const alias of [
    "gpt-5.5",
    "claude-opus-4.7",
    "deepseek-v4-pro",
    "qwen3.7-max",
    "kimi-k2.6"
  ]) {
    const profile = repositories.modelProfiles.findByAlias(alias);
    if (!profile) continue;
    repositories.modelPrices.upsert({
      provider: profile.provider,
      model: profile.model,
      inputPricePerMillion: 1_000_000,
      outputPricePerMillion: 1_000_000,
      currency: "USD",
      effectiveDate: "2026-05-25",
      sourceNote: "Expensive unit-test price",
      enabled: true
    });
  }
}

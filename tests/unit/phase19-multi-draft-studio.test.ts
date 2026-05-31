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
import { createRepositories } from "@main/db/service";
import type { RepositoryRegistry } from "@main/db/service";
import { CredentialService } from "@main/providers/credential-service";
import { RedactionService } from "@main/security/redaction-service";
import { SecretEncryptionService } from "@main/security/secret-encryption-service";
import { MultiDraftService } from "@main/workflows/multi-draft-service";

let tempDir = "";
let currentConnection: ReturnType<typeof createDatabaseConnection> | null = null;

afterEach(() => {
  currentConnection?.sqlite.close();
  currentConnection = null;
  if (tempDir) {
    rmSync(tempDir, { recursive: true, force: true });
    tempDir = "";
  }
});

describe("phase 19 simple multi-draft studio", () => {
  it("adds candidate draft persistence tables", () => {
    const { connection } = createHarness(new DraftRecordingAdapter());
    const tables = connection.sqlite
      .prepare("select name from sqlite_master where type = 'table' order by name")
      .all()
      .map((row) => (row as { name: string }).name);

    expect(tables).toEqual(
      expect.arrayContaining(["draft_candidate_groups", "draft_candidates", "draft_fusions"])
    );
  });

  it("generates fake candidate drafts from one chapter plan without changing canonical manuscript", async () => {
    const { repositories, service, chapter } = createHarness(new DraftRecordingAdapter());
    const beforeCanonical = repositories.manuscripts.getCanonical(chapter.id);
    const group = service.createGroup({
      chapterId: chapter.id,
      presetName: "Balanced Compare",
      targetWords: 1600,
      userInstruction: "同一章纲，生成两个候选稿。"
    });

    const detail = await service.generateCandidates({
      groupId: group.id,
      executionMode: "mock",
      confirmed: true,
      candidates: [
        { provider: "fake", model: "qwen3.7-max", roleLabel: "Qwen: hook and pacing" },
        { provider: "fake", model: "deepseek-v4-pro", roleLabel: "DeepSeek: plot structure" }
      ]
    });

    expect(detail.group.status).toBe("paused");
    expect(detail.candidates).toHaveLength(2);
    expect(detail.candidates.map((candidate) => candidate.status)).toEqual([
      "succeeded",
      "succeeded"
    ]);
    expect(detail.candidates.every((candidate) => candidate.llmRunId)).toBe(true);
    expect(repositories.cost.summarizeRuns({ chapterId: chapter.id }).runCount).toBe(2);
    expect(repositories.manuscripts.getCanonical(chapter.id)?.id).toBe(beforeCanonical?.id);
  });

  it("keeps successful candidates when one candidate fails and retries only the failed candidate", async () => {
    const adapter = new DraftRecordingAdapter({ failingModels: new Set(["kimi-k2.6"]) });
    const { service, chapter } = createHarness(adapter);
    const group = service.createGroup({ chapterId: chapter.id, presetName: "Failure Compare" });

    const firstPass = await service.generateCandidates({
      groupId: group.id,
      executionMode: "mock",
      confirmed: true,
      candidates: [
        { provider: "fake", model: "qwen3.7-max", roleLabel: "Qwen: hook" },
        { provider: "fake", model: "kimi-k2.6", roleLabel: "Kimi: prose" }
      ]
    });

    expect(firstPass.candidates.map((candidate) => candidate.status).sort()).toEqual([
      "failed",
      "succeeded"
    ]);

    adapter.failingModels.clear();
    const failed = firstPass.candidates.find((candidate) => candidate.status === "failed");
    expect(failed).toBeTruthy();
    const retried = await service.retryCandidate({
      candidateId: failed?.id ?? "",
      confirmed: true
    });

    expect(retried.status).toBe("succeeded");
    expect(adapter.requests.filter((request) => request.model === "kimi-k2.6")).toHaveLength(2);
  });

  it("saves candidates and fusions as generated manuscript versions only after explicit action", async () => {
    const { repositories, service, chapter } = createHarness(new DraftRecordingAdapter());
    const group = service.createGroup({ chapterId: chapter.id, presetName: "Fusion Compare" });
    const detail = await service.generateCandidates({
      groupId: group.id,
      executionMode: "mock",
      confirmed: true,
      candidates: [
        { provider: "fake", model: "kimi-k2.6", roleLabel: "Kimi: prose fluency" },
        { provider: "fake", model: "deepseek-v4-pro", roleLabel: "DeepSeek: structure" }
      ]
    });

    const base = detail.candidates[0];
    const reference = detail.candidates[1];
    expect(base).toBeTruthy();
    expect(reference).toBeTruthy();
    const saved = service.saveCandidateAsVersion({
      candidateId: base?.id ?? "",
      title: "Kimi candidate"
    });
    expect(saved.isCanonical).toBe(false);
    expect(repositories.manuscripts.getCanonical(chapter.id)?.title).toBe("人工正稿");

    expect(() =>
      service.setCandidateCanonical({
        candidateId: base?.id ?? "",
        confirmed: false
      })
    ).toThrow(/Confirmation/i);

    expect(() =>
      service.createFusion({
        groupId: group.id,
        baseCandidateId: "",
        referenceCandidateIds: [],
        fusionProvider: "fake",
        fusionModel: "qwen3.7-max"
      })
    ).toThrow(/base candidate/i);

    const fusion = service.createFusion({
      groupId: group.id,
      baseCandidateId: base?.id ?? "",
      referenceCandidateIds: [reference?.id ?? ""],
      fusionProvider: "fake",
      fusionModel: "qwen3.7-max",
      fusionInstruction: "Use Kimi as base, borrow DeepSeek plot order."
    });
    const fused = await service.generateFusion({ fusionId: fusion.id, confirmed: true });
    expect(fused.status).toBe("succeeded");
    expect(fused.resultArtifactId).toMatch(/^artifact_/);
    expect(repositories.manuscripts.getCanonical(chapter.id)?.title).toBe("人工正稿");

    const fusedVersion = service.saveFusionAsVersion({
      fusionId: fused.id,
      title: "Fused candidate"
    });
    expect(fusedVersion.isCanonical).toBe(false);
  });

  it("keeps the renderer simple and avoids secret fields in candidate UI", () => {
    const appSource = readFileSync("src/renderer/app/App.tsx", "utf8");
    const candidatePanelSource = readFileSync(
      "src/renderer/features/workflows/CandidateStudioPanel.tsx",
      "utf8"
    );
    const settingsSource = readFileSync("src/renderer/features/settings/SettingsPanel.tsx", "utf8");

    expect(appSource).toContain("CandidateStudioPanel");
    expect(appSource).not.toContain("Candidates");
    expect(candidatePanelSource).toContain("从同一章节细纲生成 2-3 个候选稿");
    expect(candidatePanelSource).toContain("保留 Kimi 的文风");
    expect(settingsSource).toContain("成本");
    expect(`${candidatePanelSource}\n${settingsSource}`).not.toContain("encryptedSecretBase64");
    expect(`${candidatePanelSource}\n${settingsSource}`).not.toContain("decrypted");
  });
});

class DraftRecordingAdapter implements ProviderAdapter {
  readonly id: AIProviderId = "fake";
  readonly displayName = "Draft Recording Provider";
  readonly capabilities: ProviderAdapterCapabilities = {
    streaming: true,
    json: true,
    tools: false,
    vision: false,
    promptCaching: false
  };
  readonly requests: StreamRequest[] = [];
  readonly failingModels: Set<string>;

  constructor(options: { failingModels?: Set<string> } = {}) {
    this.failingModels = options.failingModels ?? new Set();
  }

  validateConfig(_config: ProviderAdapterConfig): void {
    return undefined;
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
    if (request.model && this.failingModels.has(request.model)) {
      throw new ProviderAdapterError({
        code: "provider_error",
        message: `Draft failed for ${request.model}`,
        retryable: true
      });
    }
    const text = `【${request.model ?? "fake"}】林澈推开雨夜里的门。\n\n他听见城市电流低语，按照同一章纲推进冲突，并在结尾留下具体钩子。`;
    return {
      text,
      usage: {
        inputTokens: request.messages.reduce((total, message) => total + message.content.length, 0),
        outputTokens: text.length
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

function createHarness(adapter: ProviderAdapter) {
  tempDir = mkdtempSync(join(tmpdir(), "wenforge-phase19-"));
  const connection = createDatabaseConnection(join(tempDir, "test.sqlite"));
  currentConnection = connection;
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
  const aiGateway = new AiGateway({
    repositories,
    credentialService,
    adapters: [adapter]
  });
  const project = repositories.projects.create({ name: "候选稿测试" });
  const book = repositories.books.create({ projectId: project.id, title: "雨夜觉醒" });
  const chapter = repositories.chapters.create({
    bookId: book.id,
    chapterIndex: 1,
    title: "雨夜异响",
    targetWords: 1600
  });
  repositories.manuscripts.saveManualVersion({
    chapterId: chapter.id,
    title: "人工正稿",
    contentMarkdown: "人工确认过的正文。",
    isCanonical: true
  });
  repositories.planning.upsertChapterPlan({
    bookId: book.id,
    chapterId: chapter.id,
    chapterIndex: 1,
    title: "雨夜异响",
    targetWords: 1600,
    chapterPromise: "主角发现雨夜电流低语不是幻觉",
    openingHook: "雨声里出现第二个心跳",
    mainConflict: "是否追查旧楼异响",
    emotionalTurn: "从逃避到主动进入旧楼",
    payoff: "拿到异常声纹",
    endingHook: "声纹里出现自己的名字",
    continuityDependenciesJson: JSON.stringify(["雨夜感知规则"]),
    status: "accepted"
  });
  const service = new MultiDraftService({ repositories, aiGateway });
  return { connection, repositories: repositories as RepositoryRegistry, service, project, book, chapter };
}

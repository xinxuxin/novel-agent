import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { EvaluationService } from "@main/eval/evaluation-service";
import { createDatabaseConnection } from "@main/db/connection";
import { migrateDatabase } from "@main/db/migrate";
import { createRepositories } from "@main/db/service";
import type { RepositoryRegistry } from "@main/db/service";
import type { ProviderId } from "@shared/domain/model-routing";

let tempDir = "";

const MODEL_SEEDS: Array<{
  provider: ProviderId;
  model: string;
  alias: string;
  displayName: string;
  price: number;
}> = [
  { provider: "openai", model: "gpt-5.5", alias: "gpt-5.5", displayName: "GPT-5.5", price: 10 },
  {
    provider: "anthropic",
    model: "claude-opus-4.7",
    alias: "claude-opus-4.7",
    displayName: "Claude Opus 4.7",
    price: 12
  },
  {
    provider: "dashscope_qwen",
    model: "qwen3.7-max",
    alias: "qwen3.7-max",
    displayName: "Qwen3.7-Max",
    price: 2
  },
  {
    provider: "moonshot_kimi",
    model: "kimi-k2.6",
    alias: "kimi-k2.6",
    displayName: "Kimi K2.6",
    price: 3
  },
  {
    provider: "deepseek",
    model: "deepseek-v4-pro",
    alias: "deepseek-v4-pro",
    displayName: "DeepSeek V4 Pro",
    price: 1
  }
];

function createHarness() {
  tempDir = mkdtempSync(join(tmpdir(), "wenforge-phase15e-"));
  const connection = createDatabaseConnection(join(tempDir, "test.sqlite"));
  migrateDatabase(connection.sqlite);
  const repositories = createRepositories(connection.db);
  const project = repositories.projects.create({ name: "Eval Project" });
  const book = repositories.books.create({ projectId: project.id, title: "Eval Book" });
  const chapter = repositories.chapters.create({
    bookId: book.id,
    chapterIndex: 1,
    title: "第一章"
  });
  const profiles = MODEL_SEEDS.map((seed) => {
    const profile = repositories.modelProfiles.create({
      provider: seed.provider,
      model: seed.model,
      alias: seed.alias,
      displayName: seed.displayName,
      supportsStreaming: true,
      supportsJson: true,
      defaultTemperature: 0.2,
      enabled: true
    });
    repositories.modelPrices.upsert({
      provider: seed.provider,
      model: seed.model,
      inputPricePerMillion: seed.price,
      outputPricePerMillion: seed.price * 2,
      effectiveDate: "2026-05-26",
      sourceNote: "Phase 15E test editable placeholder"
    });
    return profile;
  });
  return { connection, repositories, project, book, chapter, profiles };
}

afterEach(() => {
  if (tempDir) {
    rmSync(tempDir, { recursive: true, force: true });
    tempDir = "";
  }
});

function scoreProfileOutputs(
  service: EvaluationService,
  repositories: RepositoryRegistry,
  runId: string,
  profileAlias: string,
  score: {
    quality: number;
    cost: number;
    hook?: number;
    continuity?: number;
    logic?: number;
    market?: number;
  }
) {
  const profile = repositories.modelProfiles.list().find((item) => item.alias === profileAlias);
  expect(profile).toBeTruthy();
  const outputs = service
    .listOutputs(runId)
    .filter((output) => output.modelProfileId === profile?.id);
  for (const output of outputs) {
    service.scoreHuman({
      outputId: output.id,
      dimensions: {
        opening_hook: score.hook ?? score.quality,
        conflict_density: score.quality,
        character_voice: score.quality,
        chinese_naturalness: score.quality,
        webnovel_pacing: score.quality,
        emotional_turn: score.quality,
        originality: score.quality,
        continuity_respect: score.continuity ?? score.quality,
        ending_hook: score.hook ?? score.quality,
        low_ai_smell: score.quality,
        structural_logic: score.logic ?? score.quality,
        market_fit: score.market ?? score.quality,
        cost_score: score.cost,
        latency_score: score.cost
      },
      notes: `${profileAlias} human score`
    });
  }
}

describe("phase 15e real-model evaluation and route recommendations", () => {
  it("seeds the Chinese webnovel routing eval v2 suite with the requested cases and task types", () => {
    const { connection, repositories } = createHarness();
    const service = new EvaluationService({
      database: connection.db,
      repositories,
      now: () => "2026-05-26T12:00:00.000Z"
    });

    const suite = service.ensureRouteEvalSuite();
    expect(suite.name).toBe("中文网文路由评测 v2");
    expect(suite.version).toBe("2");
    expect(service.listCases(suite.id).map((item) => item.title)).toEqual([
      "都市异能开篇",
      "玄幻退婚流反转",
      "仙侠宗门危机",
      "无限流副本开局",
      "女频追妻火葬场",
      "末世重生复仇",
      "科幻机甲学院",
      "修真境界突破",
      "群像势力冲突",
      "章末悬念改写",
      "世界观原创性检查",
      "卷纲逻辑漏洞检查"
    ]);

    expect(service.getSupportedRoutingEvalTaskTypes()).toEqual([
      "draft_chapter",
      "webnovel_style_rewrite",
      "suspense_hook_audit",
      "continuity_audit",
      "chapter_outline",
      "revise_chapter",
      "originality_audit",
      "plot_logic_audit"
    ]);
  });

  it("runs the v2 suite with five target models in fake mode, masks blind outputs, and leaves canon untouched", () => {
    const { connection, repositories, book, chapter, profiles } = createHarness();
    repositories.manuscripts.saveManualVersion({
      chapterId: chapter.id,
      title: "Canon",
      contentMarkdown: "人工章节",
      isCanonical: true
    });
    const beforeManuscripts = Number(
      (connection.sqlite.prepare("select count(*) as count from manuscript_versions").get() as {
        count: number;
      }).count
    );
    const service = new EvaluationService({
      database: connection.db,
      repositories,
      now: () => "2026-05-26T12:00:00.000Z"
    });
    const suite = service.ensureRouteEvalSuite();

    const run = service.startRun({
      suiteId: suite.id,
      bookId: book.id,
      mode: "blind_comparison",
      modelProfileIds: profiles.map((profile) => profile.id),
      taskType: "originality_audit",
      qualityMode: "premium_webnovel",
      executionMode: "mock"
    });

    const outputs = service.listOutputs(run.id);
    expect(outputs).toHaveLength(60);
    expect(outputs.every((output) => output.llmRunId)).toBe(true);
    const blind = service.listOutputs(run.id, { blind: true });
    expect(blind.every((output) => output.modelProfileId === null)).toBe(true);
    expect(blind.every((output) => output.provider === null)).toBe(true);
    expect(blind.map((output) => output.blindLabel)).toContain("A");
    expect(
      Number(
        (connection.sqlite.prepare("select count(*) as count from manuscript_versions").get() as {
          count: number;
        }).count
      )
    ).toBe(beforeManuscripts);
  });

  it("tracks advisory LLM judge scores as llm_runs and stores evidence snippets separately from human scores", () => {
    const { connection, repositories, book, profiles } = createHarness();
    const service = new EvaluationService({
      database: connection.db,
      repositories,
      now: () => "2026-05-26T12:00:00.000Z"
    });
    const suite = service.ensureRouteEvalSuite();
    const run = service.startRun({
      suiteId: suite.id,
      bookId: book.id,
      mode: "human_scoring",
      modelProfileIds: [profiles[0]!.id],
      taskType: "draft_chapter",
      qualityMode: "balanced",
      executionMode: "mock"
    });
    const output = service.listOutputs(run.id)[0]!;
    const beforeRuns = Number(
      (connection.sqlite.prepare("select count(*) as count from llm_runs").get() as { count: number })
        .count
    );

    const judgeScore = service.scoreLlmJudge({
      outputId: output.id,
      judgeModelProfileId: profiles[4]!.id,
      executionMode: "mock"
    });

    expect(judgeScore.scorerType).toBe("llm_judge");
    expect(judgeScore.scorerLabel).toContain("advisory");
    expect(judgeScore.notes).toContain("evidence");
    expect(JSON.parse(judgeScore.dimensionsJson)).toHaveProperty("structural_logic");
    expect(
      Number(
        (connection.sqlite.prepare("select count(*) as count from llm_runs").get() as {
          count: number;
        }).count
      )
    ).toBe(beforeRuns + 1);
  });

  it("recommends routes from quality, cost, and task-specific scores without auto-applying changes", () => {
    const { connection, repositories, book, profiles } = createHarness();
    const service = new EvaluationService({
      database: connection.db,
      repositories,
      now: () => "2026-05-26T12:00:00.000Z"
    });
    const suite = service.ensureRouteEvalSuite();
    const run = service.startRun({
      suiteId: suite.id,
      bookId: book.id,
      mode: "blind_comparison",
      modelProfileIds: profiles.map((profile) => profile.id),
      taskType: "draft_chapter",
      qualityMode: "premium_webnovel",
      executionMode: "mock"
    });
    scoreProfileOutputs(service, repositories, run.id, "qwen3.7-max", {
      quality: 8.5,
      cost: 9,
      hook: 9.5,
      market: 9.5
    });
    scoreProfileOutputs(service, repositories, run.id, "claude-opus-4.7", {
      quality: 9.4,
      cost: 5,
      logic: 9.5
    });
    scoreProfileOutputs(service, repositories, run.id, "deepseek-v4-pro", {
      quality: 8,
      cost: 10,
      continuity: 9.7,
      logic: 9.7
    });
    scoreProfileOutputs(service, repositories, run.id, "gpt-5.5", { quality: 9, cost: 6 });
    scoreProfileOutputs(service, repositories, run.id, "kimi-k2.6", {
      quality: 8.2,
      cost: 8,
      hook: 8.8,
      market: 8.6
    });

    const recommendations = service.recommendRoutes(run.id);
    expect(recommendations.items.find((item) => item.id === "daily_author")?.modelAlias).toBe(
      "qwen3.7-max"
    );
    expect(recommendations.items.find((item) => item.id === "key_chapter_author")?.modelAlias).toBe(
      "claude-opus-4.7"
    );
    expect(recommendations.items.find((item) => item.id === "continuity_reviewer")?.modelAlias).toBe(
      "deepseek-v4-pro"
    );
    expect(recommendations.items.every((item) => item.requiresConfirmation)).toBe(true);

    expect(() =>
      service.applyRecommendationToRoute({
        runId: run.id,
        recommendationId: "continuity_reviewer",
        qualityMode: "premium_webnovel",
        confirmed: false
      })
    ).toThrow(/confirmation/i);

    const beforeRoutes = repositories.taskRoutes.list().length;
    const applied = service.applyRecommendationToRoute({
      runId: run.id,
      recommendationId: "continuity_reviewer",
      qualityMode: "premium_webnovel",
      confirmed: true
    });
    expect(applied.taskType).toBe("continuity_audit");
    expect(repositories.taskRoutes.list().length).toBeGreaterThanOrEqual(beforeRoutes);
  });

  it("writes redacted model eval reports without raw outputs unless explicitly requested", () => {
    const { connection, repositories, book, profiles } = createHarness();
    const service = new EvaluationService({
      database: connection.db,
      repositories,
      reportsDir: join(tempDir, "reports", "model-evals"),
      now: () => "2026-05-26T12:00:00.000Z"
    });
    const suite = service.ensureRouteEvalSuite();
    const run = service.startRun({
      suiteId: suite.id,
      bookId: book.id,
      mode: "blind_comparison",
      modelProfileIds: [profiles[0]!.id, profiles[4]!.id],
      taskType: "plot_logic_audit",
      qualityMode: "premium_webnovel",
      executionMode: "mock"
    });
    const output = service.listOutputs(run.id)[0]!;
    service.scoreHuman({
      outputId: output.id,
      dimensions: {
        opening_hook: 8,
        conflict_density: 8,
        character_voice: 8,
        chinese_naturalness: 8,
        webnovel_pacing: 8,
        emotional_turn: 8,
        originality: 8,
        continuity_respect: 8,
        ending_hook: 8,
        low_ai_smell: 8,
        structural_logic: 9,
        market_fit: 8,
        cost_score: 8,
        latency_score: 8
      },
      notes: "Authorization: Bearer sk-report-secret should be redacted"
    });

    const report = service.exportReport({ runId: run.id, includeRawOutputs: false });
    const content = readFileSync(report.filePath, "utf8");
    expect(report.filePath).toContain("reports/model-evals");
    expect(content).toContain("Sensitive values omitted");
    expect(content).toContain("recommended route changes");
    expect(content).not.toContain("sk-report-secret");
    expect(content).not.toContain("Bearer");
    expect(content).not.toContain(output.outputText);
  });
});

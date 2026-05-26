import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { CostDashboardService, PricingRegistryService } from "@main/costs/cost-dashboard-service";
import { EvaluationService } from "@main/eval/evaluation-service";
import { createDatabaseConnection } from "@main/db/connection";
import { migrateDatabase } from "@main/db/migrate";
import { createRepositories } from "@main/db/service";
import type { RepositoryRegistry } from "@main/db/service";
import type { LLMTaskType } from "@contracts/ai";

let tempDir = "";

function createHarness() {
  tempDir = mkdtempSync(join(tmpdir(), "wenforge-phase11-"));
  const connection = createDatabaseConnection(join(tempDir, "test.sqlite"));
  migrateDatabase(connection.sqlite);
  const repositories = createRepositories(connection.db);
  const project = repositories.projects.create({ name: "Cost Project" });
  const book = repositories.books.create({ projectId: project.id, title: "Cost Book" });
  const chapterOne = repositories.chapters.create({
    bookId: book.id,
    chapterIndex: 1,
    title: "第一章"
  });
  const chapterTwo = repositories.chapters.create({
    bookId: book.id,
    chapterIndex: 2,
    title: "第二章"
  });
  return { connection, repositories, project, book, chapterOne, chapterTwo };
}

afterEach(() => {
  if (tempDir) {
    rmSync(tempDir, { recursive: true, force: true });
    tempDir = "";
  }
});

function createFinishedRun(
  repositories: RepositoryRegistry,
  sqlite: ReturnType<typeof createDatabaseConnection>["sqlite"],
  input: {
    projectId: string;
    bookId: string;
    chapterId: string;
    provider: string;
    model: string;
    taskType: LLMTaskType;
    startedAt: string;
    finalCost: number;
    estimatedCost: number;
    usageSource: "estimated" | "provider" | "mixed";
    latencyMs?: number;
    errorMessage?: string | null;
  }
) {
  const run = repositories.cost.createLlmRun({
    projectId: input.projectId,
    bookId: input.bookId,
    chapterId: input.chapterId,
    provider: input.provider,
    model: input.model,
    taskType: input.taskType,
    inputTokensEstimated: 1000,
    estimatedCostLive: input.estimatedCost,
    currency: "USD",
    promptHash: "prompt_hash_only"
  });
  repositories.cost.finishRun(run.id, {
    status: input.errorMessage ? "failed" : "succeeded",
    outputTokensEstimatedLive: 500,
    inputTokensReported: input.usageSource === "estimated" ? null : 1100,
    outputTokensReported: input.usageSource === "estimated" ? null : 650,
    usageSource: input.usageSource,
    estimatedCostLive: input.estimatedCost,
    finalCost: input.finalCost,
    latencyMs: input.latencyMs ?? 1000,
    errorCode: input.errorMessage ? "provider_error" : null,
    errorMessage: input.errorMessage ?? null,
    responseHash: "response_hash_only"
  });
  sqlite
    .prepare("update llm_runs set request_started_at = ?, created_at = ? where id = ?")
    .run(input.startedAt, input.startedAt, run.id);
  return repositories.cost.getRun(run.id)!;
}

describe("phase 11 cost dashboard and model evaluation", () => {
  it("aggregates cost visibility, budget summaries, stale prices, and redacted CSV export", () => {
    const { connection, repositories, project, book, chapterOne, chapterTwo } = createHarness();
    repositories.chapters.setStatus(chapterOne.id, "approved");
    repositories.manuscripts.saveManualVersion({
      chapterId: chapterOne.id,
      title: "Canonical",
      contentMarkdown: "灵气".repeat(1000),
      isCanonical: true
    });
    repositories.modelPrices.upsert({
      provider: "openai",
      model: "fast",
      inputPricePerMillion: 1,
      outputPricePerMillion: 3,
      effectiveDate: "2026-05-20",
      sourceNote: "Fresh price",
      enabled: true
    });
    const stalePrice = repositories.modelPrices.upsert({
      provider: "deepseek",
      model: "old",
      inputPricePerMillion: 0.5,
      outputPricePerMillion: 1,
      effectiveDate: "2025-01-01",
      sourceNote: "Stale price",
      enabled: true
    });

    const active = createFinishedRun(repositories, connection.sqlite, {
      projectId: project.id,
      bookId: book.id,
      chapterId: chapterOne.id,
      provider: "openai",
      model: "fast",
      taskType: "draft_chapter",
      startedAt: "2026-05-25T10:00:00.000Z",
      estimatedCost: 0.045,
      finalCost: 0.05,
      usageSource: "provider",
      latencyMs: 1200
    });
    createFinishedRun(repositories, connection.sqlite, {
      projectId: project.id,
      bookId: book.id,
      chapterId: chapterTwo.id,
      provider: "openai",
      model: "fast",
      taskType: "continuity_audit",
      startedAt: "2026-05-25T11:00:00.000Z",
      estimatedCost: 0.019,
      finalCost: 0.02,
      usageSource: "provider",
      latencyMs: 800
    });
    createFinishedRun(repositories, connection.sqlite, {
      projectId: project.id,
      bookId: book.id,
      chapterId: chapterTwo.id,
      provider: "deepseek",
      model: "old",
      taskType: "revise_chapter",
      startedAt: "2026-05-15T09:00:00.000Z",
      estimatedCost: 0.03,
      finalCost: 0.03,
      usageSource: "estimated",
      latencyMs: 1400,
      errorMessage: "Authorization: Bearer sk-secret-should-not-leak"
    });

    const service = new CostDashboardService({
      database: connection.db,
      repositories,
      now: () => "2026-05-25T12:00:00.000Z",
      priceStaleAfterDays: 90
    });
    const dashboard = service.getDashboard({
      projectId: project.id,
      activeRunId: active.id,
      sessionSince: "2026-05-25T00:00:00.000Z"
    });

    expect(dashboard.activeRunCost.finalCost).toBeCloseTo(0.05);
    expect(dashboard.sessionCost.finalCost).toBeCloseTo(0.07);
    expect(dashboard.todayCost.finalCost).toBeCloseTo(0.07);
    expect(dashboard.currentProjectCost.finalCost).toBeCloseTo(0.1);
    expect(dashboard.monthToDateCost.finalCost).toBeCloseTo(0.1);
    expect(dashboard.byProvider.find((group) => group.key === "openai")?.finalCost).toBeCloseTo(
      0.07
    );
    expect(dashboard.byModel.find((group) => group.key === "openai/fast")?.runCount).toBe(2);
    expect(dashboard.byTaskType.map((group) => group.key)).toContain("draft_chapter");
    expect(dashboard.byWorkflowNode.map((group) => group.key)).toContain("draft_chapter");
    expect(dashboard.byChapter.find((group) => group.key === chapterOne.id)?.finalCost).toBeCloseTo(
      0.05
    );
    expect(dashboard.estimatedVsReported.providerReportedCost).toBeCloseTo(0.07);
    expect(dashboard.estimatedVsReported.estimatedOnlyCost).toBeCloseTo(0.03);
    expect(dashboard.averageCostPerApprovedChapter).toBeCloseTo(0.1);
    expect(dashboard.averageCostPer1kChineseCharacters).toBeCloseTo(0.05);
    expect(dashboard.stalePriceWarnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ priceId: stalePrice.id, provider: "deepseek", model: "old" })
      ])
    );

    const csv = service.exportCsv({ projectId: project.id });
    expect(csv.rowCount).toBe(3);
    expect(csv.content).toContain("provider,model,task_type");
    expect(csv.content).not.toContain("sk-secret");
    expect(csv.content).not.toContain("Bearer");
  });

  it("imports and exports price registry JSON and reports routes with missing or stale prices", () => {
    const { connection, repositories } = createHarness();
    const pricing = new PricingRegistryService({
      database: connection.db,
      repositories,
      now: () => "2026-05-25T12:00:00.000Z"
    });
    const freshProfile = repositories.modelProfiles.create({
      provider: "openai",
      model: "fresh-model",
      displayName: "Fresh Model"
    });
    const staleProfile = repositories.modelProfiles.create({
      provider: "deepseek",
      model: "stale-model",
      displayName: "Stale Model"
    });
    repositories.taskRoutes.upsert({
      taskType: "draft_chapter",
      qualityMode: "balanced",
      primaryModelProfileId: freshProfile.id,
      temperature: 0.7,
      maxOutputTokens: 4000
    });
    repositories.taskRoutes.upsert({
      taskType: "continuity_audit",
      qualityMode: "balanced",
      primaryModelProfileId: staleProfile.id,
      temperature: 0.2,
      maxOutputTokens: 2000
    });

    const result = pricing.importJson(
      JSON.stringify({
        prices: [
          {
            provider: "openai",
            model: "fresh-model",
            inputPricePerMillion: 2,
            outputPricePerMillion: 6,
            currency: "USD",
            effectiveDate: "2026-05-20",
            sourceNote: "Imported"
          },
          {
            provider: "deepseek",
            model: "stale-model",
            inputPricePerMillion: 1,
            outputPricePerMillion: 2,
            currency: "USD",
            effectiveDate: "2025-01-01",
            sourceNote: "Imported stale"
          }
        ]
      })
    );

    expect(result.importedCount).toBe(2);
    expect(JSON.parse(pricing.exportJson()).prices).toHaveLength(2);
    const warnings = pricing.listRoutePriceWarnings({ staleAfterDays: 90 });
    expect(warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ taskType: "continuity_audit", warningType: "stale_price" })
      ])
    );
  });

  it("runs built-in Chinese web novel evals in mock mode, masks blind outputs, scores, and promotes a winner only with confirmation", () => {
    const { connection, repositories, book, chapterOne } = createHarness();
    repositories.manuscripts.saveManualVersion({
      chapterId: chapterOne.id,
      title: "Canon",
      contentMarkdown: "人工章节",
      isCanonical: true
    });
    const beforeManuscripts = Number(
      (
        connection.sqlite.prepare("select count(*) as count from manuscript_versions").get() as {
          count: number;
        }
      ).count
    );
    const profileA = repositories.modelProfiles.create({
      provider: "openai",
      model: "model-a",
      displayName: "Model A"
    });
    const profileB = repositories.modelProfiles.create({
      provider: "deepseek",
      model: "model-b",
      displayName: "Model B"
    });
    repositories.modelPrices.upsert({
      provider: "openai",
      model: "model-a",
      inputPricePerMillion: 1,
      outputPricePerMillion: 3,
      effectiveDate: "2026-05-20",
      sourceNote: "Eval price"
    });
    repositories.modelPrices.upsert({
      provider: "deepseek",
      model: "model-b",
      inputPricePerMillion: 0.5,
      outputPricePerMillion: 1,
      effectiveDate: "2026-05-20",
      sourceNote: "Eval price"
    });

    const service = new EvaluationService({
      database: connection.db,
      repositories,
      now: () => "2026-05-25T12:00:00.000Z"
    });
    const suite = service.ensureBuiltInSuite();
    expect(suite.name).toBe("中文网文基础评测 v1");
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
      "章末悬念改写"
    ]);

    const run = service.startRun({
      suiteId: suite.id,
      bookId: book.id,
      mode: "blind_comparison",
      modelProfileIds: [profileA.id, profileB.id],
      taskType: "draft_chapter",
      qualityMode: "balanced",
      executionMode: "mock"
    });
    const outputs = service.listOutputs(run.id);
    expect(outputs).toHaveLength(20);
    expect(outputs.every((output) => output.llmRunId)).toBe(true);
    const blind = service.listOutputs(run.id, { blind: true });
    expect(blind[0]?.blindLabel).toBe("A");
    expect(blind[0]?.modelProfileId).toBeNull();
    expect(blind[0]?.model).toBeNull();
    expect(
      Number(
        (
          connection.sqlite.prepare("select count(*) as count from manuscript_versions").get() as {
            count: number;
          }
        ).count
      )
    ).toBe(beforeManuscripts);

    service.scoreHuman({
      outputId: outputs[0]!.id,
      dimensions: {
        opening_hook: 8,
        conflict_density: 7,
        character_voice: 8,
        chinese_naturalness: 9,
        webnovel_pacing: 8,
        emotional_turn: 7,
        originality: 7,
        continuity_respect: 8,
        ending_hook: 9,
        low_ai_smell: 8,
        cost_score: 9,
        latency_score: 8
      },
      notes: "Strong opening."
    });
    const leaderboard = service.leaderboard(run.id);
    expect(leaderboard[0]?.qualityScore).toBeGreaterThan(0);
    expect(leaderboard[0]?.costAdjustedScore).toBeGreaterThan(0);

    expect(() =>
      service.promoteWinnerToRoute({
        evalRunId: run.id,
        outputId: outputs[0]!.id,
        taskType: "draft_chapter",
        qualityMode: "balanced",
        confirmed: false
      })
    ).toThrow(/confirmation/i);

    const promoted = service.promoteWinnerToRoute({
      evalRunId: run.id,
      outputId: outputs[0]!.id,
      taskType: "draft_chapter",
      qualityMode: "balanced",
      confirmed: true
    });
    expect(promoted.primaryModelProfileId).toBe(outputs[0]!.modelProfileId);
  });
});

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { CostCalculator } from "@main/ai/cost-calculator";
import { CostForecastService } from "@main/costs/cost-forecast-service";
import { UsageCalibrationService } from "@main/costs/usage-calibration-service";
import { createDatabaseConnection } from "@main/db/connection";
import { migrateDatabase } from "@main/db/migrate";
import { createRepositories, seedModelRoutingData } from "@main/db/service";
import type { RepositoryRegistry } from "@main/db/service";

let tempDir = "";

function createHarness() {
  tempDir = mkdtempSync(join(tmpdir(), "wenforge-phase15d-"));
  const connection = createDatabaseConnection(join(tempDir, "test.sqlite"));
  migrateDatabase(connection.sqlite);
  const repositories = createRepositories(connection.db);
  const project = repositories.projects.create({ name: "Forecast Project" });
  const book = repositories.books.create({ projectId: project.id, title: "Forecast Book" });
  const chapter = repositories.chapters.create({
    bookId: book.id,
    chapterIndex: 1,
    title: "第一章",
    targetWords: 1600
  });
  return { connection, repositories, project, book, chapter };
}

function createRoutedModel(
  repositories: RepositoryRegistry,
  input: {
    provider: "openai" | "dashscope_qwen";
    model: string;
    taskTypes: Array<"chapter_outline" | "draft_chapter" | "revise_chapter">;
  }
) {
  const profile = repositories.modelProfiles.create({
    provider: input.provider,
    model: input.model,
    displayName: input.model
  });
  const price = repositories.modelPrices.upsert({
    provider: input.provider,
    model: input.model,
    inputPricePerMillion: 10,
    outputPricePerMillion: 20,
    effectiveDate: "2026-05-25",
    sourceNote: "Test base price"
  });
  for (const taskType of input.taskTypes) {
    repositories.taskRoutes.upsert({
      taskType,
      qualityMode: "balanced",
      primaryModelProfileId: profile.id,
      temperature: 0,
      maxOutputTokens: 2000
    });
  }
  return { profile, price };
}

afterEach(() => {
  if (tempDir) {
    rmSync(tempDir, { recursive: true, force: true });
    tempDir = "";
  }
});

describe("phase 15d cost calibration, price tiers, and forecasting", () => {
  it("selects token and deployment-mode price tiers before falling back to base prices", () => {
    const calculator = new CostCalculator();
    const basePrice = {
      inputPricePerMillion: 10,
      outputPricePerMillion: 20,
      cachedInputPricePerMillion: null,
      currency: "USD"
    };
    const tiers = [
      {
        id: "tier-small",
        deploymentMode: "global",
        minInputTokens: 0,
        maxInputTokens: 1_000,
        inputPricePerMillion: 1,
        outputPricePerMillion: 2,
        cachedInputPricePerMillion: null,
        cacheWritePricePerMillion: null,
        currency: "USD",
        enabled: true
      },
      {
        id: "tier-large",
        deploymentMode: "global",
        minInputTokens: 1_001,
        maxInputTokens: null,
        inputPricePerMillion: 3,
        outputPricePerMillion: 4,
        cachedInputPricePerMillion: 0.5,
        cacheWritePricePerMillion: 0.75,
        currency: "USD",
        enabled: true
      },
      {
        id: "tier-qwen-cn",
        deploymentMode: "chinese_mainland",
        minInputTokens: 0,
        maxInputTokens: null,
        inputPricePerMillion: 5,
        outputPricePerMillion: 6,
        cachedInputPricePerMillion: null,
        cacheWritePricePerMillion: null,
        currency: "USD",
        enabled: true
      }
    ];

    const large = calculator.calculateWithPriceSelection({
      usage: { inputTokens: 2_000, outputTokens: 1_000, cachedInputTokens: 500 },
      basePrice,
      tiers,
      deploymentMode: "global",
      estimated: false
    });
    expect(large.selectedTier?.id).toBe("tier-large");
    expect(large.cost.totalCost).toBeCloseTo(0.01025);
    expect(large.warnings).toEqual([]);

    const regional = calculator.calculateWithPriceSelection({
      usage: { inputTokens: 2_000, outputTokens: 1_000 },
      basePrice,
      tiers,
      deploymentMode: "chinese_mainland",
      estimated: true
    });
    expect(regional.selectedTier?.id).toBe("tier-qwen-cn");
    expect(regional.cost.totalCost).toBeCloseTo(0.016);

    const fallback = calculator.calculateWithPriceSelection({
      usage: { inputTokens: 2_000, outputTokens: 1_000 },
      basePrice,
      tiers,
      deploymentMode: "eu",
      estimated: true
    });
    expect(fallback.selectedTier).toBeNull();
    expect(fallback.cost.totalCost).toBeCloseTo(0.04);
    expect(fallback.warnings).toContain("no_matching_price_tier");
  });

  it("creates price tier, calibration, and quota tables and seeds editable placeholder tiers", () => {
    const { connection, repositories } = createHarness();
    seedModelRoutingData(repositories);

    expect(
      connection.sqlite
        .prepare("select name from sqlite_master where type = 'table' and name = ?")
        .get("model_price_tiers")
    ).toBeTruthy();
    expect(
      connection.sqlite
        .prepare("select name from sqlite_master where type = 'table' and name = ?")
        .get("usage_calibration")
    ).toBeTruthy();
    expect(
      connection.sqlite
        .prepare("select name from sqlite_master where type = 'table' and name = ?")
        .get("provider_quota_notes")
    ).toBeTruthy();

    const qwenTiers = repositories.modelPriceTiers.list({
      provider: "dashscope_qwen",
      model: "qwen3-max"
    });
    expect(qwenTiers.map((tier) => tier.deploymentMode).sort()).toEqual([
      "chinese_mainland",
      "eu",
      "global",
      "hong_kong",
      "international"
    ]);
    expect(qwenTiers.every((tier) => tier.sourceNote.includes("User must confirm"))).toBe(true);
  });

  it("updates usage calibration factors from provider-reported usage", () => {
    const { repositories } = createHarness();
    const service = new UsageCalibrationService({
      repositories,
      now: () => "2026-05-26T10:00:00.000Z"
    });

    service.recordSample({
      provider: "openai",
      model: "gpt-test",
      inputTokensEstimated: 1_000,
      outputTokensEstimated: 500,
      inputTokensReported: 1_250,
      outputTokensReported: 650
    });
    service.recordSample({
      provider: "openai",
      model: "gpt-test",
      inputTokensEstimated: 2_000,
      outputTokensEstimated: 800,
      inputTokensReported: 2_200,
      outputTokensReported: 880
    });

    const calibration = service.get("openai", "gpt-test");
    expect(calibration?.samples).toBe(2);
    expect(calibration?.inputEstimateFactor).toBeCloseTo(1.175);
    expect(calibration?.outputEstimateFactor).toBeCloseTo(1.2);
    expect(calibration?.confidence).toBeGreaterThan(0);

    const adjusted = service.applyToEstimate("openai", "gpt-test", {
      inputTokens: 1_000,
      outputTokens: 1_000
    });
    expect(adjusted.inputTokens).toBe(1175);
    expect(adjusted.outputTokens).toBe(1200);
  });

  it("forecasts chapter cost with tiers, budget warnings, and manual quota remaining", () => {
    const { repositories, project, book, chapter } = createHarness();
    const { price } = createRoutedModel(repositories, {
      provider: "openai",
      model: "forecast-model",
      taskTypes: ["chapter_outline", "draft_chapter", "revise_chapter"]
    });
    repositories.modelPriceTiers.upsert({
      modelPriceId: price.id,
      provider: "openai",
      model: "forecast-model",
      deploymentMode: "global",
      minInputTokens: 0,
      maxInputTokens: null,
      inputPricePerMillion: 2,
      outputPricePerMillion: 6,
      effectiveDate: "2026-05-25",
      sourceNote: "Test global tier"
    });
    repositories.budgetPolicies.update({
      projectBudgetCap: 0.05,
      warningThresholdPercent: 50,
      onBudgetExceeded: "warn"
    });
    repositories.providerQuotas.upsert({
      provider: "openai",
      creditBalance: 0.2,
      monthlyBudget: 0.4,
      freeQuotaRemaining: 0.05,
      refreshedAt: "2026-05-26",
      notes: "Manual test quota"
    });

    const service = new CostForecastService({
      repositories,
      now: () => "2026-05-26T10:00:00.000Z"
    });
    const nextChapter = service.forecastChapters({
      projectId: project.id,
      bookId: book.id,
      chapterId: chapter.id,
      qualityMode: "balanced",
      chapterCount: 1,
      deploymentModeByProvider: { openai: "global" }
    });
    expect(nextChapter.nodes.map((node) => node.taskType)).toContain("draft_chapter");
    expect(nextChapter.totalExpectedCost).toBeGreaterThan(0);
    expect(nextChapter.lowCost).toBeLessThan(nextChapter.totalExpectedCost);
    expect(nextChapter.highCost).toBeGreaterThan(nextChapter.totalExpectedCost);
    expect(nextChapter.warnings).toContain("project_budget_warning");

    const hundred = service.forecastChapters({
      projectId: project.id,
      bookId: book.id,
      chapterId: chapter.id,
      qualityMode: "balanced",
      chapterCount: 100,
      deploymentModeByProvider: { openai: "global" }
    });
    expect(hundred.chapterCount).toBe(100);
    expect(hundred.totalExpectedCost).toBeCloseTo(nextChapter.totalExpectedCost * 100);

    const quota = service.getProviderQuotaSummary({
      forecast: nextChapter,
      providers: ["openai", "dashscope_qwen", "anthropic", "deepseek"]
    });
    expect(quota.providers.find((item) => item.provider === "openai")?.chaptersRemaining).toBe(
      Math.floor(0.25 / nextChapter.providerCosts.openai!)
    );
    expect(quota.limitingProvider?.provider).toBe("openai");
    expect(quota.warnings).toContain("OpenAI low balance");
  });

  it("compares economy, balanced, and premium webnovel route costs without real provider calls", () => {
    expect(process.env.RUN_REAL_PROVIDER_CHECKS).not.toBe("true");
    const { repositories, project, book, chapter } = createHarness();
    createRoutedModel(repositories, {
      provider: "openai",
      model: "comparison-model",
      taskTypes: ["chapter_outline", "draft_chapter", "revise_chapter"]
    });
    const service = new CostForecastService({
      repositories,
      now: () => "2026-05-26T10:00:00.000Z"
    });

    const comparison = service.compareQualityModes({
      projectId: project.id,
      bookId: book.id,
      chapterId: chapter.id,
      chapterCount: 10
    });

    expect(comparison.forecasts.map((item) => item.qualityMode)).toEqual([
      "economy",
      "balanced",
      "premium_webnovel"
    ]);
    expect(comparison.forecasts.find((item) => item.qualityMode === "balanced")).toBeTruthy();
  });
});

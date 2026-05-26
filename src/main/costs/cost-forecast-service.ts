import type {
  CostForecast,
  CostForecastRequest,
  ForecastNode,
  ProviderQuotaSummary,
  QualityModeComparison
} from "@contracts/cost-dashboard";
import type { ModelPriceRecord, ModelPriceTierRecord } from "@contracts/model-routing";
import { CostCalculator } from "@main/ai/cost-calculator";
import type { RepositoryRegistry } from "@main/db/service";
import { UsageCalibrationService } from "./usage-calibration-service";
import type { ProviderId, QualityMode, TaskType } from "@shared/domain/model-routing";

export interface CostForecastServiceOptions {
  repositories: RepositoryRegistry;
  now?: () => string;
}

interface TaskTokenPlan {
  taskType: TaskType;
  inputTokens: number;
  outputTokens: number;
}

const FORECAST_TASKS: TaskTokenPlan[] = [
  { taskType: "chapter_outline", inputTokens: 6_000, outputTokens: 1_200 },
  { taskType: "scene_cards", inputTokens: 7_000, outputTokens: 1_800 },
  { taskType: "draft_chapter", inputTokens: 9_000, outputTokens: 2_800 },
  { taskType: "suspense_hook_audit", inputTokens: 8_000, outputTokens: 900 },
  { taskType: "continuity_audit", inputTokens: 9_000, outputTokens: 1_200 },
  { taskType: "revise_chapter", inputTokens: 11_000, outputTokens: 2_800 },
  { taskType: "state_settlement", inputTokens: 8_000, outputTokens: 1_200 }
];

const COMPARE_MODES: QualityMode[] = ["economy", "balanced", "premium_webnovel"];

const LOW_BALANCE_LABELS: Partial<Record<ProviderId, string>> = {
  dashscope_qwen: "Qwen",
  anthropic: "Claude",
  openai: "OpenAI",
  deepseek: "DeepSeek"
};

export class CostForecastService {
  private readonly calculator = new CostCalculator();
  private readonly calibration: UsageCalibrationService;

  constructor(private readonly options: CostForecastServiceOptions) {
    this.calibration = new UsageCalibrationService(options);
  }

  forecastChapters(input: CostForecastRequest = {}): CostForecast {
    const chapterCount = input.chapterCount ?? 1;
    const qualityMode = input.qualityMode ?? "balanced";
    const nodes = FORECAST_TASKS.map((task) =>
      this.forecastNode(task, qualityMode, input.deploymentModeByProvider ?? {})
    );
    const nodeExpected = sum(nodes.map((node) => node.expectedCost));
    const totalExpectedCost = roundCost(nodeExpected * chapterCount);
    const policy = this.options.repositories.budgetPolicies.getDefault();
    const remainingProjectBudget =
      typeof policy.projectBudgetCap === "number"
        ? roundCost(Math.max(policy.projectBudgetCap - totalExpectedCost, 0))
        : null;
    const warnings = Array.from(new Set(nodes.flatMap((node) => node.warnings)));
    if (
      typeof policy.projectBudgetCap === "number" &&
      totalExpectedCost >=
        policy.projectBudgetCap * Math.max(0, policy.warningThresholdPercent) / 100
    ) {
      warnings.push("project_budget_warning");
    }
    return {
      projectId: input.projectId ?? null,
      bookId: input.bookId ?? null,
      chapterId: input.chapterId ?? null,
      qualityMode,
      chapterCount,
      nodes,
      lowCost: roundCost(totalExpectedCost * 0.75),
      totalExpectedCost,
      highCost: roundCost(totalExpectedCost * 1.35),
      currency: nodes.find((node) => node.currency)?.currency ?? "USD",
      providerCosts: nodes.reduce<Record<string, number>>((accumulator, node) => {
        if (node.provider) {
          accumulator[node.provider] = roundCost(
            (accumulator[node.provider] ?? 0) + node.expectedCost * chapterCount
          );
        }
        return accumulator;
      }, {}),
      remainingProjectBudget,
      warnings
    };
  }

  compareQualityModes(input: Omit<CostForecastRequest, "qualityMode">): QualityModeComparison {
    return {
      forecasts: COMPARE_MODES.map((qualityMode) => {
        const forecast = this.forecastChapters({ ...input, qualityMode });
        return {
          qualityMode: forecast.qualityMode,
          totalExpectedCost: forecast.totalExpectedCost,
          currency: forecast.currency
        };
      })
    };
  }

  getProviderQuotaSummary(input: {
    forecast: CostForecast;
    providers?: ProviderId[] | undefined;
  }): ProviderQuotaSummary {
    const providers =
      input.providers ?? (Object.keys(input.forecast.providerCosts) as ProviderId[]);
    const summaries = providers.map((provider) => {
      const quota = this.options.repositories.providerQuotas.get(provider);
      const expectedCostPerChapter =
        (input.forecast.providerCosts[provider] ?? 0) / input.forecast.chapterCount;
      const availableBalance = roundCost(
        (quota?.creditBalance ?? 0) + (quota?.freeQuotaRemaining ?? 0)
      );
      return {
        provider,
        availableBalance,
        expectedCostPerChapter,
        chaptersRemaining:
          expectedCostPerChapter > 0 ? Math.floor(availableBalance / expectedCostPerChapter) : null,
        refreshedAt: quota?.refreshedAt ?? null,
        notes: quota?.notes ?? null
      };
    });
    const limitingProvider =
      summaries
        .filter((summary) => summary.chaptersRemaining !== null)
        .sort((left, right) => (left.chaptersRemaining ?? 0) - (right.chaptersRemaining ?? 0))[0] ??
      null;
    const warnings = summaries.flatMap((summary) => {
      const label = LOW_BALANCE_LABELS[summary.provider];
      if (!label || summary.expectedCostPerChapter <= 0) return [];
      return summary.availableBalance <= summary.expectedCostPerChapter * 10
        ? [`${label} low balance`]
        : [];
    });
    return {
      providers: summaries,
      limitingProvider: limitingProvider
        ? {
            provider: limitingProvider.provider,
            chaptersRemaining: limitingProvider.chaptersRemaining
          }
        : null,
      warnings
    };
  }

  private forecastNode(
    task: TaskTokenPlan,
    qualityMode: QualityMode,
    deploymentModeByProvider: Partial<Record<ProviderId, string>>
  ): ForecastNode {
    const route = this.options.repositories.taskRoutes.find(task.taskType, qualityMode);
    if (!route?.enabled) {
      return missingNode(task, "route_unavailable");
    }
    const profile = this.options.repositories.modelProfiles.get(route.primaryModelProfileId);
    if (!profile?.enabled) {
      return missingNode(task, "model_profile_unavailable");
    }
    const calibrated = this.calibration.applyToEstimate(profile.provider, profile.model, {
      inputTokens: task.inputTokens,
      outputTokens: task.outputTokens
    });
    const price = this.options.repositories.modelPrices.findActive(profile.provider, profile.model);
    if (!price) {
      return {
        ...missingNode(task, "missing_price"),
        provider: profile.provider,
        model: profile.model
      };
    }
    const tiers = this.options.repositories.modelPriceTiers.list({
      provider: profile.provider,
      model: profile.model
    });
    const selection = this.calculator.calculateWithPriceSelection({
      usage: {
        inputTokens: calibrated.inputTokens,
        outputTokens: calibrated.outputTokens
      },
      basePrice: toCalculatorPrice(price),
      tiers: tiers.map(toCalculatorTier),
      deploymentMode: deploymentModeByProvider[profile.provider],
      estimated: true
    });
    return {
      taskType: task.taskType,
      provider: profile.provider,
      model: profile.model,
      inputTokens: calibrated.inputTokens,
      outputTokens: calibrated.outputTokens,
      expectedCost: selection.cost.totalCost,
      currency: selection.cost.currency,
      selectedTierId: selection.selectedTier?.id ?? null,
      warnings: calibrated.calibrated
        ? [...selection.warnings, "calibrated_estimate"]
        : selection.warnings
    };
  }
}

function missingNode(task: TaskTokenPlan, warning: string): ForecastNode {
  return {
    taskType: task.taskType,
    provider: null,
    model: null,
    inputTokens: task.inputTokens,
    outputTokens: task.outputTokens,
    expectedCost: 0,
    currency: "USD",
    selectedTierId: null,
    warnings: [warning]
  };
}

function toCalculatorPrice(price: ModelPriceRecord) {
  return {
    inputPricePerMillion: price.inputPricePerMillion,
    outputPricePerMillion: price.outputPricePerMillion,
    cachedInputPricePerMillion: price.cachedInputPricePerMillion,
    currency: price.currency
  };
}

function toCalculatorTier(tier: ModelPriceTierRecord) {
  return {
    id: tier.id,
    deploymentMode: tier.deploymentMode,
    minInputTokens: tier.minInputTokens,
    maxInputTokens: tier.maxInputTokens,
    inputPricePerMillion: tier.inputPricePerMillion,
    outputPricePerMillion: tier.outputPricePerMillion,
    cachedInputPricePerMillion: tier.cachedInputPricePerMillion,
    cacheWritePricePerMillion: tier.cacheWritePricePerMillion,
    currency: tier.currency,
    enabled: tier.enabled
  };
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function roundCost(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

import type {
  ModelPriceRecord,
  ModelProfileRecord,
  ModelRouteResolution,
  RoutePreviewContext
} from "@contracts/model-routing";
import type { RoutingSettings } from "@contracts/settings";
import type { ProviderId } from "@shared/domain/model-routing";
import type { QualityMode, TaskType } from "@shared/domain/model-routing";
import type { ModelPriceRepository } from "@main/db/repositories/model-price-repository";
import type { ModelPriceTierRepository } from "@main/db/repositories/model-price-tier-repository";
import type { ModelProfileRepository } from "@main/db/repositories/model-profile-repository";
import type { ProviderCredentialRepository } from "@main/db/repositories/provider-credential-repository";
import type { ProviderHealthRepository } from "@main/db/repositories/provider-health-repository";
import type { TaskRouteRepository } from "@main/db/repositories/task-route-repository";
import { CostCalculator } from "@main/ai/cost-calculator";
import { isPriceStale } from "./model-pricing";

export interface ModelRouterOptions {
  credentials: ProviderCredentialRepository;
  modelProfiles: ModelProfileRepository;
  prices: ModelPriceRepository;
  priceTiers?: ModelPriceTierRepository | undefined;
  routes: TaskRouteRepository;
  providerHealth?: ProviderHealthRepository | undefined;
  settings: RoutingSettings;
}

export interface ExpectedTokenEstimate {
  inputTokens: number;
  outputTokens: number;
}

export interface RouteOutcome {
  status: "succeeded" | "failed" | "fallback_used";
  code?: string | undefined;
  message?: string | undefined;
}

export class ModelRouter {
  constructor(private readonly options: ModelRouterOptions) {}

  resolveRoute(
    taskType: TaskType,
    qualityMode: QualityMode,
    context: RoutePreviewContext = {}
  ): ModelRouteResolution {
    const warnings: string[] = [];
    const errors: string[] = [];
    const route = this.options.routes.find(taskType, qualityMode);

    if (!route?.enabled) {
      return {
        available: false,
        taskType,
        qualityMode,
        route,
        modelProfile: null,
        fallbackModels: [],
        price: null,
        credential: null,
        providerHealth: null,
        estimatedCostRange: emptyCostRange(),
        warnings,
        errors: ["route_unavailable"]
      };
    }

    const selectedProfileId = context.userOverrideModelProfileId ?? route.primaryModelProfileId;
    const modelProfile = this.options.modelProfiles.get(selectedProfileId);
    if (!modelProfile?.enabled) {
      return {
        available: false,
        taskType,
        qualityMode,
        route,
        modelProfile,
        fallbackModels: [],
        price: null,
        credential: null,
        providerHealth: null,
        estimatedCostRange: emptyCostRange(),
        warnings,
        errors: ["model_profile_unavailable"]
      };
    }

    const credential =
      this.options.credentials.listConfiguredByProvider(modelProfile.provider)[0] ?? null;
    if (!credential) {
      errors.push("missing_credential");
    }

    const price = this.options.prices.findActive(modelProfile.provider, modelProfile.model);
    if (!price) {
      if (this.options.settings.missingPriceBehavior === "block") {
        errors.push("missing_price");
      } else {
        warnings.push("missing_price");
      }
    } else if (
      isPriceStale({
        effectiveDate: price.effectiveDate,
        staleAfterDays: this.options.settings.priceStaleAfterDays
      })
    ) {
      warnings.push("stale_price");
    }

    const providerHealth = this.options.providerHealth?.get(
      modelProfile.provider,
      modelProfile.model
    ) ?? {
      id: "unknown",
      provider: modelProfile.provider,
      model: modelProfile.model,
      status: "unknown" as const,
      checkedAt: "",
      errorCode: null,
      errorMessage: null
    };
    if (providerHealth.status === "down") {
      warnings.push("provider_down");
    }

    return {
      available: errors.length === 0,
      taskType,
      qualityMode,
      route,
      modelProfile,
      fallbackModels: this.getFallbackModels(taskType, qualityMode),
      price,
      credential,
      providerHealth,
      estimatedCostRange: this.estimateRouteCost(taskType, context.expectedTokens, qualityMode),
      warnings,
      errors
    };
  }

  getPrimaryModel(taskType: TaskType, qualityMode: QualityMode): ModelProfileRecord | null {
    const route = this.options.routes.find(taskType, qualityMode);
    if (!route?.enabled) return null;
    return this.options.modelProfiles.get(route.primaryModelProfileId);
  }

  getFallbackModels(taskType: TaskType, qualityMode: QualityMode): ModelProfileRecord[] {
    const route = this.options.routes.find(taskType, qualityMode);
    if (!route?.enabled) return [];
    return [route.fallbackModelProfileId1, route.fallbackModelProfileId2]
      .filter((id): id is string => Boolean(id))
      .map((id) => this.options.modelProfiles.get(id))
      .filter((profile): profile is ModelProfileRecord => Boolean(profile?.enabled));
  }

  estimateRouteCost(
    taskType: TaskType,
    expectedTokens?: ExpectedTokenEstimate,
    qualityMode: QualityMode = "balanced"
  ): {
    minCost: number;
    maxCost: number;
    currency: string;
  } {
    const route = this.options.routes.find(taskType, qualityMode);
    const candidates = route
      ? [
          this.options.modelProfiles.get(route.primaryModelProfileId),
          route.fallbackModelProfileId1
            ? this.options.modelProfiles.get(route.fallbackModelProfileId1)
            : null,
          route.fallbackModelProfileId2
            ? this.options.modelProfiles.get(route.fallbackModelProfileId2)
            : null
        ].filter((profile): profile is ModelProfileRecord => Boolean(profile))
      : [];
    const tokens = expectedTokens ?? { inputTokens: 2_000, outputTokens: 2_000 };
    const costs = candidates
      .map((profile) => this.options.prices.findActive(profile.provider, profile.model))
      .filter((price): price is ModelPriceRecord => Boolean(price))
      .map((price) => ({
        cost: routeCost(
          price,
          tokens,
          this.options.priceTiers?.list({ provider: price.provider, model: price.model }) ?? []
        ),
        currency: price.currency
      }));

    if (costs.length === 0) {
      return emptyCostRange();
    }
    return {
      minCost: roundCost(Math.min(...costs.map((item) => item.cost))),
      maxCost: roundCost(Math.max(...costs.map((item) => item.cost))),
      currency: costs[0]?.currency ?? "USD"
    };
  }

  shouldUseFallback(
    error: { code: string; retryable?: boolean | undefined },
    providerStatus?: string | null
  ): boolean {
    if (["auth_error", "invalid_api_key", "permission_denied"].includes(error.code)) {
      return false;
    }
    if (error.code === "rate_limit") {
      return true;
    }
    if (providerStatus === "down") {
      return true;
    }
    return (
      error.retryable === true || ["network_error", "timeout", "overloaded"].includes(error.code)
    );
  }

  recordRouteOutcome(
    runId: string,
    provider: ProviderId,
    model: string,
    outcome: RouteOutcome
  ): void {
    if (!this.options.providerHealth) return;
    if (outcome.status === "succeeded") {
      this.options.providerHealth.recordSuccess(provider, model, runId);
      return;
    }
    this.options.providerHealth.recordFailure({
      provider,
      model,
      code: outcome.code ?? "provider_error",
      message: outcome.message ?? "Provider route failed",
      terminal: outcome.code === "auth_error"
    });
  }
}

function routeCost(
  price: ModelPriceRecord,
  tokens: ExpectedTokenEstimate,
  tiers: Array<{
    id?: string | undefined;
    deploymentMode?: string | null | undefined;
    minInputTokens: number;
    maxInputTokens?: number | null | undefined;
    inputPricePerMillion: number;
    outputPricePerMillion: number;
    cachedInputPricePerMillion?: number | null | undefined;
    cacheWritePricePerMillion?: number | null | undefined;
    currency: string;
    enabled?: boolean | undefined;
  }>
): number {
  return new CostCalculator().calculateWithPriceSelection({
    usage: tokens,
    basePrice: {
      inputPricePerMillion: price.inputPricePerMillion,
      outputPricePerMillion: price.outputPricePerMillion,
      cachedInputPricePerMillion: price.cachedInputPricePerMillion,
      currency: price.currency
    },
    tiers,
    estimated: true
  }).cost.totalCost;
}

function emptyCostRange(): { minCost: number; maxCost: number; currency: string } {
  return { minCost: 0, maxCost: 0, currency: "USD" };
}

function roundCost(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

import type { ModelRouteResolution } from "@contracts/model-routing";
import type { RoutingSettings } from "@contracts/settings";
import type { QualityMode, TaskType } from "@shared/domain/model-routing";
import type { ModelPriceRepository } from "@main/db/repositories/model-price-repository";
import type { ModelProfileRepository } from "@main/db/repositories/model-profile-repository";
import type { ProviderCredentialRepository } from "@main/db/repositories/provider-credential-repository";
import type { TaskRouteRepository } from "@main/db/repositories/task-route-repository";
import { isPriceStale } from "./model-pricing";

export interface ModelRouterOptions {
  credentials: ProviderCredentialRepository;
  modelProfiles: ModelProfileRepository;
  prices: ModelPriceRepository;
  routes: TaskRouteRepository;
  settings: RoutingSettings;
}

export class ModelRouter {
  constructor(private readonly options: ModelRouterOptions) {}

  resolveRoute(taskType: TaskType, qualityMode: QualityMode): ModelRouteResolution {
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
        price: null,
        credential: null,
        warnings,
        errors: ["route_unavailable"]
      };
    }

    const modelProfile = this.options.modelProfiles.get(route.primaryModelProfileId);
    if (!modelProfile?.enabled) {
      return {
        available: false,
        taskType,
        qualityMode,
        route,
        modelProfile,
        price: null,
        credential: null,
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

    return {
      available: errors.length === 0,
      taskType,
      qualityMode,
      route,
      modelProfile,
      price,
      credential,
      warnings,
      errors
    };
  }
}

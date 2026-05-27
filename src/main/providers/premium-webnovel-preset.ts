import type { ModelProfileRecord } from "@contracts/model-routing";
import type { RepositoryRegistry } from "@main/db/service";
import type { ProviderId, TaskType } from "@shared/domain/model-routing";

export const PREMIUM_WEBNOVEL_QUALITY_MODE = "premium_webnovel" as const;

export const PREMIUM_WEBNOVEL_ALIASES = [
  "gpt-5.5",
  "claude-opus-4.7",
  "deepseek-v4-pro",
  "qwen3.7-max",
  "kimi-k2.6"
] as const;

export type PremiumWebnovelAlias = (typeof PREMIUM_WEBNOVEL_ALIASES)[number];

export interface PremiumWebnovelRoutePresetEntry {
  primary: PremiumWebnovelAlias | PremiumWebnovelAlias[];
  fallback?: PremiumWebnovelAlias[];
  mode?: "single" | "parallel_cross_check";
  aggregator?: PremiumWebnovelAlias;
}

export interface PremiumWebnovelRoutePreset {
  quality_mode: typeof PREMIUM_WEBNOVEL_QUALITY_MODE;
  chapter_importance_modes: Array<"normal" | "key_chapter" | "volume_start" | "volume_climax" | "finale">;
  routes: Record<string, PremiumWebnovelRoutePresetEntry>;
}

interface ModelAliasSeed {
  alias: PremiumWebnovelAlias;
  provider: ProviderId;
  model: string;
  displayName: string;
  recommendedTasks: TaskType[];
}

const USER_CONFIRM_PRICE_NOTE = "Editable placeholder price. User must confirm in provider console.";

export const PREMIUM_WEBNOVEL_MODEL_SEEDS: ModelAliasSeed[] = [
  {
    alias: "gpt-5.5",
    provider: "openai",
    model: "gpt-5.5",
    displayName: "GPT-5.5",
    recommendedTasks: ["story_bible", "volume_outline", "chapter_outline", "continuity_audit"]
  },
  {
    alias: "claude-opus-4.7",
    provider: "anthropic",
    model: "claude-opus-4.7",
    displayName: "Claude Opus 4.7",
    recommendedTasks: ["story_bible", "volume_outline", "revise_chapter"]
  },
  {
    alias: "deepseek-v4-pro",
    provider: "deepseek",
    model: "deepseek-v4-pro",
    displayName: "DeepSeek V4-Pro",
    recommendedTasks: ["chapter_outline", "scene_cards", "continuity_audit", "state_settlement"]
  },
  {
    alias: "qwen3.7-max",
    provider: "dashscope_qwen",
    model: "qwen3.7-max",
    displayName: "Qwen3.7-Max",
    recommendedTasks: ["draft_chapter", "webnovel_style_rewrite", "suspense_hook_audit"]
  },
  {
    alias: "kimi-k2.6",
    provider: "moonshot_kimi",
    model: "kimi-k2.6",
    displayName: "Kimi K2.6",
    recommendedTasks: ["draft_chapter", "scene_cards", "summarize_chapter"]
  }
];

export const PREMIUM_WEBNOVEL_ROUTE_PRESET: PremiumWebnovelRoutePreset = {
  quality_mode: PREMIUM_WEBNOVEL_QUALITY_MODE,
  chapter_importance_modes: ["normal", "key_chapter", "volume_start", "volume_climax", "finale"],
  routes: {
    story_bible: {
      primary: ["gpt-5.5", "claude-opus-4.7"],
      mode: "parallel_cross_check",
      aggregator: "deepseek-v4-pro",
      fallback: ["deepseek-v4-pro"]
    },
    volume_outline: {
      primary: ["gpt-5.5", "claude-opus-4.7"],
      mode: "parallel_cross_check",
      aggregator: "deepseek-v4-pro",
      fallback: ["deepseek-v4-pro"]
    },
    chapter_outline: {
      primary: "deepseek-v4-pro",
      fallback: ["gpt-5.5", "qwen3.7-max"]
    },
    scene_cards: {
      primary: "deepseek-v4-pro",
      fallback: ["kimi-k2.6"]
    },
    draft_chapter: {
      primary: "qwen3.7-max",
      fallback: ["kimi-k2.6", "claude-opus-4.7"]
    },
    webnovel_style_rewrite: {
      primary: "qwen3.7-max",
      fallback: ["kimi-k2.6"]
    },
    suspense_hook_audit: {
      primary: "qwen3.7-max",
      fallback: ["deepseek-v4-pro"]
    },
    continuity_audit: {
      primary: "deepseek-v4-pro",
      fallback: ["gpt-5.5", "claude-opus-4.7"]
    },
    revise_chapter: {
      primary: "claude-opus-4.7",
      fallback: ["qwen3.7-max"]
    },
    state_settlement: {
      primary: "deepseek-v4-pro",
      fallback: ["gpt-5.5"]
    },
    summarize_chapter: {
      primary: "deepseek-v4-pro",
      fallback: ["kimi-k2.6"]
    }
  }
};

export interface ApplyPremiumPresetOptions {
  forceRoutes?: boolean;
  preset?: PremiumWebnovelRoutePreset | undefined;
}

export function applyPremiumWebnovelPreset(
  repositories: RepositoryRegistry,
  options: ApplyPremiumPresetOptions = {}
): PremiumWebnovelRoutePreset {
  const preset = options.preset ?? PREMIUM_WEBNOVEL_ROUTE_PRESET;
  const profilesByAlias = ensurePremiumModelAliases(repositories);

  for (const [taskType, route] of Object.entries(preset.routes)) {
    const typedTaskType = taskType as TaskType;
    const existing = repositories.taskRoutes.find(typedTaskType, PREMIUM_WEBNOVEL_QUALITY_MODE);
    if (existing && !options.forceRoutes) {
      continue;
    }
    const routeAliases = routeAliasesForTask(route);
    const [primaryAlias, fallbackAlias1, fallbackAlias2] = routeAliases;
    if (!primaryAlias) {
      continue;
    }
    const primary = profilesByAlias.get(primaryAlias);
    if (!primary) continue;
    repositories.taskRoutes.upsert({
      taskType: typedTaskType,
      qualityMode: PREMIUM_WEBNOVEL_QUALITY_MODE,
      primaryModelProfileId: primary.id,
      fallbackModelProfileId1: fallbackAlias1 ? profilesByAlias.get(fallbackAlias1)?.id ?? null : null,
      fallbackModelProfileId2: fallbackAlias2 ? profilesByAlias.get(fallbackAlias2)?.id ?? null : null,
      temperature: taskTemperature(typedTaskType),
      maxOutputTokens: taskMaxOutputTokens(typedTaskType),
      budgetCapPerCall: null,
      enabled: true
    });
  }

  repositories.settings.set("route_preset:premium_webnovel", preset);
  return preset;
}

export function exportPremiumWebnovelPreset(repositories: RepositoryRegistry): PremiumWebnovelRoutePreset {
  return (
    repositories.settings.get<PremiumWebnovelRoutePreset>("route_preset:premium_webnovel") ??
    PREMIUM_WEBNOVEL_ROUTE_PRESET
  );
}

export function importPremiumWebnovelPreset(
  repositories: RepositoryRegistry,
  preset: PremiumWebnovelRoutePreset
): PremiumWebnovelRoutePreset {
  repositories.settings.set("route_preset:premium_webnovel", preset);
  return applyPremiumWebnovelPreset(repositories, { forceRoutes: true, preset });
}

function ensurePremiumModelAliases(
  repositories: RepositoryRegistry
): Map<PremiumWebnovelAlias, ModelProfileRecord> {
  const profilesByAlias = new Map<PremiumWebnovelAlias, ModelProfileRecord>();
  for (const seed of PREMIUM_WEBNOVEL_MODEL_SEEDS) {
    const profile =
      repositories.modelProfiles.findByAlias(seed.alias) ??
      repositories.modelProfiles.upsert({
        id: repositories.modelProfiles.find(seed.provider, seed.model)?.id,
        provider: seed.provider,
        model: seed.model,
        alias: seed.alias,
        displayName: seed.displayName,
        supportsStreaming: true,
        supportsJson: true,
        supportsTools: false,
        supportsVision: false,
        supportsPromptCaching: false,
        defaultTemperature: seed.provider === "moonshot_kimi" ? 1 : 0.7,
        supportsTemperature: seed.provider !== "moonshot_kimi",
        recommendedTasks: seed.recommendedTasks,
        enabled: true
      });
    profilesByAlias.set(seed.alias, profile);
    if (!repositories.modelPrices.findActive(profile.provider, profile.model)) {
      repositories.modelPrices.upsert({
        provider: profile.provider,
        model: profile.model,
        inputPricePerMillion: 0,
        outputPricePerMillion: 0,
        cachedInputPricePerMillion: null,
        currency: "USD",
        contextWindow: profile.contextWindow,
        maxOutputTokens: profile.maxOutputTokens,
        effectiveDate: "2026-05-25",
        sourceNote: USER_CONFIRM_PRICE_NOTE,
        enabled: true
      });
    }
  }
  return profilesByAlias;
}

function routeAliasesForTask(route: PremiumWebnovelRoutePresetEntry): PremiumWebnovelAlias[] {
  const primary = Array.isArray(route.primary) ? route.primary : [route.primary];
  return [...primary, ...(route.fallback ?? [])].slice(0, 3);
}

function taskTemperature(taskType: TaskType): number {
  if (taskType === "draft_chapter" || taskType === "webnovel_style_rewrite") {
    return 0.78;
  }
  if (taskType.endsWith("_audit") || taskType === "state_settlement") {
    return 0.2;
  }
  return 0.55;
}

function taskMaxOutputTokens(taskType: TaskType): number {
  if (taskType === "draft_chapter" || taskType === "revise_chapter") {
    return 10_000;
  }
  if (taskType === "scene_cards" || taskType === "volume_outline") {
    return 4_000;
  }
  return 2_500;
}

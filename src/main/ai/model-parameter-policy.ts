import type { AIProviderId, LLMTaskType } from "@contracts/ai";

export const ENDPOINT_FAMILIES = [
  "openai_chat_completions",
  "openai_responses",
  "anthropic_messages",
  "gemini_generate_content",
  "openai_compatible",
  "dashscope_openai_compatible",
  "moonshot_openai_compatible",
  "deepseek_openai_compatible",
  "xai_openai_compatible",
  "openrouter_openai_compatible"
] as const;

export type EndpointFamily = (typeof ENDPOINT_FAMILIES)[number];

export const MAX_OUTPUT_PARAM_NAMES = [
  "max_tokens",
  "max_completion_tokens",
  "max_output_tokens",
  "output_token_limit",
  "generation_config_max_output_tokens"
] as const;

export type MaxOutputParamName = (typeof MAX_OUTPUT_PARAM_NAMES)[number];

export const CREATIVITY_INTENTS = ["deterministic", "balanced", "creative", "wild"] as const;
export type CreativityIntent = (typeof CREATIVITY_INTENTS)[number];

export const CONTEXT_BUDGET_MODES = ["conservative", "balanced", "max_safe", "manual"] as const;
export type ContextBudgetMode = (typeof CONTEXT_BUDGET_MODES)[number];

export interface OmittedProviderParam {
  name: string;
  reason: string;
}

export interface NormalizedProviderParams {
  endpointFamily: EndpointFamily;
  bodyParams: Record<string, unknown>;
  omittedParams: OmittedProviderParam[];
  warnings: string[];
  promptInstructions: string[];
  effectiveMaxOutputTokens: number;
  effectiveContextTokenBudget: number | null;
  creativityIntent: CreativityIntent;
  contextBudgetMode: ContextBudgetMode;
}

export interface ModelParameterPolicyInput {
  provider: AIProviderId;
  model: string;
  taskType?: LLMTaskType | undefined;
  endpointFamily?: EndpointFamily | null | undefined;
  outputTokenBudget?: number | null | undefined;
  contextWindow?: number | null | undefined;
  contextBudgetMode?: ContextBudgetMode | null | undefined;
  creativityIntent?: CreativityIntent | null | undefined;
  requestedTemperature?: number | null | undefined;
  jsonMode?: boolean | undefined;
  stream?: boolean | undefined;
  supportsTemperature?: boolean | null | undefined;
  supportsTopP?: boolean | null | undefined;
  supportsTopK?: boolean | null | undefined;
  supportsFrequencyPenalty?: boolean | null | undefined;
  supportsPresencePenalty?: boolean | null | undefined;
  supportsStop?: boolean | null | undefined;
  supportsReasoningEffort?: boolean | null | undefined;
  supportsAdaptiveThinking?: boolean | null | undefined;
  supportsManualThinkingBudget?: boolean | null | undefined;
  maxOutputParamName?: MaxOutputParamName | null | undefined;
  userOverrides?: Record<string, unknown> | null | undefined;
}

export interface ParameterCompatibilityClassification {
  retryable: boolean;
  code: "provider_parameter_error" | "unknown";
  removeParams: string[];
  message: string;
}

const DEFAULT_OUTPUT_TOKENS = 2048;
const DEFAULT_CONTEXT_WINDOW = 32_000;
const CONTEXT_OVERHEAD_RESERVE = 1024;

export class ModelParameterPolicy {
  normalize(input: ModelParameterPolicyInput): NormalizedProviderParams {
    const endpointFamily = input.endpointFamily ?? defaultEndpointFamily(input.provider);
    const maxOutputParamName =
      input.maxOutputParamName ?? defaultMaxOutputParamName(input.provider, input.model, endpointFamily);
    const creativityIntent =
      input.creativityIntent ?? defaultCreativityIntent(input.taskType ?? "draft_chapter");
    const contextBudgetMode = input.contextBudgetMode ?? "max_safe";
    const effectiveMaxOutputTokens = Math.max(
      1,
      Math.floor(input.outputTokenBudget ?? DEFAULT_OUTPUT_TOKENS)
    );
    const bodyParams: Record<string, unknown> = {};
    const omittedParams: OmittedProviderParam[] = [];
    const warnings: string[] = [];
    const promptInstructions: string[] = [];

    bodyParams[maxOutputParamName] = effectiveMaxOutputTokens;

    const desiredTemperature = normalizeTemperature(
      input.requestedTemperature ?? temperatureForIntent(creativityIntent)
    );
    if (supports(input.supportsTemperature, input.provider, input.model, endpointFamily, "temperature")) {
      bodyParams.temperature = desiredTemperature;
    } else {
      omittedParams.push({
        name: "temperature",
        reason: `${input.model} unsupported temperature for ${endpointFamily}`
      });
      promptInstructions.push(creativityInstruction(creativityIntent));
    }

    for (const unsafeName of ["top_p", "top_k", "frequency_penalty", "presence_penalty"]) {
      if (input.userOverrides && Object.prototype.hasOwnProperty.call(input.userOverrides, unsafeName)) {
        omittedParams.push({
          name: unsafeName,
          reason: "advanced override is unsupported or unsafe for this model profile"
        });
      }
    }

    if (endpointFamily === "openai_chat_completions") {
      if ("max_tokens" in bodyParams && maxOutputParamName !== "max_tokens") {
        omittedParams.push({ name: "max_tokens", reason: "model profile uses a newer output limit parameter" });
        delete bodyParams.max_tokens;
      }
      if ("max_completion_tokens" in bodyParams && maxOutputParamName !== "max_completion_tokens") {
        omittedParams.push({
          name: "max_completion_tokens",
          reason: "model profile uses a different output limit parameter"
        });
        delete bodyParams.max_completion_tokens;
      }
    }

    const effectiveContextTokenBudget = calculateContextBudget({
      mode: contextBudgetMode,
      contextWindow: input.contextWindow ?? DEFAULT_CONTEXT_WINDOW,
      outputTokenBudget: effectiveMaxOutputTokens
    });

    if (contextBudgetMode === "max_safe" && effectiveContextTokenBudget === null) {
      warnings.push("Context budget could not be calculated because model context window is unknown.");
    }

    return {
      endpointFamily,
      bodyParams,
      omittedParams,
      warnings,
      promptInstructions: compactInstructions(promptInstructions),
      effectiveMaxOutputTokens,
      effectiveContextTokenBudget,
      creativityIntent,
      contextBudgetMode
    };
  }

  classifyParameterError(message: string): ParameterCompatibilityClassification {
    const normalized = message.toLowerCase();
    const removeParams: string[] = [];
    if (normalized.includes("max_tokens") && normalized.includes("unsupported")) {
      removeParams.push("max_tokens");
    }
    if (normalized.includes("temperature") && (normalized.includes("deprecated") || normalized.includes("unsupported"))) {
      removeParams.push("temperature");
    }
    if (normalized.includes("top_p") && normalized.includes("unsupported")) {
      removeParams.push("top_p");
    }
    if (normalized.includes("top_k") && normalized.includes("unsupported")) {
      removeParams.push("top_k");
    }
    return removeParams.length > 0
      ? {
          retryable: true,
          code: "provider_parameter_error",
          removeParams,
          message: "The provider rejected one or more request parameters."
        }
      : { retryable: false, code: "unknown", removeParams: [], message: "Not a known parameter error." };
  }
}

export function applyParameterRetryPatch(
  params: NormalizedProviderParams,
  removeParams: string[]
): NormalizedProviderParams {
  const bodyParams = { ...params.bodyParams };
  const omittedParams = [...params.omittedParams];
  for (const name of removeParams) {
    if (name in bodyParams) {
      delete bodyParams[name];
      omittedParams.push({ name, reason: "removed after provider parameter compatibility error" });
    }
  }
  return {
    ...params,
    bodyParams,
    omittedParams,
    warnings: [
      ...params.warnings,
      "The model rejected a request parameter. WenForge retried with compatible parameters."
    ]
  };
}

export function defaultEndpointFamily(provider: AIProviderId): EndpointFamily {
  switch (provider) {
    case "anthropic":
      return "anthropic_messages";
    case "gemini":
      return "gemini_generate_content";
    case "dashscope_qwen":
      return "dashscope_openai_compatible";
    case "moonshot_kimi":
      return "moonshot_openai_compatible";
    case "deepseek":
      return "deepseek_openai_compatible";
    case "xai":
      return "xai_openai_compatible";
    case "openrouter":
      return "openrouter_openai_compatible";
    case "openai":
      return "openai_chat_completions";
    default:
      return "openai_compatible";
  }
}

export function defaultMaxOutputParamName(
  provider: AIProviderId,
  model: string,
  endpointFamily: EndpointFamily
): MaxOutputParamName {
  if (endpointFamily === "anthropic_messages") return "max_tokens";
  if (endpointFamily === "gemini_generate_content") return "generation_config_max_output_tokens";
  if (endpointFamily === "openai_responses") return "max_output_tokens";
  if (provider === "openai" && /^gpt-5|^gpt-4\.1|^o[134]/i.test(model)) {
    return "max_completion_tokens";
  }
  return "max_tokens";
}

export function defaultCreativityIntent(taskType: LLMTaskType): CreativityIntent {
  switch (taskType) {
    case "continuity_audit":
    case "state_settlement":
    case "summarize_chapter":
    case "embedding_or_memory_indexing":
      return "deterministic";
    case "draft_chapter":
    case "webnovel_style_rewrite":
    case "revise_chapter":
      return "creative";
    default:
      return "balanced";
  }
}

function supports(
  value: boolean | null | undefined,
  provider: AIProviderId,
  model: string,
  endpointFamily: EndpointFamily,
  paramName: string
): boolean {
  if (typeof value === "boolean") return value;
  if (paramName === "temperature" && endpointFamily === "anthropic_messages" && /opus-4\.7/i.test(model)) {
    return false;
  }
  if (provider === "fake") return true;
  return true;
}

function normalizeTemperature(value: number): number {
  if (!Number.isFinite(value)) return 0.7;
  return Math.max(0, Math.min(2, Math.round(value * 100) / 100));
}

function temperatureForIntent(intent: CreativityIntent): number {
  switch (intent) {
    case "deterministic":
      return 0.2;
    case "balanced":
      return 0.65;
    case "creative":
      return 0.9;
    case "wild":
      return 1.15;
  }
}

function creativityInstruction(intent: CreativityIntent): string {
  switch (intent) {
    case "deterministic":
      return "请用稳定、克制、可复核的方式输出，优先保持事实一致。";
    case "balanced":
      return "请在稳定结构和适度变化之间取得平衡。";
    case "creative":
      return "请通过更有变化的句式、情绪推进和具体细节增强创作表现。";
    case "wild":
      return "请大胆提出更强烈的戏剧选择，但不要破坏已确认设定。";
  }
}

function calculateContextBudget(input: {
  mode: ContextBudgetMode;
  contextWindow: number | null;
  outputTokenBudget: number;
}): number | null {
  if (!input.contextWindow || input.contextWindow <= 0) return null;
  const remaining = input.contextWindow - input.outputTokenBudget - CONTEXT_OVERHEAD_RESERVE;
  switch (input.mode) {
    case "conservative":
      return Math.max(1024, Math.floor(remaining * 0.45));
    case "balanced":
      return Math.max(1024, Math.floor(remaining * 0.7));
    case "manual":
    case "max_safe":
      return Math.max(1024, remaining);
  }
}

function compactInstructions(values: string[]): string[] {
  return [...new Set(values.filter((value) => value.trim().length > 0))];
}

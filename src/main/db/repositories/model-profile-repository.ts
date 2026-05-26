import type { ModelProfileRecord } from "@contracts/model-routing";
import type { ProviderId, TaskType } from "@shared/domain/model-routing";
import type { WenForgeDatabase } from "@main/db/connection";
import { createId } from "@main/db/id";
import { nowIso } from "./types";

export interface UpsertModelProfileInput {
  id?: string | undefined;
  provider: ProviderId;
  model: string;
  alias?: string | null | undefined;
  displayName: string;
  contextWindow?: number | null | undefined;
  maxOutputTokens?: number | null | undefined;
  supportsStreaming?: boolean | undefined;
  supportsJson?: boolean | undefined;
  supportsTools?: boolean | undefined;
  supportsVision?: boolean | undefined;
  supportsPromptCaching?: boolean | undefined;
  supportsTemperature?: boolean | undefined;
  supportsTopP?: boolean | undefined;
  supportsTopK?: boolean | undefined;
  supportsFrequencyPenalty?: boolean | undefined;
  supportsPresencePenalty?: boolean | undefined;
  supportsStop?: boolean | undefined;
  supportsReasoningEffort?: boolean | undefined;
  supportsAdaptiveThinking?: boolean | undefined;
  supportsManualThinkingBudget?: boolean | undefined;
  maxOutputParamName?: ModelProfileRecord["maxOutputParamName"] | undefined;
  endpointFamily?: ModelProfileRecord["endpointFamily"] | undefined;
  supportsResponsesApi?: boolean | undefined;
  supportsChatCompletions?: boolean | undefined;
  defaultTemperature?: number | undefined;
  recommendedTasks?: TaskType[] | undefined;
  recommendedTasksJson?: string | undefined;
  enabled?: boolean | undefined;
}

function boolFromSql(value: unknown): boolean {
  return value === true || value === 1;
}

function mapProfile(row: Record<string, unknown>): ModelProfileRecord {
  return {
    id: String(row.id),
    provider: String(row.provider) as ProviderId,
    model: String(row.model),
    alias: nullableString(row.alias),
    displayName: String(row.display_name),
    contextWindow: row.context_window === null ? null : Number(row.context_window),
    maxOutputTokens: row.max_output_tokens === null ? null : Number(row.max_output_tokens),
    supportsStreaming: boolFromSql(row.supports_streaming),
    supportsJson: boolFromSql(row.supports_json),
    supportsTools: boolFromSql(row.supports_tools),
    supportsVision: boolFromSql(row.supports_vision),
    supportsPromptCaching: boolFromSql(row.supports_prompt_caching),
    supportsTemperature: boolFromSql(row.supports_temperature),
    supportsTopP: boolFromSql(row.supports_top_p),
    supportsTopK: boolFromSql(row.supports_top_k),
    supportsFrequencyPenalty: boolFromSql(row.supports_frequency_penalty),
    supportsPresencePenalty: boolFromSql(row.supports_presence_penalty),
    supportsStop: boolFromSql(row.supports_stop),
    supportsReasoningEffort: boolFromSql(row.supports_reasoning_effort),
    supportsAdaptiveThinking: boolFromSql(row.supports_adaptive_thinking),
    supportsManualThinkingBudget: boolFromSql(row.supports_manual_thinking_budget),
    maxOutputParamName: normalizeMaxOutputParamName(row.max_output_param_name),
    endpointFamily: normalizeEndpointFamily(row.endpoint_family),
    supportsResponsesApi: boolFromSql(row.supports_responses_api),
    supportsChatCompletions: boolFromSql(row.supports_chat_completions),
    defaultTemperature: Number(row.default_temperature),
    recommendedTasksJson: String(row.recommended_tasks_json),
    enabled: boolFromSql(row.enabled),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

export class ModelProfileRepository {
  constructor(private readonly db: WenForgeDatabase) {}

  list(): ModelProfileRecord[] {
    return this.db.sqlite
      .prepare("select * from model_profiles order by provider asc, model asc")
      .all()
      .map((row) => mapProfile(row as Record<string, unknown>));
  }

  get(id: string): ModelProfileRecord | null {
    const row = this.db.sqlite.prepare("select * from model_profiles where id = ?").get(id);
    return row ? mapProfile(row as Record<string, unknown>) : null;
  }

  find(provider: ProviderId, model: string): ModelProfileRecord | null {
    const row = this.db.sqlite
      .prepare("select * from model_profiles where provider = ? and model = ?")
      .get(provider, model);
    return row ? mapProfile(row as Record<string, unknown>) : null;
  }

  findByAlias(alias: string): ModelProfileRecord | null {
    const row = this.db.sqlite
      .prepare("select * from model_profiles where alias = ?")
      .get(alias.trim());
    return row ? mapProfile(row as Record<string, unknown>) : null;
  }

  create(input: UpsertModelProfileInput): ModelProfileRecord {
    return this.upsert(input);
  }

  upsert(input: UpsertModelProfileInput): ModelProfileRecord {
    const now = nowIso();
    const existing = input.id ? this.get(input.id) : this.find(input.provider, input.model);
    const id = existing?.id ?? input.id ?? createId("model");
    const recommendedTasksJson =
      input.recommendedTasksJson ?? JSON.stringify(input.recommendedTasks ?? []);

    if (existing && input.id) {
      this.db.sqlite
        .prepare(
          `update model_profiles
          set provider = @provider,
            model = @model,
            alias = @alias,
            display_name = @displayName,
            context_window = @contextWindow,
            max_output_tokens = @maxOutputTokens,
            supports_streaming = @supportsStreaming,
            supports_json = @supportsJson,
            supports_tools = @supportsTools,
            supports_vision = @supportsVision,
            supports_prompt_caching = @supportsPromptCaching,
            supports_temperature = @supportsTemperature,
            supports_top_p = @supportsTopP,
            supports_top_k = @supportsTopK,
            supports_frequency_penalty = @supportsFrequencyPenalty,
            supports_presence_penalty = @supportsPresencePenalty,
            supports_stop = @supportsStop,
            supports_reasoning_effort = @supportsReasoningEffort,
            supports_adaptive_thinking = @supportsAdaptiveThinking,
            supports_manual_thinking_budget = @supportsManualThinkingBudget,
            max_output_param_name = @maxOutputParamName,
            endpoint_family = @endpointFamily,
            supports_responses_api = @supportsResponsesApi,
            supports_chat_completions = @supportsChatCompletions,
            default_temperature = @defaultTemperature,
            recommended_tasks_json = @recommendedTasksJson,
            enabled = @enabled,
            updated_at = @updatedAt
          where id = @id`
        )
        .run({
          id,
          provider: input.provider,
          model: input.model,
          alias: normalizeAlias(input.alias),
          displayName: input.displayName,
          contextWindow: input.contextWindow ?? null,
          maxOutputTokens: input.maxOutputTokens ?? null,
          supportsStreaming: input.supportsStreaming === false ? 0 : 1,
          supportsJson: input.supportsJson ? 1 : 0,
          supportsTools: input.supportsTools ? 1 : 0,
          supportsVision: input.supportsVision ? 1 : 0,
          supportsPromptCaching: input.supportsPromptCaching ? 1 : 0,
          ...capabilityParams(input),
          defaultTemperature: input.defaultTemperature ?? 0.7,
          recommendedTasksJson,
          enabled: input.enabled === false ? 0 : 1,
          updatedAt: now
        });
      return this.get(id) as ModelProfileRecord;
    }

    this.db.sqlite
      .prepare(
        `insert into model_profiles
        (id, provider, model, alias, display_name, context_window, max_output_tokens, supports_streaming,
          supports_json, supports_tools, supports_vision, supports_prompt_caching,
          supports_temperature, supports_top_p, supports_top_k, supports_frequency_penalty,
          supports_presence_penalty, supports_stop, supports_reasoning_effort, supports_adaptive_thinking,
          supports_manual_thinking_budget, max_output_param_name, endpoint_family, supports_responses_api,
          supports_chat_completions, default_temperature,
          recommended_tasks_json, enabled, created_at, updated_at)
        values (@id, @provider, @model, @alias, @displayName, @contextWindow, @maxOutputTokens,
          @supportsStreaming, @supportsJson, @supportsTools, @supportsVision, @supportsPromptCaching,
          @supportsTemperature, @supportsTopP, @supportsTopK, @supportsFrequencyPenalty,
          @supportsPresencePenalty, @supportsStop, @supportsReasoningEffort, @supportsAdaptiveThinking,
          @supportsManualThinkingBudget, @maxOutputParamName, @endpointFamily, @supportsResponsesApi,
          @supportsChatCompletions, @defaultTemperature, @recommendedTasksJson, @enabled,
          @createdAt, @updatedAt)
        on conflict(provider, model) do update set
          alias = excluded.alias,
          display_name = excluded.display_name,
          context_window = excluded.context_window,
          max_output_tokens = excluded.max_output_tokens,
          supports_streaming = excluded.supports_streaming,
          supports_json = excluded.supports_json,
          supports_tools = excluded.supports_tools,
          supports_vision = excluded.supports_vision,
          supports_prompt_caching = excluded.supports_prompt_caching,
          supports_temperature = excluded.supports_temperature,
          supports_top_p = excluded.supports_top_p,
          supports_top_k = excluded.supports_top_k,
          supports_frequency_penalty = excluded.supports_frequency_penalty,
          supports_presence_penalty = excluded.supports_presence_penalty,
          supports_stop = excluded.supports_stop,
          supports_reasoning_effort = excluded.supports_reasoning_effort,
          supports_adaptive_thinking = excluded.supports_adaptive_thinking,
          supports_manual_thinking_budget = excluded.supports_manual_thinking_budget,
          max_output_param_name = excluded.max_output_param_name,
          endpoint_family = excluded.endpoint_family,
          supports_responses_api = excluded.supports_responses_api,
          supports_chat_completions = excluded.supports_chat_completions,
          default_temperature = excluded.default_temperature,
          recommended_tasks_json = excluded.recommended_tasks_json,
          enabled = excluded.enabled,
          updated_at = excluded.updated_at`
      )
      .run({
        id,
        provider: input.provider,
        model: input.model,
        alias: normalizeAlias(input.alias),
        displayName: input.displayName,
        contextWindow: input.contextWindow ?? null,
        maxOutputTokens: input.maxOutputTokens ?? null,
        supportsStreaming: input.supportsStreaming === false ? 0 : 1,
        supportsJson: input.supportsJson ? 1 : 0,
        supportsTools: input.supportsTools ? 1 : 0,
        supportsVision: input.supportsVision ? 1 : 0,
        supportsPromptCaching: input.supportsPromptCaching ? 1 : 0,
        ...capabilityParams(input),
        defaultTemperature: input.defaultTemperature ?? 0.7,
        recommendedTasksJson,
        enabled: input.enabled === false ? 0 : 1,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now
      });
    return this.find(input.provider, input.model) as ModelProfileRecord;
  }
}

function normalizeAlias(alias: string | null | undefined): string | null {
  const trimmed = alias?.trim();
  return trimmed ? trimmed : null;
}

function nullableString(value: unknown): string | null {
  return value === null || typeof value === "undefined" ? null : String(value);
}

function capabilityParams(input: UpsertModelProfileInput): Record<string, unknown> {
  return {
    supportsTemperature: input.supportsTemperature === false ? 0 : 1,
    supportsTopP: input.supportsTopP ? 1 : 0,
    supportsTopK: input.supportsTopK ? 1 : 0,
    supportsFrequencyPenalty: input.supportsFrequencyPenalty ? 1 : 0,
    supportsPresencePenalty: input.supportsPresencePenalty ? 1 : 0,
    supportsStop: input.supportsStop === false ? 0 : 1,
    supportsReasoningEffort: input.supportsReasoningEffort ? 1 : 0,
    supportsAdaptiveThinking: input.supportsAdaptiveThinking ? 1 : 0,
    supportsManualThinkingBudget: input.supportsManualThinkingBudget ? 1 : 0,
    maxOutputParamName: input.maxOutputParamName ?? "max_tokens",
    endpointFamily: input.endpointFamily ?? defaultEndpointFamilyForProvider(input.provider),
    supportsResponsesApi: input.supportsResponsesApi ? 1 : 0,
    supportsChatCompletions: input.supportsChatCompletions === false ? 0 : 1
  };
}

function normalizeMaxOutputParamName(value: unknown): ModelProfileRecord["maxOutputParamName"] {
  return value === "max_completion_tokens" ||
    value === "max_output_tokens" ||
    value === "output_token_limit" ||
    value === "generation_config_max_output_tokens"
    ? value
    : "max_tokens";
}

function normalizeEndpointFamily(value: unknown): ModelProfileRecord["endpointFamily"] {
  const text = typeof value === "string" ? value : "";
  if (
    text === "openai_chat_completions" ||
    text === "openai_responses" ||
    text === "anthropic_messages" ||
    text === "gemini_generate_content" ||
    text === "dashscope_openai_compatible" ||
    text === "moonshot_openai_compatible" ||
    text === "deepseek_openai_compatible" ||
    text === "xai_openai_compatible" ||
    text === "openrouter_openai_compatible"
  ) {
    return text;
  }
  return "openai_compatible";
}

function defaultEndpointFamilyForProvider(provider: ProviderId): ModelProfileRecord["endpointFamily"] {
  switch (provider) {
    case "openai":
      return "openai_chat_completions";
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
    default:
      return "openai_compatible";
  }
}

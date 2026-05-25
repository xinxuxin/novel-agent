import type { ModelProfileRecord } from "@contracts/model-routing";
import type { ProviderId, TaskType } from "@shared/domain/model-routing";
import type { WenForgeDatabase } from "@main/db/connection";
import { createId } from "@main/db/id";
import { nowIso } from "./types";

export interface UpsertModelProfileInput {
  id?: string | undefined;
  provider: ProviderId;
  model: string;
  displayName: string;
  contextWindow?: number | null | undefined;
  maxOutputTokens?: number | null | undefined;
  supportsStreaming?: boolean | undefined;
  supportsJson?: boolean | undefined;
  supportsTools?: boolean | undefined;
  supportsVision?: boolean | undefined;
  supportsPromptCaching?: boolean | undefined;
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
    displayName: String(row.display_name),
    contextWindow: row.context_window === null ? null : Number(row.context_window),
    maxOutputTokens: row.max_output_tokens === null ? null : Number(row.max_output_tokens),
    supportsStreaming: boolFromSql(row.supports_streaming),
    supportsJson: boolFromSql(row.supports_json),
    supportsTools: boolFromSql(row.supports_tools),
    supportsVision: boolFromSql(row.supports_vision),
    supportsPromptCaching: boolFromSql(row.supports_prompt_caching),
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

  create(input: UpsertModelProfileInput): ModelProfileRecord {
    return this.upsert(input);
  }

  upsert(input: UpsertModelProfileInput): ModelProfileRecord {
    const now = nowIso();
    const existing = input.id ? this.get(input.id) : this.find(input.provider, input.model);
    const id = existing?.id ?? input.id ?? createId("model");
    const recommendedTasksJson =
      input.recommendedTasksJson ?? JSON.stringify(input.recommendedTasks ?? []);
    this.db.sqlite
      .prepare(
        `insert into model_profiles
        (id, provider, model, display_name, context_window, max_output_tokens, supports_streaming,
          supports_json, supports_tools, supports_vision, supports_prompt_caching, default_temperature,
          recommended_tasks_json, enabled, created_at, updated_at)
        values (@id, @provider, @model, @displayName, @contextWindow, @maxOutputTokens,
          @supportsStreaming, @supportsJson, @supportsTools, @supportsVision, @supportsPromptCaching,
          @defaultTemperature, @recommendedTasksJson, @enabled, @createdAt, @updatedAt)
        on conflict(provider, model) do update set
          display_name = excluded.display_name,
          context_window = excluded.context_window,
          max_output_tokens = excluded.max_output_tokens,
          supports_streaming = excluded.supports_streaming,
          supports_json = excluded.supports_json,
          supports_tools = excluded.supports_tools,
          supports_vision = excluded.supports_vision,
          supports_prompt_caching = excluded.supports_prompt_caching,
          default_temperature = excluded.default_temperature,
          recommended_tasks_json = excluded.recommended_tasks_json,
          enabled = excluded.enabled,
          updated_at = excluded.updated_at`
      )
      .run({
        id,
        provider: input.provider,
        model: input.model,
        displayName: input.displayName,
        contextWindow: input.contextWindow ?? null,
        maxOutputTokens: input.maxOutputTokens ?? null,
        supportsStreaming: input.supportsStreaming === false ? 0 : 1,
        supportsJson: input.supportsJson ? 1 : 0,
        supportsTools: input.supportsTools ? 1 : 0,
        supportsVision: input.supportsVision ? 1 : 0,
        supportsPromptCaching: input.supportsPromptCaching ? 1 : 0,
        defaultTemperature: input.defaultTemperature ?? 0.7,
        recommendedTasksJson,
        enabled: input.enabled === false ? 0 : 1,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now
      });
    return this.find(input.provider, input.model) as ModelProfileRecord;
  }
}

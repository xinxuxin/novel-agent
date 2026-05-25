import type { TaskRouteRecord } from "@contracts/model-routing";
import type { QualityMode, TaskType } from "@shared/domain/model-routing";
import type { WenForgeDatabase } from "@main/db/connection";
import { createId } from "@main/db/id";
import { nowIso } from "./types";

export interface UpsertTaskRouteInput {
  id?: string | undefined;
  taskType: TaskType;
  qualityMode: QualityMode;
  primaryModelProfileId: string;
  fallbackModelProfileId1?: string | null | undefined;
  fallbackModelProfileId2?: string | null | undefined;
  temperature: number;
  maxOutputTokens: number;
  budgetCapPerCall?: number | null | undefined;
  enabled?: boolean | undefined;
}

function boolFromSql(value: unknown): boolean {
  return value === true || value === 1;
}

function mapRoute(row: Record<string, unknown>): TaskRouteRecord {
  return {
    id: String(row.id),
    taskType: String(row.task_type) as TaskType,
    qualityMode: String(row.quality_mode) as QualityMode,
    primaryModelProfileId: String(row.primary_model_profile_id),
    fallbackModelProfileId1:
      row.fallback_model_profile_id_1 === null ? null : String(row.fallback_model_profile_id_1),
    fallbackModelProfileId2:
      row.fallback_model_profile_id_2 === null ? null : String(row.fallback_model_profile_id_2),
    temperature: Number(row.temperature),
    maxOutputTokens: Number(row.max_output_tokens),
    budgetCapPerCall: row.budget_cap_per_call === null ? null : Number(row.budget_cap_per_call),
    enabled: boolFromSql(row.enabled),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

export class TaskRouteRepository {
  constructor(private readonly db: WenForgeDatabase) {}

  list(): TaskRouteRecord[] {
    return this.db.sqlite
      .prepare("select * from task_model_routes order by task_type asc, quality_mode asc")
      .all()
      .map((row) => mapRoute(row as Record<string, unknown>));
  }

  find(taskType: TaskType, qualityMode: QualityMode): TaskRouteRecord | null {
    const row = this.db.sqlite
      .prepare("select * from task_model_routes where task_type = ? and quality_mode = ?")
      .get(taskType, qualityMode);
    return row ? mapRoute(row as Record<string, unknown>) : null;
  }

  upsert(input: UpsertTaskRouteInput): TaskRouteRecord {
    const now = nowIso();
    const existing = this.find(input.taskType, input.qualityMode);
    const id = existing?.id ?? input.id ?? createId("route");
    const legacyProfile = this.db.sqlite
      .prepare("select provider, model from model_profiles where id = ?")
      .get(input.primaryModelProfileId) as { provider: string; model: string } | undefined;
    this.db.sqlite
      .prepare(
        `insert into task_model_routes
        (id, task_type, quality_mode, provider, model, primary_model_profile_id, fallback_model_profile_id_1,
          fallback_model_profile_id_2, temperature, max_output_tokens, budget_cap_per_call,
          enabled, created_at, updated_at)
        values (@id, @taskType, @qualityMode, @legacyProvider, @legacyModel, @primaryModelProfileId, @fallbackModelProfileId1,
          @fallbackModelProfileId2, @temperature, @maxOutputTokens, @budgetCapPerCall,
          @enabled, @createdAt, @updatedAt)
        on conflict(task_type, quality_mode) do update set
          provider = excluded.provider,
          model = excluded.model,
          primary_model_profile_id = excluded.primary_model_profile_id,
          fallback_model_profile_id_1 = excluded.fallback_model_profile_id_1,
          fallback_model_profile_id_2 = excluded.fallback_model_profile_id_2,
          temperature = excluded.temperature,
          max_output_tokens = excluded.max_output_tokens,
          budget_cap_per_call = excluded.budget_cap_per_call,
          enabled = excluded.enabled,
          updated_at = excluded.updated_at`
      )
      .run({
        id,
        taskType: input.taskType,
        qualityMode: input.qualityMode,
        legacyProvider: legacyProfile?.provider ?? "",
        legacyModel: legacyProfile?.model ?? "",
        primaryModelProfileId: input.primaryModelProfileId,
        fallbackModelProfileId1: input.fallbackModelProfileId1 ?? null,
        fallbackModelProfileId2: input.fallbackModelProfileId2 ?? null,
        temperature: input.temperature,
        maxOutputTokens: input.maxOutputTokens,
        budgetCapPerCall: input.budgetCapPerCall ?? null,
        enabled: input.enabled === false ? 0 : 1,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now
      });
    return this.find(input.taskType, input.qualityMode) as TaskRouteRecord;
  }
}

import type { ModelPriceTierRecord } from "@contracts/model-routing";
import type { ProviderId } from "@shared/domain/model-routing";
import type { WenForgeDatabase } from "@main/db/connection";
import { createId } from "@main/db/id";
import { nowIso } from "./types";

export interface UpsertModelPriceTierInput {
  id?: string | undefined;
  modelPriceId: string;
  provider: ProviderId;
  model: string;
  deploymentMode?: string | null | undefined;
  minInputTokens: number;
  maxInputTokens?: number | null | undefined;
  inputPricePerMillion: number;
  outputPricePerMillion: number;
  cachedInputPricePerMillion?: number | null | undefined;
  cacheWritePricePerMillion?: number | null | undefined;
  currency?: string | undefined;
  effectiveDate: string;
  sourceNote: string;
  enabled?: boolean | undefined;
}

export interface PriceTierListFilter {
  provider?: ProviderId | undefined;
  model?: string | undefined;
}

export interface SelectActiveTierInput {
  provider: ProviderId;
  model: string;
  inputTokens: number;
  deploymentMode?: string | null | undefined;
}

export class ModelPriceTierRepository {
  constructor(private readonly db: WenForgeDatabase) {}

  list(filter: PriceTierListFilter = {}): ModelPriceTierRecord[] {
    const clauses: string[] = [];
    const values: unknown[] = [];
    if (filter.provider) {
      clauses.push("provider = ?");
      values.push(filter.provider);
    }
    if (filter.model) {
      clauses.push("model = ?");
      values.push(filter.model);
    }
    const where = clauses.length > 0 ? `where ${clauses.join(" and ")}` : "";
    return this.db.sqlite
      .prepare(
        `select * from model_price_tiers ${where}
        order by provider asc, model asc, coalesce(deployment_mode, '') asc,
          min_input_tokens asc, effective_date desc`
      )
      .all(...values)
      .map((row) => mapTier(row as Record<string, unknown>));
  }

  get(id: string): ModelPriceTierRecord | null {
    const row = this.db.sqlite.prepare("select * from model_price_tiers where id = ?").get(id);
    return row ? mapTier(row as Record<string, unknown>) : null;
  }

  upsert(input: UpsertModelPriceTierInput): ModelPriceTierRecord {
    const now = nowIso();
    const id = input.id ?? createId("tier");
    this.db.sqlite
      .prepare(
        `insert into model_price_tiers
        (id, model_price_id, provider, model, deployment_mode, min_input_tokens, max_input_tokens,
          input_price_per_million, output_price_per_million, cached_input_price_per_million,
          cache_write_price_per_million, currency, effective_date, source_note, enabled,
          created_at, updated_at)
        values (@id, @modelPriceId, @provider, @model, @deploymentMode, @minInputTokens,
          @maxInputTokens, @inputPricePerMillion, @outputPricePerMillion,
          @cachedInputPricePerMillion, @cacheWritePricePerMillion, @currency, @effectiveDate,
          @sourceNote, @enabled, @createdAt, @updatedAt)
        on conflict(id) do update set
          model_price_id = excluded.model_price_id,
          provider = excluded.provider,
          model = excluded.model,
          deployment_mode = excluded.deployment_mode,
          min_input_tokens = excluded.min_input_tokens,
          max_input_tokens = excluded.max_input_tokens,
          input_price_per_million = excluded.input_price_per_million,
          output_price_per_million = excluded.output_price_per_million,
          cached_input_price_per_million = excluded.cached_input_price_per_million,
          cache_write_price_per_million = excluded.cache_write_price_per_million,
          currency = excluded.currency,
          effective_date = excluded.effective_date,
          source_note = excluded.source_note,
          enabled = excluded.enabled,
          updated_at = excluded.updated_at`
      )
      .run({
        id,
        modelPriceId: input.modelPriceId,
        provider: input.provider,
        model: input.model,
        deploymentMode: input.deploymentMode ?? null,
        minInputTokens: input.minInputTokens,
        maxInputTokens: input.maxInputTokens ?? null,
        inputPricePerMillion: input.inputPricePerMillion,
        outputPricePerMillion: input.outputPricePerMillion,
        cachedInputPricePerMillion: input.cachedInputPricePerMillion ?? null,
        cacheWritePricePerMillion: input.cacheWritePricePerMillion ?? null,
        currency: input.currency ?? "USD",
        effectiveDate: input.effectiveDate,
        sourceNote: input.sourceNote,
        enabled: input.enabled === false ? 0 : 1,
        createdAt: now,
        updatedAt: now
      });
    return this.get(id) as ModelPriceTierRecord;
  }

  selectActive(input: SelectActiveTierInput): ModelPriceTierRecord | null {
    const modes = input.deploymentMode
      ? [input.deploymentMode]
      : ["global", null] as Array<string | null>;
    for (const mode of modes) {
      const row = this.db.sqlite
        .prepare(
          `select * from model_price_tiers
          where provider = @provider
            and model = @model
            and enabled = 1
            and ((@deploymentMode is null and deployment_mode is null)
              or deployment_mode = @deploymentMode)
            and min_input_tokens <= @inputTokens
            and (max_input_tokens is null or max_input_tokens >= @inputTokens)
          order by effective_date desc, min_input_tokens desc, rowid desc
          limit 1`
        )
        .get({
          provider: input.provider,
          model: input.model,
          deploymentMode: mode,
          inputTokens: input.inputTokens
        });
      if (row) return mapTier(row as Record<string, unknown>);
    }
    return null;
  }
}

function mapTier(row: Record<string, unknown>): ModelPriceTierRecord {
  return {
    id: String(row.id),
    modelPriceId: String(row.model_price_id),
    provider: String(row.provider) as ProviderId,
    model: String(row.model),
    deploymentMode: nullableString(row.deployment_mode),
    minInputTokens: Number(row.min_input_tokens),
    maxInputTokens: nullableNumber(row.max_input_tokens),
    inputPricePerMillion: Number(row.input_price_per_million),
    outputPricePerMillion: Number(row.output_price_per_million),
    cachedInputPricePerMillion: nullableNumber(row.cached_input_price_per_million),
    cacheWritePricePerMillion: nullableNumber(row.cache_write_price_per_million),
    currency: String(row.currency),
    effectiveDate: String(row.effective_date),
    sourceNote: String(row.source_note),
    enabled: row.enabled === true || row.enabled === 1,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

function nullableString(value: unknown): string | null {
  return value === null || typeof value === "undefined" ? null : String(value);
}

function nullableNumber(value: unknown): number | null {
  return value === null || typeof value === "undefined" ? null : Number(value);
}

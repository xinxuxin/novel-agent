import type { ModelPriceRecord } from "@contracts/model-routing";
import type { ProviderId } from "@shared/domain/model-routing";
import type { WenForgeDatabase } from "@main/db/connection";
import { createId } from "@main/db/id";
import { nowIso } from "./types";

export interface UpsertModelPriceInput {
  id?: string | undefined;
  provider: ProviderId;
  model: string;
  inputPricePerMillion: number;
  outputPricePerMillion: number;
  cachedInputPricePerMillion?: number | null | undefined;
  currency?: string | undefined;
  contextWindow?: number | null | undefined;
  maxOutputTokens?: number | null | undefined;
  effectiveDate: string;
  sourceNote: string;
  enabled?: boolean | undefined;
}

function boolFromSql(value: unknown): boolean {
  return value === true || value === 1;
}

function mapPrice(row: Record<string, unknown>): ModelPriceRecord {
  return {
    id: String(row.id),
    provider: String(row.provider) as ProviderId,
    model: String(row.model),
    inputPricePerMillion: Number(row.input_price_per_million),
    outputPricePerMillion: Number(row.output_price_per_million),
    cachedInputPricePerMillion:
      row.cached_input_price_per_million === null
        ? null
        : Number(row.cached_input_price_per_million),
    currency: String(row.currency),
    contextWindow: row.context_window === null ? null : Number(row.context_window),
    maxOutputTokens: row.max_output_tokens === null ? null : Number(row.max_output_tokens),
    effectiveDate: String(row.effective_date),
    sourceNote: String(row.source_note),
    enabled: boolFromSql(row.enabled),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

export class ModelPriceRepository {
  constructor(private readonly db: WenForgeDatabase) {}

  list(): ModelPriceRecord[] {
    return this.db.sqlite
      .prepare("select * from model_prices order by provider asc, model asc, effective_date desc")
      .all()
      .map((row) => mapPrice(row as Record<string, unknown>));
  }

  get(id: string): ModelPriceRecord | null {
    const row = this.db.sqlite.prepare("select * from model_prices where id = ?").get(id);
    return row ? mapPrice(row as Record<string, unknown>) : null;
  }

  findActive(provider: ProviderId, model: string): ModelPriceRecord | null {
    const row = this.db.sqlite
      .prepare(
        `select * from model_prices
        where provider = ? and model = ? and enabled = 1
        order by effective_date desc limit 1`
      )
      .get(provider, model);
    return row ? mapPrice(row as Record<string, unknown>) : null;
  }

  upsert(input: UpsertModelPriceInput): ModelPriceRecord {
    const now = nowIso();
    const id = input.id ?? createId("price");
    this.db.sqlite
      .prepare(
        `insert into model_prices
        (id, provider, model, input_price_per_million, output_price_per_million,
          cached_input_price_per_million, currency, context_window, max_output_tokens,
          effective_date, source_note, enabled, created_at, updated_at)
        values (@id, @provider, @model, @inputPricePerMillion, @outputPricePerMillion,
          @cachedInputPricePerMillion, @currency, @contextWindow, @maxOutputTokens,
          @effectiveDate, @sourceNote, @enabled, @createdAt, @updatedAt)
        on conflict(id) do update set
          provider = excluded.provider,
          model = excluded.model,
          input_price_per_million = excluded.input_price_per_million,
          output_price_per_million = excluded.output_price_per_million,
          cached_input_price_per_million = excluded.cached_input_price_per_million,
          currency = excluded.currency,
          context_window = excluded.context_window,
          max_output_tokens = excluded.max_output_tokens,
          effective_date = excluded.effective_date,
          source_note = excluded.source_note,
          enabled = excluded.enabled,
          updated_at = excluded.updated_at`
      )
      .run({
        id,
        provider: input.provider,
        model: input.model,
        inputPricePerMillion: input.inputPricePerMillion,
        outputPricePerMillion: input.outputPricePerMillion,
        cachedInputPricePerMillion: input.cachedInputPricePerMillion ?? null,
        currency: input.currency ?? "USD",
        contextWindow: input.contextWindow ?? null,
        maxOutputTokens: input.maxOutputTokens ?? null,
        effectiveDate: input.effectiveDate,
        sourceNote: input.sourceNote,
        enabled: input.enabled === false ? 0 : 1,
        createdAt: now,
        updatedAt: now
      });
    return this.get(id) as ModelPriceRecord;
  }
}

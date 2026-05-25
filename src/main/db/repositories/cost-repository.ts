import type { WenForgeDatabase } from "@main/db/connection";
import { createId } from "@main/db/id";
import { nowIso } from "./types";

export class CostRepository {
  constructor(private readonly db: WenForgeDatabase) {}

  createModelPrice(input: {
    provider: string;
    model: string;
    inputPricePerMillion: number;
    outputPricePerMillion: number;
    cachedInputPricePerMillion?: number | null;
    currency?: string;
    effectiveDate: string;
    sourceNote: string;
    enabled?: boolean;
  }): string {
    const now = nowIso();
    const id = createId("price");
    this.db.sqlite
      .prepare(
        `insert into model_prices
        (id, provider, model, input_price_per_million, output_price_per_million,
          cached_input_price_per_million, currency, effective_date, source_note, enabled, created_at, updated_at)
        values (@id, @provider, @model, @inputPricePerMillion, @outputPricePerMillion,
          @cachedInputPricePerMillion, @currency, @effectiveDate, @sourceNote, @enabled, @createdAt, @updatedAt)`
      )
      .run({
        id,
        provider: input.provider,
        model: input.model,
        inputPricePerMillion: input.inputPricePerMillion,
        outputPricePerMillion: input.outputPricePerMillion,
        cachedInputPricePerMillion: input.cachedInputPricePerMillion ?? null,
        currency: input.currency ?? "USD",
        effectiveDate: input.effectiveDate,
        sourceNote: input.sourceNote,
        enabled: input.enabled === false ? 0 : 1,
        createdAt: now,
        updatedAt: now
      });
    return id;
  }
}

import type { UsageCalibrationRecord } from "@contracts/model-routing";
import type { ProviderId } from "@shared/domain/model-routing";
import type { WenForgeDatabase } from "@main/db/connection";
import { createId } from "@main/db/id";
import { nowIso } from "./types";

export interface UpsertUsageCalibrationInput {
  id?: string | undefined;
  provider: ProviderId;
  model: string;
  samples: number;
  inputEstimateFactor: number;
  outputEstimateFactor: number;
  meanAbsoluteError: number;
  lastSampleAt?: string | null | undefined;
  createdAt?: string | undefined;
}

export class UsageCalibrationRepository {
  constructor(private readonly db: WenForgeDatabase) {}

  get(provider: ProviderId, model: string): UsageCalibrationRecord | null {
    const row = this.db.sqlite
      .prepare("select * from usage_calibration where provider = ? and model = ?")
      .get(provider, model);
    return row ? mapCalibration(row as Record<string, unknown>) : null;
  }

  upsert(input: UpsertUsageCalibrationInput): UsageCalibrationRecord {
    const now = nowIso();
    const existing = this.get(input.provider, input.model);
    const id = input.id ?? existing?.id ?? createId("calibration");
    this.db.sqlite
      .prepare(
        `insert into usage_calibration
        (id, provider, model, samples, input_estimate_factor, output_estimate_factor,
          mean_absolute_error, last_sample_at, created_at, updated_at)
        values (@id, @provider, @model, @samples, @inputEstimateFactor,
          @outputEstimateFactor, @meanAbsoluteError, @lastSampleAt, @createdAt, @updatedAt)
        on conflict(provider, model) do update set
          samples = excluded.samples,
          input_estimate_factor = excluded.input_estimate_factor,
          output_estimate_factor = excluded.output_estimate_factor,
          mean_absolute_error = excluded.mean_absolute_error,
          last_sample_at = excluded.last_sample_at,
          updated_at = excluded.updated_at`
      )
      .run({
        id,
        provider: input.provider,
        model: input.model,
        samples: input.samples,
        inputEstimateFactor: input.inputEstimateFactor,
        outputEstimateFactor: input.outputEstimateFactor,
        meanAbsoluteError: input.meanAbsoluteError,
        lastSampleAt: input.lastSampleAt ?? null,
        createdAt: input.createdAt ?? existing?.createdAt ?? now,
        updatedAt: now
      });
    return this.get(input.provider, input.model) as UsageCalibrationRecord;
  }
}

function mapCalibration(row: Record<string, unknown>): UsageCalibrationRecord {
  const samples = Number(row.samples);
  return {
    id: String(row.id),
    provider: String(row.provider) as ProviderId,
    model: String(row.model),
    samples,
    inputEstimateFactor: Number(row.input_estimate_factor),
    outputEstimateFactor: Number(row.output_estimate_factor),
    meanAbsoluteError: Number(row.mean_absolute_error),
    lastSampleAt: nullableString(row.last_sample_at),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    confidence: Math.min(1, samples / 20)
  };
}

function nullableString(value: unknown): string | null {
  return value === null || typeof value === "undefined" ? null : String(value);
}

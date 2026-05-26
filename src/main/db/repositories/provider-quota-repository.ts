import type { ProviderQuotaNoteRecord } from "@contracts/model-routing";
import type { ProviderId } from "@shared/domain/model-routing";
import type { WenForgeDatabase } from "@main/db/connection";
import { createId } from "@main/db/id";
import { nowIso } from "./types";

export interface UpsertProviderQuotaInput {
  id?: string | undefined;
  provider: ProviderId;
  creditBalance?: number | null | undefined;
  monthlyBudget?: number | null | undefined;
  freeQuotaRemaining?: number | null | undefined;
  refreshedAt?: string | null | undefined;
  notes?: string | null | undefined;
}

export class ProviderQuotaRepository {
  constructor(private readonly db: WenForgeDatabase) {}

  list(): ProviderQuotaNoteRecord[] {
    return this.db.sqlite
      .prepare("select * from provider_quota_notes order by provider asc")
      .all()
      .map((row) => mapQuota(row as Record<string, unknown>));
  }

  get(provider: ProviderId): ProviderQuotaNoteRecord | null {
    const row = this.db.sqlite
      .prepare("select * from provider_quota_notes where provider = ?")
      .get(provider);
    return row ? mapQuota(row as Record<string, unknown>) : null;
  }

  upsert(input: UpsertProviderQuotaInput): ProviderQuotaNoteRecord {
    const now = nowIso();
    const existing = this.get(input.provider);
    const id = input.id ?? existing?.id ?? createId("quota");
    this.db.sqlite
      .prepare(
        `insert into provider_quota_notes
        (id, provider, credit_balance, monthly_budget, free_quota_remaining, refreshed_at, notes,
          created_at, updated_at)
        values (@id, @provider, @creditBalance, @monthlyBudget, @freeQuotaRemaining,
          @refreshedAt, @notes, @createdAt, @updatedAt)
        on conflict(provider) do update set
          credit_balance = excluded.credit_balance,
          monthly_budget = excluded.monthly_budget,
          free_quota_remaining = excluded.free_quota_remaining,
          refreshed_at = excluded.refreshed_at,
          notes = excluded.notes,
          updated_at = excluded.updated_at`
      )
      .run({
        id,
        provider: input.provider,
        creditBalance:
          typeof input.creditBalance === "undefined"
            ? existing?.creditBalance ?? null
            : input.creditBalance,
        monthlyBudget:
          typeof input.monthlyBudget === "undefined"
            ? existing?.monthlyBudget ?? null
            : input.monthlyBudget,
        freeQuotaRemaining:
          typeof input.freeQuotaRemaining === "undefined"
            ? existing?.freeQuotaRemaining ?? null
            : input.freeQuotaRemaining,
        refreshedAt:
          typeof input.refreshedAt === "undefined" ? existing?.refreshedAt ?? null : input.refreshedAt,
        notes: typeof input.notes === "undefined" ? existing?.notes ?? null : input.notes,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now
      });
    return this.get(input.provider) as ProviderQuotaNoteRecord;
  }
}

function mapQuota(row: Record<string, unknown>): ProviderQuotaNoteRecord {
  return {
    id: String(row.id),
    provider: String(row.provider) as ProviderId,
    creditBalance: nullableNumber(row.credit_balance),
    monthlyBudget: nullableNumber(row.monthly_budget),
    freeQuotaRemaining: nullableNumber(row.free_quota_remaining),
    refreshedAt: nullableString(row.refreshed_at),
    notes: nullableString(row.notes),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

function nullableNumber(value: unknown): number | null {
  return value === null || typeof value === "undefined" ? null : Number(value);
}

function nullableString(value: unknown): string | null {
  return value === null || typeof value === "undefined" ? null : String(value);
}

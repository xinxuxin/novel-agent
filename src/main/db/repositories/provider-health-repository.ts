import type { ProviderHealthRecord } from "@contracts/model-routing";
import type { ProviderId } from "@shared/domain/model-routing";
import type { WenForgeDatabase } from "@main/db/connection";
import { createId } from "@main/db/id";
import { nowIso } from "./types";

type ProviderHealthStatus = ProviderHealthRecord["status"];

function mapHealth(row: Record<string, unknown>): ProviderHealthRecord {
  return {
    id: String(row.id),
    provider: String(row.provider) as ProviderId,
    model: row.model === null || typeof row.model === "undefined" ? null : String(row.model),
    status: String(row.status) as ProviderHealthStatus,
    checkedAt: String(row.checked_at),
    errorCode: row.error_code === null ? null : String(row.error_code),
    errorMessage: row.error_message === null ? null : String(row.error_message)
  };
}

export class ProviderHealthRepository {
  constructor(private readonly db: WenForgeDatabase) {}

  list(): ProviderHealthRecord[] {
    return this.db.sqlite
      .prepare("select * from provider_health order by checked_at desc")
      .all()
      .map((row) => mapHealth(row as Record<string, unknown>));
  }

  get(provider: ProviderId, model?: string | null): ProviderHealthRecord | null {
    const row = this.db.sqlite
      .prepare(
        "select * from provider_health where provider = ? and coalesce(model, '') = coalesce(?, '') order by checked_at desc limit 1"
      )
      .get(provider, model ?? null);
    return row ? mapHealth(row as Record<string, unknown>) : null;
  }

  recordSuccess(
    provider: ProviderId,
    model: string | null,
    runId?: string | null
  ): ProviderHealthRecord {
    void runId;
    return this.upsert({
      provider,
      model,
      status: "healthy",
      errorCode: null,
      errorMessage: null
    });
  }

  recordFailure(input: {
    provider: ProviderId;
    model?: string | null;
    code: string;
    message: string;
    terminal?: boolean;
  }): ProviderHealthRecord {
    return this.upsert({
      provider: input.provider,
      model: input.model ?? null,
      status: input.terminal ? "down" : "degraded",
      errorCode: input.code,
      errorMessage: input.message
    });
  }

  reset(provider?: ProviderId): void {
    if (provider) {
      this.db.sqlite.prepare("delete from provider_health where provider = ?").run(provider);
      return;
    }
    this.db.sqlite.prepare("delete from provider_health").run();
  }

  private upsert(input: {
    provider: ProviderId;
    model: string | null;
    status: ProviderHealthStatus;
    errorCode: string | null;
    errorMessage: string | null;
  }): ProviderHealthRecord {
    const existing = this.get(input.provider, input.model);
    const id = existing?.id ?? createId("health");
    const checkedAt = nowIso();
    this.db.sqlite
      .prepare(
        `insert into provider_health
        (id, provider, model, status, checked_at, error_code, error_message)
        values (@id, @provider, @model, @status, @checkedAt, @errorCode, @errorMessage)
        on conflict(id) do update set
          provider = excluded.provider,
          model = excluded.model,
          status = excluded.status,
          checked_at = excluded.checked_at,
          error_code = excluded.error_code,
          error_message = excluded.error_message`
      )
      .run({
        id,
        provider: input.provider,
        model: input.model,
        status: input.status,
        checkedAt,
        errorCode: input.errorCode,
        errorMessage: input.errorMessage
      });
    return this.get(input.provider, input.model) as ProviderHealthRecord;
  }
}

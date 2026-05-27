import type { ProviderCredentialDto } from "@contracts/model-routing";
import type { ProviderId, CredentialStatus } from "@shared/domain/model-routing";
import type { WenForgeDatabase } from "@main/db/connection";
import { createId } from "@main/db/id";
import { nowIso } from "./types";

export interface ProviderCredentialSecretRecord extends ProviderCredentialDto {
  encryptedSecretBase64: string | null;
}

export interface SaveProviderCredentialRecordInput {
  id?: string;
  provider: ProviderId;
  displayName: string;
  baseUrl?: string | null | undefined;
  encryptedSecretBase64: string;
  redactedKeyLabel: string;
}

function boolFromSql(value: unknown): boolean {
  return value === true || value === 1;
}

function mapCredential(row: Record<string, unknown>): ProviderCredentialSecretRecord {
  return {
    id: String(row.id),
    provider: String(row.provider) as ProviderId,
    displayName: String(row.display_name),
    baseUrl: row.base_url === null ? null : String(row.base_url),
    isConfigured: boolFromSql(row.is_configured),
    redactedKeyLabel: String(row.redacted_key_label),
    lastTestedAt: row.last_tested_at === null ? null : String(row.last_tested_at),
    lastStatus: String(row.last_status) as CredentialStatus,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    encryptedSecretBase64:
      row.encrypted_secret_base64 === null ? null : String(row.encrypted_secret_base64)
  };
}

export class ProviderCredentialRepository {
  constructor(private readonly db: WenForgeDatabase) {}

  list(): ProviderCredentialSecretRecord[] {
    return this.db.sqlite
      .prepare("select * from provider_credentials order by provider asc, display_name asc")
      .all()
      .map((row) => mapCredential(row as Record<string, unknown>));
  }

  listConfiguredByProvider(provider: ProviderId): ProviderCredentialSecretRecord[] {
    return this.db.sqlite
      .prepare(
        `select * from provider_credentials
        where provider = ? and is_configured = 1
        order by case last_status when 'test_failed' then 1 else 0 end asc, updated_at desc`
      )
      .all(provider)
      .map((row) => mapCredential(row as Record<string, unknown>));
  }

  get(id: string): ProviderCredentialSecretRecord | null {
    const row = this.db.sqlite.prepare("select * from provider_credentials where id = ?").get(id);
    return row ? mapCredential(row as Record<string, unknown>) : null;
  }

  save(input: SaveProviderCredentialRecordInput): ProviderCredentialSecretRecord {
    const now = nowIso();
    const id = input.id ?? createId("credential");
    this.db.sqlite
      .prepare(
        `insert into provider_credentials
        (id, provider, display_name, base_url, encrypted_secret_base64, redacted_key_label,
          is_configured, last_status, created_at, updated_at)
        values (@id, @provider, @displayName, @baseUrl, @encryptedSecretBase64, @redactedKeyLabel,
          1, 'configured', @createdAt, @updatedAt)
        on conflict(id) do update set
          provider = excluded.provider,
          display_name = excluded.display_name,
          base_url = excluded.base_url,
          encrypted_secret_base64 = excluded.encrypted_secret_base64,
          redacted_key_label = excluded.redacted_key_label,
          is_configured = 1,
          last_status = 'configured',
          updated_at = excluded.updated_at`
      )
      .run({
        id,
        provider: input.provider,
        displayName: input.displayName,
        baseUrl: input.baseUrl ?? null,
        encryptedSecretBase64: input.encryptedSecretBase64,
        redactedKeyLabel: input.redactedKeyLabel,
        createdAt: now,
        updatedAt: now
      });
    return this.get(id) as ProviderCredentialSecretRecord;
  }

  updateBaseUrl(id: string, baseUrl: string | null): ProviderCredentialSecretRecord | null {
    this.db.sqlite
      .prepare("update provider_credentials set base_url = ?, updated_at = ? where id = ?")
      .run(baseUrl, nowIso(), id);
    return this.get(id);
  }

  updateStatus(
    id: string,
    status: CredentialStatus,
    lastTestedAt: string | null
  ): ProviderCredentialSecretRecord | null {
    this.db.sqlite
      .prepare(
        "update provider_credentials set last_status = ?, last_tested_at = ?, updated_at = ? where id = ?"
      )
      .run(status, lastTestedAt, nowIso(), id);
    return this.get(id);
  }

  delete(id: string, confirmed = false): boolean {
    return (
      confirmed &&
      this.db.sqlite.prepare("delete from provider_credentials where id = ?").run(id).changes > 0
    );
  }
}

import type { ProviderHealthRecord } from "@contracts/model-routing";
import { RedactionService } from "@main/security/redaction-service";

export interface DiagnosticsBundleInput {
  appVersion: string;
  platform: NodeJS.Platform | string;
  environment?: string;
  dbMigrationVersion: string;
  safeStorageAvailable: boolean;
  providerHealth: ProviderHealthRecord[];
  recentErrors?: string[];
  logs?: string[];
  settings?: unknown;
  providerCheckSummary?: unknown;
  costAccountingSummary?: unknown;
  includeManuscripts?: boolean;
  createdAt?: string;
}

export interface DiagnosticsBundle {
  appVersion: string;
  platform: string;
  environment: string;
  dbMigrationVersion: string;
  safeStorageAvailable: boolean;
  providerHealth: ProviderHealthRecord[];
  recentErrors: string[];
  logs: string[];
  settings: unknown;
  providerCheckSummary: unknown;
  costAccountingSummary: unknown;
  manuscriptsIncluded: boolean;
  createdAt: string;
}

const SECRET_KEY_PATTERN =
  /(^|_)(apiKey|api_key|authorization|token|secret|credential|encryptedSecretBase64|encrypted_secret_base64|encryptedSecretRef|encrypted_secret_ref)(_|$)/i;

export function exportDiagnosticsBundle(input: DiagnosticsBundleInput): DiagnosticsBundle {
  const redaction = new RedactionService();
  return {
    appVersion: input.appVersion,
    platform: String(input.platform),
    environment: input.environment ?? "unknown",
    dbMigrationVersion: input.dbMigrationVersion,
    safeStorageAvailable: input.safeStorageAvailable,
    providerHealth: redactJson(input.providerHealth, redaction) as ProviderHealthRecord[],
    recentErrors: (input.recentErrors ?? []).map((error) => redaction.redact(error)),
    logs: (input.logs ?? []).map((line) => redaction.redact(line)),
    settings: redactJson(input.settings ?? {}, redaction),
    providerCheckSummary: redactJson(input.providerCheckSummary ?? [], redaction),
    costAccountingSummary: redactJson(input.costAccountingSummary ?? {}, redaction),
    manuscriptsIncluded: Boolean(input.includeManuscripts),
    createdAt: input.createdAt ?? new Date().toISOString()
  };
}

export function readLatestMigrationVersion(sqlite: {
  prepare: (sql: string) => { get: () => unknown };
}): string {
  try {
    const row = sqlite
      .prepare("select hash from __drizzle_migrations order by id desc limit 1")
      .get() as { hash?: unknown } | undefined;
    return typeof row?.hash === "string" ? row.hash : "unknown";
  } catch {
    return "unknown";
  }
}

function redactJson(value: unknown, redaction: RedactionService): unknown {
  if (typeof value === "string") {
    return redaction.redact(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactJson(item, redaction));
  }

  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !SECRET_KEY_PATTERN.test(key))
        .map(([key, child]) => [key, redactJson(child, redaction)])
    );
  }

  return value;
}

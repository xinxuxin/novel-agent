import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  statSync,
  writeFileSync
} from "node:fs";
import { basename, join, resolve } from "node:path";

import { z } from "zod";

import {
  backupCreateRequestSchema,
  backupRestoreRequestSchema,
  backupSettingsSchema,
  type BackupCreateRequest,
  type BackupRecord,
  type BackupRestoreRequest,
  type BackupRestoreResult,
  type BackupSettings
} from "@contracts/import-export";
import type { WenForgeDatabase } from "@main/db/connection";
import type { RepositoryRegistry } from "@main/db/service";
import { ImportExportService, validateSafeUserPath } from "@main/files/import-export-service";

export interface BackupServiceOptions {
  database: WenForgeDatabase;
  repositories: RepositoryRegistry;
  dbPath?: string;
  userDataDir: string;
  now?: () => string;
}

const BACKUP_SETTINGS_KEY = "backup_settings";
const BACKUP_SCHEMA_VERSION = 1;
const backupFileSchema = z.object({
  metadata: z.object({
    app: z.literal("WenForge Studio"),
    schemaVersion: z.literal(BACKUP_SCHEMA_VERSION),
    createdAt: z.string(),
    reason: z.string(),
    secretsExcluded: z.literal(true)
  }),
  projects: z.array(z.unknown())
});

export class BackupService {
  private readonly importExport: ImportExportService;

  constructor(private readonly options: BackupServiceOptions) {
    this.importExport = new ImportExportService(options);
  }

  async create(input: BackupCreateRequest = {}): Promise<BackupRecord> {
    const parsed = backupCreateRequestSchema.parse(input);
    const settings = this.getSettings();
    const destinationDir =
      parsed.destinationDir ?? settings.backupLocation ?? this.defaultBackupDir();
    const backupDir = this.ensureBackupDirectory(destinationDir);
    const createdAt = this.now();
    const reason = parsed.reason ?? "manual";
    const id = backupId(createdAt, reason);
    const path = join(backupDir, `${id}.json`);
    const payload = {
      metadata: {
        app: "WenForge Studio" as const,
        schemaVersion: 1 as const,
        createdAt,
        reason,
        secretsExcluded: true as const,
        encryptedSecretsIncluded: false,
        migrationSafety: "restore requires matching WenForge backup schema"
      },
      projects: this.importExport.exportAllProjects(true)
    };

    writeFileSync(path, JSON.stringify(payload, null, 2), "utf8");
    this.applyRetention(backupDir, settings.retentionCount);
    return this.recordFromPath(path, reason, createdAt);
  }

  list(): BackupRecord[] {
    const settings = this.getSettings();
    const dirs = new Set(
      [this.defaultBackupDir(), settings.backupLocation].filter(Boolean) as string[]
    );
    return [...dirs]
      .flatMap((directory) => this.listDirectory(directory))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async restore(input: BackupRestoreRequest): Promise<BackupRestoreResult> {
    const parsed = backupRestoreRequestSchema.parse(input);
    if (!parsed.confirmed) {
      throw new Error("Backup restore requires explicit confirmation");
    }

    const record = this.findBackup(parsed.id);
    if (!record) {
      throw new Error("Backup not found");
    }

    const raw = readFileSync(record.path, "utf8");
    const payload = backupFileSchema.parse(JSON.parse(raw) as unknown);
    const preRestore = await this.create({ reason: "before_restore" });

    const transaction = this.options.database.sqlite.transaction(() => {
      this.clearRestorableData();
      for (const projectPackage of payload.projects) {
        this.importExport.importProjectJson({
          payload: projectPackage,
          conflictStrategy: "create_new_project"
        });
      }
    });
    transaction();

    return {
      restoredBackupId: parsed.id,
      preRestoreBackupId: preRestore.id,
      restoredAt: this.now()
    };
  }

  getSettings(): BackupSettings {
    const saved = this.options.repositories.settings.get<BackupSettings>(BACKUP_SETTINGS_KEY);
    const parsed = saved ? backupSettingsSchema.safeParse(saved) : null;
    if (parsed?.success) {
      return parsed.data;
    }

    return {
      autoBackup: "off",
      backupLocation: this.defaultBackupDir(),
      retentionCount: 10
    };
  }

  updateSettings(input: Partial<BackupSettings>): BackupSettings {
    const current = this.getSettings();
    const next = backupSettingsSchema.parse({
      ...current,
      ...input,
      backupLocation: input.backupLocation ?? current.backupLocation
    });
    if (next.backupLocation) {
      this.ensureBackupDirectory(next.backupLocation);
    }
    this.options.repositories.settings.set(BACKUP_SETTINGS_KEY, next);
    return next;
  }

  private findBackup(id: string): BackupRecord | null {
    const directPath = this.list().find((record) => record.id === id)?.path;
    if (directPath) return this.recordFromPath(directPath);
    return null;
  }

  private clearRestorableData(): void {
    const sqlite = this.options.database.sqlite;
    const tables = [
      "eval_scores",
      "eval_outputs",
      "eval_runs",
      "eval_cases",
      "eval_suites",
      "llm_runs",
      "provider_health",
      "task_model_routes",
      "model_prices",
      "model_profiles",
      "provider_base_urls",
      "budget_policies",
      "state_update_applications",
      "settlement_proposal_items",
      "settlement_proposals",
      "review_cards",
      "workflow_events",
      "workflow_checkpoints",
      "generation_runs",
      "memory_chunks",
      "search_index",
      "reader_positioning",
      "style_guides",
      "unresolved_hooks",
      "foreshadowing_items",
      "timeline_events",
      "power_system_rules",
      "artifacts",
      "locations",
      "factions",
      "characters",
      "story_bible_entries",
      "generated_artifacts",
      "manuscript_diffs",
      "manuscript_versions",
      "scenes",
      "chapters",
      "volumes",
      "books",
      "projects",
      "import_export_jobs"
    ];
    sqlite.pragma("foreign_keys = OFF");
    try {
      for (const table of tables) {
        sqlite.prepare(`delete from ${table}`).run();
      }
    } finally {
      sqlite.pragma("foreign_keys = ON");
    }
  }

  private listDirectory(directory: string): BackupRecord[] {
    if (!existsSync(directory)) {
      return [];
    }
    return readdirSync(directory)
      .filter((file) => file.endsWith(".json"))
      .map((file) => join(directory, file))
      .map((path) => this.recordFromPath(path))
      .filter((record): record is BackupRecord => Boolean(record));
  }

  private recordFromPath(
    path: string,
    fallbackReason = "manual",
    fallbackCreatedAt?: string
  ): BackupRecord {
    const stats = statSync(path);
    let reason = fallbackReason;
    let createdAt = fallbackCreatedAt ?? stats.mtime.toISOString();
    try {
      const metadata = JSON.parse(readFileSync(path, "utf8")) as {
        metadata?: { reason?: string; createdAt?: string };
      };
      reason = metadata.metadata?.reason ?? reason;
      createdAt = metadata.metadata?.createdAt ?? createdAt;
    } catch {
      // Keep the backup listed even if metadata cannot be parsed.
    }
    return {
      id: basename(path, ".json"),
      path,
      reason,
      createdAt,
      sizeBytes: stats.size
    };
  }

  private applyRetention(directory: string, retentionCount: number): void {
    const backups = this.listDirectory(directory).sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt)
    );
    for (const backup of backups.slice(retentionCount)) {
      const archivedPath = `${backup.path}.old`;
      renameSync(backup.path, archivedPath);
    }
  }

  private ensureBackupDirectory(directory: string): string {
    const resolved = resolve(directory);
    if (resolved.startsWith(resolve(this.options.userDataDir))) {
      validateSafeUserPath(this.options.userDataDir, resolved);
    }
    mkdirSync(resolved, { recursive: true });
    return resolved;
  }

  private defaultBackupDir(): string {
    return join(this.options.userDataDir, "backups");
  }

  private now(): string {
    return this.options.now?.() ?? new Date().toISOString();
  }
}

function backupId(createdAt: string, reason: string): string {
  return `${createdAt.replace(/[:.]/g, "-")}-${reason.replace(/[^a-zA-Z0-9_-]+/g, "-")}`;
}

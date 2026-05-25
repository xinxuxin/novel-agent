# Backup And Restore

Phase 12 adds JSON backups for local WenForge project data. Backups are local files stored in the configured backup directory, defaulting to the Electron `userData/backups` folder.

## Backup Contents

Backups include:

- metadata with schema version, creation time, and reason
- exported project JSON packages
- books, volumes, chapters, manuscript versions, story bible entries, safe settings, and redacted cost records

Backups exclude:

- decrypted API keys
- encrypted credential blobs
- provider credential records
- Authorization headers

## Backup Settings

The app stores backup settings in `app_settings`:

- `autoBackup`: `off`, `daily`, `on_app_close`, or `before_destructive_operations`
- `backupLocation`: custom local directory or the default `userData/backups`
- `retentionCount`: number of retained JSON backup files in a backup directory

Phase 12 implements manual backups and settings persistence. Automatic scheduling hooks can be expanded in a later phase.

## Restore Flow

Restore is destructive and requires explicit confirmation. The restore service:

1. Locates the selected backup by id.
2. Parses and validates backup metadata and schema version.
3. Creates a pre-restore backup first.
4. Clears restorable project/workflow/cost/eval data transactionally.
5. Imports each project package from the backup as local project records.
6. Leaves provider credentials out of the restore path.

SQLite `pragma integrity_check` remains the verification baseline after restore. Migrations should remain backward-compatible with the backup schema, and future backup schema versions must include explicit migration logic before restore.

## Safety Notes

- Restores do not silently merge credentials.
- Restore uses project JSON import validation rather than raw SQL dumps.
- Backup files are portable but should still be treated as sensitive because they may contain manuscript text, story bible facts, and cost history.

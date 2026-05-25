# Database

WenForge Studio uses SQLite as the local source of truth. Runtime database access belongs to the Electron main process; renderer code talks to it only through typed IPC contracts.

## Location

The app stores the runtime database at:

```text
<Electron userData>/data/wenforge.sqlite
```

Tests use temporary SQLite files. The app must not write runtime data into the install directory or repository root.

## Runtime Flow

1. Main process resolves the database path from `app.getPath("userData")`.
2. `createDatabaseConnection()` opens `better-sqlite3`, enables foreign keys and WAL mode, and creates a Drizzle connection.
3. `migrateDatabase()` applies the initial schema safely on startup.
4. Repositories are constructed in the main process and registered behind typed IPC endpoints.
5. Demo data is seeded only when no projects exist.

## Schema Coverage

The initial schema includes:

- project hierarchy: `projects`, `books`, `volumes`, `chapters`, `scenes`
- manuscript state: `manuscript_versions`, `manuscript_diffs`, `generated_artifacts`
- story bible and memory: `story_bible_entries`, `characters`, `factions`, `locations`, `artifacts`, `power_system_rules`, `timeline_events`, `foreshadowing_items`, `unresolved_hooks`, `style_guides`, `reader_positioning`, `memory_chunks`
- workflow: `generation_runs`, `workflow_checkpoints`, `workflow_events`, `review_cards`, `settlement_proposals`, `settlement_proposal_items`, `state_update_applications`
- provider/model/cost placeholders: `provider_credentials`, `provider_base_urls`, `model_profiles`, `model_prices`, `task_model_routes`, `provider_health`, `llm_runs`
- app tables: `app_settings`, `audit_log`, `import_export_jobs`

## Manuscript Rules

Canonical manuscript text is never overwritten in place. Saving or rolling back creates a new `manuscript_versions` row. Setting a canonical version clears previous canonical flags transactionally.

Generated artifacts remain in `generated_artifacts` and do not become canonical unless later accepted into a manuscript version.

## Search

The migration attempts to create a unified SQLite FTS5 `search_index` for memory chunks and story bible entries. Search falls back to keyword `LIKE` queries if FTS5 is unavailable or returns no result for Chinese keyword matching.

## Dev Scripts

```bash
pnpm db:generate
pnpm db:migrate
pnpm db:studio
```

These scripts are for development schema tooling. Runtime app migrations still run in the Electron main process against the `userData` database.

import type { SqliteDatabase } from "./connection";

const INITIAL_SCHEMA_SQL = `
create table if not exists __drizzle_migrations (
  id integer primary key autoincrement,
  hash text not null,
  created_at integer not null
);

create table if not exists projects (
  id text primary key,
  name text not null,
  description text,
  genre text,
  target_reader text,
  status text not null default 'active',
  created_at text not null,
  updated_at text not null
);

create table if not exists books (
  id text primary key,
  project_id text not null references projects(id) on delete cascade,
  title text not null,
  logline text,
  genre text,
  target_length_chapters integer,
  status text not null default 'active',
  created_at text not null,
  updated_at text not null
);
create index if not exists books_project_id_idx on books(project_id);

create table if not exists volumes (
  id text primary key,
  book_id text not null references books(id) on delete cascade,
  title text not null,
  volume_index integer not null,
  summary text,
  status text not null default 'planned',
  created_at text not null,
  updated_at text not null,
  unique(book_id, volume_index)
);

create table if not exists chapters (
  id text primary key,
  book_id text not null references books(id) on delete cascade,
  volume_id text references volumes(id) on delete set null,
  chapter_index integer not null,
  title text not null,
  status text not null default 'planned',
  target_words integer not null default 3000,
  current_words integer not null default 0,
  summary text,
  outline_json text,
  created_at text not null,
  updated_at text not null,
  unique(book_id, chapter_index)
);
create index if not exists chapters_book_id_idx on chapters(book_id);

create table if not exists scenes (
  id text primary key,
  chapter_id text not null references chapters(id) on delete cascade,
  scene_index integer not null,
  title text,
  pov_character_id text,
  setting text,
  goal text,
  obstacle text,
  conflict_beat text,
  emotional_turn text,
  outcome text,
  handoff text,
  raw_card_json text,
  created_at text not null,
  updated_at text not null
);

create table if not exists manuscript_versions (
  id text primary key,
  chapter_id text not null references chapters(id) on delete cascade,
  parent_version_id text,
  version_index integer not null,
  branch_label text,
  title text not null,
  content_markdown text not null,
  content_plaintext text not null,
  source_type text not null check(source_type in ('manual', 'generated', 'imported', 'restored')),
  generation_run_id text,
  is_canonical integer not null default 0,
  word_count integer not null default 0,
  character_count integer not null default 0,
  created_at text not null
);
create index if not exists manuscript_versions_chapter_idx on manuscript_versions(chapter_id);
create index if not exists manuscript_versions_canonical_idx on manuscript_versions(chapter_id, is_canonical);

create table if not exists manuscript_diffs (
  id text primary key,
  from_version_id text,
  to_version_id text,
  diff_json text not null,
  created_at text not null
);

create table if not exists generated_artifacts (
  id text primary key,
  generation_run_id text not null,
  chapter_id text,
  artifact_type text not null,
  title text,
  content_text text not null,
  content_json text,
  source_node text,
  created_at text not null
);

create table if not exists story_bible_entries (
  id text primary key,
  book_id text not null references books(id) on delete cascade,
  chapter_id text,
  entry_type text not null,
  title text not null,
  content text not null,
  provenance text not null default 'manual',
  source_run_id text,
  status text not null default 'active',
  created_at text not null,
  updated_at text not null
);

create table if not exists characters (
  id text primary key,
  book_id text not null references books(id) on delete cascade,
  name text not null,
  aliases_json text not null default '[]',
  role text,
  summary text,
  current_state text,
  created_at text not null,
  updated_at text not null
);

create table if not exists factions (
  id text primary key,
  book_id text not null,
  name text not null,
  summary text,
  created_at text not null,
  updated_at text not null
);

create table if not exists locations (
  id text primary key,
  book_id text not null,
  name text not null,
  summary text,
  created_at text not null,
  updated_at text not null
);

create table if not exists artifacts (
  id text primary key,
  book_id text not null,
  name text not null,
  summary text,
  created_at text not null,
  updated_at text not null
);

create table if not exists power_system_rules (
  id text primary key,
  book_id text not null,
  title text not null,
  content text not null,
  created_at text not null,
  updated_at text not null
);

create table if not exists timeline_events (
  id text primary key,
  book_id text not null,
  chapter_id text,
  event_index integer not null default 0,
  title text not null,
  content text not null,
  created_at text not null,
  updated_at text not null
);

create table if not exists foreshadowing_items (
  id text primary key,
  book_id text not null,
  chapter_id text,
  title text not null,
  content text not null,
  status text not null default 'open',
  created_at text not null,
  updated_at text not null
);

create table if not exists unresolved_hooks (
  id text primary key,
  book_id text not null,
  chapter_id text,
  title text not null,
  content text not null,
  status text not null default 'open',
  created_at text not null,
  updated_at text not null
);

create table if not exists style_guides (
  id text primary key,
  book_id text not null,
  title text not null,
  content text not null,
  created_at text not null,
  updated_at text not null
);

create table if not exists reader_positioning (
  id text primary key,
  book_id text not null,
  title text not null,
  content text not null,
  created_at text not null,
  updated_at text not null
);

create table if not exists memory_chunks (
  id text primary key,
  book_id text not null references books(id) on delete cascade,
  chapter_id text,
  source_type text not null,
  source_id text,
  title text not null,
  content text not null,
  summary text,
  tags_json text not null default '[]',
  importance integer not null default 5,
  token_estimate integer not null default 0,
  embedding_json text,
  created_at text not null,
  updated_at text not null
);

create table if not exists generation_runs (
  id text primary key,
  project_id text,
  book_id text,
  chapter_id text,
  status text not null default 'draft',
  created_at text not null,
  updated_at text not null
);

create table if not exists workflow_checkpoints (
  id text primary key,
  generation_run_id text not null,
  node_name text not null,
  state_json text not null,
  created_at text not null
);

create table if not exists workflow_events (
  id text primary key,
  generation_run_id text not null,
  event_type text not null,
  payload_json text not null,
  created_at text not null
);

create table if not exists review_cards (
  id text primary key,
  generation_run_id text not null,
  chapter_id text not null,
  review_type text not null,
  severity text not null,
  title text not null,
  issue text not null,
  evidence text,
  affected_entity_type text,
  affected_entity_id text,
  suggested_fix text,
  requires_human_judgment integer not null default 1,
  status text not null default 'open',
  raw_json text,
  created_at text not null
);

create table if not exists settlement_proposals (
  id text primary key,
  generation_run_id text not null,
  chapter_id text not null,
  status text not null default 'proposed',
  created_at text not null,
  updated_at text not null
);

create table if not exists settlement_proposal_items (
  id text primary key,
  proposal_id text not null references settlement_proposals(id) on delete cascade,
  item_type text not null,
  target_entity_type text,
  target_entity_id text,
  action_type text not null,
  evidence_summary text not null,
  confidence real not null default 0,
  before_json text,
  after_json text not null,
  status text not null default 'proposed',
  created_at text not null,
  updated_at text not null
);

create table if not exists state_update_applications (
  id text primary key,
  proposal_item_id text,
  generation_run_id text,
  entity_type text,
  entity_id text,
  update_type text,
  before_json text,
  after_json text,
  applied_by text,
  applied_at text,
  applied_entity_type text,
  applied_entity_id text,
  created_at text not null
);

create table if not exists provider_credentials (
  id text primary key,
  provider text not null,
  display_name text not null,
  base_url text,
  encrypted_secret_base64 text,
  redacted_key_label text not null default '[redacted]',
  is_configured integer not null default 0,
  last_tested_at text,
  last_status text not null default 'unknown',
  encrypted_secret_ref text,
  redacted_hint text,
  status text not null default 'not_configured',
  created_at text not null,
  updated_at text not null
);

create table if not exists provider_base_urls (
  id text primary key,
  provider text not null,
  base_url text not null,
  enabled integer not null default 1,
  created_at text not null,
  updated_at text not null
);

create table if not exists model_profiles (
  id text primary key,
  provider text not null,
  model text not null,
  display_name text not null,
  context_window integer,
  max_output_tokens integer,
  supports_streaming integer not null default 1,
  supports_json integer not null default 0,
  supports_tools integer not null default 0,
  supports_vision integer not null default 0,
  supports_prompt_caching integer not null default 0,
  default_temperature real not null default 0.7,
  recommended_tasks_json text not null default '[]',
  enabled integer not null default 1,
  created_at text not null,
  updated_at text not null,
  unique(provider, model)
);

create table if not exists model_prices (
  id text primary key,
  provider text not null,
  model text not null,
  input_price_per_million real not null,
  output_price_per_million real not null,
  cached_input_price_per_million real,
  currency text not null default 'USD',
  context_window integer,
  max_output_tokens integer,
  effective_date text not null,
  source_note text not null,
  enabled integer not null default 1,
  created_at text not null,
  updated_at text not null
);

create table if not exists task_model_routes (
  id text primary key,
  task_type text not null,
  quality_mode text not null default 'balanced',
  provider text,
  model text,
  primary_model_profile_id text,
  fallback_model_profile_id_1 text,
  fallback_model_profile_id_2 text,
  temperature real not null default 0.7,
  max_output_tokens integer not null default 4000,
  budget_cap_per_call real,
  enabled integer not null default 1,
  created_at text not null,
  updated_at text not null,
  unique(task_type, quality_mode)
);

create table if not exists provider_health (
  id text primary key,
  provider text not null,
  model text,
  status text not null,
  checked_at text not null,
  error_code text,
  error_message text
);

create table if not exists budget_policies (
  id text primary key,
  name text not null,
  per_call_budget_cap real,
  per_workflow_budget_cap real,
  daily_budget_cap real,
  project_budget_cap real,
  warning_threshold_percent real not null default 50,
  on_budget_exceeded text not null default 'warn',
  currency text not null default 'USD',
  created_at text not null,
  updated_at text not null
);

create table if not exists llm_runs (
  id text primary key,
  generation_run_id text,
  provider text not null,
  model text not null,
  task_type text not null,
  project_id text,
  book_id text,
  chapter_id text,
  request_started_at text not null,
  request_finished_at text,
  status text not null,
  input_tokens_estimated integer not null default 0,
  output_tokens_estimated_live integer not null default 0,
  input_tokens_reported integer,
  output_tokens_reported integer,
  cached_input_tokens_reported integer,
  usage_source text not null default 'estimated',
  estimated_cost_live real not null default 0,
  final_cost real,
  currency text not null default 'USD',
  latency_ms integer,
  error_code text,
  error_message text,
  prompt_hash text,
  response_hash text,
  created_at text not null
);

create table if not exists app_settings (
  key text primary key,
  value_json text not null,
  updated_at text not null
);

create table if not exists audit_log (
  id text primary key,
  action text not null,
  entity_type text,
  entity_id text,
  details_json text,
  created_at text not null
);

create table if not exists import_export_jobs (
  id text primary key,
  job_type text not null,
  status text not null,
  payload_json text,
  created_at text not null,
  updated_at text not null
);
`;

const SEARCH_INDEX_SQL = `
create virtual table if not exists search_index using fts5(
  book_id unindexed,
  source_type unindexed,
  source_id unindexed,
  title,
  content,
  summary
);
`;

export function migrateDatabase(sqlite: SqliteDatabase): void {
  sqlite.exec(INITIAL_SCHEMA_SQL);
  ensureColumns(sqlite);

  try {
    sqlite.exec(SEARCH_INDEX_SQL);
  } catch {
    sqlite
      .prepare("insert or ignore into app_settings (key, value_json, updated_at) values (?, ?, ?)")
      .run("fts5_available", JSON.stringify(false), new Date().toISOString());
  }

  sqlite
    .prepare("insert or ignore into __drizzle_migrations (hash, created_at) values (?, ?)")
    .run("0000_initial_wenforge_schema", Date.now());
}

function ensureColumns(sqlite: SqliteDatabase): void {
  ensureColumn(sqlite, "provider_credentials", "base_url", "text");
  ensureColumn(sqlite, "provider_credentials", "encrypted_secret_base64", "text");
  ensureColumn(
    sqlite,
    "provider_credentials",
    "redacted_key_label",
    "text not null default '[redacted]'"
  );
  ensureColumn(sqlite, "provider_credentials", "is_configured", "integer not null default 0");
  ensureColumn(sqlite, "provider_credentials", "last_tested_at", "text");
  ensureColumn(sqlite, "provider_credentials", "last_status", "text not null default 'unknown'");
  ensureColumn(sqlite, "provider_health", "model", "text");
  ensureColumn(sqlite, "state_update_applications", "generation_run_id", "text");
  ensureColumn(sqlite, "state_update_applications", "entity_type", "text");
  ensureColumn(sqlite, "state_update_applications", "entity_id", "text");
  ensureColumn(sqlite, "state_update_applications", "update_type", "text");
  ensureColumn(sqlite, "state_update_applications", "before_json", "text");
  ensureColumn(sqlite, "state_update_applications", "after_json", "text");
  ensureColumn(sqlite, "state_update_applications", "applied_by", "text");
  ensureColumn(sqlite, "state_update_applications", "applied_at", "text");

  ensureColumn(sqlite, "characters", "first_appearance_chapter_id", "text");
  ensureColumn(sqlite, "characters", "goal", "text");
  ensureColumn(sqlite, "characters", "motivation", "text");
  ensureColumn(sqlite, "characters", "secret", "text");
  ensureColumn(sqlite, "characters", "contradiction", "text");
  ensureColumn(sqlite, "characters", "relationship_notes", "text");
  ensureColumn(sqlite, "characters", "speaking_style", "text");
  ensureColumn(sqlite, "characters", "forbidden_inconsistencies", "text");
  ensureColumn(sqlite, "characters", "tags_json", "text not null default '[]'");
  ensureColumn(sqlite, "characters", "importance", "integer not null default 5");
  ensureColumn(sqlite, "characters", "related_chapter_ids_json", "text not null default '[]'");

  for (const tableName of ["factions", "locations", "artifacts"]) {
    ensureColumn(sqlite, tableName, "tags_json", "text not null default '[]'");
    ensureColumn(sqlite, tableName, "importance", "integer not null default 5");
    ensureColumn(sqlite, tableName, "related_chapter_ids_json", "text not null default '[]'");
  }

  ensureColumn(sqlite, "power_system_rules", "rule_type", "text");
  ensureColumn(sqlite, "power_system_rules", "rank_level_name", "text");
  ensureColumn(sqlite, "power_system_rules", "rank_order", "integer not null default 0");
  ensureColumn(sqlite, "power_system_rules", "advancement_conditions", "text");
  ensureColumn(sqlite, "power_system_rules", "limits_costs", "text");
  ensureColumn(sqlite, "power_system_rules", "known_users_json", "text not null default '[]'");
  ensureColumn(sqlite, "power_system_rules", "contradiction_checks", "text");
  ensureColumn(sqlite, "power_system_rules", "notes", "text");
  ensureColumn(sqlite, "power_system_rules", "tags_json", "text not null default '[]'");
  ensureColumn(sqlite, "power_system_rules", "importance", "integer not null default 5");
  ensureColumn(
    sqlite,
    "power_system_rules",
    "related_chapter_ids_json",
    "text not null default '[]'"
  );

  ensureColumn(sqlite, "timeline_events", "tags_json", "text not null default '[]'");
  ensureColumn(sqlite, "timeline_events", "importance", "integer not null default 5");
  ensureColumn(sqlite, "timeline_events", "related_chapter_ids_json", "text not null default '[]'");

  ensureColumn(sqlite, "foreshadowing_items", "seed_chapter_id", "text");
  ensureColumn(sqlite, "foreshadowing_items", "hint_text", "text");
  ensureColumn(sqlite, "foreshadowing_items", "expected_payoff_chapter_id", "text");
  ensureColumn(
    sqlite,
    "foreshadowing_items",
    "related_entities_json",
    "text not null default '[]'"
  );
  ensureColumn(sqlite, "foreshadowing_items", "payoff_notes", "text");
  ensureColumn(sqlite, "foreshadowing_items", "tags_json", "text not null default '[]'");
  ensureColumn(sqlite, "foreshadowing_items", "importance", "integer not null default 5");
  ensureColumn(
    sqlite,
    "foreshadowing_items",
    "related_chapter_ids_json",
    "text not null default '[]'"
  );

  ensureColumn(sqlite, "unresolved_hooks", "source_chapter_id", "text");
  ensureColumn(sqlite, "unresolved_hooks", "hook_text", "text");
  ensureColumn(sqlite, "unresolved_hooks", "urgency", "text");
  ensureColumn(sqlite, "unresolved_hooks", "expected_resolution_window", "text");
  ensureColumn(sqlite, "unresolved_hooks", "notes", "text");
  ensureColumn(sqlite, "unresolved_hooks", "tags_json", "text not null default '[]'");
  ensureColumn(sqlite, "unresolved_hooks", "importance", "integer not null default 5");
  ensureColumn(
    sqlite,
    "unresolved_hooks",
    "related_chapter_ids_json",
    "text not null default '[]'"
  );

  ensureColumn(sqlite, "style_guides", "genre", "text");
  ensureColumn(sqlite, "style_guides", "tone", "text");
  ensureColumn(sqlite, "style_guides", "pacing_rules", "text");
  ensureColumn(sqlite, "style_guides", "forbidden_cliches", "text");
  ensureColumn(sqlite, "style_guides", "preferred_sentence_patterns", "text");
  ensureColumn(sqlite, "style_guides", "dialogue_style", "text");
  ensureColumn(sqlite, "style_guides", "chapter_ending_pattern", "text");
  ensureColumn(sqlite, "style_guides", "examples", "text");
  ensureColumn(sqlite, "style_guides", "tags_json", "text not null default '[]'");
  ensureColumn(sqlite, "style_guides", "importance", "integer not null default 5");
  ensureColumn(sqlite, "style_guides", "related_chapter_ids_json", "text not null default '[]'");

  ensureColumn(sqlite, "reader_positioning", "target_reader", "text");
  ensureColumn(sqlite, "reader_positioning", "platform_style", "text");
  ensureColumn(sqlite, "reader_positioning", "genre_expectation", "text");
  ensureColumn(sqlite, "reader_positioning", "emotional_promise", "text");
  ensureColumn(sqlite, "reader_positioning", "update_cadence_notes", "text");
  ensureColumn(sqlite, "reader_positioning", "commercial_constraints", "text");
  ensureColumn(sqlite, "reader_positioning", "tags_json", "text not null default '[]'");
  ensureColumn(sqlite, "reader_positioning", "importance", "integer not null default 5");
  ensureColumn(
    sqlite,
    "reader_positioning",
    "related_chapter_ids_json",
    "text not null default '[]'"
  );

  ensureColumn(sqlite, "model_profiles", "context_window", "integer");
  ensureColumn(sqlite, "model_profiles", "max_output_tokens", "integer");
  ensureColumn(sqlite, "model_profiles", "supports_streaming", "integer not null default 1");
  ensureColumn(sqlite, "model_profiles", "supports_json", "integer not null default 0");
  ensureColumn(sqlite, "model_profiles", "supports_tools", "integer not null default 0");
  ensureColumn(sqlite, "model_profiles", "supports_vision", "integer not null default 0");
  ensureColumn(sqlite, "model_profiles", "supports_prompt_caching", "integer not null default 0");
  ensureColumn(sqlite, "model_profiles", "default_temperature", "real not null default 0.7");
  ensureColumn(sqlite, "model_profiles", "recommended_tasks_json", "text not null default '[]'");

  ensureColumn(sqlite, "task_model_routes", "quality_mode", "text not null default 'balanced'");
  ensureColumn(sqlite, "task_model_routes", "primary_model_profile_id", "text");
  ensureColumn(sqlite, "task_model_routes", "fallback_model_profile_id_1", "text");
  ensureColumn(sqlite, "task_model_routes", "fallback_model_profile_id_2", "text");
  ensureColumn(sqlite, "task_model_routes", "temperature", "real not null default 0.7");
  ensureColumn(sqlite, "task_model_routes", "max_output_tokens", "integer not null default 4000");
  ensureColumn(sqlite, "task_model_routes", "budget_cap_per_call", "real");
  ensureTaskRouteTableShape(sqlite);
  sqlite.exec(
    "create unique index if not exists model_profiles_provider_model_unique on model_profiles(provider, model)"
  );
  sqlite.exec(
    "create unique index if not exists task_model_routes_task_quality_unique on task_model_routes(task_type, quality_mode)"
  );
}

function ensureTaskRouteTableShape(sqlite: SqliteDatabase): void {
  const table = sqlite
    .prepare("select sql from sqlite_master where type = 'table' and name = 'task_model_routes'")
    .get() as { sql: string } | undefined;
  const createSql = table?.sql ?? "";
  const hasLegacyTaskUnique =
    /task_type\s+text\s+not\s+null\s+unique/i.test(createSql) ||
    /unique\s*\(\s*task_type\s*\)/i.test(createSql);

  if (!hasLegacyTaskUnique) {
    return;
  }

  sqlite.exec(`
    alter table task_model_routes rename to task_model_routes_legacy;

    create table task_model_routes (
      id text primary key,
      task_type text not null,
      quality_mode text not null default 'balanced',
      provider text,
      model text,
      primary_model_profile_id text,
      fallback_model_profile_id_1 text,
      fallback_model_profile_id_2 text,
      temperature real not null default 0.7,
      max_output_tokens integer not null default 4000,
      budget_cap_per_call real,
      enabled integer not null default 1,
      created_at text not null,
      updated_at text not null,
      unique(task_type, quality_mode)
    );

    insert or ignore into task_model_routes (
      id,
      task_type,
      quality_mode,
      provider,
      model,
      primary_model_profile_id,
      fallback_model_profile_id_1,
      fallback_model_profile_id_2,
      temperature,
      max_output_tokens,
      budget_cap_per_call,
      enabled,
      created_at,
      updated_at
    )
    select
      id,
      task_type,
      coalesce(nullif(quality_mode, ''), 'balanced'),
      provider,
      model,
      primary_model_profile_id,
      fallback_model_profile_id_1,
      fallback_model_profile_id_2,
      temperature,
      max_output_tokens,
      budget_cap_per_call,
      enabled,
      created_at,
      updated_at
    from task_model_routes_legacy;

    drop table task_model_routes_legacy;
  `);
}

function ensureColumn(
  sqlite: SqliteDatabase,
  tableName: string,
  columnName: string,
  definition: string
): void {
  const columns = sqlite.prepare(`pragma table_info(${tableName})`).all() as Array<{
    name: string;
  }>;
  if (!columns.some((column) => column.name === columnName)) {
    sqlite.exec(`alter table ${tableName} add column ${columnName} ${definition}`);
  }
}

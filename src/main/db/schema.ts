import { index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const projects = sqliteTable("projects", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  genre: text("genre"),
  targetReader: text("target_reader"),
  status: text("status").notNull().default("active"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull()
});

export const books = sqliteTable(
  "books",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    logline: text("logline"),
    genre: text("genre"),
    targetLengthChapters: integer("target_length_chapters"),
    status: text("status").notNull().default("active"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull()
  },
  (table) => [index("books_project_id_idx").on(table.projectId)]
);

export const volumes = sqliteTable(
  "volumes",
  {
    id: text("id").primaryKey(),
    bookId: text("book_id")
      .notNull()
      .references(() => books.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    volumeIndex: integer("volume_index").notNull(),
    summary: text("summary"),
    status: text("status").notNull().default("planned"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull()
  },
  (table) => [uniqueIndex("volumes_book_index_unique").on(table.bookId, table.volumeIndex)]
);

export const chapters = sqliteTable(
  "chapters",
  {
    id: text("id").primaryKey(),
    bookId: text("book_id")
      .notNull()
      .references(() => books.id, { onDelete: "cascade" }),
    volumeId: text("volume_id").references(() => volumes.id, { onDelete: "set null" }),
    chapterIndex: integer("chapter_index").notNull(),
    title: text("title").notNull(),
    status: text("status").notNull().default("planned"),
    targetWords: integer("target_words").notNull().default(3000),
    currentWords: integer("current_words").notNull().default(0),
    summary: text("summary"),
    outlineJson: text("outline_json"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull()
  },
  (table) => [
    index("chapters_book_id_idx").on(table.bookId),
    uniqueIndex("chapters_book_index_unique").on(table.bookId, table.chapterIndex)
  ]
);

export const scenes = sqliteTable("scenes", {
  id: text("id").primaryKey(),
  chapterId: text("chapter_id")
    .notNull()
    .references(() => chapters.id, { onDelete: "cascade" }),
  sceneIndex: integer("scene_index").notNull(),
  title: text("title"),
  povCharacterId: text("pov_character_id"),
  setting: text("setting"),
  goal: text("goal"),
  obstacle: text("obstacle"),
  conflictBeat: text("conflict_beat"),
  emotionalTurn: text("emotional_turn"),
  outcome: text("outcome"),
  handoff: text("handoff"),
  rawCardJson: text("raw_card_json"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull()
});

export const manuscriptVersions = sqliteTable(
  "manuscript_versions",
  {
    id: text("id").primaryKey(),
    chapterId: text("chapter_id")
      .notNull()
      .references(() => chapters.id, { onDelete: "cascade" }),
    parentVersionId: text("parent_version_id"),
    versionIndex: integer("version_index").notNull(),
    branchLabel: text("branch_label"),
    title: text("title").notNull(),
    contentMarkdown: text("content_markdown").notNull(),
    contentPlaintext: text("content_plaintext").notNull(),
    sourceType: text("source_type").notNull(),
    generationRunId: text("generation_run_id"),
    isCanonical: integer("is_canonical", { mode: "boolean" }).notNull().default(false),
    wordCount: integer("word_count").notNull().default(0),
    characterCount: integer("character_count").notNull().default(0),
    createdAt: text("created_at").notNull()
  },
  (table) => [
    index("manuscript_versions_chapter_idx").on(table.chapterId),
    index("manuscript_versions_canonical_idx").on(table.chapterId, table.isCanonical)
  ]
);

export const generatedArtifacts = sqliteTable("generated_artifacts", {
  id: text("id").primaryKey(),
  generationRunId: text("generation_run_id").notNull(),
  chapterId: text("chapter_id"),
  artifactType: text("artifact_type").notNull(),
  title: text("title"),
  contentText: text("content_text").notNull(),
  contentJson: text("content_json"),
  sourceNode: text("source_node"),
  createdAt: text("created_at").notNull()
});

export const storyBibleEntries = sqliteTable("story_bible_entries", {
  id: text("id").primaryKey(),
  bookId: text("book_id")
    .notNull()
    .references(() => books.id, { onDelete: "cascade" }),
  chapterId: text("chapter_id"),
  entryType: text("entry_type").notNull(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  provenance: text("provenance").notNull().default("manual"),
  sourceRunId: text("source_run_id"),
  status: text("status").notNull().default("active"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull()
});

export const characters = sqliteTable("characters", {
  id: text("id").primaryKey(),
  bookId: text("book_id").notNull(),
  name: text("name").notNull(),
  aliasesJson: text("aliases_json").notNull().default("[]"),
  role: text("role"),
  firstAppearanceChapterId: text("first_appearance_chapter_id"),
  summary: text("summary"),
  currentState: text("current_state"),
  goal: text("goal"),
  motivation: text("motivation"),
  secret: text("secret"),
  contradiction: text("contradiction"),
  relationshipNotes: text("relationship_notes"),
  speakingStyle: text("speaking_style"),
  forbiddenInconsistencies: text("forbidden_inconsistencies"),
  tagsJson: text("tags_json").notNull().default("[]"),
  importance: integer("importance").notNull().default(5),
  relatedChapterIdsJson: text("related_chapter_ids_json").notNull().default("[]"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull()
});

export const factions = sqliteTable("factions", {
  id: text("id").primaryKey(),
  bookId: text("book_id").notNull(),
  name: text("name").notNull(),
  summary: text("summary"),
  tagsJson: text("tags_json").notNull().default("[]"),
  importance: integer("importance").notNull().default(5),
  relatedChapterIdsJson: text("related_chapter_ids_json").notNull().default("[]"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull()
});

export const locations = sqliteTable("locations", {
  id: text("id").primaryKey(),
  bookId: text("book_id").notNull(),
  name: text("name").notNull(),
  summary: text("summary"),
  tagsJson: text("tags_json").notNull().default("[]"),
  importance: integer("importance").notNull().default(5),
  relatedChapterIdsJson: text("related_chapter_ids_json").notNull().default("[]"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull()
});

export const artifacts = sqliteTable("artifacts", {
  id: text("id").primaryKey(),
  bookId: text("book_id").notNull(),
  name: text("name").notNull(),
  summary: text("summary"),
  tagsJson: text("tags_json").notNull().default("[]"),
  importance: integer("importance").notNull().default(5),
  relatedChapterIdsJson: text("related_chapter_ids_json").notNull().default("[]"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull()
});

export const powerSystemRules = sqliteTable("power_system_rules", {
  id: text("id").primaryKey(),
  bookId: text("book_id").notNull(),
  ruleType: text("rule_type"),
  rankLevelName: text("rank_level_name").notNull(),
  rankOrder: integer("rank_order").notNull().default(0),
  advancementConditions: text("advancement_conditions"),
  limitsCosts: text("limits_costs"),
  knownUsersJson: text("known_users_json").notNull().default("[]"),
  contradictionChecks: text("contradiction_checks"),
  notes: text("notes"),
  tagsJson: text("tags_json").notNull().default("[]"),
  importance: integer("importance").notNull().default(5),
  relatedChapterIdsJson: text("related_chapter_ids_json").notNull().default("[]"),
  title: text("title").notNull(),
  content: text("content").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull()
});

export const timelineEvents = sqliteTable("timeline_events", {
  id: text("id").primaryKey(),
  bookId: text("book_id").notNull(),
  chapterId: text("chapter_id"),
  eventIndex: integer("event_index").notNull().default(0),
  title: text("title").notNull(),
  content: text("content").notNull(),
  tagsJson: text("tags_json").notNull().default("[]"),
  importance: integer("importance").notNull().default(5),
  relatedChapterIdsJson: text("related_chapter_ids_json").notNull().default("[]"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull()
});

export const foreshadowingItems = sqliteTable("foreshadowing_items", {
  id: text("id").primaryKey(),
  bookId: text("book_id").notNull(),
  chapterId: text("chapter_id"),
  seedChapterId: text("seed_chapter_id"),
  hintText: text("hint_text"),
  expectedPayoffChapterId: text("expected_payoff_chapter_id"),
  title: text("title").notNull(),
  content: text("content").notNull(),
  status: text("status").notNull().default("seeded"),
  relatedEntitiesJson: text("related_entities_json").notNull().default("[]"),
  payoffNotes: text("payoff_notes"),
  tagsJson: text("tags_json").notNull().default("[]"),
  importance: integer("importance").notNull().default(5),
  relatedChapterIdsJson: text("related_chapter_ids_json").notNull().default("[]"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull()
});

export const unresolvedHooks = sqliteTable("unresolved_hooks", {
  id: text("id").primaryKey(),
  bookId: text("book_id").notNull(),
  chapterId: text("chapter_id"),
  sourceChapterId: text("source_chapter_id"),
  hookText: text("hook_text"),
  urgency: text("urgency"),
  expectedResolutionWindow: text("expected_resolution_window"),
  title: text("title").notNull(),
  content: text("content").notNull(),
  status: text("status").notNull().default("open"),
  notes: text("notes"),
  tagsJson: text("tags_json").notNull().default("[]"),
  importance: integer("importance").notNull().default(5),
  relatedChapterIdsJson: text("related_chapter_ids_json").notNull().default("[]"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull()
});

export const styleGuides = sqliteTable("style_guides", {
  id: text("id").primaryKey(),
  bookId: text("book_id").notNull(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  genre: text("genre"),
  tone: text("tone"),
  pacingRules: text("pacing_rules"),
  forbiddenCliches: text("forbidden_cliches"),
  preferredSentencePatterns: text("preferred_sentence_patterns"),
  dialogueStyle: text("dialogue_style"),
  chapterEndingPattern: text("chapter_ending_pattern"),
  examples: text("examples"),
  tagsJson: text("tags_json").notNull().default("[]"),
  importance: integer("importance").notNull().default(5),
  relatedChapterIdsJson: text("related_chapter_ids_json").notNull().default("[]"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull()
});

export const readerPositioning = sqliteTable("reader_positioning", {
  id: text("id").primaryKey(),
  bookId: text("book_id").notNull(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  targetReader: text("target_reader"),
  platformStyle: text("platform_style"),
  genreExpectation: text("genre_expectation"),
  emotionalPromise: text("emotional_promise"),
  updateCadenceNotes: text("update_cadence_notes"),
  commercialConstraints: text("commercial_constraints"),
  tagsJson: text("tags_json").notNull().default("[]"),
  importance: integer("importance").notNull().default(5),
  relatedChapterIdsJson: text("related_chapter_ids_json").notNull().default("[]"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull()
});

export const memoryChunks = sqliteTable("memory_chunks", {
  id: text("id").primaryKey(),
  bookId: text("book_id").notNull(),
  chapterId: text("chapter_id"),
  sourceType: text("source_type").notNull(),
  sourceId: text("source_id"),
  title: text("title").notNull(),
  content: text("content").notNull(),
  summary: text("summary"),
  tagsJson: text("tags_json").notNull().default("[]"),
  importance: integer("importance").notNull().default(5),
  tokenEstimate: integer("token_estimate").notNull().default(0),
  embeddingJson: text("embedding_json"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull()
});

export const generationRuns = sqliteTable("generation_runs", {
  id: text("id").primaryKey(),
  projectId: text("project_id"),
  bookId: text("book_id"),
  chapterId: text("chapter_id"),
  status: text("status").notNull().default("draft"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull()
});

export const llmRuns = sqliteTable("llm_runs", {
  id: text("id").primaryKey(),
  generationRunId: text("generation_run_id"),
  provider: text("provider").notNull(),
  model: text("model").notNull(),
  taskType: text("task_type").notNull(),
  projectId: text("project_id"),
  bookId: text("book_id"),
  chapterId: text("chapter_id"),
  requestStartedAt: text("request_started_at").notNull(),
  requestFinishedAt: text("request_finished_at"),
  status: text("status").notNull(),
  inputTokensEstimated: integer("input_tokens_estimated").notNull().default(0),
  outputTokensEstimatedLive: integer("output_tokens_estimated_live").notNull().default(0),
  inputTokensReported: integer("input_tokens_reported"),
  outputTokensReported: integer("output_tokens_reported"),
  cachedInputTokensReported: integer("cached_input_tokens_reported"),
  usageSource: text("usage_source").notNull().default("estimated"),
  estimatedCostLive: real("estimated_cost_live").notNull().default(0),
  finalCost: real("final_cost"),
  currency: text("currency").notNull().default("USD"),
  latencyMs: integer("latency_ms"),
  errorCode: text("error_code"),
  errorMessage: text("error_message"),
  promptHash: text("prompt_hash"),
  responseHash: text("response_hash"),
  createdAt: text("created_at").notNull()
});

export const modelPrices = sqliteTable("model_prices", {
  id: text("id").primaryKey(),
  provider: text("provider").notNull(),
  model: text("model").notNull(),
  inputPricePerMillion: real("input_price_per_million").notNull(),
  outputPricePerMillion: real("output_price_per_million").notNull(),
  cachedInputPricePerMillion: real("cached_input_price_per_million"),
  currency: text("currency").notNull().default("USD"),
  contextWindow: integer("context_window"),
  maxOutputTokens: integer("max_output_tokens"),
  effectiveDate: text("effective_date").notNull(),
  sourceNote: text("source_note").notNull(),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull()
});

export const appSettings = sqliteTable("app_settings", {
  key: text("key").primaryKey(),
  valueJson: text("value_json").notNull(),
  updatedAt: text("updated_at").notNull()
});

export const schema = {
  projects,
  books,
  volumes,
  chapters,
  scenes,
  manuscriptVersions,
  generatedArtifacts,
  storyBibleEntries,
  characters,
  factions,
  locations,
  artifacts,
  powerSystemRules,
  timelineEvents,
  foreshadowingItems,
  unresolvedHooks,
  styleGuides,
  readerPositioning,
  memoryChunks,
  generationRuns,
  llmRuns,
  modelPrices,
  appSettings
};

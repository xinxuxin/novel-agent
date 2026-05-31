import type { WenForgeDatabase } from "@main/db/connection";
import { createId } from "@main/db/id";
import { nowIso } from "./types";

export type OutlineSourceType = "paste" | "file" | "manual" | "imported";
export type PlanStatus = "draft" | "proposed" | "accepted" | "rejected" | "archived";
export type WordCountPriority = "loose" | "normal" | "strict";
export type PlanEditTargetType = "outline" | "volume" | "chapter" | "scene" | "beat" | "manuscript";
export type PlanEditProposalStatus = "proposed" | "accepted" | "rejected" | "archived";
export type IntakeStatus = "draft" | "proposed" | "accepted" | "rejected" | "archived";
export type IntakeMessageRole = "user" | "assistant" | "system";

export interface BookSettingFileRecord {
  id: string;
  bookId: string;
  title: string;
  contentMarkdown: string;
  contentPlaintext: string;
  isActive: boolean;
  sourceType: OutlineSourceType;
  createdAt: string;
  updatedAt: string;
}

export interface CreateBookSettingFileInput {
  bookId: string;
  title: string;
  contentMarkdown: string;
  contentPlaintext?: string | undefined;
  sourceType?: OutlineSourceType | undefined;
  isActive?: boolean | undefined;
}

export interface IntakeSessionRecord {
  id: string;
  projectId: string;
  bookId: string | null;
  title: string;
  status: IntakeStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CreateIntakeSessionInput {
  projectId: string;
  bookId?: string | null | undefined;
  title: string;
  status?: IntakeStatus | undefined;
}

export interface IntakeMessageRecord {
  id: string;
  sessionId: string;
  role: IntakeMessageRole;
  content: string;
  linkedArtifactId: string | null;
  createdAt: string;
}

export interface AddIntakeMessageInput {
  sessionId: string;
  role: IntakeMessageRole;
  content: string;
  linkedArtifactId?: string | null | undefined;
}

export interface IntakeArtifactRecord {
  id: string;
  sessionId: string;
  artifactType: string;
  title: string;
  contentJson: string;
  contentMarkdown: string;
  status: IntakeStatus;
  sourceMessageIdsJson: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateIntakeArtifactInput {
  sessionId: string;
  artifactType: string;
  title: string;
  contentJson: string;
  contentMarkdown?: string | undefined;
  status?: IntakeStatus | undefined;
  sourceMessageIdsJson?: string | undefined;
}

export interface OutlineSourceRecord {
  id: string;
  projectId: string;
  bookId: string;
  sourceType: OutlineSourceType;
  title: string;
  originalText: string;
  parsedAt: string | null;
  parserModel: string | null;
  createdAt: string;
}

export interface CreateOutlineSourceInput {
  projectId: string;
  bookId: string;
  sourceType: OutlineSourceType;
  title: string;
  originalText: string;
  parsedAt?: string | null | undefined;
  parserModel?: string | null | undefined;
}

export interface OutlineVersionRecord {
  id: string;
  bookId: string;
  parentVersionId: string | null;
  title: string;
  contentJson: string;
  contentMarkdown: string;
  sourceId: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface CreateOutlineVersionInput {
  bookId: string;
  parentVersionId?: string | null | undefined;
  title: string;
  contentJson: string;
  contentMarkdown: string;
  sourceId?: string | null | undefined;
  isActive?: boolean | undefined;
}

export interface MaterialDigestRecord {
  id: string;
  bookId: string;
  intakeSessionId: string | null;
  outlineVersionId: string | null;
  sourceSummaryJson: string;
  digestJson: string;
  missingInformationJson: string;
  ambiguityWarningsJson: string;
  warningsJson: string;
  acceptedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateMaterialDigestInput {
  bookId: string;
  intakeSessionId?: string | null | undefined;
  outlineVersionId?: string | null | undefined;
  sourceSummaryJson: string;
  digestJson: string;
  missingInformationJson?: string | undefined;
  ambiguityWarningsJson?: string | undefined;
  warningsJson?: string | undefined;
  acceptedAt?: string | null | undefined;
}

export interface ChapterPlanRecord {
  id: string;
  bookId: string;
  volumeId: string | null;
  chapterId: string | null;
  outlineVersionId: string | null;
  chapterIndex: number;
  title: string;
  targetWords: number;
  minWords: number | null;
  maxWords: number | null;
  wordCountPriority: WordCountPriority;
  chapterSummary: string | null;
  chapterPromise: string | null;
  openingHook: string | null;
  mainConflict: string | null;
  conflictEscalation: string | null;
  keyEventsJson: string;
  sceneCardsJson: string;
  emotionalTurn: string | null;
  payoff: string | null;
  endingHook: string | null;
  continuityDependenciesJson: string;
  charactersInvolvedJson: string;
  storyBibleFactsUsedJson: string;
  foreshadowingSeededJson: string;
  foreshadowingResolvedJson: string;
  unresolvedHooksCarriedForwardJson: string;
  outlineText: string | null;
  mustIncludeJson: string;
  mustAvoidJson: string;
  importSourceId: string | null;
  userNotes: string | null;
  riskNotes: string | null;
  status: PlanStatus;
  acceptedAt: string | null;
  acceptedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UpsertChapterPlanInput {
  id?: string | undefined;
  bookId: string;
  volumeId?: string | null | undefined;
  chapterId?: string | null | undefined;
  outlineVersionId?: string | null | undefined;
  chapterIndex: number;
  title: string;
  targetWords?: number | undefined;
  minWords?: number | null | undefined;
  maxWords?: number | null | undefined;
  wordCountPriority?: WordCountPriority | undefined;
  chapterSummary?: string | null | undefined;
  chapterPromise?: string | null | undefined;
  openingHook?: string | null | undefined;
  mainConflict?: string | null | undefined;
  conflictEscalation?: string | null | undefined;
  keyEventsJson?: string | undefined;
  sceneCardsJson?: string | undefined;
  emotionalTurn?: string | null | undefined;
  payoff?: string | null | undefined;
  endingHook?: string | null | undefined;
  continuityDependenciesJson?: string | undefined;
  charactersInvolvedJson?: string | undefined;
  storyBibleFactsUsedJson?: string | undefined;
  foreshadowingSeededJson?: string | undefined;
  foreshadowingResolvedJson?: string | undefined;
  unresolvedHooksCarriedForwardJson?: string | undefined;
  outlineText?: string | null | undefined;
  mustIncludeJson?: string | undefined;
  mustAvoidJson?: string | undefined;
  importSourceId?: string | null | undefined;
  userNotes?: string | null | undefined;
  riskNotes?: string | null | undefined;
  status?: PlanStatus | undefined;
  acceptedBy?: string | null | undefined;
}

export interface PlanEditProposalRecord {
  id: string;
  bookId: string;
  targetType: PlanEditTargetType;
  targetId: string;
  instruction: string;
  beforeJson: string;
  afterJson: string;
  patchJson: string | null;
  rationale: string;
  modelProvider: string | null;
  modelName: string | null;
  llmRunId: string | null;
  status: PlanEditProposalStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePlanEditProposalInput {
  bookId: string;
  targetType: PlanEditTargetType;
  targetId: string;
  instruction: string;
  beforeJson: string;
  afterJson: string;
  patchJson?: string | null | undefined;
  rationale: string;
  modelProvider?: string | null | undefined;
  modelName?: string | null | undefined;
  llmRunId?: string | null | undefined;
}

export class PlanningRepository {
  constructor(private readonly db: WenForgeDatabase) {}

  createBookSettingFile(input: CreateBookSettingFileInput): BookSettingFileRecord {
    const now = nowIso();
    const row = {
      id: createId("setting_file"),
      bookId: input.bookId,
      title: input.title,
      contentMarkdown: input.contentMarkdown,
      contentPlaintext: input.contentPlaintext ?? markdownToPlaintext(input.contentMarkdown),
      isActive: input.isActive === true ? 1 : 0,
      sourceType: input.sourceType ?? "manual",
      createdAt: now,
      updatedAt: now
    };
    const tx = this.db.sqlite.transaction(() => {
      if (row.isActive) {
        this.db.sqlite
          .prepare("update book_setting_files set is_active = 0, updated_at = ? where book_id = ?")
          .run(now, row.bookId);
      }
      this.db.sqlite
        .prepare(
          `insert into book_setting_files
          (id, book_id, title, content_markdown, content_plaintext, is_active, source_type,
            created_at, updated_at)
          values (@id, @bookId, @title, @contentMarkdown, @contentPlaintext, @isActive,
            @sourceType, @createdAt, @updatedAt)`
        )
        .run(row);
    });
    tx();
    return this.getBookSettingFile(row.id) as BookSettingFileRecord;
  }

  listBookSettingFiles(bookId: string): BookSettingFileRecord[] {
    return this.db.sqlite
      .prepare(
        "select * from book_setting_files where book_id = ? order by is_active desc, created_at desc"
      )
      .all(bookId)
      .map((row) => mapBookSettingFile(row as Record<string, unknown>));
  }

  getBookSettingFile(id: string): BookSettingFileRecord | null {
    const row = this.db.sqlite.prepare("select * from book_setting_files where id = ?").get(id);
    return row ? mapBookSettingFile(row as Record<string, unknown>) : null;
  }

  getActiveBookSettingFile(bookId: string): BookSettingFileRecord | null {
    const row = this.db.sqlite
      .prepare(
        "select * from book_setting_files where book_id = ? and is_active = 1 order by updated_at desc limit 1"
      )
      .get(bookId);
    return row ? mapBookSettingFile(row as Record<string, unknown>) : null;
  }

  setActiveBookSettingFile(bookId: string, id: string): BookSettingFileRecord | null {
    const now = nowIso();
    const tx = this.db.sqlite.transaction(() => {
      this.db.sqlite
        .prepare("update book_setting_files set is_active = 0, updated_at = ? where book_id = ?")
        .run(now, bookId);
      this.db.sqlite
        .prepare(
          "update book_setting_files set is_active = 1, updated_at = ? where id = ? and book_id = ?"
        )
        .run(now, id, bookId);
    });
    tx();
    return this.getBookSettingFile(id);
  }

  createIntakeSession(input: CreateIntakeSessionInput): IntakeSessionRecord {
    const now = nowIso();
    const row = {
      id: createId("intake_session"),
      projectId: input.projectId,
      bookId: input.bookId ?? null,
      title: input.title,
      status: input.status ?? "draft",
      createdAt: now,
      updatedAt: now
    };
    this.db.sqlite
      .prepare(
        `insert into intake_sessions
        (id, project_id, book_id, title, status, created_at, updated_at)
        values (@id, @projectId, @bookId, @title, @status, @createdAt, @updatedAt)`
      )
      .run(row);
    return this.getIntakeSession(row.id) as IntakeSessionRecord;
  }

  listIntakeSessions(projectId: string): IntakeSessionRecord[] {
    return this.db.sqlite
      .prepare("select * from intake_sessions where project_id = ? order by updated_at desc")
      .all(projectId)
      .map((row) => mapIntakeSession(row as Record<string, unknown>));
  }

  getIntakeSession(id: string): IntakeSessionRecord | null {
    const row = this.db.sqlite.prepare("select * from intake_sessions where id = ?").get(id);
    return row ? mapIntakeSession(row as Record<string, unknown>) : null;
  }

  updateIntakeSessionStatus(id: string, status: IntakeStatus): IntakeSessionRecord | null {
    this.db.sqlite
      .prepare("update intake_sessions set status = ?, updated_at = ? where id = ?")
      .run(status, nowIso(), id);
    return this.getIntakeSession(id);
  }

  addIntakeMessage(input: AddIntakeMessageInput): IntakeMessageRecord {
    const row = {
      id: createId("intake_message"),
      sessionId: input.sessionId,
      role: input.role,
      content: input.content,
      linkedArtifactId: input.linkedArtifactId ?? null,
      createdAt: nowIso()
    };
    this.db.sqlite
      .prepare(
        `insert into intake_messages
        (id, session_id, role, content, linked_artifact_id, created_at)
        values (@id, @sessionId, @role, @content, @linkedArtifactId, @createdAt)`
      )
      .run(row);
    this.touchIntakeSession(input.sessionId);
    return this.getIntakeMessage(row.id) as IntakeMessageRecord;
  }

  listIntakeMessages(sessionId: string): IntakeMessageRecord[] {
    return this.db.sqlite
      .prepare("select * from intake_messages where session_id = ? order by created_at asc")
      .all(sessionId)
      .map((row) => mapIntakeMessage(row as Record<string, unknown>));
  }

  getIntakeMessage(id: string): IntakeMessageRecord | null {
    const row = this.db.sqlite.prepare("select * from intake_messages where id = ?").get(id);
    return row ? mapIntakeMessage(row as Record<string, unknown>) : null;
  }

  createIntakeArtifact(input: CreateIntakeArtifactInput): IntakeArtifactRecord {
    const now = nowIso();
    const row = {
      id: createId("intake_artifact"),
      sessionId: input.sessionId,
      artifactType: input.artifactType,
      title: input.title,
      contentJson: input.contentJson,
      contentMarkdown: input.contentMarkdown ?? "",
      status: input.status ?? "proposed",
      sourceMessageIdsJson: input.sourceMessageIdsJson ?? "[]",
      createdAt: now,
      updatedAt: now
    };
    this.db.sqlite
      .prepare(
        `insert into intake_artifacts
        (id, session_id, artifact_type, title, content_json, content_markdown, status,
          source_message_ids_json, created_at, updated_at)
        values (@id, @sessionId, @artifactType, @title, @contentJson, @contentMarkdown, @status,
          @sourceMessageIdsJson, @createdAt, @updatedAt)`
      )
      .run(row);
    this.touchIntakeSession(input.sessionId);
    return this.getIntakeArtifact(row.id) as IntakeArtifactRecord;
  }

  listIntakeArtifacts(sessionId: string): IntakeArtifactRecord[] {
    return this.db.sqlite
      .prepare("select * from intake_artifacts where session_id = ? order by created_at desc")
      .all(sessionId)
      .map((row) => mapIntakeArtifact(row as Record<string, unknown>));
  }

  getIntakeArtifact(id: string): IntakeArtifactRecord | null {
    const row = this.db.sqlite.prepare("select * from intake_artifacts where id = ?").get(id);
    return row ? mapIntakeArtifact(row as Record<string, unknown>) : null;
  }

  updateIntakeArtifactStatus(id: string, status: IntakeStatus): IntakeArtifactRecord | null {
    const existing = this.getIntakeArtifact(id);
    this.db.sqlite
      .prepare("update intake_artifacts set status = ?, updated_at = ? where id = ?")
      .run(status, nowIso(), id);
    if (existing) this.touchIntakeSession(existing.sessionId);
    return this.getIntakeArtifact(id);
  }

  private touchIntakeSession(sessionId: string): void {
    this.db.sqlite
      .prepare("update intake_sessions set updated_at = ? where id = ?")
      .run(nowIso(), sessionId);
  }

  createOutlineSource(input: CreateOutlineSourceInput): OutlineSourceRecord {
    const row = {
      id: createId("outline_source"),
      projectId: input.projectId,
      bookId: input.bookId,
      sourceType: input.sourceType,
      title: input.title,
      originalText: input.originalText,
      parsedAt: input.parsedAt ?? null,
      parserModel: input.parserModel ?? null,
      createdAt: nowIso()
    };
    this.db.sqlite
      .prepare(
        `insert into outline_sources
        (id, project_id, book_id, source_type, title, original_text, parsed_at, parser_model, created_at)
        values (@id, @projectId, @bookId, @sourceType, @title, @originalText, @parsedAt, @parserModel, @createdAt)`
      )
      .run(row);
    return row;
  }

  listOutlineSources(bookId: string): OutlineSourceRecord[] {
    return this.db.sqlite
      .prepare("select * from outline_sources where book_id = ? order by created_at desc")
      .all(bookId)
      .map((row) => mapOutlineSource(row as Record<string, unknown>));
  }

  createOutlineVersion(input: CreateOutlineVersionInput): OutlineVersionRecord {
    const now = nowIso();
    const row = {
      id: createId("outline_version"),
      bookId: input.bookId,
      parentVersionId: input.parentVersionId ?? null,
      title: input.title,
      contentJson: input.contentJson,
      contentMarkdown: input.contentMarkdown,
      sourceId: input.sourceId ?? null,
      isActive: input.isActive ? 1 : 0,
      createdAt: now
    };
    const tx = this.db.sqlite.transaction(() => {
      if (input.isActive) {
        this.db.sqlite
          .prepare("update outline_versions set is_active = 0 where book_id = ?")
          .run(input.bookId);
      }
      this.db.sqlite
        .prepare(
          `insert into outline_versions
          (id, book_id, parent_version_id, title, content_json, content_markdown, source_id, is_active, created_at)
          values (@id, @bookId, @parentVersionId, @title, @contentJson, @contentMarkdown, @sourceId, @isActive, @createdAt)`
        )
        .run(row);
    });
    tx();
    return this.getOutlineVersion(row.id) as OutlineVersionRecord;
  }

  listOutlineVersions(bookId: string): OutlineVersionRecord[] {
    return this.db.sqlite
      .prepare("select * from outline_versions where book_id = ? order by created_at desc")
      .all(bookId)
      .map((row) => mapOutlineVersion(row as Record<string, unknown>));
  }

  getOutlineVersion(id: string): OutlineVersionRecord | null {
    const row = this.db.sqlite.prepare("select * from outline_versions where id = ?").get(id);
    return row ? mapOutlineVersion(row as Record<string, unknown>) : null;
  }

  setActiveOutlineVersion(bookId: string, id: string): OutlineVersionRecord | null {
    const tx = this.db.sqlite.transaction(() => {
      this.db.sqlite
        .prepare("update outline_versions set is_active = 0 where book_id = ?")
        .run(bookId);
      this.db.sqlite
        .prepare("update outline_versions set is_active = 1 where id = ? and book_id = ?")
        .run(id, bookId);
    });
    tx();
    return this.getOutlineVersion(id);
  }

  createMaterialDigest(input: CreateMaterialDigestInput): MaterialDigestRecord {
    const row = {
      id: createId("material_digest"),
      bookId: input.bookId,
      intakeSessionId: input.intakeSessionId ?? null,
      outlineVersionId: input.outlineVersionId ?? null,
      sourceSummaryJson: input.sourceSummaryJson,
      digestJson: input.digestJson,
      missingInformationJson: input.missingInformationJson ?? "[]",
      ambiguityWarningsJson: input.ambiguityWarningsJson ?? "[]",
      warningsJson: input.warningsJson ?? "[]",
      acceptedAt: input.acceptedAt ?? null,
      createdAt: nowIso(),
      updatedAt: nowIso()
    };
    this.db.sqlite
      .prepare(
        `insert into material_digests
        (id, book_id, intake_session_id, outline_version_id, source_summary_json, digest_json,
          missing_information_json, ambiguity_warnings_json, warnings_json, accepted_at,
          created_at, updated_at)
        values (@id, @bookId, @intakeSessionId, @outlineVersionId, @sourceSummaryJson,
          @digestJson, @missingInformationJson, @ambiguityWarningsJson, @warningsJson,
          @acceptedAt, @createdAt, @updatedAt)`
      )
      .run(row);
    return this.getMaterialDigest(row.id) as MaterialDigestRecord;
  }

  listMaterialDigests(bookId: string): MaterialDigestRecord[] {
    return this.db.sqlite
      .prepare("select * from material_digests where book_id = ? order by created_at desc")
      .all(bookId)
      .map((row) => mapMaterialDigest(row as Record<string, unknown>));
  }

  getLatestMaterialDigest(bookId: string): MaterialDigestRecord | null {
    const row = this.db.sqlite
      .prepare("select * from material_digests where book_id = ? order by created_at desc limit 1")
      .get(bookId);
    return row ? mapMaterialDigest(row as Record<string, unknown>) : null;
  }

  getMaterialDigest(id: string): MaterialDigestRecord | null {
    const row = this.db.sqlite.prepare("select * from material_digests where id = ?").get(id);
    return row ? mapMaterialDigest(row as Record<string, unknown>) : null;
  }

  upsertChapterPlan(input: UpsertChapterPlanInput): ChapterPlanRecord {
    const now = nowIso();
    const existing = input.id
      ? this.getChapterPlan(input.id)
      : input.chapterId
        ? this.getAcceptedChapterPlan(input.chapterId)
        : null;
    const id = existing?.id ?? input.id ?? createId("chapter_plan");
    const status = input.status ?? existing?.status ?? "draft";
    const row = {
      id,
      bookId: input.bookId,
      volumeId: input.volumeId ?? existing?.volumeId ?? null,
      chapterId: input.chapterId ?? existing?.chapterId ?? null,
      outlineVersionId: input.outlineVersionId ?? existing?.outlineVersionId ?? null,
      chapterIndex: input.chapterIndex,
      title: input.title,
      targetWords: input.targetWords ?? existing?.targetWords ?? 3000,
      minWords: input.minWords === undefined ? (existing?.minWords ?? null) : input.minWords,
      maxWords: input.maxWords === undefined ? (existing?.maxWords ?? null) : input.maxWords,
      wordCountPriority: input.wordCountPriority ?? existing?.wordCountPriority ?? "normal",
      chapterSummary:
        input.chapterSummary === undefined
          ? (existing?.chapterSummary ?? null)
          : input.chapterSummary,
      chapterPromise:
        input.chapterPromise === undefined
          ? (existing?.chapterPromise ?? null)
          : input.chapterPromise,
      openingHook:
        input.openingHook === undefined ? (existing?.openingHook ?? null) : input.openingHook,
      mainConflict:
        input.mainConflict === undefined ? (existing?.mainConflict ?? null) : input.mainConflict,
      conflictEscalation:
        input.conflictEscalation === undefined
          ? (existing?.conflictEscalation ?? null)
          : input.conflictEscalation,
      keyEventsJson: input.keyEventsJson ?? existing?.keyEventsJson ?? "[]",
      sceneCardsJson: input.sceneCardsJson ?? existing?.sceneCardsJson ?? "[]",
      emotionalTurn:
        input.emotionalTurn === undefined ? (existing?.emotionalTurn ?? null) : input.emotionalTurn,
      payoff: input.payoff === undefined ? (existing?.payoff ?? null) : input.payoff,
      endingHook:
        input.endingHook === undefined ? (existing?.endingHook ?? null) : input.endingHook,
      continuityDependenciesJson:
        input.continuityDependenciesJson ?? existing?.continuityDependenciesJson ?? "[]",
      charactersInvolvedJson:
        input.charactersInvolvedJson ?? existing?.charactersInvolvedJson ?? "[]",
      storyBibleFactsUsedJson:
        input.storyBibleFactsUsedJson ?? existing?.storyBibleFactsUsedJson ?? "[]",
      foreshadowingSeededJson:
        input.foreshadowingSeededJson ?? existing?.foreshadowingSeededJson ?? "[]",
      foreshadowingResolvedJson:
        input.foreshadowingResolvedJson ?? existing?.foreshadowingResolvedJson ?? "[]",
      unresolvedHooksCarriedForwardJson:
        input.unresolvedHooksCarriedForwardJson ??
        existing?.unresolvedHooksCarriedForwardJson ??
        "[]",
      outlineText:
        input.outlineText === undefined ? (existing?.outlineText ?? null) : input.outlineText,
      mustIncludeJson: input.mustIncludeJson ?? existing?.mustIncludeJson ?? "[]",
      mustAvoidJson: input.mustAvoidJson ?? existing?.mustAvoidJson ?? "[]",
      importSourceId:
        input.importSourceId === undefined
          ? (existing?.importSourceId ?? null)
          : input.importSourceId,
      userNotes: input.userNotes === undefined ? (existing?.userNotes ?? null) : input.userNotes,
      riskNotes: input.riskNotes === undefined ? (existing?.riskNotes ?? null) : input.riskNotes,
      status,
      acceptedAt: status === "accepted" ? (existing?.acceptedAt ?? now) : null,
      acceptedBy:
        status === "accepted" ? (input.acceptedBy ?? existing?.acceptedBy ?? "local-user") : null,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now
    };
    this.db.sqlite
      .prepare(
        `insert into chapter_plans
        (id, book_id, volume_id, chapter_id, outline_version_id, chapter_index, title, target_words,
          min_words, max_words, word_count_priority, chapter_summary, chapter_promise, opening_hook,
          main_conflict, conflict_escalation, key_events_json, scene_cards_json, emotional_turn,
          payoff, ending_hook, continuity_dependencies_json, characters_involved_json,
          story_bible_facts_used_json, foreshadowing_seeded_json, foreshadowing_resolved_json,
          unresolved_hooks_carried_forward_json, outline_text, must_include_json, must_avoid_json,
          import_source_id, user_notes, risk_notes, status, accepted_at, accepted_by, created_at,
          updated_at)
        values (@id, @bookId, @volumeId, @chapterId, @outlineVersionId, @chapterIndex, @title,
          @targetWords, @minWords, @maxWords, @wordCountPriority, @chapterSummary, @chapterPromise,
          @openingHook, @mainConflict, @conflictEscalation, @keyEventsJson, @sceneCardsJson,
          @emotionalTurn, @payoff, @endingHook, @continuityDependenciesJson,
          @charactersInvolvedJson, @storyBibleFactsUsedJson, @foreshadowingSeededJson,
          @foreshadowingResolvedJson, @unresolvedHooksCarriedForwardJson, @outlineText,
          @mustIncludeJson, @mustAvoidJson, @importSourceId, @userNotes, @riskNotes, @status,
          @acceptedAt, @acceptedBy, @createdAt, @updatedAt)
        on conflict(id) do update set
          volume_id = excluded.volume_id,
          chapter_id = excluded.chapter_id,
          outline_version_id = excluded.outline_version_id,
          chapter_index = excluded.chapter_index,
          title = excluded.title,
          target_words = excluded.target_words,
          min_words = excluded.min_words,
          max_words = excluded.max_words,
          word_count_priority = excluded.word_count_priority,
          chapter_summary = excluded.chapter_summary,
          chapter_promise = excluded.chapter_promise,
          opening_hook = excluded.opening_hook,
          main_conflict = excluded.main_conflict,
          conflict_escalation = excluded.conflict_escalation,
          key_events_json = excluded.key_events_json,
          scene_cards_json = excluded.scene_cards_json,
          emotional_turn = excluded.emotional_turn,
          payoff = excluded.payoff,
          ending_hook = excluded.ending_hook,
          continuity_dependencies_json = excluded.continuity_dependencies_json,
          characters_involved_json = excluded.characters_involved_json,
          story_bible_facts_used_json = excluded.story_bible_facts_used_json,
          foreshadowing_seeded_json = excluded.foreshadowing_seeded_json,
          foreshadowing_resolved_json = excluded.foreshadowing_resolved_json,
          unresolved_hooks_carried_forward_json = excluded.unresolved_hooks_carried_forward_json,
          outline_text = excluded.outline_text,
          must_include_json = excluded.must_include_json,
          must_avoid_json = excluded.must_avoid_json,
          import_source_id = excluded.import_source_id,
          user_notes = excluded.user_notes,
          risk_notes = excluded.risk_notes,
          status = excluded.status,
          accepted_at = excluded.accepted_at,
          accepted_by = excluded.accepted_by,
          updated_at = excluded.updated_at`
      )
      .run(row);
    return this.getChapterPlan(id) as ChapterPlanRecord;
  }

  listChapterPlans(bookId: string): ChapterPlanRecord[] {
    return this.db.sqlite
      .prepare("select * from chapter_plans where book_id = ? order by chapter_index asc")
      .all(bookId)
      .map((row) => mapChapterPlan(row as Record<string, unknown>));
  }

  getChapterPlan(id: string): ChapterPlanRecord | null {
    const row = this.db.sqlite.prepare("select * from chapter_plans where id = ?").get(id);
    return row ? mapChapterPlan(row as Record<string, unknown>) : null;
  }

  getAcceptedChapterPlan(chapterId: string): ChapterPlanRecord | null {
    const row = this.db.sqlite
      .prepare(
        `select * from chapter_plans
        where chapter_id = ? and status = 'accepted'
        order by updated_at desc limit 1`
      )
      .get(chapterId);
    return row ? mapChapterPlan(row as Record<string, unknown>) : null;
  }

  createPlanEditProposal(input: CreatePlanEditProposalInput): PlanEditProposalRecord {
    const now = nowIso();
    const row = {
      id: createId("plan_proposal"),
      bookId: input.bookId,
      targetType: input.targetType,
      targetId: input.targetId,
      instruction: input.instruction,
      beforeJson: input.beforeJson,
      afterJson: input.afterJson,
      patchJson: input.patchJson ?? null,
      rationale: input.rationale,
      modelProvider: input.modelProvider ?? null,
      modelName: input.modelName ?? null,
      llmRunId: input.llmRunId ?? null,
      status: "proposed",
      createdAt: now,
      updatedAt: now
    };
    this.db.sqlite
      .prepare(
        `insert into plan_edit_proposals
        (id, book_id, target_type, target_id, instruction, before_json, after_json, patch_json,
          rationale, model_provider, model_name, llm_run_id, status, created_at, updated_at)
        values (@id, @bookId, @targetType, @targetId, @instruction, @beforeJson, @afterJson,
          @patchJson, @rationale, @modelProvider, @modelName, @llmRunId, @status, @createdAt, @updatedAt)`
      )
      .run(row);
    return this.getPlanEditProposal(row.id) as PlanEditProposalRecord;
  }

  listPlanEditProposals(bookId: string): PlanEditProposalRecord[] {
    return this.db.sqlite
      .prepare("select * from plan_edit_proposals where book_id = ? order by created_at desc")
      .all(bookId)
      .map((row) => mapPlanEditProposal(row as Record<string, unknown>));
  }

  getPlanEditProposal(id: string): PlanEditProposalRecord | null {
    const row = this.db.sqlite.prepare("select * from plan_edit_proposals where id = ?").get(id);
    return row ? mapPlanEditProposal(row as Record<string, unknown>) : null;
  }

  acceptPlanEditProposal(id: string): PlanEditProposalRecord | null {
    return this.updateProposalStatus(id, "accepted");
  }

  rejectPlanEditProposal(id: string): PlanEditProposalRecord | null {
    return this.updateProposalStatus(id, "rejected");
  }

  private updateProposalStatus(
    id: string,
    status: PlanEditProposalStatus
  ): PlanEditProposalRecord | null {
    this.db.sqlite
      .prepare("update plan_edit_proposals set status = ?, updated_at = ? where id = ?")
      .run(status, nowIso(), id);
    return this.getPlanEditProposal(id);
  }
}

function mapIntakeSession(row: Record<string, unknown>): IntakeSessionRecord {
  return {
    id: String(row.id),
    projectId: String(row.project_id),
    bookId: nullable(row.book_id),
    title: String(row.title),
    status: normalizeIntakeStatus(row.status),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

function mapIntakeMessage(row: Record<string, unknown>): IntakeMessageRecord {
  return {
    id: String(row.id),
    sessionId: String(row.session_id),
    role: normalizeIntakeMessageRole(row.role),
    content: String(row.content),
    linkedArtifactId: nullable(row.linked_artifact_id),
    createdAt: String(row.created_at)
  };
}

function mapIntakeArtifact(row: Record<string, unknown>): IntakeArtifactRecord {
  return {
    id: String(row.id),
    sessionId: String(row.session_id),
    artifactType: String(row.artifact_type),
    title: String(row.title),
    contentJson: String(row.content_json),
    contentMarkdown: String(row.content_markdown ?? ""),
    status: normalizeIntakeStatus(row.status),
    sourceMessageIdsJson: String(row.source_message_ids_json ?? "[]"),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

function mapOutlineSource(row: Record<string, unknown>): OutlineSourceRecord {
  return {
    id: String(row.id),
    projectId: String(row.project_id),
    bookId: String(row.book_id),
    sourceType: String(row.source_type) as OutlineSourceType,
    title: String(row.title),
    originalText: String(row.original_text),
    parsedAt: nullable(row.parsed_at),
    parserModel: nullable(row.parser_model),
    createdAt: String(row.created_at)
  };
}

function mapOutlineVersion(row: Record<string, unknown>): OutlineVersionRecord {
  return {
    id: String(row.id),
    bookId: String(row.book_id),
    parentVersionId: nullable(row.parent_version_id),
    title: String(row.title),
    contentJson: String(row.content_json),
    contentMarkdown: String(row.content_markdown),
    sourceId: nullable(row.source_id),
    isActive: row.is_active === 1 || row.is_active === true,
    createdAt: String(row.created_at)
  };
}

function mapMaterialDigest(row: Record<string, unknown>): MaterialDigestRecord {
  return {
    id: String(row.id),
    bookId: String(row.book_id),
    intakeSessionId: nullable(row.intake_session_id),
    outlineVersionId: nullable(row.outline_version_id),
    sourceSummaryJson: String(row.source_summary_json),
    digestJson: String(row.digest_json),
    missingInformationJson: String(row.missing_information_json ?? "[]"),
    ambiguityWarningsJson: String(row.ambiguity_warnings_json ?? "[]"),
    warningsJson: String(row.warnings_json ?? "[]"),
    acceptedAt: nullable(row.accepted_at),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at ?? row.created_at)
  };
}

function mapBookSettingFile(row: Record<string, unknown>): BookSettingFileRecord {
  return {
    id: String(row.id),
    bookId: String(row.book_id),
    title: String(row.title),
    contentMarkdown: String(row.content_markdown),
    contentPlaintext: String(row.content_plaintext),
    isActive: row.is_active === 1 || row.is_active === true,
    sourceType: normalizeOutlineSourceType(row.source_type),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

function mapChapterPlan(row: Record<string, unknown>): ChapterPlanRecord {
  return {
    id: String(row.id),
    bookId: String(row.book_id),
    volumeId: nullable(row.volume_id),
    chapterId: nullable(row.chapter_id),
    outlineVersionId: nullable(row.outline_version_id),
    chapterIndex: Number(row.chapter_index),
    title: String(row.title),
    targetWords: Number(row.target_words),
    minWords: nullableNumber(row.min_words),
    maxWords: nullableNumber(row.max_words),
    wordCountPriority: normalizeWordCountPriority(row.word_count_priority),
    chapterSummary: nullable(row.chapter_summary),
    chapterPromise: nullable(row.chapter_promise),
    openingHook: nullable(row.opening_hook),
    mainConflict: nullable(row.main_conflict),
    conflictEscalation: nullable(row.conflict_escalation),
    keyEventsJson: String(row.key_events_json ?? "[]"),
    sceneCardsJson: String(row.scene_cards_json ?? "[]"),
    emotionalTurn: nullable(row.emotional_turn),
    payoff: nullable(row.payoff),
    endingHook: nullable(row.ending_hook),
    continuityDependenciesJson: String(row.continuity_dependencies_json ?? "[]"),
    charactersInvolvedJson: String(row.characters_involved_json ?? "[]"),
    storyBibleFactsUsedJson: String(row.story_bible_facts_used_json ?? "[]"),
    foreshadowingSeededJson: String(row.foreshadowing_seeded_json ?? "[]"),
    foreshadowingResolvedJson: String(row.foreshadowing_resolved_json ?? "[]"),
    unresolvedHooksCarriedForwardJson: String(row.unresolved_hooks_carried_forward_json ?? "[]"),
    outlineText: nullable(row.outline_text),
    mustIncludeJson: String(row.must_include_json ?? "[]"),
    mustAvoidJson: String(row.must_avoid_json ?? "[]"),
    importSourceId: nullable(row.import_source_id),
    userNotes: nullable(row.user_notes),
    riskNotes: nullable(row.risk_notes),
    status: String(row.status) as PlanStatus,
    acceptedAt: nullable(row.accepted_at),
    acceptedBy: nullable(row.accepted_by),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

function mapPlanEditProposal(row: Record<string, unknown>): PlanEditProposalRecord {
  return {
    id: String(row.id),
    bookId: String(row.book_id),
    targetType: String(row.target_type) as PlanEditTargetType,
    targetId: String(row.target_id),
    instruction: String(row.instruction),
    beforeJson: String(row.before_json),
    afterJson: String(row.after_json),
    patchJson: nullable(row.patch_json),
    rationale: String(row.rationale),
    modelProvider: nullable(row.model_provider),
    modelName: nullable(row.model_name),
    llmRunId: nullable(row.llm_run_id),
    status: String(row.status) as PlanEditProposalStatus,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

function nullable(value: unknown): string | null {
  return value === null || typeof value === "undefined" ? null : String(value);
}

function nullableNumber(value: unknown): number | null {
  return value === null || typeof value === "undefined" ? null : Number(value);
}

function normalizeWordCountPriority(value: unknown): WordCountPriority {
  return value === "loose" || value === "strict" ? value : "normal";
}

function normalizeOutlineSourceType(value: unknown): OutlineSourceType {
  return value === "paste" || value === "file" || value === "imported" ? value : "manual";
}

function markdownToPlaintext(value: string): string {
  return value
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/[*_>#-]/g, " ")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeIntakeStatus(value: unknown): IntakeStatus {
  return value === "accepted" || value === "rejected" || value === "archived" || value === "draft"
    ? value
    : "proposed";
}

function normalizeIntakeMessageRole(value: unknown): IntakeMessageRole {
  return value === "assistant" || value === "system" ? value : "user";
}

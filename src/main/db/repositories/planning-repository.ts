import type { WenForgeDatabase } from "@main/db/connection";
import { createId } from "@main/db/id";
import { nowIso } from "./types";

export type OutlineSourceType = "paste" | "file" | "manual" | "imported";
export type PlanStatus = "draft" | "proposed" | "accepted" | "archived";
export type PlanEditTargetType = "outline" | "volume" | "chapter" | "scene" | "beat" | "manuscript";
export type PlanEditProposalStatus = "proposed" | "accepted" | "rejected" | "archived";

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
  chapterPromise: string | null;
  openingHook: string | null;
  mainConflict: string | null;
  emotionalTurn: string | null;
  payoff: string | null;
  endingHook: string | null;
  continuityDependenciesJson: string;
  userNotes: string | null;
  status: PlanStatus;
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
  chapterPromise?: string | null | undefined;
  openingHook?: string | null | undefined;
  mainConflict?: string | null | undefined;
  emotionalTurn?: string | null | undefined;
  payoff?: string | null | undefined;
  endingHook?: string | null | undefined;
  continuityDependenciesJson?: string | undefined;
  userNotes?: string | null | undefined;
  status?: PlanStatus | undefined;
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
      this.db.sqlite.prepare("update outline_versions set is_active = 0 where book_id = ?").run(bookId);
      this.db.sqlite
        .prepare("update outline_versions set is_active = 1 where id = ? and book_id = ?")
        .run(id, bookId);
    });
    tx();
    return this.getOutlineVersion(id);
  }

  upsertChapterPlan(input: UpsertChapterPlanInput): ChapterPlanRecord {
    const now = nowIso();
    const existing = input.id
      ? this.getChapterPlan(input.id)
      : input.chapterId
        ? this.getAcceptedChapterPlan(input.chapterId)
        : null;
    const id = existing?.id ?? input.id ?? createId("chapter_plan");
    const row = {
      id,
      bookId: input.bookId,
      volumeId: input.volumeId ?? existing?.volumeId ?? null,
      chapterId: input.chapterId ?? existing?.chapterId ?? null,
      outlineVersionId: input.outlineVersionId ?? existing?.outlineVersionId ?? null,
      chapterIndex: input.chapterIndex,
      title: input.title,
      targetWords: input.targetWords ?? existing?.targetWords ?? 3000,
      minWords: input.minWords ?? existing?.minWords ?? null,
      maxWords: input.maxWords ?? existing?.maxWords ?? null,
      chapterPromise: input.chapterPromise ?? existing?.chapterPromise ?? null,
      openingHook: input.openingHook ?? existing?.openingHook ?? null,
      mainConflict: input.mainConflict ?? existing?.mainConflict ?? null,
      emotionalTurn: input.emotionalTurn ?? existing?.emotionalTurn ?? null,
      payoff: input.payoff ?? existing?.payoff ?? null,
      endingHook: input.endingHook ?? existing?.endingHook ?? null,
      continuityDependenciesJson:
        input.continuityDependenciesJson ?? existing?.continuityDependenciesJson ?? "[]",
      userNotes: input.userNotes ?? existing?.userNotes ?? null,
      status: input.status ?? existing?.status ?? "draft",
      createdAt: existing?.createdAt ?? now,
      updatedAt: now
    };
    this.db.sqlite
      .prepare(
        `insert into chapter_plans
        (id, book_id, volume_id, chapter_id, outline_version_id, chapter_index, title, target_words,
          min_words, max_words, chapter_promise, opening_hook, main_conflict, emotional_turn, payoff,
          ending_hook, continuity_dependencies_json, user_notes, status, created_at, updated_at)
        values (@id, @bookId, @volumeId, @chapterId, @outlineVersionId, @chapterIndex, @title,
          @targetWords, @minWords, @maxWords, @chapterPromise, @openingHook, @mainConflict,
          @emotionalTurn, @payoff, @endingHook, @continuityDependenciesJson, @userNotes, @status,
          @createdAt, @updatedAt)
        on conflict(id) do update set
          volume_id = excluded.volume_id,
          chapter_id = excluded.chapter_id,
          outline_version_id = excluded.outline_version_id,
          chapter_index = excluded.chapter_index,
          title = excluded.title,
          target_words = excluded.target_words,
          min_words = excluded.min_words,
          max_words = excluded.max_words,
          chapter_promise = excluded.chapter_promise,
          opening_hook = excluded.opening_hook,
          main_conflict = excluded.main_conflict,
          emotional_turn = excluded.emotional_turn,
          payoff = excluded.payoff,
          ending_hook = excluded.ending_hook,
          continuity_dependencies_json = excluded.continuity_dependencies_json,
          user_notes = excluded.user_notes,
          status = excluded.status,
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
    chapterPromise: nullable(row.chapter_promise),
    openingHook: nullable(row.opening_hook),
    mainConflict: nullable(row.main_conflict),
    emotionalTurn: nullable(row.emotional_turn),
    payoff: nullable(row.payoff),
    endingHook: nullable(row.ending_hook),
    continuityDependenciesJson: String(row.continuity_dependencies_json ?? "[]"),
    userNotes: nullable(row.user_notes),
    status: String(row.status) as PlanStatus,
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

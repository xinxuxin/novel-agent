import type {
  DraftCandidateGroupRecord,
  DraftCandidateGroupStatus,
  DraftCandidateRecord,
  DraftCandidateStatus,
  DraftFusionRecord,
  DraftFusionStatus
} from "@contracts/draft-candidates";
import type { WenForgeDatabase } from "@main/db/connection";
import { createId } from "@main/db/id";
import { countChineseAwareWords, markdownToPlaintext, nowIso } from "./types";

export interface CreateDraftCandidateGroupInput {
  chapterId: string;
  generationRunId: string;
  chapterPlanId?: string | null | undefined;
  targetWords: number;
  userInstruction?: string | null | undefined;
  presetName?: string | null | undefined;
  status?: DraftCandidateGroupStatus | undefined;
}

export interface CreateDraftCandidateInput {
  groupId: string;
  provider: DraftCandidateRecord["provider"];
  model: string;
  roleLabel: string;
  contentMarkdown?: string | undefined;
  llmRunId?: string | null | undefined;
  cost?: number | null | undefined;
  latencyMs?: number | null | undefined;
  status?: DraftCandidateStatus | undefined;
  errorMessage?: string | null | undefined;
}

export interface UpdateDraftCandidateInput {
  contentMarkdown?: string | undefined;
  llmRunId?: string | null | undefined;
  cost?: number | null | undefined;
  latencyMs?: number | null | undefined;
  status?: DraftCandidateStatus | undefined;
  errorMessage?: string | null | undefined;
}

export interface CreateDraftFusionInput {
  groupId: string;
  baseCandidateId: string;
  referenceCandidateIds: string[];
  fusionInstruction?: string | null | undefined;
  fusionProvider: DraftFusionRecord["fusionProvider"];
  fusionModel: string;
  status?: DraftFusionStatus | undefined;
}

export interface UpdateDraftFusionInput {
  resultArtifactId?: string | null | undefined;
  resultManuscriptVersionId?: string | null | undefined;
  llmRunId?: string | null | undefined;
  cost?: number | null | undefined;
  latencyMs?: number | null | undefined;
  status?: DraftFusionStatus | undefined;
  errorMessage?: string | null | undefined;
}

export class DraftCandidateRepository {
  constructor(private readonly db: WenForgeDatabase) {}

  createGroup(input: CreateDraftCandidateGroupInput): DraftCandidateGroupRecord {
    const now = nowIso();
    const row = {
      id: createId("draft_group"),
      chapterId: input.chapterId,
      generationRunId: input.generationRunId,
      chapterPlanId: input.chapterPlanId ?? null,
      targetWords: input.targetWords,
      userInstruction: input.userInstruction ?? null,
      presetName: input.presetName ?? null,
      status: input.status ?? "draft",
      createdAt: now,
      updatedAt: now
    };
    this.db.sqlite
      .prepare(
        `insert into draft_candidate_groups
        (id, chapter_id, generation_run_id, chapter_plan_id, target_words, user_instruction,
          preset_name, status, created_at, updated_at)
        values (@id, @chapterId, @generationRunId, @chapterPlanId, @targetWords,
          @userInstruction, @presetName, @status, @createdAt, @updatedAt)`
      )
      .run(row);
    return row;
  }

  getGroup(id: string): DraftCandidateGroupRecord | null {
    const row = this.db.sqlite.prepare("select * from draft_candidate_groups where id = ?").get(id);
    return row ? mapGroup(row as Record<string, unknown>) : null;
  }

  listGroupsByChapter(chapterId: string): DraftCandidateGroupRecord[] {
    return this.db.sqlite
      .prepare("select * from draft_candidate_groups where chapter_id = ? order by created_at desc")
      .all(chapterId)
      .map((row) => mapGroup(row as Record<string, unknown>));
  }

  updateGroupStatus(id: string, status: DraftCandidateGroupStatus): DraftCandidateGroupRecord | null {
    this.db.sqlite
      .prepare("update draft_candidate_groups set status = ?, updated_at = ? where id = ?")
      .run(status, nowIso(), id);
    return this.getGroup(id);
  }

  discardGroup(id: string): DraftCandidateGroupRecord | null {
    return this.updateGroupStatus(id, "discarded");
  }

  createCandidate(input: CreateDraftCandidateInput): DraftCandidateRecord {
    const now = nowIso();
    const contentMarkdown = input.contentMarkdown ?? "";
    const plaintext = markdownToPlaintext(contentMarkdown);
    const row = {
      id: createId("draft_candidate"),
      groupId: input.groupId,
      provider: input.provider,
      model: input.model,
      roleLabel: input.roleLabel,
      contentMarkdown,
      contentPlaintext: plaintext,
      wordCount: countChineseAwareWords(plaintext),
      characterCount: plaintext.length,
      llmRunId: input.llmRunId ?? null,
      cost: input.cost ?? null,
      latencyMs: input.latencyMs ?? null,
      status: input.status ?? "queued",
      errorMessage: input.errorMessage ?? null,
      createdAt: now,
      updatedAt: now
    };
    this.db.sqlite
      .prepare(
        `insert into draft_candidates
        (id, group_id, provider, model, role_label, content_markdown, content_plaintext,
          word_count, character_count, llm_run_id, cost, latency_ms, status, error_message,
          created_at, updated_at)
        values (@id, @groupId, @provider, @model, @roleLabel, @contentMarkdown, @contentPlaintext,
          @wordCount, @characterCount, @llmRunId, @cost, @latencyMs, @status, @errorMessage,
          @createdAt, @updatedAt)`
      )
      .run(row);
    return this.getCandidate(row.id) as DraftCandidateRecord;
  }

  updateCandidate(id: string, input: UpdateDraftCandidateInput): DraftCandidateRecord | null {
    const current = this.getCandidate(id);
    if (!current) return null;
    const contentMarkdown = input.contentMarkdown ?? current.contentMarkdown;
    const plaintext = markdownToPlaintext(contentMarkdown);
    const row = {
      id,
      contentMarkdown,
      contentPlaintext: plaintext,
      wordCount: countChineseAwareWords(plaintext),
      characterCount: plaintext.length,
      llmRunId: input.llmRunId ?? current.llmRunId,
      cost: input.cost ?? current.cost,
      latencyMs: input.latencyMs ?? current.latencyMs,
      status: input.status ?? current.status,
      errorMessage:
        typeof input.errorMessage === "undefined" ? current.errorMessage : input.errorMessage,
      updatedAt: nowIso()
    };
    this.db.sqlite
      .prepare(
        `update draft_candidates set
          content_markdown = @contentMarkdown,
          content_plaintext = @contentPlaintext,
          word_count = @wordCount,
          character_count = @characterCount,
          llm_run_id = @llmRunId,
          cost = @cost,
          latency_ms = @latencyMs,
          status = @status,
          error_message = @errorMessage,
          updated_at = @updatedAt
        where id = @id`
      )
      .run(row);
    return this.getCandidate(id);
  }

  getCandidate(id: string): DraftCandidateRecord | null {
    const row = this.db.sqlite.prepare("select * from draft_candidates where id = ?").get(id);
    return row ? mapCandidate(row as Record<string, unknown>) : null;
  }

  listCandidates(groupId: string): DraftCandidateRecord[] {
    return this.db.sqlite
      .prepare("select * from draft_candidates where group_id = ? order by created_at asc")
      .all(groupId)
      .map((row) => mapCandidate(row as Record<string, unknown>));
  }

  createFusion(input: CreateDraftFusionInput): DraftFusionRecord {
    const now = nowIso();
    const row = {
      id: createId("draft_fusion"),
      groupId: input.groupId,
      baseCandidateId: input.baseCandidateId,
      referenceCandidateIdsJson: JSON.stringify(input.referenceCandidateIds),
      fusionInstruction: input.fusionInstruction ?? null,
      fusionProvider: input.fusionProvider,
      fusionModel: input.fusionModel,
      resultArtifactId: null,
      resultManuscriptVersionId: null,
      llmRunId: null,
      cost: null,
      latencyMs: null,
      status: input.status ?? "proposed",
      errorMessage: null,
      createdAt: now,
      updatedAt: now
    };
    this.db.sqlite
      .prepare(
        `insert into draft_fusions
        (id, group_id, base_candidate_id, reference_candidate_ids_json, fusion_instruction,
          fusion_provider, fusion_model, result_artifact_id, result_manuscript_version_id,
          llm_run_id, cost, latency_ms, status, error_message, created_at, updated_at)
        values (@id, @groupId, @baseCandidateId, @referenceCandidateIdsJson, @fusionInstruction,
          @fusionProvider, @fusionModel, @resultArtifactId, @resultManuscriptVersionId,
          @llmRunId, @cost, @latencyMs, @status, @errorMessage, @createdAt, @updatedAt)`
      )
      .run(row);
    return this.getFusion(row.id) as DraftFusionRecord;
  }

  updateFusion(id: string, input: UpdateDraftFusionInput): DraftFusionRecord | null {
    const current = this.getFusion(id);
    if (!current) return null;
    const row = {
      id,
      resultArtifactId:
        typeof input.resultArtifactId === "undefined" ? current.resultArtifactId : input.resultArtifactId,
      resultManuscriptVersionId:
        typeof input.resultManuscriptVersionId === "undefined"
          ? current.resultManuscriptVersionId
          : input.resultManuscriptVersionId,
      llmRunId: typeof input.llmRunId === "undefined" ? current.llmRunId : input.llmRunId,
      cost: typeof input.cost === "undefined" ? current.cost : input.cost,
      latencyMs: typeof input.latencyMs === "undefined" ? current.latencyMs : input.latencyMs,
      status: input.status ?? current.status,
      errorMessage:
        typeof input.errorMessage === "undefined" ? current.errorMessage : input.errorMessage,
      updatedAt: nowIso()
    };
    this.db.sqlite
      .prepare(
        `update draft_fusions set
          result_artifact_id = @resultArtifactId,
          result_manuscript_version_id = @resultManuscriptVersionId,
          llm_run_id = @llmRunId,
          cost = @cost,
          latency_ms = @latencyMs,
          status = @status,
          error_message = @errorMessage,
          updated_at = @updatedAt
        where id = @id`
      )
      .run(row);
    return this.getFusion(id);
  }

  getFusion(id: string): DraftFusionRecord | null {
    const row = this.db.sqlite.prepare("select * from draft_fusions where id = ?").get(id);
    return row ? mapFusion(row as Record<string, unknown>) : null;
  }

  listFusions(groupId: string): DraftFusionRecord[] {
    return this.db.sqlite
      .prepare("select * from draft_fusions where group_id = ? order by created_at asc")
      .all(groupId)
      .map((row) => mapFusion(row as Record<string, unknown>));
  }
}

function mapGroup(row: Record<string, unknown>): DraftCandidateGroupRecord {
  return {
    id: String(row.id),
    chapterId: String(row.chapter_id),
    generationRunId: String(row.generation_run_id),
    chapterPlanId: nullable(row.chapter_plan_id),
    targetWords: Number(row.target_words),
    userInstruction: nullable(row.user_instruction),
    presetName: nullable(row.preset_name),
    status: String(row.status) as DraftCandidateGroupStatus,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

function mapCandidate(row: Record<string, unknown>): DraftCandidateRecord {
  return {
    id: String(row.id),
    groupId: String(row.group_id),
    provider: String(row.provider) as DraftCandidateRecord["provider"],
    model: String(row.model),
    roleLabel: String(row.role_label),
    contentMarkdown: String(row.content_markdown),
    contentPlaintext: String(row.content_plaintext),
    wordCount: Number(row.word_count),
    characterCount: Number(row.character_count),
    llmRunId: nullable(row.llm_run_id),
    cost: nullableNumber(row.cost),
    latencyMs: nullableNumber(row.latency_ms),
    status: String(row.status) as DraftCandidateStatus,
    errorMessage: nullable(row.error_message),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

function mapFusion(row: Record<string, unknown>): DraftFusionRecord {
  return {
    id: String(row.id),
    groupId: String(row.group_id),
    baseCandidateId: String(row.base_candidate_id),
    referenceCandidateIdsJson: String(row.reference_candidate_ids_json),
    fusionInstruction: nullable(row.fusion_instruction),
    fusionProvider: String(row.fusion_provider) as DraftFusionRecord["fusionProvider"],
    fusionModel: String(row.fusion_model),
    resultArtifactId: nullable(row.result_artifact_id),
    resultManuscriptVersionId: nullable(row.result_manuscript_version_id),
    llmRunId: nullable(row.llm_run_id),
    cost: nullableNumber(row.cost),
    latencyMs: nullableNumber(row.latency_ms),
    status: String(row.status) as DraftFusionStatus,
    errorMessage: nullable(row.error_message),
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

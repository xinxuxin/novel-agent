import type { WenForgeDatabase } from "@main/db/connection";
import { createId } from "@main/db/id";
import { nowIso } from "./types";
import type {
  SettlementProposalItem,
  SettlementProposalRecord,
  WorkflowCheckpointRecord,
  WorkflowEventRecord,
  WorkflowReviewCard
} from "@contracts/workflow";

export interface GenerationRunRecord {
  id: string;
  projectId: string | null;
  bookId: string | null;
  chapterId: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface GeneratedArtifactRecord {
  id: string;
  generationRunId: string;
  chapterId: string | null;
  artifactType: string;
  title: string | null;
  contentText: string;
  contentJson: string | null;
  sourceNode: string | null;
  createdAt: string;
}

export interface CreateGenerationRunInput {
  projectId?: string | null;
  bookId?: string | null;
  chapterId?: string | null;
  status?: string;
}

export interface CreateGeneratedArtifactInput {
  generationRunId: string;
  chapterId?: string | null;
  artifactType: string;
  title?: string | null;
  contentText: string;
  contentJson?: string | null;
  sourceNode?: string | null;
}

export interface CreateWorkflowEventInput {
  generationRunId: string;
  eventType: string;
  nodeName?: string | null;
  message: string;
  payload?: Record<string, unknown>;
}

export interface CreateReviewCardInput {
  generationRunId: string;
  chapterId: string;
  reviewType: string;
  severity: string;
  title: string;
  issue: string;
  evidence?: string | null;
  affectedEntityType?: string | null;
  affectedEntityId?: string | null;
  suggestedFix?: string | null;
  requiresHumanJudgment?: boolean;
  status?: string;
  rawJson?: string | null;
}

export interface CreateSettlementProposalInput {
  generationRunId: string;
  chapterId: string;
  status?: string;
  items: Array<{
    itemType: string;
    targetEntityType?: string | null;
    targetEntityId?: string | null;
    actionType: string;
    evidenceSummary: string;
    confidence: number;
    beforeJson?: string | null;
    afterJson: string;
    status?: string;
  }>;
}

function mapRun(row: Record<string, unknown>): GenerationRunRecord {
  return {
    id: String(row.id),
    projectId: row.project_id === null ? null : String(row.project_id),
    bookId: row.book_id === null ? null : String(row.book_id),
    chapterId: row.chapter_id === null ? null : String(row.chapter_id),
    status: String(row.status),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

function mapArtifact(row: Record<string, unknown>): GeneratedArtifactRecord {
  return {
    id: String(row.id),
    generationRunId: String(row.generation_run_id),
    chapterId: row.chapter_id === null ? null : String(row.chapter_id),
    artifactType: String(row.artifact_type),
    title: row.title === null ? null : String(row.title),
    contentText: String(row.content_text),
    contentJson: row.content_json === null ? null : String(row.content_json),
    sourceNode: row.source_node === null ? null : String(row.source_node),
    createdAt: String(row.created_at)
  };
}

function mapCheckpoint(row: Record<string, unknown>): WorkflowCheckpointRecord {
  return {
    id: String(row.id),
    generationRunId: String(row.generation_run_id),
    nodeName: String(row.node_name) as WorkflowCheckpointRecord["nodeName"],
    state: JSON.parse(String(row.state_json)) as Record<string, unknown>,
    createdAt: String(row.created_at)
  };
}

function mapEvent(row: Record<string, unknown>): WorkflowEventRecord {
  const payload = JSON.parse(String(row.payload_json)) as Record<string, unknown>;
  const nodeName = typeof payload.nodeName === "string" ? payload.nodeName : null;
  return {
    id: String(row.id),
    generationRunId: String(row.generation_run_id),
    eventType: String(row.event_type),
    nodeName: nodeName as WorkflowEventRecord["nodeName"],
    message: typeof payload.message === "string" ? payload.message : String(row.event_type),
    payload,
    createdAt: String(row.created_at)
  };
}

function mapReviewCard(row: Record<string, unknown>): WorkflowReviewCard {
  return {
    id: String(row.id),
    generationRunId: String(row.generation_run_id),
    chapterId: String(row.chapter_id),
    reviewType: String(row.review_type),
    severity: String(row.severity),
    title: String(row.title),
    issue: String(row.issue),
    evidence: nullableString(row.evidence),
    affectedEntityType: nullableString(row.affected_entity_type),
    affectedEntityId: nullableString(row.affected_entity_id),
    suggestedFix: nullableString(row.suggested_fix),
    requiresHumanJudgment:
      row.requires_human_judgment === 1 || row.requires_human_judgment === true,
    status: String(row.status),
    rawJson: nullableString(row.raw_json),
    createdAt: String(row.created_at)
  };
}

function mapSettlementProposal(
  row: Record<string, unknown>,
  items: SettlementProposalItem[]
): SettlementProposalRecord {
  return {
    id: String(row.id),
    generationRunId: String(row.generation_run_id),
    chapterId: String(row.chapter_id),
    status: String(row.status),
    items,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

function mapSettlementItem(row: Record<string, unknown>): SettlementProposalItem {
  return {
    id: String(row.id),
    proposalId: String(row.proposal_id),
    itemType: String(row.item_type),
    targetEntityType: nullableString(row.target_entity_type),
    targetEntityId: nullableString(row.target_entity_id),
    actionType: String(row.action_type),
    evidenceSummary: String(row.evidence_summary),
    confidence: Number(row.confidence),
    beforeJson: nullableString(row.before_json),
    afterJson: String(row.after_json),
    status: String(row.status),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

export class GenerationRepository {
  constructor(private readonly db: WenForgeDatabase) {}

  createRun(input: CreateGenerationRunInput = {}): GenerationRunRecord {
    const now = nowIso();
    const row = {
      id: createId("generation"),
      projectId: input.projectId ?? null,
      bookId: input.bookId ?? null,
      chapterId: input.chapterId ?? null,
      status: input.status ?? "draft",
      createdAt: now,
      updatedAt: now
    };
    this.db.sqlite
      .prepare(
        `insert into generation_runs (id, project_id, book_id, chapter_id, status, created_at, updated_at)
        values (@id, @projectId, @bookId, @chapterId, @status, @createdAt, @updatedAt)`
      )
      .run(row);
    return row;
  }

  updateRunStatus(id: string, status: string): GenerationRunRecord | null {
    this.db.sqlite
      .prepare("update generation_runs set status = ?, updated_at = ? where id = ?")
      .run(status, nowIso(), id);
    return this.getRun(id);
  }

  createArtifact(input: CreateGeneratedArtifactInput): GeneratedArtifactRecord {
    const row = {
      id: createId("artifact"),
      generationRunId: input.generationRunId,
      chapterId: input.chapterId ?? null,
      artifactType: input.artifactType,
      title: input.title ?? null,
      contentText: input.contentText,
      contentJson: input.contentJson ?? null,
      sourceNode: input.sourceNode ?? null,
      createdAt: nowIso()
    };
    this.db.sqlite
      .prepare(
        `insert into generated_artifacts
        (id, generation_run_id, chapter_id, artifact_type, title, content_text, content_json, source_node, created_at)
        values (@id, @generationRunId, @chapterId, @artifactType, @title, @contentText, @contentJson, @sourceNode, @createdAt)`
      )
      .run(row);
    return this.getArtifact(row.id) as GeneratedArtifactRecord;
  }

  getRun(id: string): GenerationRunRecord | null {
    const row = this.db.sqlite.prepare("select * from generation_runs where id = ?").get(id);
    return row ? mapRun(row as Record<string, unknown>) : null;
  }

  listRunsByChapter(chapterId: string): GenerationRunRecord[] {
    return this.db.sqlite
      .prepare("select * from generation_runs where chapter_id = ? order by created_at desc")
      .all(chapterId)
      .map((row) => mapRun(row as Record<string, unknown>));
  }

  getArtifact(id: string): GeneratedArtifactRecord | null {
    const row = this.db.sqlite.prepare("select * from generated_artifacts where id = ?").get(id);
    return row ? mapArtifact(row as Record<string, unknown>) : null;
  }

  listArtifacts(generationRunId: string): GeneratedArtifactRecord[] {
    return this.db.sqlite
      .prepare(
        "select * from generated_artifacts where generation_run_id = ? order by created_at asc"
      )
      .all(generationRunId)
      .map((row) => mapArtifact(row as Record<string, unknown>));
  }

  addCheckpoint(
    generationRunId: string,
    nodeName: string,
    state: Record<string, unknown>
  ): WorkflowCheckpointRecord {
    const row = {
      id: createId("checkpoint"),
      generationRunId,
      nodeName,
      stateJson: JSON.stringify(state),
      createdAt: nowIso()
    };
    this.db.sqlite
      .prepare(
        `insert into workflow_checkpoints
        (id, generation_run_id, node_name, state_json, created_at)
        values (@id, @generationRunId, @nodeName, @stateJson, @createdAt)`
      )
      .run(row);
    return this.getCheckpoint(row.id) as WorkflowCheckpointRecord;
  }

  getCheckpoint(id: string): WorkflowCheckpointRecord | null {
    const row = this.db.sqlite.prepare("select * from workflow_checkpoints where id = ?").get(id);
    return row ? mapCheckpoint(row as Record<string, unknown>) : null;
  }

  getLatestCheckpoint(generationRunId: string): WorkflowCheckpointRecord | null {
    const row = this.db.sqlite
      .prepare(
        "select * from workflow_checkpoints where generation_run_id = ? order by rowid desc limit 1"
      )
      .get(generationRunId);
    return row ? mapCheckpoint(row as Record<string, unknown>) : null;
  }

  listCheckpoints(generationRunId: string): WorkflowCheckpointRecord[] {
    return this.db.sqlite
      .prepare("select * from workflow_checkpoints where generation_run_id = ? order by rowid asc")
      .all(generationRunId)
      .map((row) => mapCheckpoint(row as Record<string, unknown>));
  }

  addEvent(input: CreateWorkflowEventInput): WorkflowEventRecord {
    const payload = {
      ...(input.payload ?? {}),
      nodeName: input.nodeName ?? null,
      message: input.message
    };
    const row = {
      id: createId("event"),
      generationRunId: input.generationRunId,
      eventType: input.eventType,
      payloadJson: JSON.stringify(payload),
      createdAt: nowIso()
    };
    this.db.sqlite
      .prepare(
        `insert into workflow_events
        (id, generation_run_id, event_type, payload_json, created_at)
        values (@id, @generationRunId, @eventType, @payloadJson, @createdAt)`
      )
      .run(row);
    return this.getEvent(row.id) as WorkflowEventRecord;
  }

  getEvent(id: string): WorkflowEventRecord | null {
    const row = this.db.sqlite.prepare("select * from workflow_events where id = ?").get(id);
    return row ? mapEvent(row as Record<string, unknown>) : null;
  }

  listEvents(generationRunId: string): WorkflowEventRecord[] {
    return this.db.sqlite
      .prepare("select * from workflow_events where generation_run_id = ? order by rowid asc")
      .all(generationRunId)
      .map((row) => mapEvent(row as Record<string, unknown>));
  }

  createReviewCard(input: CreateReviewCardInput): WorkflowReviewCard {
    const row = {
      id: createId("review"),
      generationRunId: input.generationRunId,
      chapterId: input.chapterId,
      reviewType: input.reviewType,
      severity: input.severity,
      title: input.title,
      issue: input.issue,
      evidence: input.evidence ?? null,
      affectedEntityType: input.affectedEntityType ?? null,
      affectedEntityId: input.affectedEntityId ?? null,
      suggestedFix: input.suggestedFix ?? null,
      requiresHumanJudgment: input.requiresHumanJudgment === false ? 0 : 1,
      status: input.status ?? "open",
      rawJson: input.rawJson ?? null,
      createdAt: nowIso()
    };
    this.db.sqlite
      .prepare(
        `insert into review_cards
        (id, generation_run_id, chapter_id, review_type, severity, title, issue, evidence,
          affected_entity_type, affected_entity_id, suggested_fix, requires_human_judgment,
          status, raw_json, created_at)
        values
        (@id, @generationRunId, @chapterId, @reviewType, @severity, @title, @issue, @evidence,
          @affectedEntityType, @affectedEntityId, @suggestedFix, @requiresHumanJudgment,
          @status, @rawJson, @createdAt)`
      )
      .run(row);
    return this.getReviewCard(row.id) as WorkflowReviewCard;
  }

  getReviewCard(id: string): WorkflowReviewCard | null {
    const row = this.db.sqlite.prepare("select * from review_cards where id = ?").get(id);
    return row ? mapReviewCard(row as Record<string, unknown>) : null;
  }

  listReviewCards(generationRunId: string): WorkflowReviewCard[] {
    return this.db.sqlite
      .prepare("select * from review_cards where generation_run_id = ? order by created_at asc")
      .all(generationRunId)
      .map((row) => mapReviewCard(row as Record<string, unknown>));
  }

  createSettlementProposal(input: CreateSettlementProposalInput): SettlementProposalRecord {
    const now = nowIso();
    const proposal = {
      id: createId("settlement"),
      generationRunId: input.generationRunId,
      chapterId: input.chapterId,
      status: input.status ?? "proposed",
      createdAt: now,
      updatedAt: now
    };
    const insertProposal = this.db.sqlite.prepare(
      `insert into settlement_proposals
      (id, generation_run_id, chapter_id, status, created_at, updated_at)
      values (@id, @generationRunId, @chapterId, @status, @createdAt, @updatedAt)`
    );
    const insertItem = this.db.sqlite.prepare(
      `insert into settlement_proposal_items
      (id, proposal_id, item_type, target_entity_type, target_entity_id, action_type,
        evidence_summary, confidence, before_json, after_json, status, created_at, updated_at)
      values
      (@id, @proposalId, @itemType, @targetEntityType, @targetEntityId, @actionType,
        @evidenceSummary, @confidence, @beforeJson, @afterJson, @status, @createdAt, @updatedAt)`
    );
    const tx = this.db.sqlite.transaction(() => {
      insertProposal.run(proposal);
      for (const item of input.items) {
        insertItem.run({
          id: createId("settlement_item"),
          proposalId: proposal.id,
          itemType: item.itemType,
          targetEntityType: item.targetEntityType ?? null,
          targetEntityId: item.targetEntityId ?? null,
          actionType: item.actionType,
          evidenceSummary: item.evidenceSummary,
          confidence: item.confidence,
          beforeJson: item.beforeJson ?? null,
          afterJson: item.afterJson,
          status: item.status ?? "proposed",
          createdAt: now,
          updatedAt: now
        });
      }
    });
    tx();
    return this.getSettlementProposalByRun(input.generationRunId) as SettlementProposalRecord;
  }

  getSettlementProposalByRun(generationRunId: string): SettlementProposalRecord | null {
    const row = this.db.sqlite
      .prepare(
        "select * from settlement_proposals where generation_run_id = ? order by created_at desc limit 1"
      )
      .get(generationRunId);
    if (!row) return null;
    const proposalId = String((row as Record<string, unknown>).id);
    const items = this.db.sqlite
      .prepare(
        "select * from settlement_proposal_items where proposal_id = ? order by created_at asc"
      )
      .all(proposalId)
      .map((item) => mapSettlementItem(item as Record<string, unknown>));
    return mapSettlementProposal(row as Record<string, unknown>, items);
  }
}

function nullableString(value: unknown): string | null {
  return value === null || typeof value === "undefined" ? null : String(value);
}

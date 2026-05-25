import type { WenForgeDatabase } from "@main/db/connection";
import { createId } from "@main/db/id";
import type { GeneratedArtifactRecord } from "@main/db/repositories/generation-repository";
import type { ManuscriptVersionRecord } from "@main/db/repositories/manuscript-repository";
import { countChineseAwareWords, markdownToPlaintext, nowIso } from "@main/db/repositories/types";
import type { RepositoryRegistry } from "@main/db/service";
import type {
  SettlementProposalItem,
  SettlementProposalRecord,
  WorkflowReviewCard
} from "@contracts/workflow";
import type {
  ApplySettlementResult,
  ManuscriptDiff,
  ManuscriptDiffLine,
  QualityGateResult,
  SettlementPreview,
  SettlementPreviewItem
} from "@contracts/review-settlement";

export interface SaveArtifactAsVersionInput {
  runId: string;
  artifactId: string;
  title?: string | undefined;
  setCanonical?: boolean | undefined;
  confirmed?: boolean | undefined;
  overrideBlockingWarnings?: boolean | undefined;
}

export interface DiffArtifactInput {
  artifactId: string;
  baseVersionId?: string | null | undefined;
}

export interface DiffVersionsInput {
  fromVersionId: string;
  toVersionId: string;
}

export interface ApplySettlementInput {
  proposalId: string;
  itemIds: string[];
  confirmed?: boolean | undefined;
  appliedBy?: string | undefined;
}

export interface EditSettlementItemInput {
  itemId: string;
  afterJson: string;
  status?: string | undefined;
}

export interface RejectSettlementItemsInput {
  proposalId: string;
  itemIds: string[];
}

interface ReviewSettlementServiceOptions {
  database: WenForgeDatabase;
  repositories: RepositoryRegistry;
}

interface ProposalRow {
  id: string;
  generation_run_id: string;
  chapter_id: string;
  status: string;
  created_at: string;
  updated_at: string;
}

interface SettlementItemRow {
  id: string;
  proposal_id: string;
  item_type: string;
  target_entity_type: string | null;
  target_entity_id: string | null;
  action_type: string;
  evidence_summary: string;
  confidence: number;
  before_json: string | null;
  after_json: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export class ReviewSettlementService {
  constructor(private readonly options: ReviewSettlementServiceOptions) {}

  listReviewsByGenerationRun(runId: string): WorkflowReviewCard[] {
    return this.options.repositories.generation.listReviewCards(runId);
  }

  updateReviewStatus(id: string, status: string): WorkflowReviewCard | null {
    this.options.database.sqlite
      .prepare("update review_cards set status = ? where id = ?")
      .run(status, id);
    return this.options.repositories.generation.getReviewCard(id);
  }

  qualityGate(runId: string, overrideBlockingWarnings = false): QualityGateResult {
    const cards = this.options.repositories.generation.listReviewCards(runId);
    const blockingCards = cards.filter(
      (card) => card.status !== "rejected" && card.severity === "blocking"
    );
    const lowHookWarning = cards.some((card) => {
      if (card.reviewType !== "webnovel_rhythm" || !card.rawJson) return false;
      const parsed = parseJson(card.rawJson);
      return isRecord(parsed) && Number(parsed.ending_hook_score ?? 10) < 6;
    });
    return {
      canApproveCanonical: blockingCards.length === 0 || overrideBlockingWarnings,
      blockingReviewCardIds: blockingCards.map((card) => card.id),
      warnings: lowHookWarning ? ["low_ending_hook_score"] : []
    };
  }

  saveArtifactAsVersion(input: SaveArtifactAsVersionInput): ManuscriptVersionRecord {
    const artifact = this.requireArtifact(input.artifactId, input.runId);
    if (!artifact.chapterId) {
      throw new Error("Generated artifact is not linked to a chapter");
    }
    if (input.setCanonical && !input.confirmed) {
      throw new Error("Confirmation is required before setting canonical manuscript");
    }
    if (input.setCanonical) {
      const gate = this.qualityGate(input.runId, input.overrideBlockingWarnings ?? false);
      if (!gate.canApproveCanonical) {
        throw new Error("Canonical approval is blocked by blocking review cards");
      }
    }
    return this.options.repositories.manuscripts.saveVersion({
      chapterId: artifact.chapterId,
      parentVersionId: this.options.repositories.manuscripts.getCanonical(artifact.chapterId)?.id,
      branchLabel: input.setCanonical ? "accepted-canonical" : "generated-proposal",
      title: input.title ?? artifact.title ?? "Generated manuscript version",
      contentMarkdown: artifact.contentText,
      sourceType: "generated",
      generationRunId: input.runId,
      isCanonical: input.setCanonical === true
    }) as ManuscriptVersionRecord;
  }

  diffVersions(input: DiffVersionsInput): ManuscriptDiff {
    const from = this.options.repositories.manuscripts.getVersion(input.fromVersionId);
    const to = this.options.repositories.manuscripts.getVersion(input.toVersionId);
    if (!from || !to) {
      throw new Error("Manuscript version not found");
    }
    return createUnifiedDiff({
      fromTitle: from.title,
      fromText: from.contentMarkdown,
      toTitle: to.title,
      toText: to.contentMarkdown
    });
  }

  diffArtifact(input: DiffArtifactInput): ManuscriptDiff {
    const artifact = this.requireArtifact(input.artifactId);
    if (!artifact.chapterId) {
      throw new Error("Generated artifact is not linked to a chapter");
    }
    const base = input.baseVersionId
      ? this.options.repositories.manuscripts.getVersion(input.baseVersionId)
      : this.options.repositories.manuscripts.getCanonical(artifact.chapterId);
    if (!base) {
      throw new Error("Base manuscript version not found");
    }
    return createUnifiedDiff({
      fromTitle: base.title,
      fromText: base.contentMarkdown,
      toTitle: artifact.title ?? artifact.artifactType,
      toText: artifact.contentText
    });
  }

  listSettlementByRun(runId: string): SettlementProposalRecord | null {
    return this.options.repositories.generation.getSettlementProposalByRun(runId);
  }

  previewSettlement(input: { runId: string }): SettlementPreview | null {
    const proposal = this.options.repositories.generation.getSettlementProposalByRun(input.runId);
    if (!proposal) return null;
    const acceptedText = this.acceptedManuscriptEvidence(proposal.chapterId);
    const items = proposal.items.map((item) => {
      const supportedByAcceptedManuscript = supportsEvidence(acceptedText, item.evidenceSummary);
      const previewItem: SettlementPreviewItem = {
        ...item,
        supportedByAcceptedManuscript,
        recommendedStatus: supportedByAcceptedManuscript ? "accept" : "reject",
        group: settlementGroup(item)
      };
      return previewItem;
    });
    return {
      ...proposal,
      items,
      groups: items.reduce<Record<string, SettlementPreviewItem[]>>((groups, item) => {
        groups[item.group] = [...(groups[item.group] ?? []), item];
        return groups;
      }, {})
    };
  }

  editSettlementItem(input: EditSettlementItemInput): SettlementProposalItem {
    assertJson(input.afterJson);
    this.options.database.sqlite
      .prepare(
        `update settlement_proposal_items
        set after_json = ?, status = ?, updated_at = ?
        where id = ?`
      )
      .run(input.afterJson, input.status ?? "edited", nowIso(), input.itemId);
    return this.requireSettlementItem(input.itemId);
  }

  rejectSettlementItems(input: RejectSettlementItemsInput): SettlementProposalItem[] {
    const update = this.options.database.sqlite.prepare(
      "update settlement_proposal_items set status = 'rejected', updated_at = ? where id = ? and proposal_id = ?"
    );
    const tx = this.options.database.sqlite.transaction(() => {
      for (const id of input.itemIds) {
        update.run(nowIso(), id, input.proposalId);
      }
    });
    tx();
    return input.itemIds.map((id) => this.requireSettlementItem(id));
  }

  applySelectedSettlementItems(input: ApplySettlementInput): ApplySettlementResult {
    if (!input.confirmed) {
      throw new Error("Confirmation is required before applying settlement updates");
    }
    const proposal = this.requireProposal(input.proposalId);
    const chapter = this.options.repositories.chapters.get(proposal.chapter_id);
    if (!chapter) {
      throw new Error("Settlement chapter not found");
    }
    const acceptedText = this.acceptedManuscriptEvidence(chapter.id);
    const itemIds = new Set(input.itemIds);
    const items = this.listSettlementItemRows(input.proposalId).filter((item) =>
      itemIds.has(item.id)
    );
    const appliedItems: SettlementProposalItem[] = [];
    const rejectedItems: SettlementProposalItem[] = [];

    const tx = this.options.database.sqlite.transaction(() => {
      for (const item of items) {
        if (item.status === "rejected" || !supportsEvidence(acceptedText, item.evidence_summary)) {
          this.updateSettlementStatus(item.id, "rejected");
          rejectedItems.push(this.requireSettlementItem(item.id));
          continue;
        }
        const applied = this.applySettlementItem({
          item,
          bookId: chapter.bookId,
          chapterId: chapter.id,
          generationRunId: proposal.generation_run_id,
          appliedBy: input.appliedBy ?? "local-user"
        });
        appliedItems.push(applied);
      }
      this.options.database.sqlite
        .prepare("update settlement_proposals set status = ?, updated_at = ? where id = ?")
        .run("reviewed", nowIso(), input.proposalId);
    });
    tx();

    const preview = this.previewSettlement({ runId: proposal.generation_run_id });
    const byId = new Map(preview?.items.map((item) => [item.id, item]) ?? []);
    return {
      appliedItems: appliedItems.map((item) => byId.get(item.id) ?? toPreviewItem(item, true)),
      rejectedItems: rejectedItems.map((item) => byId.get(item.id) ?? toPreviewItem(item, false))
    };
  }

  private applySettlementItem(input: {
    item: SettlementItemRow;
    bookId: string;
    chapterId: string;
    generationRunId: string;
    appliedBy: string;
  }): SettlementProposalItem {
    const after = parseJsonObject(input.item.after_json);
    const entityType = input.item.target_entity_type ?? input.item.item_type;
    let entityId: string | null = null;
    let beforeJson = input.item.before_json;

    if (isHookItem(input.item)) {
      const hook = this.options.repositories.storyBible.createUnresolvedHook({
        bookId: input.bookId,
        sourceChapterId: input.chapterId,
        hookText:
          stringField(after, "hookText") ??
          stringField(after, "content") ??
          input.item.evidence_summary,
        urgency: stringField(after, "urgency") ?? null,
        expectedResolutionWindow: stringField(after, "expectedResolutionWindow") ?? null,
        notes: stringField(after, "notes") ?? null
      });
      entityId = hook.id;
    } else if (isTimelineItem(input.item)) {
      const timeline = this.options.repositories.storyBible.createTimelineEvent({
        bookId: input.bookId,
        chapterId: input.chapterId,
        title: stringField(after, "title") ?? input.item.evidence_summary.slice(0, 60),
        content:
          stringField(after, "content") ??
          stringField(after, "summary") ??
          input.item.evidence_summary
      });
      entityId = timeline.id;
    } else if (isChapterSummaryItem(input.item)) {
      const current = this.options.repositories.chapters.get(input.chapterId);
      beforeJson = JSON.stringify({ summary: current?.summary ?? null });
      this.options.repositories.chapters.update(input.chapterId, {
        summary:
          stringField(after, "summary") ??
          stringField(after, "content") ??
          input.item.evidence_summary
      });
      entityId = input.chapterId;
    } else if (isCharacterItem(input.item)) {
      const characterId = input.item.target_entity_id;
      if (characterId) {
        const current = this.options.repositories.storyBible.getCharacter(characterId);
        beforeJson = current ? JSON.stringify(current) : beforeJson;
        const characterPatch: {
          name?: string;
          summary?: string | null;
          currentState?: string | null;
        } = {};
        const nextName = stringField(after, "name") ?? current?.name;
        if (nextName) characterPatch.name = nextName;
        characterPatch.summary = stringField(after, "summary") ?? current?.summary ?? null;
        characterPatch.currentState =
          stringField(after, "currentState") ??
          stringField(after, "current_state") ??
          current?.currentState ??
          null;
        entityId =
          this.options.repositories.storyBible.updateCharacter(characterId, characterPatch)?.id ??
          characterId;
      } else {
        const character = this.options.repositories.storyBible.createCharacter({
          bookId: input.bookId,
          name: stringField(after, "name") ?? input.item.evidence_summary.slice(0, 20),
          summary: stringField(after, "summary") ?? null,
          currentState:
            stringField(after, "currentState") ?? stringField(after, "current_state") ?? null
        });
        entityId = character.id;
      }
    } else if (isForeshadowingItem(input.item)) {
      const foreshadowing = this.options.repositories.storyBible.createForeshadowing({
        bookId: input.bookId,
        seedChapterId: input.chapterId,
        hintText:
          stringField(after, "hintText") ??
          stringField(after, "hint_text") ??
          input.item.evidence_summary,
        payoffNotes:
          stringField(after, "payoffNotes") ?? stringField(after, "payoff_notes") ?? null,
        status: "seeded"
      });
      entityId = foreshadowing.id;
    } else {
      const entry = this.options.repositories.storyBible.createEntry({
        bookId: input.bookId,
        chapterId: input.chapterId,
        entryType: input.item.item_type,
        title: stringField(after, "title") ?? input.item.evidence_summary.slice(0, 60),
        content:
          stringField(after, "content") ?? stringField(after, "summary") ?? input.item.after_json,
        provenance: "settled",
        sourceRunId: input.generationRunId
      });
      entityId = entry.id;
    }

    this.insertApplicationAudit({
      proposalItemId: input.item.id,
      generationRunId: input.generationRunId,
      entityType,
      entityId,
      updateType: input.item.action_type,
      beforeJson,
      afterJson: input.item.after_json,
      appliedBy: input.appliedBy
    });
    this.updateSettlementStatus(input.item.id, "applied");
    return this.requireSettlementItem(input.item.id);
  }

  private insertApplicationAudit(input: {
    proposalItemId: string;
    generationRunId: string;
    entityType: string;
    entityId: string | null;
    updateType: string;
    beforeJson: string | null;
    afterJson: string;
    appliedBy: string;
  }): void {
    const now = nowIso();
    this.options.database.sqlite
      .prepare(
        `insert into state_update_applications
        (id, proposal_item_id, generation_run_id, entity_type, entity_id, update_type,
          before_json, after_json, applied_by, applied_at, applied_entity_type,
          applied_entity_id, created_at)
        values
        (@id, @proposalItemId, @generationRunId, @entityType, @entityId, @updateType,
          @beforeJson, @afterJson, @appliedBy, @appliedAt, @appliedEntityType,
          @appliedEntityId, @createdAt)`
      )
      .run({
        id: createId("state_update"),
        proposalItemId: input.proposalItemId,
        generationRunId: input.generationRunId,
        entityType: input.entityType,
        entityId: input.entityId,
        updateType: input.updateType,
        beforeJson: input.beforeJson,
        afterJson: input.afterJson,
        appliedBy: input.appliedBy,
        appliedAt: now,
        appliedEntityType: input.entityType,
        appliedEntityId: input.entityId ?? "",
        createdAt: now
      });
  }

  private requireArtifact(artifactId: string, runId?: string): GeneratedArtifactRecord {
    const artifact = this.options.repositories.generation.getArtifact(artifactId);
    if (!artifact || (runId && artifact.generationRunId !== runId)) {
      throw new Error("Generated artifact not found");
    }
    return artifact;
  }

  private requireProposal(proposalId: string): ProposalRow {
    const row = this.options.database.sqlite
      .prepare("select * from settlement_proposals where id = ?")
      .get(proposalId) as ProposalRow | undefined;
    if (!row) {
      throw new Error("Settlement proposal not found");
    }
    return row;
  }

  private listSettlementItemRows(proposalId: string): SettlementItemRow[] {
    return this.options.database.sqlite
      .prepare(
        "select * from settlement_proposal_items where proposal_id = ? order by created_at asc"
      )
      .all(proposalId) as SettlementItemRow[];
  }

  private requireSettlementItem(id: string): SettlementProposalItem {
    const row = this.options.database.sqlite
      .prepare("select * from settlement_proposal_items where id = ?")
      .get(id) as SettlementItemRow | undefined;
    if (!row) {
      throw new Error("Settlement item not found");
    }
    return mapSettlementItem(row);
  }

  private updateSettlementStatus(id: string, status: string): void {
    this.options.database.sqlite
      .prepare("update settlement_proposal_items set status = ?, updated_at = ? where id = ?")
      .run(status, nowIso(), id);
  }

  private acceptedManuscriptEvidence(chapterId: string): string {
    return this.options.repositories.manuscripts.getCanonical(chapterId)?.contentPlaintext ?? "";
  }
}

export function createUnifiedDiff(input: {
  fromTitle: string;
  fromText: string;
  toTitle: string;
  toText: string;
}): ManuscriptDiff {
  const fromLines = input.fromText.split(/\r?\n/);
  const toLines = input.toText.split(/\r?\n/);
  const lines = diffLines(fromLines, toLines);
  const fromPlain = markdownToPlaintext(input.fromText);
  const toPlain = markdownToPlaintext(input.toText);
  const fromWordCount = countChineseAwareWords(fromPlain);
  const toWordCount = countChineseAwareWords(toPlain);
  return {
    fromTitle: input.fromTitle,
    toTitle: input.toTitle,
    fromWordCount,
    toWordCount,
    wordDelta: toWordCount - fromWordCount,
    fromCharacterCount: fromPlain.length,
    toCharacterCount: toPlain.length,
    characterDelta: toPlain.length - fromPlain.length,
    lines
  };
}

function diffLines(fromLines: string[], toLines: string[]): ManuscriptDiffLine[] {
  const lengths = Array.from({ length: fromLines.length + 1 }, () =>
    Array<number>(toLines.length + 1).fill(0)
  );
  for (let left = fromLines.length - 1; left >= 0; left -= 1) {
    for (let right = toLines.length - 1; right >= 0; right -= 1) {
      lengths[left]![right] =
        fromLines[left] === toLines[right]
          ? lengths[left + 1]![right + 1]! + 1
          : Math.max(lengths[left + 1]![right]!, lengths[left]![right + 1]!);
    }
  }

  const result: ManuscriptDiffLine[] = [];
  let left = 0;
  let right = 0;
  while (left < fromLines.length && right < toLines.length) {
    if (fromLines[left] === toLines[right]) {
      result.push({
        type: "unchanged",
        oldLineNumber: left + 1,
        newLineNumber: right + 1,
        text: fromLines[left] ?? ""
      });
      left += 1;
      right += 1;
    } else if (lengths[left + 1]![right]! >= lengths[left]![right + 1]!) {
      result.push({
        type: "removed",
        oldLineNumber: left + 1,
        newLineNumber: null,
        text: fromLines[left] ?? ""
      });
      left += 1;
    } else {
      result.push({
        type: "added",
        oldLineNumber: null,
        newLineNumber: right + 1,
        text: toLines[right] ?? ""
      });
      right += 1;
    }
  }
  while (left < fromLines.length) {
    result.push({
      type: "removed",
      oldLineNumber: left + 1,
      newLineNumber: null,
      text: fromLines[left] ?? ""
    });
    left += 1;
  }
  while (right < toLines.length) {
    result.push({
      type: "added",
      oldLineNumber: null,
      newLineNumber: right + 1,
      text: toLines[right] ?? ""
    });
    right += 1;
  }
  return result;
}

function mapSettlementItem(row: SettlementItemRow): SettlementProposalItem {
  return {
    id: row.id,
    proposalId: row.proposal_id,
    itemType: row.item_type,
    targetEntityType: row.target_entity_type,
    targetEntityId: row.target_entity_id,
    actionType: row.action_type,
    evidenceSummary: row.evidence_summary,
    confidence: Number(row.confidence),
    beforeJson: row.before_json,
    afterJson: row.after_json,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function settlementGroup(item: SettlementProposalItem): string {
  const key = `${item.itemType} ${item.targetEntityType ?? ""}`.toLowerCase();
  if (key.includes("character") || key.includes("relationship")) return "Characters";
  if (key.includes("timeline") || key.includes("chapter_summary")) return "Timeline";
  if (key.includes("foreshadow")) return "Foreshadowing";
  if (key.includes("hook")) return "Hooks";
  if (key.includes("style") || key.includes("reader")) return "Style/Reader";
  if (key.includes("risk")) return "Continuity Risks";
  return "World Facts";
}

function toPreviewItem(
  item: SettlementProposalItem,
  supportedByAcceptedManuscript: boolean
): SettlementPreviewItem {
  return {
    ...item,
    supportedByAcceptedManuscript,
    recommendedStatus: supportedByAcceptedManuscript ? "accept" : "reject",
    group: settlementGroup(item)
  };
}

function supportsEvidence(manuscriptText: string, evidenceSummary: string): boolean {
  const evidence = evidenceSummary.replace(/[？?。！!，,\s]/g, "");
  const manuscript = manuscriptText.replace(/[？?。！!，,\s]/g, "");
  if (evidence.length === 0) return false;
  if (manuscript.includes(evidence)) return true;
  return evidence
    .split(/[、；;：:]/)
    .filter((part) => part.length >= 4)
    .some((part) => manuscript.includes(part));
}

function parseJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function parseJsonObject(value: string): Record<string, unknown> {
  const parsed = parseJson(value);
  if (!isRecord(parsed)) {
    throw new Error("Settlement item afterJson must be a JSON object");
  }
  return parsed;
}

function assertJson(value: string): void {
  parseJsonObject(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringField(source: Record<string, unknown>, key: string): string | undefined {
  const value = source[key];
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function isHookItem(item: SettlementItemRow): boolean {
  return `${item.item_type} ${item.target_entity_type ?? ""}`.toLowerCase().includes("hook");
}

function isTimelineItem(item: SettlementItemRow): boolean {
  return `${item.item_type} ${item.target_entity_type ?? ""}`.toLowerCase().includes("timeline");
}

function isChapterSummaryItem(item: SettlementItemRow): boolean {
  return item.item_type === "chapter_summary" || item.target_entity_type === "chapter";
}

function isCharacterItem(item: SettlementItemRow): boolean {
  return `${item.item_type} ${item.target_entity_type ?? ""}`.toLowerCase().includes("character");
}

function isForeshadowingItem(item: SettlementItemRow): boolean {
  return `${item.item_type} ${item.target_entity_type ?? ""}`.toLowerCase().includes("foreshadow");
}

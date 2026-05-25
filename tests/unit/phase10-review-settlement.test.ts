import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { createDatabaseConnection } from "@main/db/connection";
import { migrateDatabase } from "@main/db/migrate";
import { createRepositories } from "@main/db/service";
import { ReviewSettlementService } from "@main/review/review-settlement-service";

let tempDir = "";

function createFixture() {
  tempDir = mkdtempSync(join(tmpdir(), "wenforge-review-"));
  const connection = createDatabaseConnection(join(tempDir, "test.sqlite"));
  migrateDatabase(connection.sqlite);
  const repositories = createRepositories(connection.db);
  const service = new ReviewSettlementService({
    database: connection.db,
    repositories
  });
  const project = repositories.projects.create({ name: "霜城序列" });
  const book = repositories.books.create({ projectId: project.id, title: "雾灯之后" });
  const chapter = repositories.chapters.create({
    bookId: book.id,
    chapterIndex: 1,
    title: "钟楼背面"
  });
  const canonical = repositories.manuscripts.saveManualVersion({
    chapterId: chapter.id,
    title: "人工正稿",
    contentMarkdown: "沈照在雨夜停在钟楼背面。\n门后的同声者是谁？",
    isCanonical: true
  });
  const run = repositories.generation.createRun({
    projectId: project.id,
    bookId: book.id,
    chapterId: chapter.id,
    status: "paused"
  });
  const draft = repositories.generation.createArtifact({
    generationRunId: run.id,
    chapterId: chapter.id,
    artifactType: "draft",
    title: "AI 草稿",
    contentText: "沈照在雨夜停在钟楼背面。\n雾灯照出第二个影子。",
    sourceNode: "draft_chapter"
  });
  const revision = repositories.generation.createArtifact({
    generationRunId: run.id,
    chapterId: chapter.id,
    artifactType: "revision",
    title: "AI 修订",
    contentText: "沈照在雨夜停在钟楼背面。\n门后的同声者是谁？\n雾灯照出第二个影子。",
    sourceNode: "revise_draft"
  });
  return {
    connection,
    repositories,
    service,
    project,
    book,
    chapter,
    canonical,
    run,
    draft,
    revision
  };
}

afterEach(() => {
  if (tempDir) {
    rmSync(tempDir, { recursive: true, force: true });
    tempDir = "";
  }
});

describe("phase 10 review, diff, and settlement confirmation", () => {
  it("blocks canonical approval when blocking review cards exist unless explicitly overridden", () => {
    const { repositories, service, chapter, run, revision } = createFixture();
    repositories.generation.createReviewCard({
      generationRunId: run.id,
      chapterId: chapter.id,
      reviewType: "continuity",
      severity: "blocking",
      title: "能力规则冲突",
      issue: "主角突然掌握全部能力。",
      evidence: "雾灯照出第二个影子。",
      suggestedFix: "保留异常但不要直接解释能力来源。",
      requiresHumanJudgment: true
    });

    expect(() =>
      service.saveArtifactAsVersion({
        runId: run.id,
        artifactId: revision.id,
        setCanonical: true,
        confirmed: true
      })
    ).toThrow(/blocking/i);

    const version = service.saveArtifactAsVersion({
      runId: run.id,
      artifactId: revision.id,
      setCanonical: true,
      confirmed: true,
      overrideBlockingWarnings: true
    });

    expect(version.isCanonical).toBe(true);
    expect(repositories.manuscripts.getCanonical(chapter.id)?.id).toBe(version.id);
  });

  it("requires explicit confirmation for canonical artifact acceptance", () => {
    const { service, revision } = createFixture();

    expect(() =>
      service.saveArtifactAsVersion({
        runId: revision.generationRunId,
        artifactId: revision.id,
        setCanonical: true,
        confirmed: false
      })
    ).toThrow(/confirmation/i);
  });

  it("saves generated artifacts as non-canonical versions by default", () => {
    const { repositories, service, chapter, revision } = createFixture();

    const version = service.saveArtifactAsVersion({
      runId: revision.generationRunId,
      artifactId: revision.id,
      title: "Generated proposal"
    });

    expect(version.sourceType).toBe("generated");
    expect(version.isCanonical).toBe(false);
    expect(repositories.manuscripts.getCanonical(chapter.id)?.title).toBe("人工正稿");
  });

  it("creates unified diffs with word and character count deltas", () => {
    const { service, revision } = createFixture();

    const diff = service.diffArtifact({ artifactId: revision.id });

    expect(diff.lines.some((line) => line.type === "added")).toBe(true);
    expect(diff.characterDelta).toBeGreaterThan(0);
    expect(diff.toCharacterCount).toBeGreaterThan(diff.fromCharacterCount);
  });

  it("previews unsupported settlement facts as rejected by default", () => {
    const { repositories, service, chapter, run } = createFixture();
    const proposal = repositories.generation.createSettlementProposal({
      generationRunId: run.id,
      chapterId: chapter.id,
      items: [
        {
          itemType: "unresolved_hook",
          targetEntityType: "hook",
          actionType: "create",
          evidenceSummary: "门后的同声者是谁",
          confidence: 0.9,
          afterJson: JSON.stringify({ hookText: "门后的同声者是谁？", urgency: "high" })
        },
        {
          itemType: "new_fact",
          targetEntityType: "world_fact",
          actionType: "create",
          evidenceSummary: "不存在的秘密组织已经登场",
          confidence: 0.2,
          afterJson: JSON.stringify({ title: "秘密组织", content: "秘密组织已经登场。" })
        }
      ]
    });

    const preview = service.previewSettlement({ runId: run.id });

    expect(preview?.id).toBe(proposal.id);
    expect(
      preview?.items.find((item) => item.itemType === "unresolved_hook")?.recommendedStatus
    ).toBe("accept");
    expect(preview?.items.find((item) => item.itemType === "new_fact")?.recommendedStatus).toBe(
      "reject"
    );
  });

  it("edits, rejects, and applies settlement items with an audit trail transactionally", () => {
    const { connection, repositories, service, book, chapter, run } = createFixture();
    const proposal = repositories.generation.createSettlementProposal({
      generationRunId: run.id,
      chapterId: chapter.id,
      items: [
        {
          itemType: "unresolved_hook",
          targetEntityType: "hook",
          actionType: "create",
          evidenceSummary: "门后的同声者是谁",
          confidence: 0.9,
          afterJson: JSON.stringify({ hookText: "门后的同声者是谁？", urgency: "high" })
        },
        {
          itemType: "timeline_event",
          targetEntityType: "timeline",
          actionType: "create",
          evidenceSummary: "门后的同声者是谁",
          confidence: 0.8,
          afterJson: JSON.stringify({ title: "钟楼同声", content: "门后传来同声回应。" })
        }
      ]
    });
    const hook = proposal.items.find((item) => item.itemType === "unresolved_hook");
    const timeline = proposal.items.find((item) => item.itemType === "timeline_event");
    expect(hook).toBeTruthy();
    expect(timeline).toBeTruthy();

    service.editSettlementItem({
      itemId: hook?.id ?? "",
      afterJson: JSON.stringify({ hookText: "门后的同声者究竟是谁？", urgency: "high" })
    });
    service.rejectSettlementItems({
      proposalId: proposal.id,
      itemIds: [timeline?.id ?? ""]
    });
    const result = service.applySelectedSettlementItems({
      proposalId: proposal.id,
      itemIds: [hook?.id ?? "", timeline?.id ?? ""],
      confirmed: true,
      appliedBy: "unit-test"
    });

    expect(result.appliedItems).toHaveLength(1);
    expect(result.rejectedItems).toHaveLength(1);
    expect(repositories.storyBible.listHooks({ bookId: book.id })).toHaveLength(1);
    expect(repositories.storyBible.listTimeline({ bookId: book.id })).toHaveLength(0);
    const auditRows = connection.sqlite
      .prepare("select * from state_update_applications")
      .all() as Array<Record<string, unknown>>;
    expect(auditRows).toHaveLength(1);
    expect(auditRows[0]).toMatchObject({
      generation_run_id: run.id,
      entity_type: "hook",
      update_type: "create",
      applied_by: "unit-test"
    });
  });
});

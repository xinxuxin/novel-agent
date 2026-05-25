import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { DEFAULT_PRIVACY_SETTINGS } from "@contracts/settings";
import {
  CHAPTER_GENERATION_WORKFLOW_NODES,
  chapterGenerationStartRequestSchema
} from "@contracts/workflow";
import { createDatabaseConnection } from "@main/db/connection";
import { migrateDatabase } from "@main/db/migrate";
import { createRepositories } from "@main/db/service";
import { ChapterWorkflowRuntime } from "@main/workflows/chapter-workflow-runtime";

let tempDir = "";

function createWorkflowFixture() {
  tempDir = mkdtempSync(join(tmpdir(), "wenforge-workflow-"));
  const connection = createDatabaseConnection(join(tempDir, "test.sqlite"));
  migrateDatabase(connection.sqlite);
  const repositories = createRepositories(connection.db);
  const project = repositories.projects.create({
    name: "霜城序列",
    description: "赛博修仙都市爽文",
    genre: "都市异能",
    targetReader: "喜欢升级、悬疑和强章节钩子的读者"
  });
  const book = repositories.books.create({
    projectId: project.id,
    title: "雾灯之后",
    logline: "霜城雨夜，失业调查员觉醒序列感知。",
    genre: "都市异能"
  });
  const volume = repositories.volumes.create({
    bookId: book.id,
    title: "霜城雨季",
    volumeIndex: 1,
    summary: "主角第一次接触序列能力。"
  });
  const chapter = repositories.chapters.create({
    bookId: book.id,
    volumeId: volume.id,
    chapterIndex: 2,
    title: "钟楼背面",
    targetWords: 3000
  });
  repositories.manuscripts.saveManualVersion({
    chapterId: chapter.id,
    title: "人工正稿",
    contentMarkdown: "沈照在雨夜停在钟楼背面，雾灯还没有亮。",
    isCanonical: true
  });
  repositories.storyBible.createStyleGuide({
    bookId: book.id,
    genre: "都市异能",
    tone: "冷雨、紧张、快节奏",
    chapterEndingPattern: "以具体危险作钩子"
  });
  repositories.storyBible.createReaderPositioning({
    bookId: book.id,
    targetReader: "喜欢都市异能升级的读者",
    platformStyle: "快节奏连载",
    emotionalPromise: "每章都有发现和压迫感"
  });

  const runtime = new ChapterWorkflowRuntime({
    database: connection.db,
    repositories,
    privacy: DEFAULT_PRIVACY_SETTINGS
  });

  return { connection, repositories, runtime, project, book, volume, chapter };
}

afterEach(() => {
  if (tempDir) {
    rmSync(tempDir, { recursive: true, force: true });
    tempDir = "";
  }
});

describe("chapter_generation_v1 workflow runtime", () => {
  it("runs deterministic mock nodes to the human gate without overwriting canon", async () => {
    const { repositories, runtime, project, book, volume, chapter } = createWorkflowFixture();

    const paused = await runtime.startChapterWorkflow({
      projectId: project.id,
      bookId: book.id,
      volumeId: volume.id,
      chapterId: chapter.id,
      qualityMode: "balanced",
      userInstruction: "突出雨夜压迫感",
      targetTokenBudget: 4000,
      confirmed: true
    });

    expect(paused).toMatchObject({
      status: "paused",
      currentNode: "human_gate",
      humanGateStatus: "waiting"
    });

    const detail = runtime.getRun(paused.id);
    expect(detail?.events.map((event) => event.nodeName)).toEqual(
      expect.arrayContaining(CHAPTER_GENERATION_WORKFLOW_NODES.slice(0, 9))
    );
    expect(detail?.checkpoints.at(-1)).toMatchObject({ nodeName: "human_gate" });
    expect(detail?.artifacts.map((artifact) => artifact.artifactType)).toEqual([
      "outline",
      "scene_cards",
      "draft",
      "continuity_audit",
      "rhythm_audit",
      "revision"
    ]);
    expect(detail?.reviewCards).toHaveLength(2);
    expect(detail?.llmRuns).toHaveLength(6);
    expect(detail?.llmRuns.every((run) => run.provider === "fake")).toBe(true);
    expect(detail?.costSummary.finalCost).toBeGreaterThan(0);
    expect(repositories.manuscripts.getCanonical(chapter.id)?.contentMarkdown).toBe(
      "沈照在雨夜停在钟楼背面，雾灯还没有亮。"
    );
  });

  it("resumes after approval, persists settlement proposals, and requires confirmation for canon", async () => {
    const { repositories, runtime, project, book, volume, chapter } = createWorkflowFixture();
    const paused = await runtime.startChapterWorkflow({
      projectId: project.id,
      bookId: book.id,
      volumeId: volume.id,
      chapterId: chapter.id,
      qualityMode: "balanced",
      confirmed: true
    });

    const completed = await runtime.resume({
      runId: paused.id,
      action: "accept"
    });
    expect(completed).toMatchObject({
      status: "completed",
      currentNode: "finalize",
      humanGateStatus: "accepted"
    });

    const detail = runtime.getRun(paused.id);
    expect(detail?.artifacts.map((artifact) => artifact.artifactType)).toContain(
      "settlement_proposal"
    );
    expect(detail?.settlementProposal?.items).toHaveLength(2);
    expect(repositories.manuscripts.getCanonical(chapter.id)?.title).toBe("人工正稿");

    const revisionArtifact = detail?.artifacts.find(
      (artifact) => artifact.artifactType === "revision"
    );
    expect(revisionArtifact).toBeTruthy();
    const acceptedVersion = runtime.acceptArtifactAsVersion({
      runId: paused.id,
      artifactId: revisionArtifact?.id ?? "",
      title: "AI 修订稿"
    });

    expect(acceptedVersion).toMatchObject({
      sourceType: "generated",
      generationRunId: paused.id,
      isCanonical: false
    });
    expect(() =>
      runtime.setAcceptedVersionCanonical({
        chapterId: chapter.id,
        versionId: acceptedVersion.id,
        confirmed: false
      })
    ).toThrow(/Confirmation is required/);

    const canonical = runtime.setAcceptedVersionCanonical({
      chapterId: chapter.id,
      versionId: acceptedVersion.id,
      confirmed: true
    });
    expect(canonical?.id).toBe(acceptedVersion.id);
  });

  it("can request another revision from the human gate and keeps the run paused", async () => {
    const { runtime, project, book, volume, chapter } = createWorkflowFixture();
    const paused = await runtime.startChapterWorkflow({
      projectId: project.id,
      bookId: book.id,
      volumeId: volume.id,
      chapterId: chapter.id,
      qualityMode: "balanced",
      confirmed: true
    });

    const revised = await runtime.requestRevision({
      runId: paused.id,
      userInstruction: "结尾钩子再具体一点"
    });
    const detail = runtime.getRun(paused.id);
    const revisionArtifacts = detail?.artifacts.filter(
      (artifact) => artifact.artifactType === "revision"
    );

    expect(revised).toMatchObject({
      status: "paused",
      currentNode: "human_gate",
      humanGateStatus: "revision_requested"
    });
    expect(revisionArtifacts).toHaveLength(2);
    expect(revisionArtifacts?.at(-1)?.contentText).toContain("结尾钩子再具体一点");
  });

  it("cancels paused workflows and prevents later resume", async () => {
    const { runtime, project, book, volume, chapter } = createWorkflowFixture();
    const paused = await runtime.startChapterWorkflow({
      projectId: project.id,
      bookId: book.id,
      volumeId: volume.id,
      chapterId: chapter.id,
      qualityMode: "balanced",
      confirmed: true
    });

    const cancelled = runtime.cancel({ runId: paused.id, confirmed: true });

    expect(cancelled).toMatchObject({ status: "cancelled", humanGateStatus: "cancelled" });
    await expect(runtime.resume({ runId: paused.id, action: "accept" })).rejects.toThrow(
      /paused at the human gate/
    );
  });

  it("aborts paused workflows through the abort endpoint path", async () => {
    const { runtime, project, book, volume, chapter } = createWorkflowFixture();
    const paused = await runtime.startChapterWorkflow({
      projectId: project.id,
      bookId: book.id,
      volumeId: volume.id,
      chapterId: chapter.id,
      qualityMode: "balanced",
      confirmed: true
    });

    const aborted = runtime.abort({ runId: paused.id });
    const detail = runtime.getRun(paused.id);

    expect(aborted).toMatchObject({ status: "cancelled", humanGateStatus: "cancelled" });
    expect(detail?.events.at(-1)).toMatchObject({ eventType: "workflow_aborted" });
  });

  it("validates generation IPC payloads with strict typed contracts", () => {
    expect(
      chapterGenerationStartRequestSchema.safeParse({
        projectId: "project-1",
        bookId: "book-1",
        chapterId: "chapter-1",
        qualityMode: "balanced",
        confirmed: true
      }).success
    ).toBe(true);

    expect(
      chapterGenerationStartRequestSchema.safeParse({
        projectId: "project-1",
        bookId: "book-1",
        chapterId: "chapter-1",
        qualityMode: "reckless"
      }).success
    ).toBe(false);
  });
});

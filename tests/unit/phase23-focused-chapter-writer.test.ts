import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { DEFAULT_PRIVACY_SETTINGS } from "@contracts/settings";
import { FOCUSED_CHAPTER_WRITER_WORKFLOW_ID } from "@contracts/workflow";
import { ContextBuilder } from "@main/context/context-builder";
import { createDatabaseConnection } from "@main/db/connection";
import type { DatabaseConnection } from "@main/db/connection";
import { migrateDatabase } from "@main/db/migrate";
import { createRepositories } from "@main/db/service";
import { ChapterWorkflowRuntime } from "@main/workflows/chapter-workflow-runtime";

let tempDir = "";
let currentConnection: DatabaseConnection | null = null;

function createFocusedFixture() {
  tempDir = mkdtempSync(join(tmpdir(), "wenforge-phase23-"));
  currentConnection = createDatabaseConnection(join(tempDir, "test.sqlite"));
  migrateDatabase(currentConnection.sqlite);
  const repositories = createRepositories(currentConnection.db);
  const project = repositories.projects.create({
    name: "全民航海测试",
    description: "海洋求生爽文",
    genre: "全民航海",
    targetReader: "喜欢资源经营和稳健主角的读者"
  });
  const book = repositories.books.create({
    projectId: project.id,
    title: "全民航海",
    logline: "主角在全民航海世界里靠隐藏词条稳健发育。",
    genre: "航海求生"
  });
  const volume = repositories.volumes.create({
    bookId: book.id,
    title: "别浪号起航",
    volumeIndex: 1,
    summary: "主角完成初始资源闭环。"
  });
  const chapterOne = repositories.chapters.create({
    bookId: book.id,
    volumeId: volume.id,
    chapterIndex: 1,
    title: "全民降临无尽海",
    targetWords: 1800,
    minWords: 1600,
    maxWords: 2100,
    wordCountPriority: "strict"
  });
  const chapterTwo = repositories.chapters.create({
    bookId: book.id,
    volumeId: volume.id,
    chapterIndex: 2,
    title: "别浪号很破，但能活",
    targetWords: 1900,
    minWords: 1700,
    maxWords: 2200,
    wordCountPriority: "normal"
  });
  repositories.manuscripts.saveManualVersion({
    chapterId: chapterOne.id,
    title: "第1章正式稿",
    contentMarkdown: "李砚醒来时，脚下只有一艘漏风的小船。",
    isCanonical: true
  });
  repositories.chapters.update(chapterOne.id, {
    summary: "李砚降临无尽海，获得破旧小船并确认隐藏词条能力。"
  });
  const runtime = new ChapterWorkflowRuntime({
    database: currentConnection.db,
    repositories,
    privacy: DEFAULT_PRIVACY_SETTINGS
  });
  return { connection: currentConnection, repositories, runtime, project, book, volume, chapterOne, chapterTwo };
}

afterEach(() => {
  currentConnection?.sqlite.close();
  currentConnection = null;
  if (tempDir) {
    rmSync(tempDir, { recursive: true, force: true });
    tempDir = "";
  }
});

describe("phase 23 focused chapter writer", () => {
  it("versions active book setting files without overwriting prior content", () => {
    const { repositories, book } = createFocusedFixture();

    const first = repositories.planning.createBookSettingFile({
      bookId: book.id,
      title: "全民航海设定集 v1",
      contentMarkdown: "# 设定\n主角冷静稳健，不圣母。",
      sourceType: "paste",
      isActive: true
    });
    const second = repositories.planning.createBookSettingFile({
      bookId: book.id,
      title: "全民航海设定集 v2",
      contentMarkdown: "# 设定\n主角冷静稳健，不圣母。隐藏词条只给提示。",
      sourceType: "manual",
      isActive: true
    });

    expect(repositories.planning.getActiveBookSettingFile(book.id)?.id).toBe(second.id);
    expect(repositories.planning.listBookSettingFiles(book.id).map((item) => item.id)).toEqual([
      second.id,
      first.id
    ]);
    expect(repositories.planning.listBookSettingFiles(book.id).find((item) => item.id === first.id)?.isActive).toBe(false);
    expect(second.contentPlaintext).toContain("隐藏词条只给提示");
  });

  it("stores focused chapter outline fields on chapter plans", () => {
    const { repositories, book, volume, chapterTwo } = createFocusedFixture();

    const plan = repositories.planning.upsertChapterPlan({
      bookId: book.id,
      volumeId: volume.id,
      chapterId: chapterTwo.id,
      chapterIndex: chapterTwo.chapterIndex,
      title: chapterTwo.title,
      targetWords: 1900,
      minWords: 1700,
      maxWords: 2200,
      wordCountPriority: "strict",
      outlineText: "李砚检查别浪号，发现船虽破但隐藏词条提示可修复。",
      mustIncludeJson: JSON.stringify(["隐藏词条", "别浪号漏水", "主角不圣母"]),
      mustAvoidJson: JSON.stringify(["系统面板刷屏", "无意义装逼"]),
      importSourceId: "outline_source_unit",
      status: "accepted"
    });

    expect(plan.outlineText).toContain("隐藏词条提示可修复");
    expect(plan.mustIncludeJson).toContain("主角不圣母");
    expect(plan.mustAvoidJson).toContain("系统面板刷屏");
    expect(plan.importSourceId).toBe("outline_source_unit");
    expect(repositories.planning.getAcceptedChapterPlan(chapterTwo.id)?.outlineText).toBe(plan.outlineText);
  });

  it("focused context includes active setting file, current outline, previous canon, and summaries", () => {
    const { connection, repositories, project, book, volume, chapterTwo } = createFocusedFixture();
    repositories.planning.createBookSettingFile({
      bookId: book.id,
      title: "活动设定",
      contentMarkdown: "世界规则：无尽海资源稀缺。禁忌：不要系统面板刷屏。",
      sourceType: "paste",
      isActive: true
    });
    repositories.planning.upsertChapterPlan({
      bookId: book.id,
      volumeId: volume.id,
      chapterId: chapterTwo.id,
      chapterIndex: chapterTwo.chapterIndex,
      title: chapterTwo.title,
      outlineText: "本章写别浪号破损、漏水、但能靠隐藏词条找到修复方向。",
      mustAvoidJson: JSON.stringify(["系统面板刷屏"]),
      status: "accepted"
    });

    const context = new ContextBuilder(connection.db, repositories).previewForChapter({
      projectId: project.id,
      bookId: book.id,
      volumeId: volume.id,
      chapterId: chapterTwo.id,
      taskType: "draft_chapter",
      qualityMode: "premium",
      targetTokenBudget: 5000,
      includeRecentChapters: 2,
      includeFullRecentChapters: true,
      privacy: { ...DEFAULT_PRIVACY_SETTINGS, allowSendingFullRecentChapters: true }
    });

    expect(context.bookPremise).toContain("无尽海资源稀缺");
    expect(JSON.stringify(context.currentChapterOutline)).toContain("别浪号破损");
    expect(JSON.stringify(context.currentChapterOutline)).toContain("系统面板刷屏");
    expect(context.recentChapterSummaries.join("\n")).toContain("隐藏词条能力");
    expect(context.recentChapterExcerpts.join("\n")).toContain("漏风的小船");
  });

  it("runs focused_chapter_writer_v1 with fake providers and pauses at the human edit gate", async () => {
    const { repositories, runtime, project, book, volume, chapterTwo } = createFocusedFixture();
    repositories.planning.createBookSettingFile({
      bookId: book.id,
      title: "活动设定",
      contentMarkdown: "主角李砚冷静、克制，优先生存，不主动圣母。",
      sourceType: "paste",
      isActive: true
    });
    repositories.planning.upsertChapterPlan({
      bookId: book.id,
      volumeId: volume.id,
      chapterId: chapterTwo.id,
      chapterIndex: chapterTwo.chapterIndex,
      title: chapterTwo.title,
      targetWords: chapterTwo.targetWords,
      outlineText: "李砚确认别浪号虽然破旧，但隐藏词条提示它能撑过第一夜。",
      openingHook: "船舱底部传来第一声漏水声。",
      endingHook: "海雾里亮起另一艘船的灯。",
      status: "accepted"
    });

    const run = await runtime.startFocusedChapterWorkflow({
      projectId: project.id,
      bookId: book.id,
      volumeId: volume.id,
      chapterId: chapterTwo.id,
      qualityMode: "premium",
      executionMode: "mock",
      confirmed: true
    });
    const detail = runtime.getRun(run.id);

    expect(run.workflowId).toBe(FOCUSED_CHAPTER_WRITER_WORKFLOW_ID);
    expect(run.status).toBe("paused");
    expect(run.currentNode).toBe("human_edit_gate");
    expect(detail?.artifacts.map((artifact) => artifact.artifactType)).toEqual([
      "writing_brief",
      "draft",
      "outline_canon_audit",
      "revision",
      "final_check"
    ]);
    expect(detail?.llmRuns).toHaveLength(5);
    expect(detail?.artifacts.find((artifact) => artifact.artifactType === "revision")?.contentText).toContain(
      "别浪号"
    );
    expect(repositories.manuscripts.getCanonical(chapterTwo.id)).toBeNull();
    expect(repositories.storyBible.list(book.id)).toEqual([]);
  });
});

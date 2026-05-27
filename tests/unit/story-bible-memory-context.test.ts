import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { ContextBuilder } from "@main/context/context-builder";
import { MemoryIndexService } from "@main/memory/memory-index-service";
import { createDatabaseConnection } from "@main/db/connection";
import { migrateDatabase } from "@main/db/migrate";
import { createRepositories } from "@main/db/service";
import { DEFAULT_PRIVACY_SETTINGS } from "@contracts/settings";

let tempDir = "";

function createFixture() {
  tempDir = mkdtempSync(join(tmpdir(), "wenforge-phase6-"));
  const connection = createDatabaseConnection(join(tempDir, "test.sqlite"));
  migrateDatabase(connection.sqlite);
  const repositories = createRepositories(connection.db);
  const { books, chapters, projects, volumes } = repositories;
  const project = projects.create({
    name: "霜城序列",
    description: "赛博修仙都市爽文",
    genre: "都市异能",
    targetReader: "喜欢升级、悬疑和强章节钩子的读者"
  });
  const book = books.create({
    projectId: project.id,
    title: "雾灯之后",
    logline: "霜城雨夜，失业调查员觉醒序列感知。",
    genre: "都市异能"
  });
  const volume = volumes.create({
    bookId: book.id,
    title: "霜城雨季",
    volumeIndex: 1,
    summary: "主角第一次接触序列能力。"
  });
  const chapterOne = chapters.create({
    bookId: book.id,
    volumeId: volume.id,
    chapterIndex: 1,
    title: "雾灯亮起",
    targetWords: 3000
  });
  chapters.update(chapterOne.id, { summary: "沈照在雨夜听见雾灯低语。" });
  const chapterTwo = chapters.create({
    bookId: book.id,
    volumeId: volume.id,
    chapterIndex: 2,
    title: "钟楼背面",
    targetWords: 3000
  });

  return {
    connection,
    repositories,
    project,
    book,
    volume,
    chapterOne,
    chapterTwo
  };
}

afterEach(() => {
  if (tempDir) {
    rmSync(tempDir, { recursive: true, force: true });
    tempDir = "";
  }
});

describe("Phase 6 story bible, memory, and context", () => {
  it("supports CRUD and filtering for canonical story bible entities", () => {
    const { repositories, book, chapterOne } = createFixture();

    const character = repositories.storyBible.createCharacter({
      bookId: book.id,
      name: "沈照",
      aliases: ["阿照"],
      role: "protagonist",
      firstAppearanceChapterId: chapterOne.id,
      currentState: "失业调查员，刚觉醒序列感知",
      goal: "查清雾灯低语来源",
      motivation: "保护妹妹",
      secret: "曾在童年见过同一盏雾灯",
      contradiction: "害怕真相却必须追查",
      relationshipNotes: "与妹妹沈夏关系紧张但互相依赖",
      speakingStyle: "短句、克制、偶尔冷幽默",
      forbiddenInconsistencies: "不能突然熟练掌控序列能力",
      tags: ["主角", "序列"],
      importance: 9,
      relatedChapterIds: [chapterOne.id]
    });

    expect(
      repositories.storyBible.listCharacters({ bookId: book.id, query: "沈照" })[0]
    ).toMatchObject({
      id: character.id,
      name: "沈照",
      tags: ["主角", "序列"],
      importance: 9
    });

    const updated = repositories.storyBible.updateCharacter(character.id, {
      currentState: "知道雾灯低语与旧案有关"
    });
    expect(updated?.currentState).toContain("旧案");

    expect(repositories.storyBible.deleteCharacter(character.id, false)).toBe(false);
    expect(repositories.storyBible.deleteCharacter(character.id, true)).toBe(true);
    expect(repositories.storyBible.listCharacters({ bookId: book.id })).toHaveLength(0);
  });

  it("indexes accepted story bible and manuscript memory with FTS or keyword fallback", () => {
    const { connection, repositories, book, chapterOne } = createFixture();
    repositories.storyBible.createCharacter({
      bookId: book.id,
      name: "沈照",
      currentState: "雾灯低语的唯一目击者",
      tags: ["主角"],
      importance: 8
    });
    repositories.storyBible.createForeshadowing({
      bookId: book.id,
      seedChapterId: chapterOne.id,
      hintText: "雾灯每次亮起都会漏掉一段钟声",
      status: "seeded",
      tags: ["雾灯"],
      importance: 7
    });
    repositories.manuscripts.saveManualVersion({
      chapterId: chapterOne.id,
      title: "雾灯亮起",
      contentMarkdown: "沈照听见雾灯低语，却没有看见任何人。",
      isCanonical: true
    });

    const memoryIndex = new MemoryIndexService(repositories);
    memoryIndex.rebuildFromStoryBible(book.id);
    memoryIndex.rebuildFromCanonicalManuscripts(book.id);
    const ftsResults = memoryIndex.searchRelevantChunks({
      bookId: book.id,
      query: "雾灯",
      sourceTypes: ["character", "foreshadowing", "canonical_manuscript"],
      minImportance: 5
    });

    expect(ftsResults.map((result) => result.sourceType)).toEqual(
      expect.arrayContaining(["character", "foreshadowing", "canonical_manuscript"])
    );
    expect(ftsResults.every((result) => typeof result.score === "number")).toBe(true);

    connection.sqlite.exec("drop table search_index");
    const fallbackResults = memoryIndex.searchRelevantChunks({ bookId: book.id, query: "目击者" });
    expect(fallbackResults.map((result) => result.title)).toContain("沈照");
  });

  it("builds context within budget, honors privacy, redacts secrets, and excludes proposals", () => {
    const { connection, repositories, project, book, volume, chapterOne, chapterTwo } =
      createFixture();
    repositories.storyBible.createStyleGuide({
      bookId: book.id,
      genre: "都市异能",
      tone: "冷雨、紧张、快节奏",
      forbiddenCliches: "不要写命运齿轮开始转动",
      chapterEndingPattern: "以具体危险作钩子",
      examples: "短段落推进"
    });
    repositories.storyBible.createReaderPositioning({
      bookId: book.id,
      targetReader: "喜欢都市异能升级的读者",
      platformStyle: "快节奏连载",
      emotionalPromise: "每章都有发现和压迫感"
    });
    repositories.storyBible.createUnresolvedHook({
      bookId: book.id,
      sourceChapterId: chapterOne.id,
      hookText: "雾灯为什么会吞掉钟声？",
      urgency: "high",
      expectedResolutionWindow: "3 chapters",
      status: "open",
      tags: ["雾灯"],
      importance: 8
    });
    const intakeSession = repositories.planning.createIntakeSession({
      projectId: project.id,
      bookId: book.id,
      title: "霜城素材整理"
    });
    repositories.planning.createIntakeArtifact({
      sessionId: intakeSession.id,
      artifactType: "creative_direction",
      title: "拒绝的系统面板方向",
      contentJson: JSON.stringify({ suggestion: "加入系统面板" }),
      contentMarkdown: "加入系统面板",
      status: "rejected"
    });
    repositories.planning.createMaterialDigest({
      bookId: book.id,
      intakeSessionId: intakeSession.id,
      sourceSummaryJson: JSON.stringify({ canon: ["用户确认雾灯网络"], rejected: ["系统面板"] }),
      digestJson: JSON.stringify({
        book_premise: "城市低语来自雾灯网络",
        missing_information: [],
        ambiguity_warnings: []
      }),
      acceptedAt: new Date().toISOString()
    });
    repositories.memory.createChunk({
      bookId: book.id,
      sourceType: "settlement_proposal",
      sourceId: "rejected_item",
      title: "Rejected generated fact",
      content: "不可采纳的秘密：sk-test-secret1234567890",
      importance: 10
    });
    repositories.manuscripts.saveManualVersion({
      chapterId: chapterOne.id,
      title: "雾灯亮起",
      contentMarkdown: "沈照听见雾灯低语。隐藏令牌 sk-test-secret1234567890 不应泄露。",
      isCanonical: true
    });

    const contextBuilder = new ContextBuilder(connection.db, repositories);
    const context = contextBuilder.previewForChapter({
      projectId: project.id,
      bookId: book.id,
      volumeId: volume.id,
      chapterId: chapterTwo.id,
      taskType: "draft_chapter",
      qualityMode: "balanced",
      userInstruction: "强调雨夜压迫感",
      targetTokenBudget: 120,
      includeRecentChapters: 2,
      includeFullRecentChapters: true,
      privacy: { ...DEFAULT_PRIVACY_SETTINGS, allowSendingFullRecentChapters: false }
    });

    const json = JSON.stringify(context);
    expect(context.bookPremise).toContain("城市低语来自雾灯网络");
    expect(context.readerPositioning).toContain("都市异能升级");
    expect(context.styleGuide).toContain("冷雨");
    expect(context.recentChapterSummaries).toHaveLength(1);
    expect(context.recentChapterExcerpts).toHaveLength(0);
    expect(context.omissions).toContain("Full recent chapters omitted by privacy setting");
    expect(context.truncationNotes.length).toBeGreaterThan(0);
    expect(context.estimatedTokens).toBeLessThanOrEqual(120);
    expect(json).not.toContain("sk-test-secret1234567890");
    expect(json).not.toContain("不可采纳的秘密");
    expect(json).not.toContain("系统面板");
  });
});

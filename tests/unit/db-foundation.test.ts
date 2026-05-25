import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { createDatabaseConnection } from "@main/db/connection";
import { migrateDatabase } from "@main/db/migrate";
import { BookRepository } from "@main/db/repositories/book-repository";
import { ChapterRepository } from "@main/db/repositories/chapter-repository";
import { GenerationRepository } from "@main/db/repositories/generation-repository";
import { ManuscriptRepository } from "@main/db/repositories/manuscript-repository";
import { MemoryRepository } from "@main/db/repositories/memory-repository";
import { ProjectRepository } from "@main/db/repositories/project-repository";
import { StoryBibleRepository } from "@main/db/repositories/story-bible-repository";
import { VolumeRepository } from "@main/db/repositories/volume-repository";

let tempDir: string;

function createTestDatabase() {
  tempDir = mkdtempSync(join(tmpdir(), "wenforge-db-"));
  const connection = createDatabaseConnection(join(tempDir, "test.sqlite"));
  migrateDatabase(connection.sqlite);
  return connection;
}

afterEach(() => {
  if (tempDir) {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

describe("local database foundation", () => {
  it("migration creates the required schema tables", () => {
    const { sqlite } = createTestDatabase();
    const rows = sqlite
      .prepare("select name from sqlite_master where type in ('table', 'virtual') order by name")
      .all() as Array<{ name: string }>;
    const names = rows.map((row) => row.name);

    for (const table of [
      "projects",
      "books",
      "volumes",
      "chapters",
      "scenes",
      "manuscript_versions",
      "generated_artifacts",
      "story_bible_entries",
      "characters",
      "memory_chunks",
      "generation_runs",
      "workflow_checkpoints",
      "review_cards",
      "settlement_proposals",
      "llm_runs",
      "model_prices",
      "app_settings",
      "audit_log"
    ]) {
      expect(names).toContain(table);
    }
  });

  it("supports CRUD for project, book, volume, and chapter hierarchy", () => {
    const { db } = createTestDatabase();
    const projects = new ProjectRepository(db);
    const books = new BookRepository(db);
    const volumes = new VolumeRepository(db);
    const chapters = new ChapterRepository(db);

    const project = projects.create({
      name: "演示：都市异能爽文",
      description: "灵气复苏背景",
      genre: "都市异能",
      targetReader: "喜欢快节奏爽点的读者"
    });
    const book = books.create({
      projectId: project.id,
      title: "觉醒之后",
      logline: "普通青年在灵气复苏前夜觉醒能力。",
      genre: "都市异能",
      targetLengthChapters: 120
    });
    const volume = volumes.create({
      bookId: book.id,
      title: "灵气复苏前夜",
      volumeIndex: 1,
      summary: "世界变化开始露出端倪。"
    });
    const chapter = chapters.create({
      bookId: book.id,
      volumeId: volume.id,
      chapterIndex: 1,
      title: "雨夜异响",
      targetWords: 3000
    });

    expect(projects.list()).toHaveLength(1);
    expect(books.listByProject(project.id)).toHaveLength(1);
    expect(volumes.listByBook(book.id)).toHaveLength(1);
    expect(chapters.listByBook(book.id)).toHaveLength(1);
    expect(chapters.get(chapter.id)?.title).toBe("雨夜异响");
  });

  it("creates canonical manuscript versions transactionally and supports rollback", () => {
    const { db } = createTestDatabase();
    const projects = new ProjectRepository(db);
    const books = new BookRepository(db);
    const chapters = new ChapterRepository(db);
    const manuscripts = new ManuscriptRepository(db);
    const project = projects.create({ name: "P" });
    const book = books.create({ projectId: project.id, title: "B" });
    const chapter = chapters.create({ bookId: book.id, chapterIndex: 1, title: "C" });

    const first = manuscripts.saveManualVersion({
      chapterId: chapter.id,
      title: "初稿",
      contentMarkdown: "第一版",
      isCanonical: true
    });
    const second = manuscripts.saveManualVersion({
      chapterId: chapter.id,
      title: "二稿",
      contentMarkdown: "第二版",
      parentVersionId: first.id,
      isCanonical: true
    });

    expect(manuscripts.getCanonical(chapter.id)?.id).toBe(second.id);
    expect(manuscripts.getVersion(first.id)?.isCanonical).toBe(false);

    const restored = manuscripts.rollback(chapter.id, first.id);

    expect(restored.sourceType).toBe("restored");
    expect(restored.contentMarkdown).toBe("第一版");
    expect(manuscripts.getCanonical(chapter.id)?.id).toBe(restored.id);
  });

  it("keeps generated artifacts non-canonical until accepted into manuscript versions", () => {
    const { db } = createTestDatabase();
    const projects = new ProjectRepository(db);
    const books = new BookRepository(db);
    const chapters = new ChapterRepository(db);
    const manuscripts = new ManuscriptRepository(db);
    const generations = new GenerationRepository(db);
    const project = projects.create({ name: "P" });
    const book = books.create({ projectId: project.id, title: "B" });
    const chapter = chapters.create({ bookId: book.id, chapterIndex: 1, title: "C" });
    const canonical = manuscripts.saveManualVersion({
      chapterId: chapter.id,
      title: "正文章节",
      contentMarkdown: "人工版本",
      isCanonical: true
    });
    const run = generations.createRun({
      projectId: project.id,
      bookId: book.id,
      chapterId: chapter.id
    });

    generations.createArtifact({
      generationRunId: run.id,
      chapterId: chapter.id,
      artifactType: "draft_chapter",
      title: "AI 草稿",
      contentText: "生成内容",
      sourceNode: "draft"
    });

    expect(manuscripts.getCanonical(chapter.id)?.id).toBe(canonical.id);
  });

  it("searches memory and story bible content with FTS or fallback keyword search", () => {
    const { db } = createTestDatabase();
    const projects = new ProjectRepository(db);
    const books = new BookRepository(db);
    const storyBible = new StoryBibleRepository(db);
    const memory = new MemoryRepository(db);
    const project = projects.create({ name: "P" });
    const book = books.create({ projectId: project.id, title: "B" });

    memory.createChunk({
      bookId: book.id,
      sourceType: "manual",
      title: "灵气潮汐",
      content: "灵气潮汐会在雨夜增强主角感知。",
      importance: 8
    });
    storyBible.createEntry({
      bookId: book.id,
      entryType: "world_rule",
      title: "雨夜规则",
      content: "雨夜会放大异常感知。"
    });

    const results = memory.search(book.id, "雨夜");

    expect(results.map((result) => result.title)).toContain("雨夜规则");
    expect(results.map((result) => result.title)).toContain("灵气潮汐");
  });
});

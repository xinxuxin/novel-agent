import type { App } from "electron";
import { join } from "node:path";

import { createDatabaseConnection } from "./connection";
import type { DatabaseConnection, WenForgeDatabase } from "./connection";
import { migrateDatabase } from "./migrate";
import { BookRepository } from "./repositories/book-repository";
import { ChapterRepository } from "./repositories/chapter-repository";
import { CostRepository } from "./repositories/cost-repository";
import { GenerationRepository } from "./repositories/generation-repository";
import { ManuscriptRepository } from "./repositories/manuscript-repository";
import { MemoryRepository } from "./repositories/memory-repository";
import { ProjectRepository } from "./repositories/project-repository";
import { SettingsRepository } from "./repositories/settings-repository";
import { StoryBibleRepository } from "./repositories/story-bible-repository";
import { VolumeRepository } from "./repositories/volume-repository";
import { createId } from "./id";
import { nowIso } from "./repositories/types";

export interface RepositoryRegistry {
  projects: ProjectRepository;
  books: BookRepository;
  volumes: VolumeRepository;
  chapters: ChapterRepository;
  manuscripts: ManuscriptRepository;
  storyBible: StoryBibleRepository;
  memory: MemoryRepository;
  cost: CostRepository;
  generation: GenerationRepository;
  settings: SettingsRepository;
}

export interface AppDatabaseService {
  connection: DatabaseConnection;
  repositories: RepositoryRegistry;
}

export function getDatabasePath(app: App): string {
  return join(app.getPath("userData"), "data", "wenforge.sqlite");
}

export function createRepositories(db: WenForgeDatabase): RepositoryRegistry {
  return {
    projects: new ProjectRepository(db),
    books: new BookRepository(db),
    volumes: new VolumeRepository(db),
    chapters: new ChapterRepository(db),
    manuscripts: new ManuscriptRepository(db),
    storyBible: new StoryBibleRepository(db),
    memory: new MemoryRepository(db),
    cost: new CostRepository(db),
    generation: new GenerationRepository(db),
    settings: new SettingsRepository(db)
  };
}

export function createAppDatabaseService(app: App): AppDatabaseService {
  const connection = createDatabaseConnection(getDatabasePath(app));
  migrateDatabase(connection.sqlite);
  const repositories = createRepositories(connection.db);
  seedDemoData(connection.db, repositories);
  return { connection, repositories };
}

export function seedDemoData(db: WenForgeDatabase, repositories: RepositoryRegistry): void {
  if (repositories.projects.list().length > 0) {
    return;
  }

  const project = repositories.projects.create({
    name: "演示：都市异能爽文",
    description: "Phase 2 demo data for local-first project hierarchy and manuscript versioning.",
    genre: "都市异能",
    targetReader: "喜欢快节奏升级、悬念钩子和情绪爽点的读者"
  });
  const book = repositories.books.create({
    projectId: project.id,
    title: "觉醒之后",
    logline: "灵气复苏前夜，普通青年在雨夜觉醒异常感知。",
    genre: "都市异能",
    targetLengthChapters: 120
  });
  const volume = repositories.volumes.create({
    bookId: book.id,
    title: "灵气复苏前夜",
    volumeIndex: 1,
    summary: "世界变化露出第一道裂缝。"
  });
  const chapterOne = repositories.chapters.create({
    bookId: book.id,
    volumeId: volume.id,
    chapterIndex: 1,
    title: "雨夜异响",
    targetWords: 3000
  });
  repositories.chapters.create({
    bookId: book.id,
    volumeId: volume.id,
    chapterIndex: 2,
    title: "旧楼里的光",
    targetWords: 3000
  });
  repositories.chapters.create({
    bookId: book.id,
    volumeId: volume.id,
    chapterIndex: 3,
    title: "第一次失控",
    targetWords: 3200
  });
  repositories.manuscripts.saveManualVersion({
    chapterId: chapterOne.id,
    title: "雨夜异响",
    contentMarkdown:
      "雨声砸在窗沿上，像有人隔着玻璃轻轻敲门。\n\n林澈在凌晨三点醒来，听见整座城市的电流都在低语。",
    isCanonical: true
  });
  repositories.storyBible.createEntry({
    bookId: book.id,
    entryType: "world_rule",
    title: "雨夜感知规则",
    content: "雨夜会放大主角对灵气潮汐的异常感知，但持续时间有限。"
  });
  repositories.memory.createChunk({
    bookId: book.id,
    chapterId: chapterOne.id,
    sourceType: "manual_seed",
    title: "开篇钩子",
    content: "主角在雨夜听见城市电流低语，暗示灵气复苏和能力觉醒。",
    importance: 7
  });

  const now = nowIso();
  db.sqlite
    .prepare(
      "insert into characters (id, book_id, name, role, summary, current_state, created_at, updated_at) values (?, ?, ?, ?, ?, ?, ?, ?)"
    )
    .run(
      createId("character"),
      book.id,
      "林澈",
      "protagonist",
      "普通青年，觉醒异常感知。",
      "尚未理解自己的能力。",
      now,
      now
    );
  db.sqlite
    .prepare(
      "insert into style_guides (id, book_id, title, content, created_at, updated_at) values (?, ?, ?, ?, ?, ?)"
    )
    .run(createId("style"), book.id, "爽文节奏", "短段落、强钩子、章节末保留悬念。", now, now);
  db.sqlite
    .prepare(
      "insert into unresolved_hooks (id, book_id, chapter_id, title, content, created_at, updated_at) values (?, ?, ?, ?, ?, ?, ?)"
    )
    .run(
      createId("hook"),
      book.id,
      chapterOne.id,
      "城市低语来源",
      "林澈听见的电流低语究竟来自灵气潮汐还是某个外部存在？",
      now,
      now
    );
}

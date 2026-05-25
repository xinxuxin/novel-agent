import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import JSZip from "jszip";
import { afterEach, describe, expect, it } from "vitest";

import {
  ImportExportService,
  sanitizeImportedMarkdown,
  validateSafeUserPath
} from "@main/files/import-export-service";
import { BackupService } from "@main/files/backup-service";
import { createDatabaseConnection } from "@main/db/connection";
import { migrateDatabase } from "@main/db/migrate";
import { createRepositories } from "@main/db/service";

let tempDir = "";

function createHarness() {
  tempDir = mkdtempSync(join(tmpdir(), "wenforge-phase12-"));
  const dbPath = join(tempDir, "wenforge.sqlite");
  const connection = createDatabaseConnection(dbPath);
  migrateDatabase(connection.sqlite);
  const repositories = createRepositories(connection.db);
  const project = repositories.projects.create({ name: "安全导出项目", description: "测试" });
  const book = repositories.books.create({
    projectId: project.id,
    title: "导出之书",
    logline: "local"
  });
  const volume = repositories.volumes.create({
    bookId: book.id,
    title: "第一卷",
    volumeIndex: 1
  });
  const chapterTwo = repositories.chapters.create({
    bookId: book.id,
    volumeId: volume.id,
    chapterIndex: 2,
    title: "第二章 后手"
  });
  const chapterOne = repositories.chapters.create({
    bookId: book.id,
    volumeId: volume.id,
    chapterIndex: 1,
    title: "第一章 雨夜"
  });
  repositories.manuscripts.saveManualVersion({
    chapterId: chapterTwo.id,
    title: "v1",
    contentMarkdown: "第二章正文",
    isCanonical: true
  });
  repositories.manuscripts.saveManualVersion({
    chapterId: chapterOne.id,
    title: "v1",
    contentMarkdown: "第一章正文",
    isCanonical: true
  });
  repositories.storyBible.createEntry({
    bookId: book.id,
    entryType: "style",
    title: "文风",
    content: "短句推进。"
  });
  repositories.storyBible.createStyleGuide({
    bookId: book.id,
    title: "节奏规则",
    content: "章末必须有具体钩子。",
    genre: "都市异能"
  });
  connection.sqlite
    .prepare(
      `insert into provider_credentials
      (id, provider, display_name, encrypted_secret_base64, redacted_key_label, is_configured,
        last_status, created_at, updated_at)
      values (?, ?, ?, ?, ?, 1, 'configured', ?, ?)`
    )
    .run(
      "cred_secret",
      "openai",
      "OpenAI",
      Buffer.from("sk-secret-not-exported").toString("base64"),
      "sk-...redacted",
      "2026-05-25T00:00:00.000Z",
      "2026-05-25T00:00:00.000Z"
    );
  const service = new ImportExportService({
    database: connection.db,
    repositories,
    userDataDir: tempDir,
    now: () => "2026-05-25T12:00:00.000Z"
  });
  const backup = new BackupService({
    database: connection.db,
    repositories,
    dbPath,
    userDataDir: tempDir,
    now: () => "2026-05-25T12:00:00.000Z"
  });
  return {
    backup,
    book,
    chapterOne,
    chapterTwo,
    connection,
    dbPath,
    project,
    repositories,
    service
  };
}

afterEach(() => {
  if (tempDir) {
    rmSync(tempDir, { recursive: true, force: true });
    tempDir = "";
  }
});

describe("phase 12 import export backup and restore", () => {
  it("exports ordered markdown, txt, project JSON, packages, and redacted costs without secrets", async () => {
    const { book, chapterOne, connection, project, repositories, service } = createHarness();
    const llm = repositories.cost.createLlmRun({
      projectId: project.id,
      bookId: book.id,
      chapterId: chapterOne.id,
      provider: "openai",
      model: "safe",
      taskType: "draft_chapter",
      inputTokensEstimated: 1000,
      estimatedCostLive: 0.01,
      currency: "USD",
      promptHash: "hash-only"
    });
    repositories.cost.finishRun(llm.id, {
      status: "failed",
      outputTokensEstimatedLive: 200,
      usageSource: "estimated",
      estimatedCostLive: 0.01,
      finalCost: 0.01,
      errorCode: "provider_error",
      errorMessage: "Authorization: Bearer sk-secret-cost"
    });

    const markdown = service.exportBookMarkdown({ bookId: book.id, frontMatter: true });
    expect(markdown.files.map((file) => file.relativePath)).toEqual([
      "chapters/001-第一章-雨夜.md",
      "chapters/002-第二章-后手.md",
      "导出之书.md"
    ]);
    expect(markdown.files.at(-1)?.content.indexOf("第一章正文")).toBeLessThan(
      markdown.files.at(-1)?.content.indexOf("第二章正文") ?? -1
    );

    const txt = service.exportBookTxt({ bookId: book.id });
    expect(txt.content).toContain("第一章正文\n\n第二章正文");

    const projectJson = service.exportProjectJson({
      projectId: project.id,
      includeManuscriptVersions: true,
      includeCostLogs: true
    });
    expect(projectJson.structuredStoryBible?.styleGuides?.[0]?.title).toBe("节奏规则");
    const serialized = JSON.stringify(projectJson);
    expect(serialized).not.toContain("encrypted_secret_base64");
    expect(serialized).not.toContain("sk-secret-not-exported");
    expect(serialized).not.toContain("Bearer");

    const costCsv = service.exportCostCsv({ projectId: project.id });
    expect(costCsv.content).not.toContain("sk-secret-cost");
    expect(costCsv.content).not.toContain("Bearer");

    const packageFile = await service.exportProjectPackage({ projectId: project.id });
    const zip = await JSZip.loadAsync(Buffer.from(packageFile.bytesBase64, "base64"));
    expect(zip.file("metadata.json")).toBeTruthy();
    expect(zip.file("chapters/001-第一章-雨夜.md")).toBeTruthy();
    expect(zip.file("story-bible/entries.json")).toBeTruthy();
    const metadata = await zip.file("metadata.json")?.async("string");
    expect(metadata).not.toContain("sk-secret");

    const tableNames = connection.sqlite
      .prepare("select name from sqlite_master where type = 'table'")
      .all()
      .map((row) => String((row as { name: string }).name));
    expect(tableNames).toContain("import_export_jobs");
  });

  it("validates paths, sanitizes markdown, imports markdown and txt chapters, and handles conflicts", () => {
    const { book, repositories, service } = createHarness();
    expect(() => validateSafeUserPath(tempDir, join(tempDir, "..", "evil.md"))).toThrow(/path/i);
    expect(sanitizeImportedMarkdown("# Title\n<script>alert(1)</script>\n正文")).not.toContain(
      "script"
    );

    const importedMarkdown = service.importMarkdown({
      bookId: book.id,
      files: [
        {
          relativePath: "safe/new.md",
          content: "# 新章\n<script>alert(1)</script>\n新章正文"
        }
      ],
      conflictStrategy: "skip_duplicates"
    });
    expect(importedMarkdown.importedChapters).toBe(1);
    const markdownChapter = repositories.chapters
      .listByBook(book.id)
      .find((chapter) => chapter.title === "新章");
    expect(markdownChapter).toBeTruthy();
    expect(
      repositories.manuscripts.getCanonical(markdownChapter!.id)?.contentMarkdown
    ).not.toContain("<script>");

    const importedTxt = service.importTxt({
      bookId: book.id,
      content: "第十章 风起\n风起正文\n\n第十一章 云落\n云落正文",
      conflictStrategy: "skip_duplicates"
    });
    expect(importedTxt.importedChapters).toBe(2);

    const skipped = service.importMarkdown({
      bookId: book.id,
      files: [{ relativePath: "safe/duplicate.md", content: "# 新章\n重复内容" }],
      conflictStrategy: "skip_duplicates"
    });
    expect(skipped.skippedChapters).toBe(1);
  });

  it("imports project JSON and WenForge packages with validation", async () => {
    const { project, service } = createHarness();
    const exported = service.exportProjectJson({
      projectId: project.id,
      includeManuscriptVersions: true
    });
    const imported = service.importProjectJson({
      payload: exported,
      conflictStrategy: "create_new_project"
    });
    expect(imported.importedProjects).toBe(1);

    expect(() =>
      service.importProjectJson({
        payload: { project: { name: "" } },
        conflictStrategy: "create_new_project"
      })
    ).toThrow(/invalid/i);

    const packageFile = await service.exportProjectPackage({ projectId: project.id });
    const importedPackage = await service.importProjectPackage({
      bytesBase64: packageFile.bytesBase64,
      conflictStrategy: "create_new_project"
    });
    expect(importedPackage.importedProjects).toBe(1);
  });

  it("creates local backups, lists them, and restores after making a pre-restore backup", async () => {
    const { backup, book, connection, repositories } = createHarness();
    const created = await backup.create({ reason: "manual" });
    expect(existsSync(created.path)).toBe(true);
    repositories.chapters.create({ bookId: book.id, chapterIndex: 99, title: "临时章" });
    expect(
      repositories.chapters.listByBook(book.id).some((chapter) => chapter.title === "临时章")
    ).toBe(true);

    const restored = await backup.restore({ id: created.id, confirmed: true });
    expect(restored.preRestoreBackupId).toBeTruthy();
    expect(
      repositories.chapters.listByBook(book.id).some((chapter) => chapter.title === "临时章")
    ).toBe(false);
    const restoredProject = repositories.projects
      .list()
      .find((item) => item.name.startsWith("安全导出项目"));
    expect(restoredProject).toBeTruthy();
    const restoredBook = repositories.books.listByProject(restoredProject!.id)[0];
    expect(restoredBook).toBeTruthy();
    expect(
      repositories.chapters
        .listByBook(restoredBook!.id)
        .some((chapter) => chapter.title === "第一章 雨夜")
    ).toBe(true);
    expect(
      repositories.storyBible
        .listStyleGuides({ bookId: restoredBook!.id })
        .some((style) => style.title === "节奏规则")
    ).toBe(true);
    expect(backup.list().length).toBeGreaterThanOrEqual(2);

    const settings = backup.updateSettings({
      autoBackup: "daily",
      backupLocation: join(tempDir, "custom-backups"),
      retentionCount: 3
    });
    expect(settings.autoBackup).toBe("daily");
    expect(settings.retentionCount).toBe(3);

    const restoredContent = readFileSync(created.path, "utf8");
    expect(restoredContent).toContain("metadata");
    expect(connection.sqlite.prepare("pragma integrity_check").pluck().get()).toBe("ok");
  });
});

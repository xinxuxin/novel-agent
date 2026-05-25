import { Buffer } from "node:buffer";
import { basename, extname, isAbsolute, relative, resolve, sep } from "node:path";

import JSZip from "jszip";
import { z } from "zod";

import {
  importMarkdownRequestSchema,
  importProjectJsonRequestSchema,
  importProjectPackageRequestSchema,
  importTxtRequestSchema,
  projectJsonPackageSchema,
  type ConflictStrategy,
  type ExportFilesResult,
  type ExportPackageResult,
  type ExportTextResult,
  type ImportMarkdownRequest,
  type ImportProjectJsonRequest,
  type ImportProjectPackageRequest,
  type ImportResult,
  type ImportTxtRequest,
  type ProjectJsonPackage
} from "@contracts/import-export";
import { CostDashboardService } from "@main/costs/cost-dashboard-service";
import type { WenForgeDatabase } from "@main/db/connection";
import { createId } from "@main/db/id";
import type { BookRecord } from "@main/db/repositories/book-repository";
import type { ChapterRecord } from "@main/db/repositories/chapter-repository";
import type { ManuscriptVersionRecord } from "@main/db/repositories/manuscript-repository";
import type { ProjectRecord } from "@main/db/repositories/project-repository";
import type { StoryBibleEntryRecord } from "@main/db/repositories/story-bible-repository";
import type { RepositoryRegistry } from "@main/db/service";
import { RedactionService } from "@main/security/redaction-service";

export interface ImportExportServiceOptions {
  database: WenForgeDatabase;
  repositories: RepositoryRegistry;
  userDataDir: string;
  now?: () => string;
}

export interface ExportBookMarkdownInput {
  bookId: string;
  frontMatter?: boolean | undefined;
}

export interface ExportBookTxtInput {
  bookId: string;
}

export interface ExportProjectJsonInput {
  projectId: string;
  includeManuscriptVersions?: boolean | undefined;
  includeCostLogs?: boolean | undefined;
}

export interface ExportProjectPackageInput extends ExportProjectJsonInput {
  includeCosts?: boolean | undefined;
}

export interface ExportCostCsvInput {
  projectId?: string | undefined;
  bookId?: string | undefined;
  chapterId?: string | undefined;
  since?: string | undefined;
  until?: string | undefined;
}

const SAFE_IMPORT_PATH_SCHEMA = z.string().min(1).max(500);
const HTML_RISK_PATTERN = /<(script|style|iframe|object|embed|link|meta)[\s\S]*?<\/\1>/gi;
const SINGLE_HTML_RISK_PATTERN = /<(script|style|iframe|object|embed|link|meta)\b[^>]*\/?>/gi;

export function validateSafeUserPath(baseDir: string, targetPath: string): string {
  const resolvedBase = resolve(baseDir);
  const resolvedTarget = resolve(targetPath);
  const isInside =
    resolvedTarget === resolvedBase || resolvedTarget.startsWith(`${resolvedBase}${sep}`);

  if (!isInside) {
    throw new Error("Unsafe path traversal rejected");
  }

  return resolvedTarget;
}

export function sanitizeImportedMarkdown(markdown: string): string {
  return markdown
    .replace(HTML_RISK_PATTERN, "")
    .replace(SINGLE_HTML_RISK_PATTERN, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/javascript:/gi, "")
    .trim();
}

export class ImportExportService {
  private readonly redaction = new RedactionService();

  constructor(private readonly options: ImportExportServiceOptions) {}

  exportBookMarkdown(input: ExportBookMarkdownInput): ExportFilesResult {
    const book = this.requireBook(input.bookId);
    const chapters = this.chaptersWithCanonical(input.bookId);
    const files = chapters.map(({ chapter, canonical }) => ({
      relativePath: `chapters/${chapterFileName(chapter)}`,
      content: this.formatChapterMarkdown(chapter, canonical, Boolean(input.frontMatter))
    }));
    const combined = chapters
      .map(({ chapter, canonical }) => this.formatChapterMarkdown(chapter, canonical, false))
      .join("\n\n");

    files.push({
      relativePath: `${safeFileName(book.title)}.md`,
      content: combined
    });
    this.recordJob("export_book_markdown", "completed", { bookId: book.id, files: files.length });

    return {
      filename: `${safeFileName(book.title)}-markdown.zip`,
      files
    };
  }

  exportBookTxt(input: ExportBookTxtInput): ExportTextResult {
    const book = this.requireBook(input.bookId);
    const content = this.chaptersWithCanonical(input.bookId)
      .map(
        ({ canonical }) =>
          canonical?.contentPlaintext || stripMarkdown(canonical?.contentMarkdown ?? "")
      )
      .join("\n\n");
    this.recordJob("export_book_txt", "completed", { bookId: book.id });

    return {
      filename: `${safeFileName(book.title)}.txt`,
      content
    };
  }

  exportProjectJson(input: ExportProjectJsonInput): ProjectJsonPackage {
    const project = this.requireProject(input.projectId);
    const books = this.options.repositories.books.listByProject(project.id).map((book) => ({
      id: book.id,
      title: book.title,
      logline: book.logline,
      genre: book.genre,
      targetLengthChapters: book.targetLengthChapters,
      status: book.status,
      volumes: this.options.repositories.volumes.listByBook(book.id).map((volume) => ({
        id: volume.id,
        title: volume.title,
        volumeIndex: volume.volumeIndex,
        summary: volume.summary,
        status: volume.status
      })),
      chapters: this.options.repositories.chapters.listByBook(book.id).map((chapter) => {
        const canonical = this.options.repositories.manuscripts.getCanonical(chapter.id);
        const versions = input.includeManuscriptVersions
          ? this.options.repositories.manuscripts.listVersions(chapter.id).map((version) => ({
              id: version.id,
              title: version.title,
              versionIndex: version.versionIndex,
              contentMarkdown: sanitizeImportedMarkdown(version.contentMarkdown),
              isCanonical: version.isCanonical,
              sourceType: version.sourceType,
              createdAt: version.createdAt
            }))
          : undefined;

        return {
          id: chapter.id,
          volumeId: chapter.volumeId,
          chapterIndex: chapter.chapterIndex,
          title: chapter.title,
          status: chapter.status,
          targetWords: chapter.targetWords,
          summary: chapter.summary,
          canonicalMarkdown: sanitizeImportedMarkdown(canonical?.contentMarkdown ?? ""),
          ...(versions ? { manuscriptVersions: versions } : {})
        };
      })
    }));
    const storyBibleEntries = this.storyBibleEntriesForProject(project.id).map((entry) => ({
      id: entry.id,
      bookId: entry.bookId,
      chapterId: entry.chapterId,
      entryType: entry.entryType,
      title: entry.title,
      content: entry.content,
      provenance: entry.provenance,
      status: entry.status
    }));
    const packageJson = {
      schemaVersion: 1 as const,
      exportedAt: this.now(),
      metadata: {
        app: "WenForge Studio" as const,
        secretsExcluded: true as const,
        encryptedSecretsIncluded: false as const,
        warning: "Provider credentials, decrypted secrets, and Authorization headers are excluded."
      },
      project: {
        id: project.id,
        name: project.name,
        description: project.description,
        genre: project.genre,
        targetReader: project.targetReader,
        status: project.status
      },
      books,
      storyBibleEntries,
      structuredStoryBible: this.structuredStoryBibleForProject(project.id),
      settings: this.safeExportSettings(),
      ...(input.includeCostLogs ? { costs: this.safeCostRows({ projectId: project.id }) } : {})
    };
    const parsed = projectJsonPackageSchema.parse(JSON.parse(this.redactJson(packageJson)));
    this.recordJob("export_project_json", "completed", {
      projectId: project.id,
      includeManuscriptVersions: Boolean(input.includeManuscriptVersions),
      includeCostLogs: Boolean(input.includeCostLogs)
    });
    return parsed;
  }

  exportCostCsv(input: ExportCostCsvInput): ExportTextResult & { rowCount: number } {
    const dashboardOptions = {
      database: this.options.database,
      repositories: this.options.repositories,
      ...(this.options.now ? { now: this.options.now } : {})
    };
    const result = new CostDashboardService(dashboardOptions).exportCsv(input);
    this.recordJob("export_cost_csv", "completed", {
      projectId: input.projectId ?? null,
      bookId: input.bookId ?? null,
      chapterId: input.chapterId ?? null,
      rowCount: result.rowCount
    });
    return result;
  }

  async exportProjectPackage(input: ExportProjectPackageInput): Promise<ExportPackageResult> {
    const projectJson = this.exportProjectJson({
      projectId: input.projectId,
      ...(typeof input.includeManuscriptVersions === "undefined"
        ? {}
        : { includeManuscriptVersions: input.includeManuscriptVersions }),
      ...(typeof input.includeCostLogs === "undefined" && typeof input.includeCosts === "undefined"
        ? {}
        : { includeCostLogs: input.includeCostLogs ?? input.includeCosts })
    });
    const zip = new JSZip();
    const projectName = safeFileName(projectJson.project.name);

    zip.file(
      "metadata.json",
      JSON.stringify(
        {
          app: "WenForge Studio",
          schemaVersion: 1,
          exportedAt: projectJson.exportedAt,
          projectName: projectJson.project.name,
          secretsExcluded: true,
          encryptedSecretsIncluded: false
        },
        null,
        2
      )
    );
    zip.file("project.json", JSON.stringify(projectJson, null, 2));

    for (const book of projectJson.books) {
      for (const chapter of [...book.chapters].sort((a, b) => a.chapterIndex - b.chapterIndex)) {
        zip.file(
          `chapters/${chapterFileName(chapter)}`,
          this.formatPlainExportedChapter(chapter.title, chapter.canonicalMarkdown)
        );
      }
    }

    zip.file("story-bible/entries.json", JSON.stringify(projectJson.storyBibleEntries, null, 2));
    if (input.includeCostLogs ?? input.includeCosts) {
      zip.file("costs/cost-report.csv", this.exportCostCsv({ projectId: input.projectId }).content);
    }

    const bytes = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
    this.recordJob("export_project_package", "completed", {
      projectId: input.projectId,
      entryCount: Object.keys(zip.files).length
    });

    return {
      filename: `${projectName}.wenforge.zip`,
      bytesBase64: Buffer.from(bytes).toString("base64"),
      entryCount: Object.keys(zip.files).length
    };
  }

  importMarkdown(input: ImportMarkdownRequest): ImportResult {
    const parsed = importMarkdownRequestSchema.parse(input);
    this.requireBook(parsed.bookId);
    let importedChapters = 0;
    let skippedChapters = 0;
    const warnings: string[] = [];

    for (const file of parsed.files) {
      assertSafeRelativeImportPath(file.relativePath);
      const sanitized = sanitizeImportedMarkdown(file.content);
      const title = extractMarkdownTitle(sanitized) || titleFromPath(file.relativePath);
      const result = this.importChapter({
        bookId: parsed.bookId,
        volumeId: parsed.volumeId ?? null,
        title,
        contentMarkdown: removeLeadingTitle(sanitized),
        conflictStrategy: parsed.conflictStrategy,
        sourceType: "imported"
      });
      importedChapters += result.imported ? 1 : 0;
      skippedChapters += result.skipped ? 1 : 0;
      warnings.push(...result.warnings);
    }

    this.recordJob("import_markdown", "completed", {
      bookId: parsed.bookId,
      importedChapters,
      skippedChapters
    });
    return emptyImportResult({ importedChapters, skippedChapters, warnings });
  }

  importTxt(input: ImportTxtRequest): ImportResult {
    const parsed = importTxtRequestSchema.parse(input);
    this.requireBook(parsed.bookId);
    let importedChapters = 0;
    let skippedChapters = 0;
    const warnings: string[] = [];

    for (const chapter of splitTxtChapters(parsed.content)) {
      const result = this.importChapter({
        bookId: parsed.bookId,
        volumeId: parsed.volumeId ?? null,
        title: chapter.title,
        contentMarkdown: sanitizeImportedMarkdown(chapter.content),
        conflictStrategy: parsed.conflictStrategy,
        sourceType: "imported"
      });
      importedChapters += result.imported ? 1 : 0;
      skippedChapters += result.skipped ? 1 : 0;
      warnings.push(...result.warnings);
    }

    this.recordJob("import_txt", "completed", {
      bookId: parsed.bookId,
      importedChapters,
      skippedChapters
    });
    return emptyImportResult({ importedChapters, skippedChapters, warnings });
  }

  importProjectJson(input: ImportProjectJsonRequest): ImportResult {
    const parsedRequest = importProjectJsonRequestSchema.parse(input);
    const parsedPackage = projectJsonPackageSchema.safeParse(parsedRequest.payload);
    if (!parsedPackage.success) {
      throw new Error(
        `Invalid WenForge project JSON: ${parsedPackage.error.issues[0]?.message ?? "schema mismatch"}`
      );
    }

    const result = this.importProjectPackageData(
      parsedPackage.data,
      parsedRequest.conflictStrategy
    );
    this.recordJob("import_project_json", "completed", {
      projectName: parsedPackage.data.project.name,
      importedProjects: result.importedProjects,
      importedBooks: result.importedBooks,
      importedChapters: result.importedChapters
    });
    return result;
  }

  async importProjectPackage(input: ImportProjectPackageRequest): Promise<ImportResult> {
    const parsed = importProjectPackageRequestSchema.parse(input);
    const zip = await JSZip.loadAsync(Buffer.from(parsed.bytesBase64, "base64"));
    const projectFile = zip.file("project.json");
    if (!projectFile) {
      throw new Error("Invalid WenForge package: missing project.json");
    }
    const payload = JSON.parse(await projectFile.async("string")) as unknown;
    const result = this.importProjectJson({
      payload,
      conflictStrategy: parsed.conflictStrategy,
      targetProjectId: parsed.targetProjectId ?? null,
      confirmed: parsed.confirmed
    });
    this.recordJob("import_project_package", "completed", {
      importedProjects: result.importedProjects,
      importedBooks: result.importedBooks,
      importedChapters: result.importedChapters
    });
    return result;
  }

  exportAllProjects(includeManuscriptVersions = true): ProjectJsonPackage[] {
    return this.options.repositories.projects.list().map((project) =>
      this.exportProjectJson({
        projectId: project.id,
        includeManuscriptVersions,
        includeCostLogs: true
      })
    );
  }

  private importProjectPackageData(
    packageData: ProjectJsonPackage,
    conflictStrategy: ConflictStrategy
  ): ImportResult {
    if (conflictStrategy !== "create_new_project" && conflictStrategy !== "merge_existing") {
      throw new Error(
        "Project imports must create a new project or merge into an existing project"
      );
    }

    const project = this.options.repositories.projects.create({
      name: this.uniqueProjectName(packageData.project.name),
      description: packageData.project.description ?? undefined,
      genre: packageData.project.genre ?? undefined,
      targetReader: packageData.project.targetReader ?? undefined,
      status: packageData.project.status
    });
    const bookIdMap = new Map<string, string>();
    const volumeIdMap = new Map<string, string>();
    const chapterIdMap = new Map<string, string>();
    let importedBooks = 0;
    let importedChapters = 0;

    for (const book of packageData.books) {
      const createdBook = this.options.repositories.books.create({
        projectId: project.id,
        title: book.title,
        logline: book.logline ?? undefined,
        genre: book.genre ?? undefined,
        targetLengthChapters: book.targetLengthChapters ?? undefined,
        status: book.status
      });
      importedBooks += 1;
      bookIdMap.set(book.id, createdBook.id);

      for (const volume of book.volumes) {
        const createdVolume = this.options.repositories.volumes.create({
          bookId: createdBook.id,
          title: volume.title,
          volumeIndex: volume.volumeIndex,
          summary: volume.summary ?? undefined,
          status: volume.status
        });
        volumeIdMap.set(volume.id, createdVolume.id);
      }

      for (const chapter of [...book.chapters].sort((a, b) => a.chapterIndex - b.chapterIndex)) {
        const createdChapter = this.options.repositories.chapters.create({
          bookId: createdBook.id,
          volumeId: chapter.volumeId ? (volumeIdMap.get(chapter.volumeId) ?? null) : null,
          chapterIndex: chapter.chapterIndex,
          title: chapter.title,
          status: chapter.status,
          targetWords: chapter.targetWords,
          summary: chapter.summary ?? undefined
        });
        chapterIdMap.set(chapter.id, createdChapter.id);
        importedChapters += 1;

        const versions = chapter.manuscriptVersions?.length
          ? [...chapter.manuscriptVersions].sort((a, b) => a.versionIndex - b.versionIndex)
          : [
              {
                title: "Imported canonical",
                contentMarkdown: chapter.canonicalMarkdown,
                isCanonical: true,
                sourceType: "imported"
              }
            ];

        for (const version of versions) {
          this.options.repositories.manuscripts.saveVersion({
            chapterId: createdChapter.id,
            title: version.title,
            contentMarkdown: sanitizeImportedMarkdown(version.contentMarkdown),
            sourceType: version.isCanonical ? "restored" : "imported",
            isCanonical: version.isCanonical
          });
        }
      }
    }

    for (const entry of packageData.storyBibleEntries) {
      const mappedBookId = bookIdMap.get(entry.bookId);
      if (!mappedBookId) continue;
      this.options.repositories.storyBible.createEntry({
        bookId: mappedBookId,
        chapterId: entry.chapterId ? (chapterIdMap.get(entry.chapterId) ?? null) : null,
        entryType: entry.entryType,
        title: entry.title,
        content: entry.content,
        provenance: entry.provenance
      });
    }
    this.importStructuredStoryBible(packageData.structuredStoryBible, bookIdMap, chapterIdMap);

    return emptyImportResult({
      importedProjects: 1,
      importedBooks,
      importedChapters,
      warnings: []
    });
  }

  private importChapter(input: {
    bookId: string;
    volumeId: string | null;
    title: string;
    contentMarkdown: string;
    conflictStrategy: ConflictStrategy;
    sourceType: "imported" | "restored";
  }): { imported: boolean; skipped: boolean; warnings: string[] } {
    const existing = this.options.repositories.chapters
      .listByBook(input.bookId)
      .find((chapter) => normalizeTitle(chapter.title) === normalizeTitle(input.title));
    if (existing && input.conflictStrategy === "skip_duplicates") {
      return {
        imported: false,
        skipped: true,
        warnings: [`Skipped duplicate chapter: ${input.title}`]
      };
    }
    if (existing && input.conflictStrategy !== "overwrite") {
      return {
        imported: false,
        skipped: true,
        warnings: [`Chapter exists and was not overwritten: ${input.title}`]
      };
    }

    const chapter =
      existing && input.conflictStrategy === "overwrite"
        ? existing
        : this.options.repositories.chapters.create({
            bookId: input.bookId,
            volumeId: input.volumeId,
            chapterIndex: this.nextChapterIndex(input.bookId),
            title: input.title
          });
    this.options.repositories.manuscripts.saveVersion({
      chapterId: chapter.id,
      title: "Imported version",
      contentMarkdown: sanitizeImportedMarkdown(input.contentMarkdown),
      sourceType: input.sourceType,
      isCanonical: true
    });
    return { imported: true, skipped: false, warnings: [] };
  }

  private nextChapterIndex(bookId: string): number {
    return (
      Math.max(
        0,
        ...this.options.repositories.chapters
          .listByBook(bookId)
          .map((chapter) => chapter.chapterIndex)
      ) + 1
    );
  }

  private chaptersWithCanonical(bookId: string): Array<{
    chapter: ChapterRecord;
    canonical: ManuscriptVersionRecord | null;
  }> {
    return this.options.repositories.chapters
      .listByBook(bookId)
      .sort((a, b) => a.chapterIndex - b.chapterIndex)
      .map((chapter) => ({
        chapter,
        canonical: this.options.repositories.manuscripts.getCanonical(chapter.id)
      }));
  }

  private formatChapterMarkdown(
    chapter: Pick<ChapterRecord, "title" | "chapterIndex" | "summary">,
    canonical: ManuscriptVersionRecord | null,
    frontMatter: boolean
  ): string {
    return this.formatPlainExportedChapter(
      chapter.title,
      canonical?.contentMarkdown ?? "",
      frontMatter
        ? [
            "---",
            `title: ${jsonScalar(chapter.title)}`,
            `chapter_index: ${chapter.chapterIndex}`,
            chapter.summary ? `summary: ${jsonScalar(chapter.summary)}` : "",
            "---",
            ""
          ]
            .filter(Boolean)
            .join("\n")
        : undefined
    );
  }

  private formatPlainExportedChapter(
    title: string,
    contentMarkdown: string,
    prefix?: string
  ): string {
    const body = sanitizeImportedMarkdown(contentMarkdown).trim();
    return [prefix, `# ${title}`, body].filter(Boolean).join("\n\n").trim();
  }

  private storyBibleEntriesForProject(projectId: string): StoryBibleEntryRecord[] {
    return this.options.repositories.books
      .listByProject(projectId)
      .flatMap((book) => this.options.repositories.storyBible.list(book.id));
  }

  private structuredStoryBibleForProject(
    projectId: string
  ): NonNullable<ProjectJsonPackage["structuredStoryBible"]> {
    const books = this.options.repositories.books.listByProject(projectId);
    return {
      characters: books.flatMap((book) =>
        portableRecords(this.options.repositories.storyBible.listCharacters({ bookId: book.id }))
      ),
      factions: books.flatMap((book) =>
        portableRecords(this.options.repositories.storyBible.listFactions({ bookId: book.id }))
      ),
      locations: books.flatMap((book) =>
        portableRecords(this.options.repositories.storyBible.listLocations({ bookId: book.id }))
      ),
      artifacts: books.flatMap((book) =>
        portableRecords(this.options.repositories.storyBible.listArtifacts({ bookId: book.id }))
      ),
      powerSystem: books.flatMap((book) =>
        portableRecords(this.options.repositories.storyBible.listPowerSystem({ bookId: book.id }))
      ),
      timeline: books.flatMap((book) =>
        portableRecords(this.options.repositories.storyBible.listTimeline({ bookId: book.id }))
      ),
      foreshadowing: books.flatMap((book) =>
        portableRecords(this.options.repositories.storyBible.listForeshadowing({ bookId: book.id }))
      ),
      hooks: books.flatMap((book) =>
        portableRecords(this.options.repositories.storyBible.listHooks({ bookId: book.id }))
      ),
      styleGuides: books.flatMap((book) =>
        portableRecords(this.options.repositories.storyBible.listStyleGuides({ bookId: book.id }))
      ),
      readerPositioning: books.flatMap((book) =>
        portableRecords(
          this.options.repositories.storyBible.listReaderPositioning({ bookId: book.id })
        )
      )
    };
  }

  private importStructuredStoryBible(
    structured: ProjectJsonPackage["structuredStoryBible"],
    bookIdMap: Map<string, string>,
    chapterIdMap: Map<string, string>
  ): void {
    if (!structured) return;

    for (const record of structured.characters ?? []) {
      const bookId = mappedBookId(record, bookIdMap);
      if (!bookId) continue;
      this.options.repositories.storyBible.createCharacter({
        bookId,
        name: stringField(record, "name", "Imported Character"),
        aliases: stringArrayField(record, "aliases"),
        role: nullableStringField(record, "role"),
        firstAppearanceChapterId: mappedNullableId(
          record["firstAppearanceChapterId"],
          chapterIdMap
        ),
        summary: nullableStringField(record, "summary"),
        currentState: nullableStringField(record, "currentState"),
        goal: nullableStringField(record, "goal"),
        motivation: nullableStringField(record, "motivation"),
        secret: nullableStringField(record, "secret"),
        contradiction: nullableStringField(record, "contradiction"),
        relationshipNotes: nullableStringField(record, "relationshipNotes"),
        speakingStyle: nullableStringField(record, "speakingStyle"),
        forbiddenInconsistencies: nullableStringField(record, "forbiddenInconsistencies"),
        tags: stringArrayField(record, "tags"),
        importance: numberField(record, "importance", 5),
        relatedChapterIds: mappedIdArray(record["relatedChapterIds"], chapterIdMap)
      });
    }

    for (const [key, create] of [
      [
        "factions",
        this.options.repositories.storyBible.createFaction.bind(
          this.options.repositories.storyBible
        )
      ],
      [
        "locations",
        this.options.repositories.storyBible.createLocation.bind(
          this.options.repositories.storyBible
        )
      ],
      [
        "artifacts",
        this.options.repositories.storyBible.createArtifact.bind(
          this.options.repositories.storyBible
        )
      ]
    ] as const) {
      for (const record of structured[key] ?? []) {
        const bookId = mappedBookId(record, bookIdMap);
        if (!bookId) continue;
        create({
          bookId,
          name: stringField(record, "name", "Imported Entity"),
          summary: nullableStringField(record, "summary"),
          tags: stringArrayField(record, "tags"),
          importance: numberField(record, "importance", 5),
          relatedChapterIds: mappedIdArray(record["relatedChapterIds"], chapterIdMap)
        });
      }
    }

    for (const record of structured.powerSystem ?? []) {
      const bookId = mappedBookId(record, bookIdMap);
      if (!bookId) continue;
      this.options.repositories.storyBible.createPowerSystemRule({
        bookId,
        ruleType: nullableStringField(record, "ruleType"),
        rankLevelName: stringField(record, "rankLevelName", "Imported Rule"),
        rankOrder: numberField(record, "rankOrder", 0),
        advancementConditions: nullableStringField(record, "advancementConditions"),
        limitsCosts: nullableStringField(record, "limitsCosts"),
        knownUsers: stringArrayField(record, "knownUsers"),
        contradictionChecks: nullableStringField(record, "contradictionChecks"),
        notes: nullableStringField(record, "notes"),
        tags: stringArrayField(record, "tags"),
        importance: numberField(record, "importance", 5),
        relatedChapterIds: mappedIdArray(record["relatedChapterIds"], chapterIdMap)
      });
    }

    for (const record of structured.timeline ?? []) {
      const bookId = mappedBookId(record, bookIdMap);
      if (!bookId) continue;
      this.options.repositories.storyBible.createTimelineEvent({
        bookId,
        chapterId: mappedNullableId(record["chapterId"], chapterIdMap),
        eventIndex: numberField(record, "eventIndex", 0),
        title: stringField(record, "title", "Imported Event"),
        content: stringField(record, "content", ""),
        tags: stringArrayField(record, "tags"),
        importance: numberField(record, "importance", 5),
        relatedChapterIds: mappedIdArray(record["relatedChapterIds"], chapterIdMap)
      });
    }

    for (const record of structured.foreshadowing ?? []) {
      const bookId = mappedBookId(record, bookIdMap);
      if (!bookId) continue;
      this.options.repositories.storyBible.createForeshadowing({
        bookId,
        seedChapterId: mappedNullableId(record["seedChapterId"], chapterIdMap),
        hintText: stringField(record, "hintText", ""),
        expectedPayoffChapterId: mappedNullableId(record["expectedPayoffChapterId"], chapterIdMap),
        status: foreshadowingStatus(record["status"]),
        relatedEntities: stringArrayField(record, "relatedEntities"),
        payoffNotes: nullableStringField(record, "payoffNotes"),
        tags: stringArrayField(record, "tags"),
        importance: numberField(record, "importance", 5),
        relatedChapterIds: mappedIdArray(record["relatedChapterIds"], chapterIdMap)
      });
    }

    for (const record of structured.hooks ?? []) {
      const bookId = mappedBookId(record, bookIdMap);
      if (!bookId) continue;
      this.options.repositories.storyBible.createUnresolvedHook({
        bookId,
        sourceChapterId: mappedNullableId(record["sourceChapterId"], chapterIdMap),
        hookText: stringField(record, "hookText", ""),
        urgency: nullableStringField(record, "urgency"),
        expectedResolutionWindow: nullableStringField(record, "expectedResolutionWindow"),
        status: stringField(record, "status", "open"),
        notes: nullableStringField(record, "notes"),
        tags: stringArrayField(record, "tags"),
        importance: numberField(record, "importance", 5),
        relatedChapterIds: mappedIdArray(record["relatedChapterIds"], chapterIdMap)
      });
    }

    for (const record of structured.styleGuides ?? []) {
      const bookId = mappedBookId(record, bookIdMap);
      if (!bookId) continue;
      this.options.repositories.storyBible.createStyleGuide({
        bookId,
        title: stringField(record, "title", "Imported Style Guide"),
        content: stringField(record, "content", ""),
        genre: nullableStringField(record, "genre"),
        tone: nullableStringField(record, "tone"),
        pacingRules: nullableStringField(record, "pacingRules"),
        forbiddenCliches: nullableStringField(record, "forbiddenCliches"),
        preferredSentencePatterns: nullableStringField(record, "preferredSentencePatterns"),
        dialogueStyle: nullableStringField(record, "dialogueStyle"),
        chapterEndingPattern: nullableStringField(record, "chapterEndingPattern"),
        examples: nullableStringField(record, "examples"),
        tags: stringArrayField(record, "tags"),
        importance: numberField(record, "importance", 5),
        relatedChapterIds: mappedIdArray(record["relatedChapterIds"], chapterIdMap)
      });
    }

    for (const record of structured.readerPositioning ?? []) {
      const bookId = mappedBookId(record, bookIdMap);
      if (!bookId) continue;
      this.options.repositories.storyBible.createReaderPositioning({
        bookId,
        title: stringField(record, "title", "Imported Reader Positioning"),
        content: stringField(record, "content", ""),
        targetReader: nullableStringField(record, "targetReader"),
        platformStyle: nullableStringField(record, "platformStyle"),
        genreExpectation: nullableStringField(record, "genreExpectation"),
        emotionalPromise: nullableStringField(record, "emotionalPromise"),
        updateCadenceNotes: nullableStringField(record, "updateCadenceNotes"),
        commercialConstraints: nullableStringField(record, "commercialConstraints"),
        tags: stringArrayField(record, "tags"),
        importance: numberField(record, "importance", 5),
        relatedChapterIds: mappedIdArray(record["relatedChapterIds"], chapterIdMap)
      });
    }
  }

  private safeCostRows(input: { projectId: string }): ProjectJsonPackage["costs"] {
    const rows = this.options.database.sqlite
      .prepare(
        `select provider, model, task_type, status, usage_source, estimated_cost_live, final_cost,
          currency, request_started_at
        from llm_runs
        where project_id = ?
        order by request_started_at asc`
      )
      .all(input.projectId) as Array<Record<string, unknown>>;

    return rows.map((row) => ({
      provider: this.redaction.redact(String(row.provider)),
      model: this.redaction.redact(String(row.model)),
      taskType: String(row.task_type),
      status: String(row.status),
      usageSource: String(row.usage_source),
      estimatedCostLive: Number(row.estimated_cost_live),
      finalCost: row.final_cost === null ? null : Number(row.final_cost),
      currency: String(row.currency),
      requestStartedAt: String(row.request_started_at)
    }));
  }

  private safeExportSettings(): Record<string, unknown> {
    const rows = this.options.database.sqlite
      .prepare(
        "select key, value_json from app_settings where key not like '%credential%' and key not like '%secret%'"
      )
      .all() as Array<Record<string, unknown>>;
    const settings: Record<string, unknown> = {};
    for (const row of rows) {
      const key = String(row.key);
      if (/key|secret|credential|token/i.test(key)) continue;
      settings[key] = JSON.parse(String(row.value_json)) as unknown;
    }
    return settings;
  }

  private redactJson(value: unknown): string {
    return this.redaction.redact(JSON.stringify(value));
  }

  private recordJob(jobType: string, status: string, payload: unknown): void {
    const now = this.now();
    this.options.database.sqlite
      .prepare(
        `insert into import_export_jobs (id, job_type, status, payload_json, created_at, updated_at)
        values (?, ?, ?, ?, ?, ?)`
      )
      .run(createId("job"), jobType, status, this.redactJson(payload), now, now);
  }

  private uniqueProjectName(name: string): string {
    const existing = new Set(
      this.options.repositories.projects.list().map((project) => project.name)
    );
    if (!existing.has(name)) return name;
    let suffix = 2;
    while (existing.has(`${name} (${suffix})`)) suffix += 1;
    return `${name} (${suffix})`;
  }

  private requireBook(bookId: string): BookRecord {
    const book = this.options.repositories.books.get(bookId);
    if (!book) throw new Error("Book not found");
    return book;
  }

  private requireProject(projectId: string): ProjectRecord {
    const project = this.options.repositories.projects.get(projectId);
    if (!project) throw new Error("Project not found");
    return project;
  }

  private now(): string {
    return this.options.now?.() ?? new Date().toISOString();
  }
}

function emptyImportResult(partial: Partial<ImportResult>): ImportResult {
  return {
    importedProjects: partial.importedProjects ?? 0,
    importedBooks: partial.importedBooks ?? 0,
    importedChapters: partial.importedChapters ?? 0,
    skippedChapters: partial.skippedChapters ?? 0,
    warnings: partial.warnings ?? []
  };
}

function assertSafeRelativeImportPath(relativePath: string): void {
  const parsed = SAFE_IMPORT_PATH_SCHEMA.parse(relativePath);
  const normalized = parsed.replace(/\\/g, "/");
  if (
    isAbsolute(normalized) ||
    normalized.split("/").some((segment) => segment === "..") ||
    normalized.includes("\0")
  ) {
    throw new Error("Unsafe import path rejected");
  }
  const roundTrip = relative(".", normalized);
  if (roundTrip.startsWith("..")) {
    throw new Error("Unsafe import path rejected");
  }
}

function safeFileName(value: string): string {
  const cleaned = value
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[<>:"/\\|?*]/g, "")
    .split("")
    .filter((character) => character.charCodeAt(0) >= 32)
    .join("")
    .replace(/\.+$/g, "");
  return cleaned || "untitled";
}

function chapterFileName(chapter: Pick<ChapterRecord, "chapterIndex" | "title">): string {
  return `${String(chapter.chapterIndex).padStart(3, "0")}-${safeFileName(chapter.title)}.md`;
}

function stripMarkdown(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/[*_`~>\-[\]()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractMarkdownTitle(markdown: string): string | null {
  const match = markdown.match(/^#\s+(.+)$/m);
  return match?.[1]?.trim() || null;
}

function titleFromPath(relativePath: string): string {
  const name = basename(relativePath, extname(relativePath));
  return name.trim() || "Imported Chapter";
}

function removeLeadingTitle(markdown: string): string {
  return markdown.replace(/^#\s+.+\n?/, "").trim();
}

function normalizeTitle(title: string): string {
  return title.trim().replace(/\s+/g, "").toLowerCase();
}

function splitTxtChapters(content: string): Array<{ title: string; content: string }> {
  const normalized = content.replace(/\r\n/g, "\n").trim();
  const headingRegex = /^第[^\n]{1,24}章[^\n]*$/gm;
  const headings = [...normalized.matchAll(headingRegex)];
  if (headings.length === 0) {
    return [{ title: "Imported TXT", content: normalized }];
  }

  return headings.map((match, index) => {
    const start = (match.index ?? 0) + match[0].length;
    const end = headings[index + 1]?.index ?? normalized.length;
    return {
      title: match[0].trim(),
      content: normalized.slice(start, end).trim()
    };
  });
}

function jsonScalar(value: string): string {
  return JSON.stringify(value);
}

function portableRecords<T extends object>(records: T[]): Array<Record<string, unknown>> {
  return records.map((record) => ({ ...record }) as Record<string, unknown>);
}

function mappedBookId(
  record: Record<string, unknown>,
  bookIdMap: Map<string, string>
): string | null {
  const sourceBookId = record["bookId"];
  return typeof sourceBookId === "string" ? (bookIdMap.get(sourceBookId) ?? null) : null;
}

function mappedNullableId(value: unknown, idMap: Map<string, string>): string | null {
  return typeof value === "string" ? (idMap.get(value) ?? null) : null;
}

function mappedIdArray(value: unknown, idMap: Map<string, string>): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => mappedNullableId(entry, idMap))
    .filter((entry): entry is string => Boolean(entry));
}

function stringField(record: Record<string, unknown>, key: string, fallback: string): string {
  const value = record[key];
  return typeof value === "string" && value.trim().length > 0 ? value : fallback;
}

function nullableStringField(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  return typeof value === "string" ? value : null;
}

function stringArrayField(record: Record<string, unknown>, key: string): string[] {
  const value = record[key];
  if (Array.isArray(value)) return value.map(String);
  if (typeof value !== "string") return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function numberField(record: Record<string, unknown>, key: string, fallback: number): number {
  const value = record[key];
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function foreshadowingStatus(value: unknown): "seeded" | "developing" | "paid_off" | "abandoned" {
  return value === "developing" || value === "paid_off" || value === "abandoned" ? value : "seeded";
}

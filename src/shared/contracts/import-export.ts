import { z } from "zod";

export const conflictStrategySchema = z.enum([
  "create_new_project",
  "merge_existing",
  "skip_duplicates",
  "overwrite"
]);
export type ConflictStrategy = z.infer<typeof conflictStrategySchema>;

export const exportFileSchema = z.object({
  relativePath: z.string(),
  content: z.string()
});
export type ExportFile = z.infer<typeof exportFileSchema>;

export const exportFilesResultSchema = z.object({
  filename: z.string(),
  files: z.array(exportFileSchema)
});
export type ExportFilesResult = z.infer<typeof exportFilesResultSchema>;

export const exportTextResultSchema = z.object({
  filename: z.string(),
  content: z.string()
});
export type ExportTextResult = z.infer<typeof exportTextResultSchema>;

export const exportBookMarkdownRequestSchema = z.object({
  bookId: z.string().min(1),
  frontMatter: z.boolean().optional()
});
export type ExportBookMarkdownRequest = z.infer<typeof exportBookMarkdownRequestSchema>;

export const exportBookTxtRequestSchema = z.object({
  bookId: z.string().min(1)
});
export type ExportBookTxtRequest = z.infer<typeof exportBookTxtRequestSchema>;

export const exportProjectJsonRequestSchema = z.object({
  projectId: z.string().min(1),
  includeManuscriptVersions: z.boolean().optional(),
  includeCostLogs: z.boolean().optional()
});
export type ExportProjectJsonRequest = z.infer<typeof exportProjectJsonRequestSchema>;

export const exportProjectPackageRequestSchema = exportProjectJsonRequestSchema.extend({
  includeCosts: z.boolean().optional()
});
export type ExportProjectPackageRequest = z.infer<typeof exportProjectPackageRequestSchema>;

export const exportCostCsvRequestSchema = z.object({
  projectId: z.string().min(1).optional(),
  bookId: z.string().min(1).optional(),
  chapterId: z.string().min(1).optional(),
  since: z.string().optional(),
  until: z.string().optional()
});
export type ExportCostCsvRequest = z.infer<typeof exportCostCsvRequestSchema>;

export const exportPackageResultSchema = z.object({
  filename: z.string(),
  bytesBase64: z.string(),
  entryCount: z.number().int().min(0)
});
export type ExportPackageResult = z.infer<typeof exportPackageResultSchema>;

const exportedVersionSchema = z.object({
  id: z.string(),
  title: z.string(),
  versionIndex: z.number(),
  contentMarkdown: z.string(),
  isCanonical: z.boolean(),
  sourceType: z.string(),
  createdAt: z.string()
});

const exportedChapterSchema = z.object({
  id: z.string(),
  volumeId: z.string().nullable(),
  chapterIndex: z.number(),
  title: z.string(),
  status: z.string(),
  targetWords: z.number(),
  summary: z.string().nullable(),
  canonicalMarkdown: z.string(),
  manuscriptVersions: z.array(exportedVersionSchema).optional()
});

const exportedVolumeSchema = z.object({
  id: z.string(),
  title: z.string(),
  volumeIndex: z.number(),
  summary: z.string().nullable(),
  status: z.string()
});

const exportedBookSchema = z.object({
  id: z.string(),
  title: z.string(),
  logline: z.string().nullable(),
  genre: z.string().nullable(),
  targetLengthChapters: z.number().nullable(),
  status: z.string(),
  volumes: z.array(exportedVolumeSchema),
  chapters: z.array(exportedChapterSchema)
});

const exportedStoryBibleEntrySchema = z.object({
  id: z.string(),
  bookId: z.string(),
  chapterId: z.string().nullable(),
  entryType: z.string(),
  title: z.string(),
  content: z.string(),
  provenance: z.string(),
  status: z.string()
});
const structuredStoryBibleSchema = z.object({
  characters: z.array(z.record(z.string(), z.unknown())).optional(),
  factions: z.array(z.record(z.string(), z.unknown())).optional(),
  locations: z.array(z.record(z.string(), z.unknown())).optional(),
  artifacts: z.array(z.record(z.string(), z.unknown())).optional(),
  powerSystem: z.array(z.record(z.string(), z.unknown())).optional(),
  timeline: z.array(z.record(z.string(), z.unknown())).optional(),
  foreshadowing: z.array(z.record(z.string(), z.unknown())).optional(),
  hooks: z.array(z.record(z.string(), z.unknown())).optional(),
  styleGuides: z.array(z.record(z.string(), z.unknown())).optional(),
  readerPositioning: z.array(z.record(z.string(), z.unknown())).optional()
});

export const projectJsonPackageSchema = z.object({
  schemaVersion: z.literal(1),
  exportedAt: z.string(),
  metadata: z.object({
    app: z.literal("WenForge Studio"),
    secretsExcluded: z.literal(true),
    encryptedSecretsIncluded: z.literal(false),
    warning: z.string()
  }),
  project: z.object({
    id: z.string(),
    name: z.string().min(1),
    description: z.string().nullable(),
    genre: z.string().nullable(),
    targetReader: z.string().nullable(),
    status: z.string()
  }),
  books: z.array(exportedBookSchema),
  storyBibleEntries: z.array(exportedStoryBibleEntrySchema),
  structuredStoryBible: structuredStoryBibleSchema.optional(),
  settings: z.record(z.string(), z.unknown()).optional(),
  costs: z
    .array(
      z.object({
        provider: z.string(),
        model: z.string(),
        taskType: z.string(),
        status: z.string(),
        usageSource: z.string(),
        estimatedCostLive: z.number(),
        finalCost: z.number().nullable(),
        currency: z.string(),
        requestStartedAt: z.string()
      })
    )
    .optional()
});
export type ProjectJsonPackage = z.infer<typeof projectJsonPackageSchema>;

export const importMarkdownRequestSchema = z.object({
  bookId: z.string().min(1),
  volumeId: z.string().min(1).nullable().optional(),
  files: z.array(exportFileSchema).min(1),
  conflictStrategy: conflictStrategySchema.default("skip_duplicates")
});
export type ImportMarkdownRequest = z.infer<typeof importMarkdownRequestSchema>;

export const importTxtRequestSchema = z.object({
  bookId: z.string().min(1),
  volumeId: z.string().min(1).nullable().optional(),
  content: z.string().min(1),
  conflictStrategy: conflictStrategySchema.default("skip_duplicates")
});
export type ImportTxtRequest = z.infer<typeof importTxtRequestSchema>;

export const importProjectJsonRequestSchema = z.object({
  payload: z.unknown(),
  conflictStrategy: conflictStrategySchema.default("create_new_project"),
  targetProjectId: z.string().min(1).nullable().optional(),
  confirmed: z.boolean().optional()
});
export type ImportProjectJsonRequest = z.infer<typeof importProjectJsonRequestSchema>;

export const importProjectPackageRequestSchema = z.object({
  bytesBase64: z.string().min(1),
  conflictStrategy: conflictStrategySchema.default("create_new_project"),
  targetProjectId: z.string().min(1).nullable().optional(),
  confirmed: z.boolean().optional()
});
export type ImportProjectPackageRequest = z.infer<typeof importProjectPackageRequestSchema>;

export const importResultSchema = z.object({
  importedProjects: z.number().int().min(0),
  importedBooks: z.number().int().min(0),
  importedChapters: z.number().int().min(0),
  skippedChapters: z.number().int().min(0),
  warnings: z.array(z.string())
});
export type ImportResult = z.infer<typeof importResultSchema>;

export const backupSettingsSchema = z.object({
  autoBackup: z.enum(["off", "daily", "on_app_close", "before_destructive_operations"]),
  backupLocation: z.string().nullable(),
  retentionCount: z.number().int().positive()
});
export type BackupSettings = z.infer<typeof backupSettingsSchema>;

export const backupSettingsUpdateSchema = backupSettingsSchema.partial();
export type BackupSettingsUpdate = z.infer<typeof backupSettingsUpdateSchema>;

export const backupRecordSchema = z.object({
  id: z.string(),
  path: z.string(),
  reason: z.string(),
  createdAt: z.string(),
  sizeBytes: z.number().int().min(0)
});
export type BackupRecord = z.infer<typeof backupRecordSchema>;

export const backupCreateRequestSchema = z.object({
  reason: z.string().optional(),
  destinationDir: z.string().optional()
});
export type BackupCreateRequest = z.infer<typeof backupCreateRequestSchema>;

export const backupRestoreRequestSchema = z.object({
  id: z.string().min(1),
  confirmed: z.boolean().optional()
});
export type BackupRestoreRequest = z.infer<typeof backupRestoreRequestSchema>;

export const backupRestoreResultSchema = z.object({
  restoredBackupId: z.string(),
  preRestoreBackupId: z.string(),
  restoredAt: z.string()
});
export type BackupRestoreResult = z.infer<typeof backupRestoreResultSchema>;

import { z } from "zod";
import { PROVIDERS, QUALITY_MODES, TASK_TYPES } from "@shared/domain/model-routing";

export const themePreferenceSchema = z.enum(["dark", "light", "system"]);
export const platformSchema = z.enum([
  "aix",
  "android",
  "darwin",
  "freebsd",
  "haiku",
  "linux",
  "openbsd",
  "sunos",
  "win32",
  "cygwin",
  "netbsd"
]);
export const studioModeSchema = z.enum(["studio", "popover"]);
export const environmentSchema = z.object({
  mode: z.enum(["development", "test", "production"]),
  packaged: z.boolean()
});
export const diagnosticPingSchema = z.object({
  ok: z.literal(true),
  at: z.string()
});

export const safeIpcErrorSchema = z.object({
  code: z.string().min(1),
  message: z.string().min(1)
});

export const ipcEnvelopeSchema = z.discriminatedUnion("ok", [
  z.object({
    ok: z.literal(true),
    data: z.unknown().optional()
  }),
  z.object({
    ok: z.literal(false),
    error: safeIpcErrorSchema
  })
]);

export type SafeIpcErrorShape = z.infer<typeof safeIpcErrorSchema>;
export type IpcEnvelope = z.infer<typeof ipcEnvelopeSchema>;

export interface IpcContract<RequestSchema extends z.ZodType, ResponseSchema extends z.ZodType> {
  channel: string;
  request: RequestSchema;
  response: ResponseSchema;
}

function createContract<RequestSchema extends z.ZodType, ResponseSchema extends z.ZodType>(
  channel: string,
  request: RequestSchema,
  response: ResponseSchema
): IpcContract<RequestSchema, ResponseSchema> {
  return { channel, request, response };
}

const emptyRequestSchema = z.undefined();
const confirmedDeleteSchema = z.object({
  id: z.string().min(1),
  confirmed: z.boolean().optional()
});
const entityIdSchema = z.object({ id: z.string().min(1) });
const projectSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  genre: z.string().nullable(),
  targetReader: z.string().nullable(),
  status: z.string(),
  createdAt: z.string(),
  updatedAt: z.string()
});
const bookSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  title: z.string(),
  logline: z.string().nullable(),
  genre: z.string().nullable(),
  targetLengthChapters: z.number().nullable(),
  status: z.string(),
  createdAt: z.string(),
  updatedAt: z.string()
});
const volumeSchema = z.object({
  id: z.string(),
  bookId: z.string(),
  title: z.string(),
  volumeIndex: z.number(),
  summary: z.string().nullable(),
  status: z.string(),
  createdAt: z.string(),
  updatedAt: z.string()
});
const chapterSchema = z.object({
  id: z.string(),
  bookId: z.string(),
  volumeId: z.string().nullable(),
  chapterIndex: z.number(),
  title: z.string(),
  status: z.string(),
  targetWords: z.number(),
  currentWords: z.number(),
  summary: z.string().nullable(),
  outlineJson: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string()
});
const manuscriptVersionSchema = z.object({
  id: z.string(),
  chapterId: z.string(),
  parentVersionId: z.string().nullable(),
  versionIndex: z.number(),
  branchLabel: z.string().nullable(),
  title: z.string(),
  contentMarkdown: z.string(),
  contentPlaintext: z.string(),
  sourceType: z.enum(["manual", "generated", "imported", "restored"]),
  generationRunId: z.string().nullable(),
  isCanonical: z.boolean(),
  wordCount: z.number(),
  characterCount: z.number(),
  createdAt: z.string()
});
const storyBibleEntrySchema = z.object({
  id: z.string(),
  bookId: z.string(),
  chapterId: z.string().nullable(),
  entryType: z.string(),
  title: z.string(),
  content: z.string(),
  provenance: z.string(),
  sourceRunId: z.string().nullable(),
  status: z.string(),
  createdAt: z.string(),
  updatedAt: z.string()
});
const memorySearchResultSchema = z.object({
  sourceType: z.string(),
  sourceId: z.string(),
  title: z.string(),
  content: z.string()
});
const providerSchema = z.enum(PROVIDERS);
const taskTypeSchema = z.enum(TASK_TYPES);
const qualityModeSchema = z.enum(QUALITY_MODES);
const credentialDtoSchema = z.object({
  id: z.string(),
  provider: providerSchema,
  displayName: z.string(),
  baseUrl: z.string().nullable(),
  isConfigured: z.boolean(),
  redactedKeyLabel: z.string(),
  lastTestedAt: z.string().nullable(),
  lastStatus: z.enum(["unknown", "configured", "test_passed", "test_failed"]),
  createdAt: z.string(),
  updatedAt: z.string()
});
const credentialStatusSchema = z.object({
  id: z.string(),
  provider: providerSchema,
  isConfigured: z.boolean(),
  lastStatus: z.enum(["unknown", "configured", "test_passed", "test_failed"]),
  lastTestedAt: z.string().nullable(),
  message: z.string()
});
const credentialTestResultSchema = z.object({
  id: z.string(),
  status: z.enum(["configured_but_untested", "test_passed", "test_failed", "not_configured"]),
  message: z.string(),
  testedAt: z.string()
});
const modelProfileSchema = z.object({
  id: z.string(),
  provider: providerSchema,
  model: z.string(),
  displayName: z.string(),
  contextWindow: z.number().nullable(),
  maxOutputTokens: z.number().nullable(),
  supportsStreaming: z.boolean(),
  supportsJson: z.boolean(),
  supportsTools: z.boolean(),
  supportsVision: z.boolean(),
  supportsPromptCaching: z.boolean(),
  defaultTemperature: z.number(),
  recommendedTasksJson: z.string(),
  enabled: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string()
});
const modelPriceSchema = z.object({
  id: z.string(),
  provider: providerSchema,
  model: z.string(),
  inputPricePerMillion: z.number(),
  outputPricePerMillion: z.number(),
  cachedInputPricePerMillion: z.number().nullable(),
  currency: z.string(),
  contextWindow: z.number().nullable(),
  maxOutputTokens: z.number().nullable(),
  effectiveDate: z.string(),
  sourceNote: z.string(),
  enabled: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string()
});
const taskRouteSchema = z.object({
  id: z.string(),
  taskType: taskTypeSchema,
  qualityMode: qualityModeSchema,
  primaryModelProfileId: z.string(),
  fallbackModelProfileId1: z.string().nullable(),
  fallbackModelProfileId2: z.string().nullable(),
  temperature: z.number(),
  maxOutputTokens: z.number(),
  budgetCapPerCall: z.number().nullable(),
  enabled: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string()
});
const routeResolutionSchema = z.object({
  available: z.boolean(),
  taskType: taskTypeSchema,
  qualityMode: qualityModeSchema,
  route: taskRouteSchema.nullable(),
  modelProfile: modelProfileSchema.nullable(),
  price: modelPriceSchema.nullable(),
  credential: credentialDtoSchema.nullable(),
  warnings: z.array(z.string()),
  errors: z.array(z.string())
});
const privacySettingsSchema = z.object({
  storeFullPrompts: z.boolean(),
  storeFullResponses: z.boolean(),
  storeManuscriptsInLogs: z.boolean(),
  allowSendingFullRecentChapters: z.boolean(),
  recentChapterCount: z.number().int().min(0),
  maxContextTokenBudget: z.number().int().positive(),
  enableDebugLogging: z.boolean()
});
const routingSettingsSchema = z.object({
  priceStaleAfterDays: z.number().int().positive(),
  missingPriceBehavior: z.enum(["warn", "block"])
});

export const IPC_CONTRACTS = {
  app: {
    getVersion: createContract("app:get-version", emptyRequestSchema, z.string()),
    getPlatform: createContract("app:get-platform", emptyRequestSchema, platformSchema),
    getEnvironment: createContract("app:get-environment", emptyRequestSchema, environmentSchema)
  },
  window: {
    minimize: createContract("window:minimize", emptyRequestSchema, z.undefined()),
    close: createContract("window:close", emptyRequestSchema, z.undefined()),
    toggleStudioMode: createContract(
      "window:toggle-studio-mode",
      emptyRequestSchema,
      studioModeSchema
    )
  },
  settings: {
    getTheme: createContract("settings:get-theme", emptyRequestSchema, themePreferenceSchema),
    setTheme: createContract(
      "settings:set-theme",
      z.object({ theme: themePreferenceSchema }),
      themePreferenceSchema
    )
  },
  diagnostics: {
    ping: createContract("diagnostics:ping", emptyRequestSchema, diagnosticPingSchema)
  },
  projects: {
    list: createContract("projects:list", emptyRequestSchema, z.array(projectSchema)),
    get: createContract("projects:get", entityIdSchema, projectSchema.nullable()),
    create: createContract(
      "projects:create",
      z.object({
        name: z.string().trim().min(1),
        description: z.string().optional(),
        genre: z.string().optional(),
        targetReader: z.string().optional()
      }),
      projectSchema
    ),
    update: createContract(
      "projects:update",
      entityIdSchema.extend({
        name: z.string().trim().min(1).optional(),
        description: z.string().optional(),
        genre: z.string().optional(),
        targetReader: z.string().optional(),
        status: z.string().optional()
      }),
      projectSchema.nullable()
    ),
    delete: createContract("projects:delete", confirmedDeleteSchema, z.boolean())
  },
  books: {
    listByProject: createContract(
      "books:list-by-project",
      z.object({ projectId: z.string().min(1) }),
      z.array(bookSchema)
    ),
    get: createContract("books:get", entityIdSchema, bookSchema.nullable()),
    create: createContract(
      "books:create",
      z.object({
        projectId: z.string().min(1),
        title: z.string().trim().min(1),
        logline: z.string().optional(),
        genre: z.string().optional(),
        targetLengthChapters: z.number().int().positive().optional()
      }),
      bookSchema
    ),
    update: createContract(
      "books:update",
      entityIdSchema.extend({ title: z.string().optional() }),
      bookSchema.nullable()
    ),
    delete: createContract("books:delete", confirmedDeleteSchema, z.boolean())
  },
  volumes: {
    listByBook: createContract(
      "volumes:list-by-book",
      z.object({ bookId: z.string().min(1) }),
      z.array(volumeSchema)
    ),
    create: createContract(
      "volumes:create",
      z.object({
        bookId: z.string().min(1),
        title: z.string().trim().min(1),
        volumeIndex: z.number().int().positive(),
        summary: z.string().optional()
      }),
      volumeSchema
    ),
    update: createContract(
      "volumes:update",
      entityIdSchema.extend({ title: z.string().optional() }),
      volumeSchema.nullable()
    ),
    delete: createContract("volumes:delete", confirmedDeleteSchema, z.boolean())
  },
  chapters: {
    listByBook: createContract(
      "chapters:list-by-book",
      z.object({ bookId: z.string().min(1) }),
      z.array(chapterSchema)
    ),
    get: createContract("chapters:get", entityIdSchema, chapterSchema.nullable()),
    create: createContract(
      "chapters:create",
      z.object({
        bookId: z.string().min(1),
        volumeId: z.string().min(1).nullable().optional(),
        chapterIndex: z.number().int().positive(),
        title: z.string().trim().min(1),
        targetWords: z.number().int().positive().optional()
      }),
      chapterSchema
    ),
    update: createContract(
      "chapters:update",
      entityIdSchema.extend({ title: z.string().optional() }),
      chapterSchema.nullable()
    ),
    reorder: createContract(
      "chapters:reorder",
      z.object({ bookId: z.string().min(1), orderedChapterIds: z.array(z.string().min(1)) }),
      z.undefined()
    ),
    setStatus: createContract(
      "chapters:set-status",
      entityIdSchema.extend({ status: z.string().min(1) }),
      chapterSchema.nullable()
    ),
    delete: createContract("chapters:delete", confirmedDeleteSchema, z.boolean())
  },
  manuscripts: {
    listVersions: createContract(
      "manuscripts:list-versions",
      z.object({ chapterId: z.string().min(1) }),
      z.array(manuscriptVersionSchema)
    ),
    getVersion: createContract(
      "manuscripts:get-version",
      entityIdSchema,
      manuscriptVersionSchema.nullable()
    ),
    getCanonical: createContract(
      "manuscripts:get-canonical",
      z.object({ chapterId: z.string().min(1) }),
      manuscriptVersionSchema.nullable()
    ),
    saveManualVersion: createContract(
      "manuscripts:save-manual-version",
      z.object({
        chapterId: z.string().min(1),
        parentVersionId: z.string().nullable().optional(),
        title: z.string().trim().min(1),
        contentMarkdown: z.string(),
        isCanonical: z.boolean().optional()
      }),
      manuscriptVersionSchema
    ),
    setCanonical: createContract(
      "manuscripts:set-canonical",
      z.object({ chapterId: z.string().min(1), versionId: z.string().min(1) }),
      manuscriptVersionSchema.nullable()
    ),
    rollback: createContract(
      "manuscripts:rollback",
      z.object({
        chapterId: z.string().min(1),
        versionId: z.string().min(1),
        confirmed: z.boolean().optional()
      }),
      manuscriptVersionSchema
    )
  },
  storyBible: {
    entries: {
      list: createContract(
        "story-bible:entries:list",
        z.object({ bookId: z.string().min(1) }),
        z.array(storyBibleEntrySchema)
      ),
      create: createContract(
        "story-bible:entries:create",
        z.object({
          bookId: z.string().min(1),
          chapterId: z.string().nullable().optional(),
          entryType: z.string().min(1),
          title: z.string().trim().min(1),
          content: z.string().min(1)
        }),
        storyBibleEntrySchema
      ),
      update: createContract(
        "story-bible:entries:update",
        entityIdSchema.extend({ title: z.string().optional() }),
        storyBibleEntrySchema.nullable()
      ),
      delete: createContract("story-bible:entries:delete", confirmedDeleteSchema, z.boolean())
    }
  },
  dataSettings: {
    get: createContract(
      "data-settings:get",
      z.object({ key: z.string().min(1) }),
      z.unknown().nullable()
    ),
    set: createContract(
      "data-settings:set",
      z.object({ key: z.string().min(1), value: z.unknown() }),
      z.undefined()
    )
  },
  memory: {
    search: createContract(
      "memory:search",
      z.object({ bookId: z.string().min(1), query: z.string().trim().min(1) }),
      z.array(memorySearchResultSchema)
    )
  },
  credentials: {
    list: createContract("credentials:list", emptyRequestSchema, z.array(credentialDtoSchema)),
    save: createContract(
      "credentials:save",
      z.object({
        provider: providerSchema,
        displayName: z.string().trim().min(1),
        apiKey: z.string().trim().min(1),
        baseUrl: z.string().url().nullable().optional()
      }),
      credentialDtoSchema
    ),
    delete: createContract("credentials:delete", confirmedDeleteSchema, z.boolean()),
    getStatus: createContract("credentials:get-status", entityIdSchema, credentialStatusSchema),
    testConnection: createContract(
      "credentials:test-connection",
      entityIdSchema,
      credentialTestResultSchema
    ),
    updateBaseUrl: createContract(
      "credentials:update-base-url",
      entityIdSchema.extend({ baseUrl: z.string().url().nullable() }),
      credentialDtoSchema.nullable()
    )
  },
  modelProfiles: {
    list: createContract("model-profiles:list", emptyRequestSchema, z.array(modelProfileSchema)),
    upsert: createContract(
      "model-profiles:upsert",
      z.object({
        id: z.string().optional(),
        provider: providerSchema,
        model: z.string().trim().min(1),
        displayName: z.string().trim().min(1),
        contextWindow: z.number().int().positive().nullable().optional(),
        maxOutputTokens: z.number().int().positive().nullable().optional(),
        supportsStreaming: z.boolean().optional(),
        supportsJson: z.boolean().optional(),
        supportsTools: z.boolean().optional(),
        supportsVision: z.boolean().optional(),
        supportsPromptCaching: z.boolean().optional(),
        defaultTemperature: z.number().min(0).max(2).optional(),
        recommendedTasks: z.array(taskTypeSchema).optional(),
        recommendedTasksJson: z.string().optional(),
        enabled: z.boolean().optional()
      }),
      modelProfileSchema
    )
  },
  modelPrices: {
    list: createContract("model-prices:list", emptyRequestSchema, z.array(modelPriceSchema)),
    upsert: createContract(
      "model-prices:upsert",
      z.object({
        id: z.string().optional(),
        provider: providerSchema,
        model: z.string().trim().min(1),
        inputPricePerMillion: z.number().min(0),
        outputPricePerMillion: z.number().min(0),
        cachedInputPricePerMillion: z.number().min(0).nullable().optional(),
        currency: z.string().trim().min(1).optional(),
        contextWindow: z.number().int().positive().nullable().optional(),
        maxOutputTokens: z.number().int().positive().nullable().optional(),
        effectiveDate: z.string().trim().min(1),
        sourceNote: z.string().trim().min(1),
        enabled: z.boolean().optional()
      }),
      modelPriceSchema
    )
  },
  taskRoutes: {
    list: createContract("task-routes:list", emptyRequestSchema, z.array(taskRouteSchema)),
    upsert: createContract(
      "task-routes:upsert",
      z.object({
        id: z.string().optional(),
        taskType: taskTypeSchema,
        qualityMode: qualityModeSchema,
        primaryModelProfileId: z.string().min(1),
        fallbackModelProfileId1: z.string().nullable().optional(),
        fallbackModelProfileId2: z.string().nullable().optional(),
        temperature: z.number().min(0).max(2),
        maxOutputTokens: z.number().int().positive(),
        budgetCapPerCall: z.number().min(0).nullable().optional(),
        enabled: z.boolean().optional()
      }),
      taskRouteSchema
    ),
    resolve: createContract(
      "task-routes:resolve",
      z.object({ taskType: taskTypeSchema, qualityMode: qualityModeSchema }),
      routeResolutionSchema
    )
  },
  privacy: {
    get: createContract("privacy:get", emptyRequestSchema, privacySettingsSchema),
    update: createContract("privacy:update", privacySettingsSchema.partial(), privacySettingsSchema)
  },
  routingSettings: {
    get: createContract("routing-settings:get", emptyRequestSchema, routingSettingsSchema),
    update: createContract(
      "routing-settings:update",
      routingSettingsSchema.partial(),
      routingSettingsSchema
    )
  }
} as const;

export const IPC_CONTRACT_LIST = [
  IPC_CONTRACTS.app.getVersion,
  IPC_CONTRACTS.app.getPlatform,
  IPC_CONTRACTS.app.getEnvironment,
  IPC_CONTRACTS.window.minimize,
  IPC_CONTRACTS.window.close,
  IPC_CONTRACTS.window.toggleStudioMode,
  IPC_CONTRACTS.settings.getTheme,
  IPC_CONTRACTS.settings.setTheme,
  IPC_CONTRACTS.diagnostics.ping,
  IPC_CONTRACTS.projects.list,
  IPC_CONTRACTS.projects.get,
  IPC_CONTRACTS.projects.create,
  IPC_CONTRACTS.projects.update,
  IPC_CONTRACTS.projects.delete,
  IPC_CONTRACTS.books.listByProject,
  IPC_CONTRACTS.books.get,
  IPC_CONTRACTS.books.create,
  IPC_CONTRACTS.books.update,
  IPC_CONTRACTS.books.delete,
  IPC_CONTRACTS.volumes.listByBook,
  IPC_CONTRACTS.volumes.create,
  IPC_CONTRACTS.volumes.update,
  IPC_CONTRACTS.volumes.delete,
  IPC_CONTRACTS.chapters.listByBook,
  IPC_CONTRACTS.chapters.get,
  IPC_CONTRACTS.chapters.create,
  IPC_CONTRACTS.chapters.update,
  IPC_CONTRACTS.chapters.reorder,
  IPC_CONTRACTS.chapters.setStatus,
  IPC_CONTRACTS.chapters.delete,
  IPC_CONTRACTS.manuscripts.listVersions,
  IPC_CONTRACTS.manuscripts.getVersion,
  IPC_CONTRACTS.manuscripts.getCanonical,
  IPC_CONTRACTS.manuscripts.saveManualVersion,
  IPC_CONTRACTS.manuscripts.setCanonical,
  IPC_CONTRACTS.manuscripts.rollback,
  IPC_CONTRACTS.storyBible.entries.list,
  IPC_CONTRACTS.storyBible.entries.create,
  IPC_CONTRACTS.storyBible.entries.update,
  IPC_CONTRACTS.storyBible.entries.delete,
  IPC_CONTRACTS.dataSettings.get,
  IPC_CONTRACTS.dataSettings.set,
  IPC_CONTRACTS.memory.search,
  IPC_CONTRACTS.credentials.list,
  IPC_CONTRACTS.credentials.save,
  IPC_CONTRACTS.credentials.delete,
  IPC_CONTRACTS.credentials.getStatus,
  IPC_CONTRACTS.credentials.testConnection,
  IPC_CONTRACTS.credentials.updateBaseUrl,
  IPC_CONTRACTS.modelProfiles.list,
  IPC_CONTRACTS.modelProfiles.upsert,
  IPC_CONTRACTS.modelPrices.list,
  IPC_CONTRACTS.modelPrices.upsert,
  IPC_CONTRACTS.taskRoutes.list,
  IPC_CONTRACTS.taskRoutes.upsert,
  IPC_CONTRACTS.taskRoutes.resolve,
  IPC_CONTRACTS.privacy.get,
  IPC_CONTRACTS.privacy.update,
  IPC_CONTRACTS.routingSettings.get,
  IPC_CONTRACTS.routingSettings.update
] as const;

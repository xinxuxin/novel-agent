import { z } from "zod";
import { PROVIDERS, QUALITY_MODES, TASK_TYPES } from "@shared/domain/model-routing";
import {
  costSummaryRequestSchema,
  costSummarySchema,
  llmRunRecordSchema,
  streamRequestSchema,
  streamStartResultSchema
} from "@contracts/ai";

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
const providerSchema = z.enum(PROVIDERS);
const taskTypeSchema = z.enum(TASK_TYPES);
const qualityModeSchema = z.enum(QUALITY_MODES);
const privacySettingsSchema = z.object({
  storeFullPrompts: z.boolean(),
  storeFullResponses: z.boolean(),
  storeManuscriptsInLogs: z.boolean(),
  allowPromptPreview: z.boolean(),
  allowSendingFullRecentChapters: z.boolean(),
  recentChapterCount: z.number().int().min(0),
  maxContextTokenBudget: z.number().int().positive(),
  enableDebugLogging: z.boolean()
});
const routingSettingsSchema = z.object({
  priceStaleAfterDays: z.number().int().positive(),
  missingPriceBehavior: z.enum(["warn", "block"])
});
const storyBibleQuerySchema = z.object({
  bookId: z.string().min(1),
  query: z.string().optional(),
  tags: z.array(z.string()).optional(),
  chapterId: z.string().nullable().optional()
});
const storyBibleRecordSchema: z.ZodType<{ id: string }> = z
  .object({ id: z.string() })
  .passthrough();
const namedStoryBibleRecordSchema = storyBibleRecordSchema;
const namedStoryBibleInputSchema = z.object({
  bookId: z.string().min(1),
  name: z.string().trim().min(1),
  summary: z.string().nullable().optional(),
  tags: z.array(z.string()).optional(),
  importance: z.number().int().min(0).max(10).optional(),
  relatedChapterIds: z.array(z.string()).optional()
});
const namedStoryBibleUpdateSchema = namedStoryBibleInputSchema.partial().extend({
  id: z.string().min(1)
});
const characterRecordSchema = storyBibleRecordSchema;
const characterInputSchema = namedStoryBibleInputSchema.extend({
  aliases: z.array(z.string()).optional(),
  role: z.string().nullable().optional(),
  firstAppearanceChapterId: z.string().nullable().optional(),
  currentState: z.string().nullable().optional(),
  goal: z.string().nullable().optional(),
  motivation: z.string().nullable().optional(),
  secret: z.string().nullable().optional(),
  contradiction: z.string().nullable().optional(),
  relationshipNotes: z.string().nullable().optional(),
  speakingStyle: z.string().nullable().optional(),
  forbiddenInconsistencies: z.string().nullable().optional()
});
const characterUpdateSchema = characterInputSchema.partial().extend({ id: z.string().min(1) });
const powerSystemRecordSchema = storyBibleRecordSchema;
const powerSystemInputSchema = z.object({
  bookId: z.string().min(1),
  ruleType: z.string().nullable().optional(),
  rankLevelName: z.string().trim().min(1),
  rankOrder: z.number().int().optional(),
  advancementConditions: z.string().nullable().optional(),
  limitsCosts: z.string().nullable().optional(),
  knownUsers: z.array(z.string()).optional(),
  contradictionChecks: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  tags: z.array(z.string()).optional(),
  importance: z.number().int().min(0).max(10).optional(),
  relatedChapterIds: z.array(z.string()).optional()
});
const powerSystemUpdateSchema = powerSystemInputSchema.partial().extend({ id: z.string().min(1) });
const timelineRecordSchema = storyBibleRecordSchema;
const timelineInputSchema = z.object({
  bookId: z.string().min(1),
  chapterId: z.string().nullable().optional(),
  eventIndex: z.number().int().optional(),
  title: z.string().trim().min(1),
  content: z.string().min(1),
  tags: z.array(z.string()).optional(),
  importance: z.number().int().min(0).max(10).optional(),
  relatedChapterIds: z.array(z.string()).optional()
});
const timelineUpdateSchema = timelineInputSchema.partial().extend({ id: z.string().min(1) });
const foreshadowingStatusSchema = z.enum(["seeded", "developing", "paid_off", "abandoned"]);
const foreshadowingRecordSchema = storyBibleRecordSchema;
const foreshadowingInputSchema = z.object({
  bookId: z.string().min(1),
  seedChapterId: z.string().nullable().optional(),
  hintText: z.string().trim().min(1),
  expectedPayoffChapterId: z.string().nullable().optional(),
  status: foreshadowingStatusSchema.optional(),
  relatedEntities: z.array(z.string()).optional(),
  payoffNotes: z.string().nullable().optional(),
  tags: z.array(z.string()).optional(),
  importance: z.number().int().min(0).max(10).optional(),
  relatedChapterIds: z.array(z.string()).optional()
});
const foreshadowingUpdateSchema = foreshadowingInputSchema.partial().extend({
  id: z.string().min(1)
});
const hookRecordSchema = storyBibleRecordSchema;
const hookInputSchema = z.object({
  bookId: z.string().min(1),
  sourceChapterId: z.string().nullable().optional(),
  hookText: z.string().trim().min(1),
  urgency: z.string().nullable().optional(),
  expectedResolutionWindow: z.string().nullable().optional(),
  status: z.string().optional(),
  notes: z.string().nullable().optional(),
  tags: z.array(z.string()).optional(),
  importance: z.number().int().min(0).max(10).optional(),
  relatedChapterIds: z.array(z.string()).optional()
});
const hookUpdateSchema = hookInputSchema.partial().extend({ id: z.string().min(1) });
const styleGuideRecordSchema = storyBibleRecordSchema;
const styleGuideInputSchema = z.object({
  bookId: z.string().min(1),
  title: z.string().optional(),
  content: z.string().optional(),
  genre: z.string().nullable().optional(),
  tone: z.string().nullable().optional(),
  pacingRules: z.string().nullable().optional(),
  forbiddenCliches: z.string().nullable().optional(),
  preferredSentencePatterns: z.string().nullable().optional(),
  dialogueStyle: z.string().nullable().optional(),
  chapterEndingPattern: z.string().nullable().optional(),
  examples: z.string().nullable().optional(),
  tags: z.array(z.string()).optional(),
  importance: z.number().int().min(0).max(10).optional(),
  relatedChapterIds: z.array(z.string()).optional()
});
const styleGuideUpdateSchema = styleGuideInputSchema.partial().extend({ id: z.string().min(1) });
const readerPositioningRecordSchema = storyBibleRecordSchema;
const readerPositioningInputSchema = z.object({
  bookId: z.string().min(1),
  title: z.string().optional(),
  content: z.string().optional(),
  targetReader: z.string().nullable().optional(),
  platformStyle: z.string().nullable().optional(),
  genreExpectation: z.string().nullable().optional(),
  emotionalPromise: z.string().nullable().optional(),
  updateCadenceNotes: z.string().nullable().optional(),
  commercialConstraints: z.string().nullable().optional(),
  tags: z.array(z.string()).optional(),
  importance: z.number().int().min(0).max(10).optional(),
  relatedChapterIds: z.array(z.string()).optional()
});
const readerPositioningUpdateSchema = readerPositioningInputSchema.partial().extend({
  id: z.string().min(1)
});
const memorySearchResultSchema = z.object({
  sourceType: z.string(),
  sourceId: z.string(),
  title: z.string(),
  content: z.string(),
  summary: z.string().nullable().optional(),
  tags: z.array(z.string()).optional(),
  importance: z.number().optional(),
  score: z.number().optional()
});
const contextPreviewRequestSchema = z.object({
  projectId: z.string().min(1),
  bookId: z.string().min(1),
  volumeId: z.string().nullable().optional(),
  chapterId: z.string().min(1),
  taskType: taskTypeSchema,
  userInstruction: z.string().nullable().optional(),
  qualityMode: qualityModeSchema,
  targetTokenBudget: z.number().int().positive(),
  includeRecentChapters: z.number().int().min(0),
  includeFullRecentChapters: z.boolean(),
  privacy: privacySettingsSchema.optional()
});
const contextPreviewPackSchema = z.object({
  projectBrief: z.string(),
  bookPremise: z.string(),
  volumeGoal: z.string().nullable(),
  currentChapterMetadata: z.string(),
  currentChapterOutline: z.unknown().nullable(),
  sceneCards: z.array(z.unknown()),
  readerPositioning: z.string(),
  styleGuide: z.string(),
  relevantCharacters: z.array(z.string()),
  relevantFactions: z.array(z.string()),
  relevantLocations: z.array(z.string()),
  relevantArtifacts: z.array(z.string()),
  powerSystemDigest: z.string(),
  timelineDigest: z.string(),
  foreshadowingDigest: z.string(),
  unresolvedHooks: z.array(z.string()),
  recentChapterSummaries: z.array(z.string()),
  recentChapterExcerpts: z.array(z.string()),
  retrievedMemoryChunks: z.array(
    z.object({
      sourceType: z.string(),
      sourceId: z.string(),
      title: z.string(),
      content: z.string(),
      score: z.number()
    })
  ),
  continuityWarnings: z.array(z.string()),
  omissions: z.array(z.string()),
  truncationNotes: z.array(z.string()),
  estimatedTokens: z.number()
});
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
      entityIdSchema.extend({
        title: z.string().trim().min(1).optional(),
        logline: z.string().optional(),
        genre: z.string().optional(),
        targetLengthChapters: z.number().int().positive().optional(),
        status: z.string().optional()
      }),
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
      entityIdSchema.extend({
        title: z.string().trim().min(1).optional(),
        volumeIndex: z.number().int().positive().optional(),
        summary: z.string().nullable().optional(),
        status: z.string().optional()
      }),
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
      entityIdSchema.extend({
        volumeId: z.string().min(1).nullable().optional(),
        chapterIndex: z.number().int().positive().optional(),
        title: z.string().trim().min(1).optional(),
        status: z.string().optional(),
        targetWords: z.number().int().positive().optional(),
        summary: z.string().nullable().optional(),
        outlineJson: z.string().nullable().optional()
      }),
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
        entityIdSchema.extend({
          entryType: z.string().min(1).optional(),
          title: z.string().trim().min(1).optional(),
          content: z.string().min(1).optional(),
          status: z.string().optional()
        }),
        storyBibleEntrySchema.nullable()
      ),
      delete: createContract("story-bible:entries:delete", confirmedDeleteSchema, z.boolean())
    },
    characters: {
      list: createContract(
        "story-bible:characters:list",
        storyBibleQuerySchema,
        z.array(characterRecordSchema)
      ),
      create: createContract(
        "story-bible:characters:create",
        characterInputSchema,
        characterRecordSchema
      ),
      update: createContract(
        "story-bible:characters:update",
        characterUpdateSchema,
        characterRecordSchema.nullable()
      ),
      delete: createContract("story-bible:characters:delete", confirmedDeleteSchema, z.boolean())
    },
    factions: {
      list: createContract(
        "story-bible:factions:list",
        storyBibleQuerySchema,
        z.array(namedStoryBibleRecordSchema)
      ),
      create: createContract(
        "story-bible:factions:create",
        namedStoryBibleInputSchema,
        namedStoryBibleRecordSchema
      ),
      update: createContract(
        "story-bible:factions:update",
        namedStoryBibleUpdateSchema,
        namedStoryBibleRecordSchema.nullable()
      ),
      delete: createContract("story-bible:factions:delete", confirmedDeleteSchema, z.boolean())
    },
    locations: {
      list: createContract(
        "story-bible:locations:list",
        storyBibleQuerySchema,
        z.array(namedStoryBibleRecordSchema)
      ),
      create: createContract(
        "story-bible:locations:create",
        namedStoryBibleInputSchema,
        namedStoryBibleRecordSchema
      ),
      update: createContract(
        "story-bible:locations:update",
        namedStoryBibleUpdateSchema,
        namedStoryBibleRecordSchema.nullable()
      ),
      delete: createContract("story-bible:locations:delete", confirmedDeleteSchema, z.boolean())
    },
    artifacts: {
      list: createContract(
        "story-bible:artifacts:list",
        storyBibleQuerySchema,
        z.array(namedStoryBibleRecordSchema)
      ),
      create: createContract(
        "story-bible:artifacts:create",
        namedStoryBibleInputSchema,
        namedStoryBibleRecordSchema
      ),
      update: createContract(
        "story-bible:artifacts:update",
        namedStoryBibleUpdateSchema,
        namedStoryBibleRecordSchema.nullable()
      ),
      delete: createContract("story-bible:artifacts:delete", confirmedDeleteSchema, z.boolean())
    },
    powerSystem: {
      list: createContract(
        "story-bible:power-system:list",
        storyBibleQuerySchema,
        z.array(powerSystemRecordSchema)
      ),
      create: createContract(
        "story-bible:power-system:create",
        powerSystemInputSchema,
        powerSystemRecordSchema
      ),
      update: createContract(
        "story-bible:power-system:update",
        powerSystemUpdateSchema,
        powerSystemRecordSchema.nullable()
      ),
      delete: createContract("story-bible:power-system:delete", confirmedDeleteSchema, z.boolean())
    },
    timeline: {
      list: createContract(
        "story-bible:timeline:list",
        storyBibleQuerySchema,
        z.array(timelineRecordSchema)
      ),
      create: createContract(
        "story-bible:timeline:create",
        timelineInputSchema,
        timelineRecordSchema
      ),
      update: createContract(
        "story-bible:timeline:update",
        timelineUpdateSchema,
        timelineRecordSchema.nullable()
      ),
      delete: createContract("story-bible:timeline:delete", confirmedDeleteSchema, z.boolean())
    },
    foreshadowing: {
      list: createContract(
        "story-bible:foreshadowing:list",
        storyBibleQuerySchema,
        z.array(foreshadowingRecordSchema)
      ),
      create: createContract(
        "story-bible:foreshadowing:create",
        foreshadowingInputSchema,
        foreshadowingRecordSchema
      ),
      update: createContract(
        "story-bible:foreshadowing:update",
        foreshadowingUpdateSchema,
        foreshadowingRecordSchema.nullable()
      ),
      delete: createContract("story-bible:foreshadowing:delete", confirmedDeleteSchema, z.boolean())
    },
    hooks: {
      list: createContract(
        "story-bible:hooks:list",
        storyBibleQuerySchema,
        z.array(hookRecordSchema)
      ),
      create: createContract("story-bible:hooks:create", hookInputSchema, hookRecordSchema),
      update: createContract(
        "story-bible:hooks:update",
        hookUpdateSchema,
        hookRecordSchema.nullable()
      ),
      delete: createContract("story-bible:hooks:delete", confirmedDeleteSchema, z.boolean())
    },
    styleGuide: {
      list: createContract(
        "story-bible:style-guide:list",
        storyBibleQuerySchema,
        z.array(styleGuideRecordSchema)
      ),
      create: createContract(
        "story-bible:style-guide:create",
        styleGuideInputSchema,
        styleGuideRecordSchema
      ),
      update: createContract(
        "story-bible:style-guide:update",
        styleGuideUpdateSchema,
        styleGuideRecordSchema.nullable()
      ),
      delete: createContract("story-bible:style-guide:delete", confirmedDeleteSchema, z.boolean())
    },
    readerPositioning: {
      list: createContract(
        "story-bible:reader-positioning:list",
        storyBibleQuerySchema,
        z.array(readerPositioningRecordSchema)
      ),
      create: createContract(
        "story-bible:reader-positioning:create",
        readerPositioningInputSchema,
        readerPositioningRecordSchema
      ),
      update: createContract(
        "story-bible:reader-positioning:update",
        readerPositioningUpdateSchema,
        readerPositioningRecordSchema.nullable()
      ),
      delete: createContract(
        "story-bible:reader-positioning:delete",
        confirmedDeleteSchema,
        z.boolean()
      )
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
      z.object({
        bookId: z.string().min(1),
        query: z.string().trim().min(1),
        chapterId: z.string().nullable().optional(),
        sourceTypes: z.array(z.string()).optional(),
        tags: z.array(z.string()).optional(),
        minImportance: z.number().optional(),
        limit: z.number().int().positive().optional()
      }),
      z.array(memorySearchResultSchema)
    ),
    rebuildBookIndex: createContract(
      "memory:rebuild-book-index",
      z.object({ bookId: z.string().min(1) }),
      z.undefined()
    )
  },
  context: {
    previewForChapter: createContract(
      "context:preview-for-chapter",
      contextPreviewRequestSchema,
      contextPreviewPackSchema
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
  },
  ai: {
    stream: {
      start: createContract("ai:stream:start", streamRequestSchema, streamStartResultSchema),
      abort: createContract("ai:stream:abort", entityIdSchema, z.boolean())
    },
    runs: {
      get: createContract(
        "ai:runs:get",
        z.object({ runId: z.string().min(1) }),
        llmRunRecordSchema.nullable()
      ),
      listByChapter: createContract(
        "ai:runs:list-by-chapter",
        z.object({ chapterId: z.string().min(1) }),
        z.array(llmRunRecordSchema)
      )
    },
    costs: {
      summary: createContract("ai:costs:summary", costSummaryRequestSchema, costSummarySchema)
    }
  }
};

export const IPC_CONTRACT_LIST: Array<IpcContract<z.ZodType, z.ZodType>> = [
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
  IPC_CONTRACTS.storyBible.characters.list,
  IPC_CONTRACTS.storyBible.characters.create,
  IPC_CONTRACTS.storyBible.characters.update,
  IPC_CONTRACTS.storyBible.characters.delete,
  IPC_CONTRACTS.storyBible.factions.list,
  IPC_CONTRACTS.storyBible.factions.create,
  IPC_CONTRACTS.storyBible.factions.update,
  IPC_CONTRACTS.storyBible.factions.delete,
  IPC_CONTRACTS.storyBible.locations.list,
  IPC_CONTRACTS.storyBible.locations.create,
  IPC_CONTRACTS.storyBible.locations.update,
  IPC_CONTRACTS.storyBible.locations.delete,
  IPC_CONTRACTS.storyBible.artifacts.list,
  IPC_CONTRACTS.storyBible.artifacts.create,
  IPC_CONTRACTS.storyBible.artifacts.update,
  IPC_CONTRACTS.storyBible.artifacts.delete,
  IPC_CONTRACTS.storyBible.powerSystem.list,
  IPC_CONTRACTS.storyBible.powerSystem.create,
  IPC_CONTRACTS.storyBible.powerSystem.update,
  IPC_CONTRACTS.storyBible.powerSystem.delete,
  IPC_CONTRACTS.storyBible.timeline.list,
  IPC_CONTRACTS.storyBible.timeline.create,
  IPC_CONTRACTS.storyBible.timeline.update,
  IPC_CONTRACTS.storyBible.timeline.delete,
  IPC_CONTRACTS.storyBible.foreshadowing.list,
  IPC_CONTRACTS.storyBible.foreshadowing.create,
  IPC_CONTRACTS.storyBible.foreshadowing.update,
  IPC_CONTRACTS.storyBible.foreshadowing.delete,
  IPC_CONTRACTS.storyBible.hooks.list,
  IPC_CONTRACTS.storyBible.hooks.create,
  IPC_CONTRACTS.storyBible.hooks.update,
  IPC_CONTRACTS.storyBible.hooks.delete,
  IPC_CONTRACTS.storyBible.styleGuide.list,
  IPC_CONTRACTS.storyBible.styleGuide.create,
  IPC_CONTRACTS.storyBible.styleGuide.update,
  IPC_CONTRACTS.storyBible.styleGuide.delete,
  IPC_CONTRACTS.storyBible.readerPositioning.list,
  IPC_CONTRACTS.storyBible.readerPositioning.create,
  IPC_CONTRACTS.storyBible.readerPositioning.update,
  IPC_CONTRACTS.storyBible.readerPositioning.delete,
  IPC_CONTRACTS.dataSettings.get,
  IPC_CONTRACTS.dataSettings.set,
  IPC_CONTRACTS.memory.search,
  IPC_CONTRACTS.memory.rebuildBookIndex,
  IPC_CONTRACTS.context.previewForChapter,
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
  IPC_CONTRACTS.routingSettings.update,
  IPC_CONTRACTS.ai.stream.start,
  IPC_CONTRACTS.ai.stream.abort,
  IPC_CONTRACTS.ai.runs.get,
  IPC_CONTRACTS.ai.runs.listByChapter,
  IPC_CONTRACTS.ai.costs.summary
];

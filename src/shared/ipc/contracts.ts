import { z } from "zod";
import { PROVIDERS, QUALITY_MODES, TASK_TYPES } from "@shared/domain/model-routing";
import {
  costSummaryRequestSchema,
  costSummarySchema,
  llmRunRecordSchema,
  providerModelInfoSchema,
  streamRequestSchema,
  streamStartResultSchema
} from "@contracts/ai";
import { diagnosticBundleRequestSchema, diagnosticBundleSchema } from "@contracts/diagnostics";
import {
  providerSmokeResultSchema,
  providerSmokeRunAllRequestSchema,
  providerSmokeRunRequestSchema
} from "@contracts/provider-smoke";
import {
  providerChapterCheckRequestSchema,
  providerChapterCheckResultSchema,
  providerCheckReportRecordSchema
} from "@contracts/provider-check";
import { crossCheckRequestSchema, crossCheckResultSchema } from "@contracts/cross-check";
import {
  chapterCandidatesRequestSchema,
  createCandidateGroupSchema,
  createFusionSchema,
  deleteCandidateGroupSchema,
  draftCandidateGroupDetailSchema,
  draftCandidateGroupSchema,
  draftCandidateSchema,
  draftFusionSchema,
  generateCandidatesSchema,
  generateFusionSchema,
  groupIdRequestSchema,
  retryCandidateSchema,
  saveCandidateAsVersionSchema,
  saveFusionAsVersionSchema,
  setCandidateCanonicalSchema,
  setFusionCanonicalSchema
} from "@contracts/draft-candidates";
import {
  costForecastRequestSchema,
  costForecastSchema,
  costDashboardSummarySchema,
  costGroupSchema,
  costScopeRequestSchema,
  csvExportResultSchema,
  modelPriceTierSchema,
  priceImportResultSchema,
  providerQuotaNoteSchema,
  providerQuotaSummarySchema,
  qualityModeComparisonSchema,
  routePriceWarningSchema
} from "@contracts/cost-dashboard";
import {
  evalApplyRecommendationRequestSchema,
  evalCaseSchema,
  evalHumanScoreRequestSchema,
  evalJudgeRequestSchema,
  evalLeaderboardEntrySchema,
  evalOutputSchema,
  evalPromoteRequestSchema,
  evalReportRequestSchema,
  evalReportResultSchema,
  evalRouteRecommendationsSchema,
  evalRunSchema,
  evalScoreSchema,
  evalStartRequestSchema,
  evalSuiteSchema
} from "@contracts/evaluation";
import {
  backupCreateRequestSchema,
  backupRecordSchema,
  backupRestoreRequestSchema,
  backupRestoreResultSchema,
  backupSettingsSchema,
  backupSettingsUpdateSchema,
  exportBookMarkdownRequestSchema,
  exportBookTxtRequestSchema,
  exportCostCsvRequestSchema,
  exportFilesResultSchema,
  exportPackageResultSchema,
  exportProjectJsonRequestSchema,
  exportProjectPackageRequestSchema,
  exportTextResultSchema,
  importMarkdownRequestSchema,
  importProjectJsonRequestSchema,
  importProjectPackageRequestSchema,
  importResultSchema,
  importTxtRequestSchema,
  projectJsonPackageSchema
} from "@contracts/import-export";
import {
  chapterGenerationStartRequestSchema,
  chapterWorkflowDetailSchema,
  generationAbortRequestSchema,
  generationAcceptArtifactAsVersionSchema,
  generationCancelRequestSchema,
  generationGetRunRequestSchema,
  generationListRunsByChapterRequestSchema,
  generationRequestRevisionSchema,
  generationResumeRequestSchema,
  generationSetAcceptedVersionCanonicalSchema,
  generationStreamEventsRequestSchema,
  manuscriptVersionWorkflowResponseSchema,
  settlementProposalItemSchema,
  workflowEventRecordSchema,
  workflowReviewCardSchema,
  workflowRunRecordSchema
} from "@contracts/workflow";

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
  minWords: z.number().nullable(),
  maxWords: z.number().nullable(),
  lockWordCount: z.boolean(),
  wordCountPriority: z.enum(["loose", "normal", "strict"]),
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
const outlineSourceSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  bookId: z.string(),
  sourceType: z.enum(["paste", "file", "manual", "imported"]),
  title: z.string(),
  originalText: z.string(),
  parsedAt: z.string().nullable(),
  parserModel: z.string().nullable(),
  createdAt: z.string()
});
const outlineVersionSchema = z.object({
  id: z.string(),
  bookId: z.string(),
  parentVersionId: z.string().nullable(),
  title: z.string(),
  contentJson: z.string(),
  contentMarkdown: z.string(),
  sourceId: z.string().nullable(),
  isActive: z.boolean(),
  createdAt: z.string()
});
const planStatusSchema = z.enum(["draft", "proposed", "accepted", "archived"]);
const chapterPlanSchema = z.object({
  id: z.string(),
  bookId: z.string(),
  volumeId: z.string().nullable(),
  chapterId: z.string().nullable(),
  outlineVersionId: z.string().nullable(),
  chapterIndex: z.number(),
  title: z.string(),
  targetWords: z.number(),
  minWords: z.number().nullable(),
  maxWords: z.number().nullable(),
  chapterPromise: z.string().nullable(),
  openingHook: z.string().nullable(),
  mainConflict: z.string().nullable(),
  emotionalTurn: z.string().nullable(),
  payoff: z.string().nullable(),
  endingHook: z.string().nullable(),
  continuityDependenciesJson: z.string(),
  userNotes: z.string().nullable(),
  status: planStatusSchema,
  createdAt: z.string(),
  updatedAt: z.string()
});
const planEditProposalSchema = z.object({
  id: z.string(),
  bookId: z.string(),
  targetType: z.enum(["outline", "volume", "chapter", "scene", "beat", "manuscript"]),
  targetId: z.string(),
  instruction: z.string(),
  beforeJson: z.string(),
  afterJson: z.string(),
  patchJson: z.string().nullable(),
  rationale: z.string(),
  modelProvider: z.string().nullable(),
  modelName: z.string().nullable(),
  llmRunId: z.string().nullable(),
  status: z.enum(["proposed", "accepted", "rejected", "archived"]),
  createdAt: z.string(),
  updatedAt: z.string()
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
const creativityIntentSchema = z.enum(["deterministic", "balanced", "creative", "wild"]);
const contextBudgetModeSchema = z.enum(["conservative", "balanced", "max_safe", "manual"]);
const maxOutputParamNameSchema = z.enum([
  "max_tokens",
  "max_completion_tokens",
  "max_output_tokens",
  "output_token_limit",
  "generation_config_max_output_tokens"
]);
const endpointFamilySchema = z.enum([
  "openai_chat_completions",
  "openai_responses",
  "anthropic_messages",
  "gemini_generate_content",
  "openai_compatible",
  "dashscope_openai_compatible",
  "moonshot_openai_compatible",
  "deepseek_openai_compatible",
  "xai_openai_compatible",
  "openrouter_openai_compatible"
]);
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
const providerModelListResultSchema = z.object({
  provider: providerSchema,
  configured: z.boolean(),
  status: z.enum(["skipped", "passed", "failed"]),
  models: z.array(providerModelInfoSchema),
  fetchedAt: z.string().nullable(),
  error: z.string().nullable()
});
const modelProfileSchema = z.object({
  id: z.string(),
  provider: providerSchema,
  model: z.string(),
  alias: z.string().nullable(),
  displayName: z.string(),
  contextWindow: z.number().nullable(),
  maxOutputTokens: z.number().nullable(),
  supportsStreaming: z.boolean(),
  supportsJson: z.boolean(),
  supportsTools: z.boolean(),
  supportsVision: z.boolean(),
  supportsPromptCaching: z.boolean(),
  supportsTemperature: z.boolean(),
  supportsTopP: z.boolean(),
  supportsTopK: z.boolean(),
  supportsFrequencyPenalty: z.boolean(),
  supportsPresencePenalty: z.boolean(),
  supportsStop: z.boolean(),
  supportsReasoningEffort: z.boolean(),
  supportsAdaptiveThinking: z.boolean(),
  supportsManualThinkingBudget: z.boolean(),
  maxOutputParamName: maxOutputParamNameSchema,
  endpointFamily: endpointFamilySchema,
  supportsResponsesApi: z.boolean(),
  supportsChatCompletions: z.boolean(),
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
  creativityIntent: creativityIntentSchema,
  contextBudgetMode: contextBudgetModeSchema,
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
  fallbackModels: z.array(modelProfileSchema),
  price: modelPriceSchema.nullable(),
  credential: credentialDtoSchema.nullable(),
  providerHealth: z
    .object({
      id: z.string(),
      provider: providerSchema,
      model: z.string().nullable(),
      status: z.enum(["unknown", "healthy", "degraded", "down"]),
      checkedAt: z.string(),
      errorCode: z.string().nullable(),
      errorMessage: z.string().nullable()
    })
    .nullable(),
  estimatedCostRange: z.object({
    minCost: z.number().min(0),
    maxCost: z.number().min(0),
    currency: z.string()
  }),
  warnings: z.array(z.string()),
  errors: z.array(z.string())
});
const routePreviewRequestSchema = z.object({
  taskType: taskTypeSchema,
  qualityMode: qualityModeSchema,
  chapterImportance: z
    .enum(["normal", "opening", "key_chapter", "volume_start", "volume_climax", "climax", "finale"])
    .optional(),
  budgetMode: z.enum(["strict", "flexible"]).optional(),
  expectedTokens: z
    .object({
      inputTokens: z.number().int().min(0),
      outputTokens: z.number().int().min(0)
    })
    .optional(),
  userOverrideModelProfileId: z.string().min(1).nullable().optional()
});
const routePresetSchema = z.object({
  quality_mode: qualityModeSchema,
  chapter_importance_modes: z.array(z.string()),
  routes: z.record(
    z.string(),
    z.object({
      primary: z.union([z.string(), z.array(z.string())]),
      fallback: z.array(z.string()).optional(),
      mode: z.enum(["single", "parallel_cross_check"]).optional(),
      aggregator: z.string().optional()
    })
  )
});
const budgetPolicySchema = z.object({
  id: z.string(),
  name: z.string(),
  perCallBudgetCap: z.number().nullable(),
  perWorkflowBudgetCap: z.number().nullable(),
  dailyBudgetCap: z.number().nullable(),
  projectBudgetCap: z.number().nullable(),
  warningThresholdPercent: z.number(),
  onBudgetExceeded: z.enum(["warn", "pause", "abort"]),
  currency: z.string(),
  createdAt: z.string(),
  updatedAt: z.string()
});
const budgetPolicyUpdateSchema = budgetPolicySchema
  .pick({
    id: true,
    name: true,
    perCallBudgetCap: true,
    perWorkflowBudgetCap: true,
    dailyBudgetCap: true,
    projectBudgetCap: true,
    warningThresholdPercent: true,
    onBudgetExceeded: true,
    currency: true
  })
  .partial();
const providerHealthSchema = z.object({
  id: z.string(),
  provider: providerSchema,
  model: z.string().nullable(),
  status: z.enum(["unknown", "healthy", "degraded", "down"]),
  checkedAt: z.string(),
  errorCode: z.string().nullable(),
  errorMessage: z.string().nullable()
});
const manuscriptDiffLineSchema = z.object({
  type: z.enum(["unchanged", "added", "removed"]),
  oldLineNumber: z.number().int().positive().nullable(),
  newLineNumber: z.number().int().positive().nullable(),
  text: z.string()
});
const manuscriptDiffSchema = z.object({
  fromTitle: z.string(),
  toTitle: z.string(),
  fromWordCount: z.number().int().min(0),
  toWordCount: z.number().int().min(0),
  wordDelta: z.number().int(),
  fromCharacterCount: z.number().int().min(0),
  toCharacterCount: z.number().int().min(0),
  characterDelta: z.number().int(),
  lines: z.array(manuscriptDiffLineSchema)
});
const qualityGateSchema = z.object({
  canApproveCanonical: z.boolean(),
  blockingReviewCardIds: z.array(z.string()),
  warnings: z.array(z.string())
});
const settlementPreviewItemSchema = settlementProposalItemSchema.extend({
  supportedByAcceptedManuscript: z.boolean(),
  recommendedStatus: z.enum(["accept", "reject"]),
  group: z.string()
});
const settlementPreviewSchema = z.object({
  id: z.string(),
  generationRunId: z.string(),
  chapterId: z.string(),
  status: z.string(),
  items: z.array(settlementPreviewItemSchema),
  groups: z.record(z.string(), z.array(settlementPreviewItemSchema)),
  createdAt: z.string(),
  updatedAt: z.string()
});
const applySettlementResultSchema = z.object({
  appliedItems: z.array(settlementPreviewItemSchema),
  rejectedItems: z.array(settlementPreviewItemSchema)
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
    ping: createContract("diagnostics:ping", emptyRequestSchema, diagnosticPingSchema),
    exportBundle: createContract(
      "diagnostics:export-bundle",
      diagnosticBundleRequestSchema.optional(),
      diagnosticBundleSchema
    )
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
        targetWords: z.number().int().positive().optional(),
        minWords: z.number().int().positive().nullable().optional(),
        maxWords: z.number().int().positive().nullable().optional(),
        lockWordCount: z.boolean().optional(),
        wordCountPriority: z.enum(["loose", "normal", "strict"]).optional()
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
        minWords: z.number().int().positive().nullable().optional(),
        maxWords: z.number().int().positive().nullable().optional(),
        lockWordCount: z.boolean().optional(),
        wordCountPriority: z.enum(["loose", "normal", "strict"]).optional(),
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
  planning: {
    outlineSources: {
      list: createContract(
        "planning:outline-sources:list",
        z.object({ bookId: z.string().min(1) }),
        z.array(outlineSourceSchema)
      ),
      create: createContract(
        "planning:outline-sources:create",
        z.object({
          projectId: z.string().min(1),
          bookId: z.string().min(1),
          sourceType: z.enum(["paste", "file", "manual", "imported"]),
          title: z.string().trim().min(1),
          originalText: z.string().min(1),
          parsedAt: z.string().nullable().optional(),
          parserModel: z.string().nullable().optional()
        }),
        outlineSourceSchema
      )
    },
    outlineVersions: {
      list: createContract(
        "planning:outline-versions:list",
        z.object({ bookId: z.string().min(1) }),
        z.array(outlineVersionSchema)
      ),
      create: createContract(
        "planning:outline-versions:create",
        z.object({
          bookId: z.string().min(1),
          parentVersionId: z.string().nullable().optional(),
          title: z.string().trim().min(1),
          contentJson: z.string().min(1),
          contentMarkdown: z.string(),
          sourceId: z.string().nullable().optional(),
          isActive: z.boolean().optional()
        }),
        outlineVersionSchema
      ),
      setActive: createContract(
        "planning:outline-versions:set-active",
        z.object({ bookId: z.string().min(1), id: z.string().min(1) }),
        outlineVersionSchema.nullable()
      )
    },
    chapterPlans: {
      list: createContract(
        "planning:chapter-plans:list",
        z.object({ bookId: z.string().min(1) }),
        z.array(chapterPlanSchema)
      ),
      getAccepted: createContract(
        "planning:chapter-plans:get-accepted",
        z.object({ chapterId: z.string().min(1) }),
        chapterPlanSchema.nullable()
      ),
      upsert: createContract(
        "planning:chapter-plans:upsert",
        z.object({
          id: z.string().optional(),
          bookId: z.string().min(1),
          volumeId: z.string().nullable().optional(),
          chapterId: z.string().nullable().optional(),
          outlineVersionId: z.string().nullable().optional(),
          chapterIndex: z.number().int().positive(),
          title: z.string().trim().min(1),
          targetWords: z.number().int().positive().optional(),
          minWords: z.number().int().positive().nullable().optional(),
          maxWords: z.number().int().positive().nullable().optional(),
          chapterPromise: z.string().nullable().optional(),
          openingHook: z.string().nullable().optional(),
          mainConflict: z.string().nullable().optional(),
          emotionalTurn: z.string().nullable().optional(),
          payoff: z.string().nullable().optional(),
          endingHook: z.string().nullable().optional(),
          continuityDependenciesJson: z.string().optional(),
          userNotes: z.string().nullable().optional(),
          status: planStatusSchema.optional()
        }),
        chapterPlanSchema
      )
    },
    proposals: {
      list: createContract(
        "planning:proposals:list",
        z.object({ bookId: z.string().min(1) }),
        z.array(planEditProposalSchema)
      ),
      create: createContract(
        "planning:proposals:create",
        z.object({
          bookId: z.string().min(1),
          targetType: z.enum(["outline", "volume", "chapter", "scene", "beat", "manuscript"]),
          targetId: z.string().min(1),
          instruction: z.string().min(1),
          beforeJson: z.string().min(1),
          afterJson: z.string().min(1),
          patchJson: z.string().nullable().optional(),
          rationale: z.string().min(1),
          modelProvider: z.string().nullable().optional(),
          modelName: z.string().nullable().optional(),
          llmRunId: z.string().nullable().optional()
        }),
        planEditProposalSchema
      ),
      accept: createContract(
        "planning:proposals:accept",
        entityIdSchema,
        planEditProposalSchema.nullable()
      ),
      reject: createContract(
        "planning:proposals:reject",
        entityIdSchema,
        planEditProposalSchema.nullable()
      )
    }
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
        alias: z.string().trim().min(1).nullable().optional(),
        displayName: z.string().trim().min(1),
        contextWindow: z.number().int().positive().nullable().optional(),
        maxOutputTokens: z.number().int().positive().nullable().optional(),
        supportsStreaming: z.boolean().optional(),
        supportsJson: z.boolean().optional(),
        supportsTools: z.boolean().optional(),
        supportsVision: z.boolean().optional(),
        supportsPromptCaching: z.boolean().optional(),
        supportsTemperature: z.boolean().optional(),
        supportsTopP: z.boolean().optional(),
        supportsTopK: z.boolean().optional(),
        supportsFrequencyPenalty: z.boolean().optional(),
        supportsPresencePenalty: z.boolean().optional(),
        supportsStop: z.boolean().optional(),
        supportsReasoningEffort: z.boolean().optional(),
        supportsAdaptiveThinking: z.boolean().optional(),
        supportsManualThinkingBudget: z.boolean().optional(),
        maxOutputParamName: maxOutputParamNameSchema.optional(),
        endpointFamily: endpointFamilySchema.optional(),
        supportsResponsesApi: z.boolean().optional(),
        supportsChatCompletions: z.boolean().optional(),
        defaultTemperature: z.number().min(0).max(2).optional(),
        recommendedTasks: z.array(taskTypeSchema).optional(),
        recommendedTasksJson: z.string().optional(),
        enabled: z.boolean().optional()
      }),
      modelProfileSchema
    )
  },
  providerModels: {
    list: createContract(
      "provider-models:list",
      z.object({ provider: providerSchema }),
      providerModelListResultSchema
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
    ),
    listTiers: createContract(
      "model-price-tiers:list",
      z
        .object({
          provider: providerSchema.optional(),
          model: z.string().trim().min(1).optional()
        })
        .optional(),
      z.array(modelPriceTierSchema)
    ),
    upsertTier: createContract(
      "model-price-tiers:upsert",
      z.object({
        id: z.string().optional(),
        modelPriceId: z.string().min(1),
        provider: providerSchema,
        model: z.string().trim().min(1),
        deploymentMode: z.string().trim().min(1).nullable().optional(),
        minInputTokens: z.number().int().min(0),
        maxInputTokens: z.number().int().min(0).nullable().optional(),
        inputPricePerMillion: z.number().min(0),
        outputPricePerMillion: z.number().min(0),
        cachedInputPricePerMillion: z.number().min(0).nullable().optional(),
        cacheWritePricePerMillion: z.number().min(0).nullable().optional(),
        currency: z.string().trim().min(1).optional(),
        effectiveDate: z.string().trim().min(1),
        sourceNote: z.string().trim().min(1),
        enabled: z.boolean().optional()
      }),
      modelPriceTierSchema
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
        creativityIntent: creativityIntentSchema.optional(),
        contextBudgetMode: contextBudgetModeSchema.optional(),
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
  modelRoutes: {
    resolvePreview: createContract(
      "model-routes:resolve-preview",
      routePreviewRequestSchema,
      routeResolutionSchema
    ),
    applyPremiumWebnovelPreset: createContract(
      "model-routes:apply-premium-webnovel-preset",
      z.object({ confirmed: z.boolean().optional() }),
      routePresetSchema
    ),
    exportPreset: createContract(
      "model-routes:export-preset",
      z.object({ qualityMode: qualityModeSchema }),
      routePresetSchema
    ),
    importPreset: createContract(
      "model-routes:import-preset",
      z.object({ presetJson: z.string().min(1), confirmed: z.boolean().optional() }),
      routePresetSchema
    )
  },
  budgets: {
    getPolicies: createContract("budgets:get-policies", emptyRequestSchema, budgetPolicySchema),
    updatePolicies: createContract(
      "budgets:update-policies",
      budgetPolicyUpdateSchema,
      budgetPolicySchema
    )
  },
  costs: {
    getSummary: createContract(
      "costs:get-summary",
      costScopeRequestSchema,
      costDashboardSummarySchema
    ),
    getByProject: createContract(
      "costs:get-by-project",
      costScopeRequestSchema,
      z.array(costGroupSchema)
    ),
    getByBook: createContract(
      "costs:get-by-book",
      costScopeRequestSchema,
      z.array(costGroupSchema)
    ),
    getByChapter: createContract(
      "costs:get-by-chapter",
      costScopeRequestSchema,
      z.array(costGroupSchema)
    ),
    getByRun: createContract("costs:get-by-run", costScopeRequestSchema, z.array(costGroupSchema)),
    getByModel: createContract(
      "costs:get-by-model",
      costScopeRequestSchema,
      z.array(costGroupSchema)
    ),
    exportCsv: createContract("costs:export-csv", costScopeRequestSchema, csvExportResultSchema),
    forecastChapters: createContract(
      "costs:forecast-chapters",
      costForecastRequestSchema,
      costForecastSchema
    ),
    compareQualityModes: createContract(
      "costs:compare-quality-modes",
      costForecastRequestSchema.omit({ qualityMode: true }),
      qualityModeComparisonSchema
    ),
    quotaSummary: createContract(
      "costs:quota-summary",
      z.object({ forecast: costForecastSchema, providers: z.array(providerSchema).optional() }),
      providerQuotaSummarySchema
    )
  },
  export: {
    bookMarkdown: createContract(
      "export:book-markdown",
      exportBookMarkdownRequestSchema,
      exportFilesResultSchema
    ),
    bookTxt: createContract("export:book-txt", exportBookTxtRequestSchema, exportTextResultSchema),
    projectJson: createContract(
      "export:project-json",
      exportProjectJsonRequestSchema,
      projectJsonPackageSchema
    ),
    projectPackage: createContract(
      "export:project-package",
      exportProjectPackageRequestSchema,
      exportPackageResultSchema
    ),
    costCsv: createContract("export:cost-csv", exportCostCsvRequestSchema, exportTextResultSchema)
  },
  import: {
    markdown: createContract("import:markdown", importMarkdownRequestSchema, importResultSchema),
    txt: createContract("import:txt", importTxtRequestSchema, importResultSchema),
    projectJson: createContract(
      "import:project-json",
      importProjectJsonRequestSchema,
      importResultSchema
    ),
    projectPackage: createContract(
      "import:project-package",
      importProjectPackageRequestSchema,
      importResultSchema
    )
  },
  backup: {
    create: createContract("backup:create", backupCreateRequestSchema, backupRecordSchema),
    list: createContract("backup:list", emptyRequestSchema, z.array(backupRecordSchema)),
    restore: createContract(
      "backup:restore",
      backupRestoreRequestSchema,
      backupRestoreResultSchema
    ),
    updateSettings: createContract(
      "backup:update-settings",
      backupSettingsUpdateSchema,
      backupSettingsSchema
    ),
    getSettings: createContract("backup:get-settings", emptyRequestSchema, backupSettingsSchema)
  },
  pricing: {
    importJson: createContract(
      "pricing:import-json",
      z.object({ json: z.string().min(2) }),
      priceImportResultSchema
    ),
    exportJson: createContract("pricing:export-json", emptyRequestSchema, z.string()),
    markStale: createContract(
      "pricing:mark-stale",
      z.object({
        priceIds: z.array(z.string().min(1)).min(1),
        effectiveDate: z.string().optional()
      }),
      z.array(modelPriceSchema)
    ),
    routeWarnings: createContract(
      "pricing:route-warnings",
      z.object({ staleAfterDays: z.number().int().positive().optional() }).optional(),
      z.array(routePriceWarningSchema)
    ),
    listQuotas: createContract(
      "pricing:quota-notes:list",
      emptyRequestSchema,
      z.array(providerQuotaNoteSchema)
    ),
    upsertQuota: createContract(
      "pricing:quota-notes:upsert",
      z.object({
        provider: providerSchema,
        creditBalance: z.number().min(0).nullable().optional(),
        monthlyBudget: z.number().min(0).nullable().optional(),
        freeQuotaRemaining: z.number().min(0).nullable().optional(),
        refreshedAt: z.string().nullable().optional(),
        notes: z.string().nullable().optional()
      }),
      providerQuotaNoteSchema
    )
  },
  providerHealth: {
    list: createContract("provider-health:list", emptyRequestSchema, z.array(providerHealthSchema)),
    reset: createContract(
      "provider-health:reset",
      z.object({ provider: providerSchema.optional() }).optional(),
      z.undefined()
    )
  },
  providerSmoke: {
    run: createContract(
      "provider-smoke:run",
      providerSmokeRunRequestSchema,
      providerSmokeResultSchema
    ),
    runAll: createContract(
      "provider-smoke:run-all",
      providerSmokeRunAllRequestSchema,
      z.array(providerSmokeResultSchema)
    ),
    report: createContract(
      "provider-smoke:report",
      emptyRequestSchema,
      z.array(providerSmokeResultSchema)
    ),
    latestReport: createContract(
      "provider-check:latest-report",
      emptyRequestSchema,
      providerCheckReportRecordSchema.nullable()
    )
  },
  providerChapterCheck: {
    run: createContract(
      "provider-chapter-check:run",
      providerChapterCheckRequestSchema,
      providerChapterCheckResultSchema
    )
  },
  crossCheck: {
    run: createContract("cross-check:run", crossCheckRequestSchema, crossCheckResultSchema)
  },
  candidates: {
    createGroup: createContract(
      "candidates:create-group",
      createCandidateGroupSchema,
      draftCandidateGroupSchema
    ),
    generate: createContract(
      "candidates:generate",
      generateCandidatesSchema,
      draftCandidateGroupDetailSchema
    ),
    listByChapter: createContract(
      "candidates:list-by-chapter",
      chapterCandidatesRequestSchema,
      z.array(draftCandidateGroupDetailSchema)
    ),
    getGroup: createContract(
      "candidates:get-group",
      groupIdRequestSchema,
      draftCandidateGroupDetailSchema
    ),
    getCandidate: createContract(
      "candidates:get-candidate",
      z.object({ candidateId: z.string().min(1) }),
      draftCandidateSchema
    ),
    deleteGroup: createContract(
      "candidates:delete-group",
      deleteCandidateGroupSchema,
      draftCandidateGroupSchema.nullable()
    ),
    retryCandidate: createContract(
      "candidates:retry-candidate",
      retryCandidateSchema,
      draftCandidateSchema
    ),
    saveCandidateAsVersion: createContract(
      "candidates:save-candidate-as-version",
      saveCandidateAsVersionSchema,
      manuscriptVersionSchema
    ),
    setCandidateCanonical: createContract(
      "candidates:set-candidate-canonical",
      setCandidateCanonicalSchema,
      manuscriptVersionSchema
    ),
    createFusion: createContract("candidates:create-fusion", createFusionSchema, draftFusionSchema),
    generateFusion: createContract(
      "candidates:generate-fusion",
      generateFusionSchema,
      draftFusionSchema
    ),
    saveFusionAsVersion: createContract(
      "candidates:save-fusion-as-version",
      saveFusionAsVersionSchema,
      manuscriptVersionSchema
    ),
    setFusionCanonical: createContract(
      "candidates:set-fusion-canonical",
      setFusionCanonicalSchema,
      manuscriptVersionSchema
    )
  },
  reviews: {
    listByGenerationRun: createContract(
      "reviews:list-by-generation-run",
      z.object({ runId: z.string().min(1) }),
      z.array(workflowReviewCardSchema)
    ),
    updateStatus: createContract(
      "reviews:update-status",
      z.object({
        id: z.string().min(1),
        status: z.enum(["open", "accepted", "rejected", "deferred", "applied"])
      }),
      workflowReviewCardSchema.nullable()
    ),
    rerunAudit: createContract(
      "reviews:rerun-audit",
      z.object({
        runId: z.string().min(1),
        auditType: z.enum(["continuity", "webnovel_rhythm"]).optional()
      }),
      z.array(workflowReviewCardSchema)
    ),
    qualityGate: createContract(
      "reviews:quality-gate",
      z.object({
        runId: z.string().min(1),
        overrideBlockingWarnings: z.boolean().optional()
      }),
      qualityGateSchema
    )
  },
  manuscript: {
    diffVersions: createContract(
      "manuscript:diff-versions",
      z.object({ fromVersionId: z.string().min(1), toVersionId: z.string().min(1) }),
      manuscriptDiffSchema
    ),
    diffArtifact: createContract(
      "manuscript:diff-artifact",
      z.object({
        artifactId: z.string().min(1),
        baseVersionId: z.string().min(1).nullable().optional()
      }),
      manuscriptDiffSchema
    ),
    saveArtifactAsVersion: createContract(
      "manuscript:save-artifact-as-version",
      z.object({
        runId: z.string().min(1),
        artifactId: z.string().min(1),
        title: z.string().trim().min(1).optional(),
        setCanonical: z.boolean().optional(),
        confirmed: z.boolean().optional(),
        overrideBlockingWarnings: z.boolean().optional()
      }),
      manuscriptVersionWorkflowResponseSchema
    )
  },
  settlement: {
    preview: createContract(
      "settlement:preview",
      z.object({ runId: z.string().min(1) }),
      settlementPreviewSchema.nullable()
    ),
    listByRun: createContract(
      "settlement:list-by-run",
      z.object({ runId: z.string().min(1) }),
      settlementPreviewSchema.nullable()
    ),
    applySelected: createContract(
      "settlement:apply-selected",
      z.object({
        proposalId: z.string().min(1),
        itemIds: z.array(z.string().min(1)),
        confirmed: z.boolean().optional(),
        appliedBy: z.string().trim().min(1).optional()
      }),
      applySettlementResultSchema
    ),
    rejectSelected: createContract(
      "settlement:reject-selected",
      z.object({ proposalId: z.string().min(1), itemIds: z.array(z.string().min(1)) }),
      z.array(settlementProposalItemSchema)
    ),
    editItem: createContract(
      "settlement:edit-item",
      z.object({
        itemId: z.string().min(1),
        afterJson: z.string().min(2),
        status: z.string().optional()
      }),
      settlementProposalItemSchema
    )
  },
  eval: {
    suites: {
      list: createContract("eval:suites:list", emptyRequestSchema, z.array(evalSuiteSchema)),
      create: createContract(
        "eval:suites:create",
        z.object({
          name: z.string().trim().min(1),
          description: z.string().nullable().optional(),
          version: z.string().optional()
        }),
        evalSuiteSchema
      ),
      update: createContract(
        "eval:suites:update",
        z.object({
          id: z.string().min(1),
          name: z.string().trim().min(1).optional(),
          description: z.string().nullable().optional(),
          version: z.string().optional()
        }),
        evalSuiteSchema.nullable()
      ),
      delete: createContract("eval:suites:delete", confirmedDeleteSchema, z.boolean())
    },
    cases: {
      list: createContract(
        "eval:cases:list",
        z.object({ suiteId: z.string().min(1) }),
        z.array(evalCaseSchema)
      ),
      create: createContract(
        "eval:cases:create",
        z.object({
          suiteId: z.string().min(1),
          title: z.string().trim().min(1),
          genre: z.string().trim().min(1),
          promptText: z.string().trim().min(1),
          referenceContext: z.string().nullable().optional(),
          expectedFocusJson: z.string().optional()
        }),
        evalCaseSchema
      ),
      update: createContract(
        "eval:cases:update",
        z.object({
          id: z.string().min(1),
          title: z.string().trim().min(1).optional(),
          genre: z.string().trim().min(1).optional(),
          promptText: z.string().trim().min(1).optional(),
          referenceContext: z.string().nullable().optional(),
          expectedFocusJson: z.string().optional()
        }),
        evalCaseSchema.nullable()
      ),
      delete: createContract("eval:cases:delete", confirmedDeleteSchema, z.boolean())
    },
    run: {
      start: createContract("eval:run:start", evalStartRequestSchema, evalRunSchema),
      abort: createContract(
        "eval:run:abort",
        z.object({ runId: z.string().min(1) }),
        evalRunSchema.nullable()
      )
    },
    outputs: {
      list: createContract(
        "eval:outputs:list",
        z.object({ runId: z.string().min(1), blind: z.boolean().optional() }),
        z.array(evalOutputSchema)
      )
    },
    score: {
      human: createContract("eval:score:human", evalHumanScoreRequestSchema, evalScoreSchema),
      llmJudge: createContract(
        "eval:score:llm-judge",
        evalJudgeRequestSchema,
        evalScoreSchema
      )
    },
    leaderboard: createContract(
      "eval:leaderboard",
      z.object({ runId: z.string().min(1) }),
      z.array(evalLeaderboardEntrySchema)
    ),
    promoteWinnerToRoute: createContract(
      "eval:promote-winner-to-route",
      evalPromoteRequestSchema,
      taskRouteSchema
    ),
    recommendRoutes: createContract(
      "eval:recommend-routes",
      z.object({ runId: z.string().min(1) }),
      evalRouteRecommendationsSchema
    ),
    applyRecommendationToRoute: createContract(
      "eval:apply-recommendation-to-route",
      evalApplyRecommendationRequestSchema,
      taskRouteSchema
    ),
    exportReport: createContract(
      "eval:export-report",
      evalReportRequestSchema,
      evalReportResultSchema
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
  },
  generation: {
    chapter: {
      start: createContract(
        "generation:chapter:start",
        chapterGenerationStartRequestSchema,
        workflowRunRecordSchema
      )
    },
    getRun: createContract(
      "generation:get-run",
      generationGetRunRequestSchema,
      chapterWorkflowDetailSchema.nullable()
    ),
    listRunsByChapter: createContract(
      "generation:list-runs-by-chapter",
      generationListRunsByChapterRequestSchema,
      z.array(workflowRunRecordSchema)
    ),
    streamEvents: createContract(
      "generation:stream-events",
      generationStreamEventsRequestSchema,
      z.array(workflowEventRecordSchema)
    ),
    abort: createContract(
      "generation:abort",
      generationAbortRequestSchema,
      workflowRunRecordSchema.nullable()
    ),
    resume: createContract(
      "generation:resume",
      generationResumeRequestSchema,
      workflowRunRecordSchema
    ),
    resumeAfterBudgetWarning: createContract(
      "generation:resume-after-budget-warning",
      z.object({ runId: z.string().min(1), confirmed: z.boolean().optional() }),
      workflowRunRecordSchema.nullable()
    ),
    requestRevision: createContract(
      "generation:request-revision",
      generationRequestRevisionSchema,
      workflowRunRecordSchema
    ),
    acceptArtifactAsVersion: createContract(
      "generation:accept-artifact-as-version",
      generationAcceptArtifactAsVersionSchema,
      manuscriptVersionWorkflowResponseSchema
    ),
    setAcceptedVersionCanonical: createContract(
      "generation:set-accepted-version-canonical",
      generationSetAcceptedVersionCanonicalSchema,
      manuscriptVersionWorkflowResponseSchema.nullable()
    ),
    cancel: createContract(
      "generation:cancel",
      generationCancelRequestSchema,
      workflowRunRecordSchema.nullable()
    )
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
  IPC_CONTRACTS.diagnostics.exportBundle,
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
  IPC_CONTRACTS.planning.outlineSources.list,
  IPC_CONTRACTS.planning.outlineSources.create,
  IPC_CONTRACTS.planning.outlineVersions.list,
  IPC_CONTRACTS.planning.outlineVersions.create,
  IPC_CONTRACTS.planning.outlineVersions.setActive,
  IPC_CONTRACTS.planning.chapterPlans.list,
  IPC_CONTRACTS.planning.chapterPlans.getAccepted,
  IPC_CONTRACTS.planning.chapterPlans.upsert,
  IPC_CONTRACTS.planning.proposals.list,
  IPC_CONTRACTS.planning.proposals.create,
  IPC_CONTRACTS.planning.proposals.accept,
  IPC_CONTRACTS.planning.proposals.reject,
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
  IPC_CONTRACTS.providerModels.list,
  IPC_CONTRACTS.modelPrices.list,
  IPC_CONTRACTS.modelPrices.upsert,
  IPC_CONTRACTS.taskRoutes.list,
  IPC_CONTRACTS.taskRoutes.upsert,
  IPC_CONTRACTS.taskRoutes.resolve,
  IPC_CONTRACTS.modelRoutes.resolvePreview,
  IPC_CONTRACTS.modelRoutes.applyPremiumWebnovelPreset,
  IPC_CONTRACTS.modelRoutes.exportPreset,
  IPC_CONTRACTS.modelRoutes.importPreset,
  IPC_CONTRACTS.budgets.getPolicies,
  IPC_CONTRACTS.budgets.updatePolicies,
  IPC_CONTRACTS.costs.getSummary,
  IPC_CONTRACTS.costs.getByProject,
  IPC_CONTRACTS.costs.getByBook,
  IPC_CONTRACTS.costs.getByChapter,
  IPC_CONTRACTS.costs.getByRun,
  IPC_CONTRACTS.costs.getByModel,
  IPC_CONTRACTS.costs.exportCsv,
  IPC_CONTRACTS.export.bookMarkdown,
  IPC_CONTRACTS.export.bookTxt,
  IPC_CONTRACTS.export.projectJson,
  IPC_CONTRACTS.export.projectPackage,
  IPC_CONTRACTS.export.costCsv,
  IPC_CONTRACTS.import.markdown,
  IPC_CONTRACTS.import.txt,
  IPC_CONTRACTS.import.projectJson,
  IPC_CONTRACTS.import.projectPackage,
  IPC_CONTRACTS.backup.create,
  IPC_CONTRACTS.backup.list,
  IPC_CONTRACTS.backup.restore,
  IPC_CONTRACTS.backup.updateSettings,
  IPC_CONTRACTS.backup.getSettings,
  IPC_CONTRACTS.pricing.importJson,
  IPC_CONTRACTS.pricing.exportJson,
  IPC_CONTRACTS.pricing.markStale,
  IPC_CONTRACTS.pricing.routeWarnings,
  IPC_CONTRACTS.providerHealth.list,
  IPC_CONTRACTS.providerHealth.reset,
  IPC_CONTRACTS.providerSmoke.run,
  IPC_CONTRACTS.providerSmoke.runAll,
  IPC_CONTRACTS.providerSmoke.report,
  IPC_CONTRACTS.providerSmoke.latestReport,
  IPC_CONTRACTS.providerChapterCheck.run,
  IPC_CONTRACTS.crossCheck.run,
  IPC_CONTRACTS.candidates.createGroup,
  IPC_CONTRACTS.candidates.generate,
  IPC_CONTRACTS.candidates.listByChapter,
  IPC_CONTRACTS.candidates.getGroup,
  IPC_CONTRACTS.candidates.getCandidate,
  IPC_CONTRACTS.candidates.deleteGroup,
  IPC_CONTRACTS.candidates.retryCandidate,
  IPC_CONTRACTS.candidates.saveCandidateAsVersion,
  IPC_CONTRACTS.candidates.setCandidateCanonical,
  IPC_CONTRACTS.candidates.createFusion,
  IPC_CONTRACTS.candidates.generateFusion,
  IPC_CONTRACTS.candidates.saveFusionAsVersion,
  IPC_CONTRACTS.candidates.setFusionCanonical,
  IPC_CONTRACTS.reviews.listByGenerationRun,
  IPC_CONTRACTS.reviews.updateStatus,
  IPC_CONTRACTS.reviews.rerunAudit,
  IPC_CONTRACTS.reviews.qualityGate,
  IPC_CONTRACTS.manuscript.diffVersions,
  IPC_CONTRACTS.manuscript.diffArtifact,
  IPC_CONTRACTS.manuscript.saveArtifactAsVersion,
  IPC_CONTRACTS.settlement.preview,
  IPC_CONTRACTS.settlement.listByRun,
  IPC_CONTRACTS.settlement.applySelected,
  IPC_CONTRACTS.settlement.rejectSelected,
  IPC_CONTRACTS.settlement.editItem,
  IPC_CONTRACTS.eval.suites.list,
  IPC_CONTRACTS.eval.suites.create,
  IPC_CONTRACTS.eval.suites.update,
  IPC_CONTRACTS.eval.suites.delete,
  IPC_CONTRACTS.eval.cases.list,
  IPC_CONTRACTS.eval.cases.create,
  IPC_CONTRACTS.eval.cases.update,
  IPC_CONTRACTS.eval.cases.delete,
  IPC_CONTRACTS.eval.run.start,
  IPC_CONTRACTS.eval.run.abort,
  IPC_CONTRACTS.eval.outputs.list,
  IPC_CONTRACTS.eval.score.human,
  IPC_CONTRACTS.eval.score.llmJudge,
  IPC_CONTRACTS.eval.leaderboard,
  IPC_CONTRACTS.eval.promoteWinnerToRoute,
  IPC_CONTRACTS.eval.recommendRoutes,
  IPC_CONTRACTS.eval.applyRecommendationToRoute,
  IPC_CONTRACTS.eval.exportReport,
  IPC_CONTRACTS.privacy.get,
  IPC_CONTRACTS.privacy.update,
  IPC_CONTRACTS.routingSettings.get,
  IPC_CONTRACTS.routingSettings.update,
  IPC_CONTRACTS.ai.stream.start,
  IPC_CONTRACTS.ai.stream.abort,
  IPC_CONTRACTS.ai.runs.get,
  IPC_CONTRACTS.ai.runs.listByChapter,
  IPC_CONTRACTS.ai.costs.summary,
  IPC_CONTRACTS.generation.chapter.start,
  IPC_CONTRACTS.generation.getRun,
  IPC_CONTRACTS.generation.listRunsByChapter,
  IPC_CONTRACTS.generation.streamEvents,
  IPC_CONTRACTS.generation.abort,
  IPC_CONTRACTS.generation.resume,
  IPC_CONTRACTS.generation.resumeAfterBudgetWarning,
  IPC_CONTRACTS.generation.requestRevision,
  IPC_CONTRACTS.generation.acceptArtifactAsVersion,
  IPC_CONTRACTS.generation.setAcceptedVersionCanonical,
  IPC_CONTRACTS.generation.cancel
];

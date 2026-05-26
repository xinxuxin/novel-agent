import type { ThemePreference } from "@shared/theme";
import type { DiagnosticBundle, DiagnosticBundleRequest } from "./diagnostics";
import type {
  ProviderSmokeResult,
  ProviderSmokeRunAllRequest,
  ProviderSmokeRunRequest
} from "./provider-smoke";
import type {
  ProviderChapterCheckRequest,
  ProviderChapterCheckResult,
  ProviderCheckReportRecord
} from "./provider-check";
import type { CrossCheckRequest, CrossCheckResult } from "./cross-check";
import type {
  CreateCandidateGroupInput,
  CreateFusionInput,
  DraftCandidateGroupDetail,
  DraftCandidateGroupRecord,
  DraftCandidateRecord,
  DraftFusionRecord,
  GenerateCandidatesInput,
  GenerateFusionInput,
  RetryCandidateInput,
  SaveCandidateAsVersionInput,
  SaveFusionAsVersionInput,
  SetCandidateCanonicalInput,
  SetFusionCanonicalInput
} from "./draft-candidates";
import type {
  AIStreamEvent,
  CostSummary,
  CostSummaryRequest,
  LLMRunRecord,
  StreamRequest,
  StreamStartResult
} from "./ai";
import type {
  ChapterGenerationStartRequest,
  ChapterWorkflowDetail,
  GenerationAcceptArtifactAsVersion,
  GenerationRequestRevision,
  GenerationResumeRequest,
  GenerationSetAcceptedVersionCanonical,
  SettlementProposalItem,
  WorkflowReviewCard,
  WorkflowEventRecord,
  WorkflowRunRecord
} from "./workflow";
import type {
  CredentialStatusDto,
  CredentialTestResult,
  ModelPriceRecord,
  ModelProfileRecord,
  ModelRouteResolution,
  ProviderHealthRecord,
  RoutePreviewContext,
  ProviderCredentialDto,
  ProviderModelListResult,
  SaveCredentialInput,
  TaskRouteRecord
} from "./model-routing";
import type { PrivacySettings, RoutingSettings } from "./settings";
import type { QualityMode, TaskType } from "@shared/domain/model-routing";
import type { ContextPreviewPack, ContextPreviewRequest } from "./context";

import type {
  BookRecord,
  ChapterRecord,
  CreateBookInput,
  CreateChapterInput,
  CreateProjectInput,
  CreateStoryBibleEntryInput,
  CreateVolumeInput,
  ManuscriptVersionRecord,
  MemorySearchResult,
  ProjectRecord,
  SaveManualVersionInput,
  StoryBibleEntryRecord,
  UpdateChapterInput,
  UpdateStoryBibleEntryInput,
  VolumeRecord
} from "./data";
import type {
  CharacterInput,
  CharacterRecord,
  ForeshadowingInput,
  ForeshadowingRecord,
  NamedEntityInput,
  NamedStoryBibleRecord,
  PowerSystemRuleInput,
  PowerSystemRuleRecord,
  ReaderPositioningInput,
  ReaderPositioningRecord,
  StoryBibleListQuery,
  StyleGuideInput,
  StyleGuideRecord,
  TimelineEventInput,
  TimelineEventRecord,
  UnresolvedHookInput,
  UnresolvedHookRecord
} from "./story-bible";
import type { BudgetPolicyRecord, UpdateBudgetPolicyInput } from "./budgets";
import type {
  CostForecast,
  CostForecastRequest,
  CostDashboardSummary,
  CostGroup,
  CostScopeRequest,
  CsvExportResult,
  ModelPriceTierDto,
  PriceImportResult,
  ProviderQuotaNoteDto,
  ProviderQuotaSummary,
  QualityModeComparison,
  RoutePriceWarning
} from "./cost-dashboard";
import type {
  BackupCreateRequest,
  BackupRecord,
  BackupRestoreRequest,
  BackupRestoreResult,
  BackupSettings,
  BackupSettingsUpdate,
  ExportBookMarkdownRequest,
  ExportBookTxtRequest,
  ExportCostCsvRequest,
  ExportFilesResult,
  ExportPackageResult,
  ExportProjectJsonRequest,
  ExportProjectPackageRequest,
  ExportTextResult,
  ImportMarkdownRequest,
  ImportProjectJsonRequest,
  ImportProjectPackageRequest,
  ImportResult,
  ImportTxtRequest,
  ProjectJsonPackage
} from "./import-export";
import type {
  EvalApplyRecommendationRequest,
  EvalCaseRecord,
  EvalHumanScoreRequest,
  EvalJudgeRequest,
  EvalLeaderboardEntry,
  EvalOutputRecord,
  EvalPromoteRequest,
  EvalReportRequest,
  EvalReportResult,
  EvalRouteRecommendations,
  EvalRunRecord,
  EvalScoreRecord,
  EvalStartRequest,
  EvalSuiteRecord
} from "./evaluation";
import type {
  ApplySettlementResult,
  ManuscriptDiff,
  QualityGateResult,
  SettlementPreview
} from "./review-settlement";
import type {
  ChapterPlanRecord,
  OutlineSourceRecord,
  OutlineVersionRecord,
  PlanEditProposalRecord
} from "./planning";

export type WenForgePlatform =
  | "aix"
  | "android"
  | "darwin"
  | "freebsd"
  | "haiku"
  | "linux"
  | "openbsd"
  | "sunos"
  | "win32"
  | "cygwin"
  | "netbsd";

export type WenForgeEnvironmentMode = "development" | "test" | "production";

export type StudioMode = "studio" | "popover";

export interface WenForgeEnvironment {
  mode: WenForgeEnvironmentMode;
  packaged: boolean;
}

export interface DiagnosticPing {
  ok: true;
  at: string;
}

export interface WenForgeApi {
  app: {
    getVersion: () => Promise<string>;
    getPlatform: () => Promise<WenForgePlatform>;
    getEnvironment: () => Promise<WenForgeEnvironment>;
  };
  window: {
    minimize: () => Promise<void>;
    close: () => Promise<void>;
    toggleStudioMode: () => Promise<StudioMode>;
  };
  settings: {
    getTheme: () => Promise<ThemePreference>;
    setTheme: (theme: ThemePreference) => Promise<ThemePreference>;
  };
  diagnostics: {
    ping: () => Promise<DiagnosticPing>;
    exportBundle: (request?: DiagnosticBundleRequest) => Promise<DiagnosticBundle>;
  };
  projects: {
    list: () => Promise<ProjectRecord[]>;
    get: (id: string) => Promise<ProjectRecord | null>;
    create: (input: CreateProjectInput) => Promise<ProjectRecord>;
    update: (
      id: string,
      input: Partial<CreateProjectInput> & { status?: string }
    ) => Promise<ProjectRecord | null>;
    delete: (id: string, confirmed: boolean) => Promise<boolean>;
  };
  books: {
    listByProject: (projectId: string) => Promise<BookRecord[]>;
    get: (id: string) => Promise<BookRecord | null>;
    create: (input: CreateBookInput) => Promise<BookRecord>;
    update: (
      id: string,
      input: Partial<CreateBookInput> & { status?: string }
    ) => Promise<BookRecord | null>;
    delete: (id: string, confirmed: boolean) => Promise<boolean>;
  };
  volumes: {
    listByBook: (bookId: string) => Promise<VolumeRecord[]>;
    create: (input: CreateVolumeInput) => Promise<VolumeRecord>;
    update: (
      id: string,
      input: Partial<CreateVolumeInput> & { status?: string }
    ) => Promise<VolumeRecord | null>;
    delete: (id: string, confirmed: boolean) => Promise<boolean>;
  };
  chapters: {
    listByBook: (bookId: string) => Promise<ChapterRecord[]>;
    get: (id: string) => Promise<ChapterRecord | null>;
    create: (input: CreateChapterInput) => Promise<ChapterRecord>;
    update: (id: string, input: UpdateChapterInput) => Promise<ChapterRecord | null>;
    reorder: (bookId: string, orderedChapterIds: string[]) => Promise<void>;
    setStatus: (id: string, status: string) => Promise<ChapterRecord | null>;
    delete: (id: string, confirmed: boolean) => Promise<boolean>;
  };
  planning: {
    outlineSources: {
      list: (bookId: string) => Promise<OutlineSourceRecord[]>;
      create: (input: {
        projectId: string;
        bookId: string;
        sourceType: "paste" | "file" | "manual" | "imported";
        title: string;
        originalText: string;
        parsedAt?: string | null;
        parserModel?: string | null;
      }) => Promise<OutlineSourceRecord>;
    };
    outlineVersions: {
      list: (bookId: string) => Promise<OutlineVersionRecord[]>;
      create: (input: {
        bookId: string;
        parentVersionId?: string | null;
        title: string;
        contentJson: string;
        contentMarkdown: string;
        sourceId?: string | null;
        isActive?: boolean;
      }) => Promise<OutlineVersionRecord>;
      setActive: (bookId: string, id: string) => Promise<OutlineVersionRecord | null>;
    };
    chapterPlans: {
      list: (bookId: string) => Promise<ChapterPlanRecord[]>;
      getAccepted: (chapterId: string) => Promise<ChapterPlanRecord | null>;
      upsert: (input: Partial<ChapterPlanRecord> & Pick<ChapterPlanRecord, "bookId" | "chapterIndex" | "title">) => Promise<ChapterPlanRecord>;
    };
    proposals: {
      list: (bookId: string) => Promise<PlanEditProposalRecord[]>;
      create: (input: {
        bookId: string;
        targetType: "outline" | "volume" | "chapter" | "scene" | "beat" | "manuscript";
        targetId: string;
        instruction: string;
        beforeJson: string;
        afterJson: string;
        patchJson?: string | null;
        rationale: string;
        modelProvider?: string | null;
        modelName?: string | null;
        llmRunId?: string | null;
      }) => Promise<PlanEditProposalRecord>;
      accept: (id: string) => Promise<PlanEditProposalRecord | null>;
      reject: (id: string) => Promise<PlanEditProposalRecord | null>;
    };
  };
  manuscripts: {
    listVersions: (chapterId: string) => Promise<ManuscriptVersionRecord[]>;
    getVersion: (id: string) => Promise<ManuscriptVersionRecord | null>;
    getCanonical: (chapterId: string) => Promise<ManuscriptVersionRecord | null>;
    saveManualVersion: (input: SaveManualVersionInput) => Promise<ManuscriptVersionRecord>;
    setCanonical: (chapterId: string, versionId: string) => Promise<ManuscriptVersionRecord | null>;
    rollback: (
      chapterId: string,
      versionId: string,
      confirmed: boolean
    ) => Promise<ManuscriptVersionRecord>;
  };
  reviews: {
    listByGenerationRun: (runId: string) => Promise<WorkflowReviewCard[]>;
    updateStatus: (
      id: string,
      status: "open" | "accepted" | "rejected" | "deferred" | "applied"
    ) => Promise<WorkflowReviewCard | null>;
    rerunAudit: (
      runId: string,
      auditType?: "continuity" | "webnovel_rhythm"
    ) => Promise<WorkflowReviewCard[]>;
    qualityGate: (runId: string, overrideBlockingWarnings?: boolean) => Promise<QualityGateResult>;
  };
  manuscript: {
    diffVersions: (fromVersionId: string, toVersionId: string) => Promise<ManuscriptDiff>;
    diffArtifact: (artifactId: string, baseVersionId?: string | null) => Promise<ManuscriptDiff>;
    saveArtifactAsVersion: (input: {
      runId: string;
      artifactId: string;
      title?: string;
      setCanonical?: boolean;
      confirmed?: boolean;
      overrideBlockingWarnings?: boolean;
    }) => Promise<ManuscriptVersionRecord>;
  };
  settlement: {
    preview: (runId: string) => Promise<SettlementPreview | null>;
    listByRun: (runId: string) => Promise<SettlementPreview | null>;
    applySelected: (input: {
      proposalId: string;
      itemIds: string[];
      confirmed?: boolean;
      appliedBy?: string;
    }) => Promise<ApplySettlementResult>;
    rejectSelected: (proposalId: string, itemIds: string[]) => Promise<SettlementProposalItem[]>;
    editItem: (
      itemId: string,
      afterJson: string,
      status?: string
    ) => Promise<SettlementProposalItem>;
  };
  storyBible: {
    entries: {
      list: (bookId: string) => Promise<StoryBibleEntryRecord[]>;
      create: (input: CreateStoryBibleEntryInput) => Promise<StoryBibleEntryRecord>;
      update: (
        id: string,
        input: UpdateStoryBibleEntryInput
      ) => Promise<StoryBibleEntryRecord | null>;
      delete: (id: string, confirmed: boolean) => Promise<boolean>;
    };
    characters: StoryBibleCrudApi<StoryBibleListQuery, CharacterInput, CharacterRecord>;
    factions: StoryBibleCrudApi<StoryBibleListQuery, NamedEntityInput, NamedStoryBibleRecord>;
    locations: StoryBibleCrudApi<StoryBibleListQuery, NamedEntityInput, NamedStoryBibleRecord>;
    artifacts: StoryBibleCrudApi<StoryBibleListQuery, NamedEntityInput, NamedStoryBibleRecord>;
    powerSystem: StoryBibleCrudApi<
      StoryBibleListQuery,
      PowerSystemRuleInput,
      PowerSystemRuleRecord
    >;
    timeline: StoryBibleCrudApi<StoryBibleListQuery, TimelineEventInput, TimelineEventRecord>;
    foreshadowing: StoryBibleCrudApi<StoryBibleListQuery, ForeshadowingInput, ForeshadowingRecord>;
    hooks: StoryBibleCrudApi<StoryBibleListQuery, UnresolvedHookInput, UnresolvedHookRecord>;
    styleGuide: StoryBibleCrudApi<StoryBibleListQuery, StyleGuideInput, StyleGuideRecord>;
    readerPositioning: StoryBibleCrudApi<
      StoryBibleListQuery,
      ReaderPositioningInput,
      ReaderPositioningRecord
    >;
  };
  memory: {
    search: (
      bookId: string,
      query: string,
      options?: {
        chapterId?: string | null;
        sourceTypes?: string[];
        tags?: string[];
        minImportance?: number;
        limit?: number;
      }
    ) => Promise<MemorySearchResult[]>;
    rebuildBookIndex: (bookId: string) => Promise<void>;
  };
  context: {
    previewForChapter: (request: ContextPreviewRequest) => Promise<ContextPreviewPack>;
  };
  credentials: {
    list: () => Promise<ProviderCredentialDto[]>;
    save: (input: SaveCredentialInput) => Promise<ProviderCredentialDto>;
    delete: (id: string, confirmed: boolean) => Promise<boolean>;
    getStatus: (id: string) => Promise<CredentialStatusDto>;
    testConnection: (id: string) => Promise<CredentialTestResult>;
    updateBaseUrl: (id: string, baseUrl: string | null) => Promise<ProviderCredentialDto | null>;
  };
  modelProfiles: {
    list: () => Promise<ModelProfileRecord[]>;
    upsert: (
      input: Partial<ModelProfileRecord> &
        Pick<ModelProfileRecord, "provider" | "model" | "displayName">
    ) => Promise<ModelProfileRecord>;
  };
  providerModels: {
    list: (provider: ProviderCredentialDto["provider"]) => Promise<ProviderModelListResult>;
  };
  modelPrices: {
    list: () => Promise<ModelPriceRecord[]>;
    upsert: (
      input: Partial<ModelPriceRecord> &
        Pick<
          ModelPriceRecord,
          | "provider"
          | "model"
          | "inputPricePerMillion"
          | "outputPricePerMillion"
          | "effectiveDate"
          | "sourceNote"
        >
    ) => Promise<ModelPriceRecord>;
    listTiers: (filter?: {
      provider?: ModelPriceTierDto["provider"];
      model?: string;
    }) => Promise<ModelPriceTierDto[]>;
    upsertTier: (
      input: Partial<ModelPriceTierDto> &
        Pick<
          ModelPriceTierDto,
          | "modelPriceId"
          | "provider"
          | "model"
          | "minInputTokens"
          | "inputPricePerMillion"
          | "outputPricePerMillion"
          | "effectiveDate"
          | "sourceNote"
        >
    ) => Promise<ModelPriceTierDto>;
  };
  taskRoutes: {
    list: () => Promise<TaskRouteRecord[]>;
    upsert: (
      input: Partial<TaskRouteRecord> &
        Pick<
          TaskRouteRecord,
          "taskType" | "qualityMode" | "primaryModelProfileId" | "temperature" | "maxOutputTokens"
        >
    ) => Promise<TaskRouteRecord>;
    resolve: (taskType: TaskType, qualityMode: QualityMode) => Promise<ModelRouteResolution>;
  };
  modelRoutes: {
    resolvePreview: (
      taskType: TaskType,
      qualityMode: QualityMode,
      context?: RoutePreviewContext
    ) => Promise<ModelRouteResolution>;
    applyPremiumWebnovelPreset: (confirmed: boolean) => Promise<unknown>;
    exportPreset: (qualityMode: QualityMode) => Promise<unknown>;
    importPreset: (presetJson: string, confirmed: boolean) => Promise<unknown>;
  };
  budgets: {
    getPolicies: () => Promise<BudgetPolicyRecord>;
    updatePolicies: (input: UpdateBudgetPolicyInput) => Promise<BudgetPolicyRecord>;
  };
  costs: {
    getSummary: (request?: CostScopeRequest) => Promise<CostDashboardSummary>;
    getByProject: (request?: CostScopeRequest) => Promise<CostGroup[]>;
    getByBook: (request?: CostScopeRequest) => Promise<CostGroup[]>;
    getByChapter: (request?: CostScopeRequest) => Promise<CostGroup[]>;
    getByRun: (request?: CostScopeRequest) => Promise<CostGroup[]>;
    getByModel: (request?: CostScopeRequest) => Promise<CostGroup[]>;
    exportCsv: (request?: CostScopeRequest) => Promise<CsvExportResult>;
    forecastChapters: (request?: CostForecastRequest) => Promise<CostForecast>;
    compareQualityModes: (
      request?: Omit<CostForecastRequest, "qualityMode">
    ) => Promise<QualityModeComparison>;
    quotaSummary: (
      forecast: CostForecast,
      providers?: ProviderQuotaSummary["providers"][number]["provider"][]
    ) => Promise<ProviderQuotaSummary>;
  };
  export: {
    bookMarkdown: (request: ExportBookMarkdownRequest) => Promise<ExportFilesResult>;
    bookTxt: (request: ExportBookTxtRequest) => Promise<ExportTextResult>;
    projectJson: (request: ExportProjectJsonRequest) => Promise<ProjectJsonPackage>;
    projectPackage: (request: ExportProjectPackageRequest) => Promise<ExportPackageResult>;
    costCsv: (request?: ExportCostCsvRequest) => Promise<ExportTextResult>;
  };
  import: {
    markdown: (request: ImportMarkdownRequest) => Promise<ImportResult>;
    txt: (request: ImportTxtRequest) => Promise<ImportResult>;
    projectJson: (request: ImportProjectJsonRequest) => Promise<ImportResult>;
    projectPackage: (request: ImportProjectPackageRequest) => Promise<ImportResult>;
  };
  backup: {
    create: (request?: BackupCreateRequest) => Promise<BackupRecord>;
    list: () => Promise<BackupRecord[]>;
    restore: (request: BackupRestoreRequest) => Promise<BackupRestoreResult>;
    getSettings: () => Promise<BackupSettings>;
    updateSettings: (request: BackupSettingsUpdate) => Promise<BackupSettings>;
  };
  pricing: {
    importJson: (json: string) => Promise<PriceImportResult>;
    exportJson: () => Promise<string>;
    markStale: (priceIds: string[], effectiveDate?: string) => Promise<ModelPriceRecord[]>;
    routeWarnings: (staleAfterDays?: number) => Promise<RoutePriceWarning[]>;
    listQuotas: () => Promise<ProviderQuotaNoteDto[]>;
    upsertQuota: (
      input: Partial<ProviderQuotaNoteDto> & Pick<ProviderQuotaNoteDto, "provider">
    ) => Promise<ProviderQuotaNoteDto>;
  };
  providerHealth: {
    list: () => Promise<ProviderHealthRecord[]>;
    reset: (provider?: ProviderHealthRecord["provider"]) => Promise<void>;
  };
  providerSmoke: {
    run: (request: ProviderSmokeRunRequest) => Promise<ProviderSmokeResult>;
    runAll: (request: ProviderSmokeRunAllRequest) => Promise<ProviderSmokeResult[]>;
    report: () => Promise<ProviderSmokeResult[]>;
    latestReport: () => Promise<ProviderCheckReportRecord | null>;
  };
  providerChapterCheck: {
    run: (request: ProviderChapterCheckRequest) => Promise<ProviderChapterCheckResult>;
  };
  crossCheck: {
    run: (request: CrossCheckRequest) => Promise<CrossCheckResult>;
  };
  candidates: {
    createGroup: (input: CreateCandidateGroupInput) => Promise<DraftCandidateGroupRecord>;
    generate: (input: GenerateCandidatesInput) => Promise<DraftCandidateGroupDetail>;
    listByChapter: (chapterId: string) => Promise<DraftCandidateGroupDetail[]>;
    getGroup: (groupId: string) => Promise<DraftCandidateGroupDetail>;
    getCandidate: (candidateId: string) => Promise<DraftCandidateRecord>;
    deleteGroup: (groupId: string, confirmed: boolean) => Promise<DraftCandidateGroupRecord | null>;
    retryCandidate: (input: RetryCandidateInput) => Promise<DraftCandidateRecord>;
    saveCandidateAsVersion: (input: SaveCandidateAsVersionInput) => Promise<ManuscriptVersionRecord>;
    setCandidateCanonical: (input: SetCandidateCanonicalInput) => Promise<ManuscriptVersionRecord>;
    createFusion: (input: CreateFusionInput) => Promise<DraftFusionRecord>;
    generateFusion: (input: GenerateFusionInput) => Promise<DraftFusionRecord>;
    saveFusionAsVersion: (input: SaveFusionAsVersionInput) => Promise<ManuscriptVersionRecord>;
    setFusionCanonical: (input: SetFusionCanonicalInput) => Promise<ManuscriptVersionRecord>;
  };
  privacy: {
    get: () => Promise<PrivacySettings>;
    update: (input: Partial<PrivacySettings>) => Promise<PrivacySettings>;
  };
  routingSettings: {
    get: () => Promise<RoutingSettings>;
    update: (input: Partial<RoutingSettings>) => Promise<RoutingSettings>;
  };
  ai: {
    stream: {
      start: (request: StreamRequest) => Promise<StreamStartResult>;
      abort: (runId: string) => Promise<boolean>;
      onEvent: (listener: (event: AIStreamEvent) => void) => () => void;
    };
    runs: {
      get: (runId: string) => Promise<LLMRunRecord | null>;
      listByChapter: (chapterId: string) => Promise<LLMRunRecord[]>;
    };
    costs: {
      summary: (request: CostSummaryRequest) => Promise<CostSummary>;
    };
  };
  eval: {
    suites: {
      list: () => Promise<EvalSuiteRecord[]>;
      create: (input: {
        name: string;
        description?: string | null;
        version?: string;
      }) => Promise<EvalSuiteRecord>;
      update: (
        id: string,
        input: Partial<{ name: string; description: string | null; version: string }>
      ) => Promise<EvalSuiteRecord | null>;
      delete: (id: string, confirmed: boolean) => Promise<boolean>;
    };
    cases: {
      list: (suiteId: string) => Promise<EvalCaseRecord[]>;
      create: (input: {
        suiteId: string;
        title: string;
        genre: string;
        promptText: string;
        referenceContext?: string | null;
        expectedFocusJson?: string;
      }) => Promise<EvalCaseRecord>;
      update: (id: string, input: Partial<EvalCaseRecord>) => Promise<EvalCaseRecord | null>;
      delete: (id: string, confirmed: boolean) => Promise<boolean>;
    };
    run: {
      start: (request: EvalStartRequest) => Promise<EvalRunRecord>;
      abort: (runId: string) => Promise<EvalRunRecord | null>;
    };
    outputs: {
      list: (runId: string, blind?: boolean) => Promise<EvalOutputRecord[]>;
    };
    score: {
      human: (request: EvalHumanScoreRequest) => Promise<EvalScoreRecord>;
      llmJudge: (request: string | EvalJudgeRequest) => Promise<EvalScoreRecord>;
    };
    leaderboard: (runId: string) => Promise<EvalLeaderboardEntry[]>;
    promoteWinnerToRoute: (request: EvalPromoteRequest) => Promise<TaskRouteRecord>;
    recommendRoutes: (runId: string) => Promise<EvalRouteRecommendations>;
    applyRecommendationToRoute: (
      request: EvalApplyRecommendationRequest
    ) => Promise<TaskRouteRecord>;
    exportReport: (request: EvalReportRequest) => Promise<EvalReportResult>;
  };
  generation: {
    chapter: {
      start: (request: ChapterGenerationStartRequest) => Promise<WorkflowRunRecord>;
    };
    getRun: (runId: string) => Promise<ChapterWorkflowDetail | null>;
    listRunsByChapter: (chapterId: string) => Promise<WorkflowRunRecord[]>;
    streamEvents: (runId: string, sinceEventId?: string) => Promise<WorkflowEventRecord[]>;
    abort: (runId: string) => Promise<WorkflowRunRecord | null>;
    resume: (request: GenerationResumeRequest) => Promise<WorkflowRunRecord>;
    resumeAfterBudgetWarning: (
      runId: string,
      confirmed: boolean
    ) => Promise<WorkflowRunRecord | null>;
    requestRevision: (request: GenerationRequestRevision) => Promise<WorkflowRunRecord>;
    acceptArtifactAsVersion: (
      request: GenerationAcceptArtifactAsVersion
    ) => Promise<ManuscriptVersionRecord>;
    setAcceptedVersionCanonical: (
      request: GenerationSetAcceptedVersionCanonical
    ) => Promise<ManuscriptVersionRecord | null>;
    cancel: (runId: string, confirmed: boolean) => Promise<WorkflowRunRecord | null>;
  };
}

export interface StoryBibleCrudApi<Query, CreateInput, Record> {
  list: (query: Query) => Promise<Record[]>;
  create: (input: CreateInput) => Promise<Record>;
  update: (id: string, input: Partial<CreateInput>) => Promise<Record | null>;
  delete: (id: string, confirmed: boolean) => Promise<boolean>;
}

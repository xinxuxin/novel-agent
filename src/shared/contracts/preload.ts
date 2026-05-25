import type { ThemePreference } from "@shared/theme";
import type {
  AIStreamEvent,
  CostSummary,
  CostSummaryRequest,
  LLMRunRecord,
  StreamRequest,
  StreamStartResult
} from "./ai";
import type {
  CredentialStatusDto,
  CredentialTestResult,
  ModelPriceRecord,
  ModelProfileRecord,
  ModelRouteResolution,
  ProviderCredentialDto,
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
}

export interface StoryBibleCrudApi<Query, CreateInput, Record> {
  list: (query: Query) => Promise<Record[]>;
  create: (input: CreateInput) => Promise<Record>;
  update: (id: string, input: Partial<CreateInput>) => Promise<Record | null>;
  delete: (id: string, confirmed: boolean) => Promise<boolean>;
}

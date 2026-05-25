import type { ThemePreference } from "@shared/theme";
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
  VolumeRecord
} from "./data";

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
    delete: (id: string, confirmed: boolean) => Promise<boolean>;
  };
  volumes: {
    listByBook: (bookId: string) => Promise<VolumeRecord[]>;
    create: (input: CreateVolumeInput) => Promise<VolumeRecord>;
  };
  chapters: {
    listByBook: (bookId: string) => Promise<ChapterRecord[]>;
    get: (id: string) => Promise<ChapterRecord | null>;
    create: (input: CreateChapterInput) => Promise<ChapterRecord>;
    setStatus: (id: string, status: string) => Promise<ChapterRecord | null>;
  };
  manuscripts: {
    listVersions: (chapterId: string) => Promise<ManuscriptVersionRecord[]>;
    getCanonical: (chapterId: string) => Promise<ManuscriptVersionRecord | null>;
    saveManualVersion: (input: SaveManualVersionInput) => Promise<ManuscriptVersionRecord>;
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
    };
  };
  memory: {
    search: (bookId: string, query: string) => Promise<MemorySearchResult[]>;
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
}

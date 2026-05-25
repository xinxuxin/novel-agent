import type { WenForgeApi } from "@contracts/preload";
import type { CostSummary, LLMRunRecord, StreamStartResult } from "@contracts/ai";
import { AI_STREAM_EVENT_CHANNEL, aiStreamEventSchema } from "@contracts/ai";
import type {
  BookRecord,
  ChapterRecord,
  ManuscriptVersionRecord,
  MemorySearchResult,
  ProjectRecord,
  StoryBibleEntryRecord,
  VolumeRecord
} from "@contracts/data";
import type {
  CredentialStatusDto,
  CredentialTestResult,
  ModelPriceRecord,
  ModelProfileRecord,
  ModelRouteResolution,
  ProviderCredentialDto,
  TaskRouteRecord
} from "@contracts/model-routing";
import type { PrivacySettings, RoutingSettings } from "@contracts/settings";
import type { QualityMode, TaskType } from "@shared/domain/model-routing";
import { IPC_CONTRACTS, ipcEnvelopeSchema } from "@shared/ipc/contracts";
import { normalizeTheme } from "@shared/theme";
import type { ThemePreference } from "@shared/theme";
import type { z } from "zod";

export type IpcInvoker = (channel: string, value?: unknown) => Promise<unknown>;
export type IpcSubscriber = (
  channel: string,
  listener: (_event: unknown, value: unknown) => void
) => () => void;

class WenForgeIpcError extends Error {
  constructor(
    public readonly code: string,
    message: string
  ) {
    super(message);
    this.name = "WenForgeIpcError";
  }
}

async function invokeContract<T>(
  invoke: IpcInvoker,
  channel: string,
  responseSchema: z.ZodType<T>,
  payload?: unknown
): Promise<T> {
  const envelope = ipcEnvelopeSchema.parse(await invoke(channel, payload));

  if (!envelope.ok) {
    throw new WenForgeIpcError(envelope.error.code, envelope.error.message);
  }

  return responseSchema.parse(envelope.data);
}

export function createPreloadApi(
  invoke: IpcInvoker,
  subscribe: IpcSubscriber = () => () => undefined
): WenForgeApi {
  return {
    app: {
      getVersion: () =>
        invokeContract(
          invoke,
          IPC_CONTRACTS.app.getVersion.channel,
          IPC_CONTRACTS.app.getVersion.response
        ),
      getPlatform: () =>
        invokeContract(
          invoke,
          IPC_CONTRACTS.app.getPlatform.channel,
          IPC_CONTRACTS.app.getPlatform.response
        ),
      getEnvironment: () =>
        invokeContract(
          invoke,
          IPC_CONTRACTS.app.getEnvironment.channel,
          IPC_CONTRACTS.app.getEnvironment.response
        )
    },
    window: {
      minimize: async () => {
        await invokeContract(
          invoke,
          IPC_CONTRACTS.window.minimize.channel,
          IPC_CONTRACTS.window.minimize.response
        );
      },
      close: async () => {
        await invokeContract(
          invoke,
          IPC_CONTRACTS.window.close.channel,
          IPC_CONTRACTS.window.close.response
        );
      },
      toggleStudioMode: () =>
        invokeContract(
          invoke,
          IPC_CONTRACTS.window.toggleStudioMode.channel,
          IPC_CONTRACTS.window.toggleStudioMode.response
        )
    },
    settings: {
      getTheme: async () =>
        normalizeTheme(
          await invokeContract(
            invoke,
            IPC_CONTRACTS.settings.getTheme.channel,
            IPC_CONTRACTS.settings.getTheme.response
          )
        ),
      setTheme: async (theme: ThemePreference) =>
        normalizeTheme(
          await invokeContract(
            invoke,
            IPC_CONTRACTS.settings.setTheme.channel,
            IPC_CONTRACTS.settings.setTheme.response,
            { theme: normalizeTheme(theme) }
          )
        )
    },
    diagnostics: {
      ping: () =>
        invokeContract(
          invoke,
          IPC_CONTRACTS.diagnostics.ping.channel,
          IPC_CONTRACTS.diagnostics.ping.response
        )
    },
    projects: {
      list: () =>
        invokeContract<ProjectRecord[]>(
          invoke,
          IPC_CONTRACTS.projects.list.channel,
          IPC_CONTRACTS.projects.list.response
        ),
      get: (id) =>
        invokeContract<ProjectRecord | null>(
          invoke,
          IPC_CONTRACTS.projects.get.channel,
          IPC_CONTRACTS.projects.get.response,
          { id }
        ),
      create: (input) =>
        invokeContract<ProjectRecord>(
          invoke,
          IPC_CONTRACTS.projects.create.channel,
          IPC_CONTRACTS.projects.create.response,
          input
        ),
      update: (id, input) =>
        invokeContract<ProjectRecord | null>(
          invoke,
          IPC_CONTRACTS.projects.update.channel,
          IPC_CONTRACTS.projects.update.response,
          { id, ...input }
        ),
      delete: (id, confirmed) =>
        invokeContract<boolean>(
          invoke,
          IPC_CONTRACTS.projects.delete.channel,
          IPC_CONTRACTS.projects.delete.response,
          { id, confirmed }
        )
    },
    books: {
      listByProject: (projectId) =>
        invokeContract<BookRecord[]>(
          invoke,
          IPC_CONTRACTS.books.listByProject.channel,
          IPC_CONTRACTS.books.listByProject.response,
          { projectId }
        ),
      get: (id) =>
        invokeContract<BookRecord | null>(
          invoke,
          IPC_CONTRACTS.books.get.channel,
          IPC_CONTRACTS.books.get.response,
          { id }
        ),
      create: (input) =>
        invokeContract<BookRecord>(
          invoke,
          IPC_CONTRACTS.books.create.channel,
          IPC_CONTRACTS.books.create.response,
          input
        ),
      delete: (id, confirmed) =>
        invokeContract<boolean>(
          invoke,
          IPC_CONTRACTS.books.delete.channel,
          IPC_CONTRACTS.books.delete.response,
          { id, confirmed }
        )
    },
    volumes: {
      listByBook: (bookId) =>
        invokeContract<VolumeRecord[]>(
          invoke,
          IPC_CONTRACTS.volumes.listByBook.channel,
          IPC_CONTRACTS.volumes.listByBook.response,
          { bookId }
        ),
      create: (input) =>
        invokeContract<VolumeRecord>(
          invoke,
          IPC_CONTRACTS.volumes.create.channel,
          IPC_CONTRACTS.volumes.create.response,
          input
        )
    },
    chapters: {
      listByBook: (bookId) =>
        invokeContract<ChapterRecord[]>(
          invoke,
          IPC_CONTRACTS.chapters.listByBook.channel,
          IPC_CONTRACTS.chapters.listByBook.response,
          { bookId }
        ),
      get: (id) =>
        invokeContract<ChapterRecord | null>(
          invoke,
          IPC_CONTRACTS.chapters.get.channel,
          IPC_CONTRACTS.chapters.get.response,
          { id }
        ),
      create: (input) =>
        invokeContract<ChapterRecord>(
          invoke,
          IPC_CONTRACTS.chapters.create.channel,
          IPC_CONTRACTS.chapters.create.response,
          input
        ),
      setStatus: (id, status) =>
        invokeContract<ChapterRecord | null>(
          invoke,
          IPC_CONTRACTS.chapters.setStatus.channel,
          IPC_CONTRACTS.chapters.setStatus.response,
          { id, status }
        )
    },
    manuscripts: {
      listVersions: (chapterId) =>
        invokeContract<ManuscriptVersionRecord[]>(
          invoke,
          IPC_CONTRACTS.manuscripts.listVersions.channel,
          IPC_CONTRACTS.manuscripts.listVersions.response,
          { chapterId }
        ),
      getCanonical: (chapterId) =>
        invokeContract<ManuscriptVersionRecord | null>(
          invoke,
          IPC_CONTRACTS.manuscripts.getCanonical.channel,
          IPC_CONTRACTS.manuscripts.getCanonical.response,
          { chapterId }
        ),
      saveManualVersion: (input) =>
        invokeContract<ManuscriptVersionRecord>(
          invoke,
          IPC_CONTRACTS.manuscripts.saveManualVersion.channel,
          IPC_CONTRACTS.manuscripts.saveManualVersion.response,
          input
        ),
      rollback: (chapterId, versionId, confirmed) =>
        invokeContract<ManuscriptVersionRecord>(
          invoke,
          IPC_CONTRACTS.manuscripts.rollback.channel,
          IPC_CONTRACTS.manuscripts.rollback.response,
          { chapterId, versionId, confirmed }
        )
    },
    storyBible: {
      entries: {
        list: (bookId) =>
          invokeContract<StoryBibleEntryRecord[]>(
            invoke,
            IPC_CONTRACTS.storyBible.entries.list.channel,
            IPC_CONTRACTS.storyBible.entries.list.response,
            { bookId }
          ),
        create: (input) =>
          invokeContract<StoryBibleEntryRecord>(
            invoke,
            IPC_CONTRACTS.storyBible.entries.create.channel,
            IPC_CONTRACTS.storyBible.entries.create.response,
            input
          )
      }
    },
    memory: {
      search: (bookId, query) =>
        invokeContract<MemorySearchResult[]>(
          invoke,
          IPC_CONTRACTS.memory.search.channel,
          IPC_CONTRACTS.memory.search.response,
          { bookId, query }
        )
    },
    credentials: {
      list: () =>
        invokeContract<ProviderCredentialDto[]>(
          invoke,
          IPC_CONTRACTS.credentials.list.channel,
          IPC_CONTRACTS.credentials.list.response
        ),
      save: (input) =>
        invokeContract<ProviderCredentialDto>(
          invoke,
          IPC_CONTRACTS.credentials.save.channel,
          IPC_CONTRACTS.credentials.save.response,
          input
        ),
      delete: (id, confirmed) =>
        invokeContract<boolean>(
          invoke,
          IPC_CONTRACTS.credentials.delete.channel,
          IPC_CONTRACTS.credentials.delete.response,
          { id, confirmed }
        ),
      getStatus: (id) =>
        invokeContract<CredentialStatusDto>(
          invoke,
          IPC_CONTRACTS.credentials.getStatus.channel,
          IPC_CONTRACTS.credentials.getStatus.response,
          { id }
        ),
      testConnection: (id) =>
        invokeContract<CredentialTestResult>(
          invoke,
          IPC_CONTRACTS.credentials.testConnection.channel,
          IPC_CONTRACTS.credentials.testConnection.response,
          { id }
        ),
      updateBaseUrl: (id, baseUrl) =>
        invokeContract<ProviderCredentialDto | null>(
          invoke,
          IPC_CONTRACTS.credentials.updateBaseUrl.channel,
          IPC_CONTRACTS.credentials.updateBaseUrl.response,
          { id, baseUrl }
        )
    },
    modelProfiles: {
      list: () =>
        invokeContract<ModelProfileRecord[]>(
          invoke,
          IPC_CONTRACTS.modelProfiles.list.channel,
          IPC_CONTRACTS.modelProfiles.list.response
        ),
      upsert: (input) =>
        invokeContract<ModelProfileRecord>(
          invoke,
          IPC_CONTRACTS.modelProfiles.upsert.channel,
          IPC_CONTRACTS.modelProfiles.upsert.response,
          input
        )
    },
    modelPrices: {
      list: () =>
        invokeContract<ModelPriceRecord[]>(
          invoke,
          IPC_CONTRACTS.modelPrices.list.channel,
          IPC_CONTRACTS.modelPrices.list.response
        ),
      upsert: (input) =>
        invokeContract<ModelPriceRecord>(
          invoke,
          IPC_CONTRACTS.modelPrices.upsert.channel,
          IPC_CONTRACTS.modelPrices.upsert.response,
          input
        )
    },
    taskRoutes: {
      list: () =>
        invokeContract<TaskRouteRecord[]>(
          invoke,
          IPC_CONTRACTS.taskRoutes.list.channel,
          IPC_CONTRACTS.taskRoutes.list.response
        ),
      upsert: (input) =>
        invokeContract<TaskRouteRecord>(
          invoke,
          IPC_CONTRACTS.taskRoutes.upsert.channel,
          IPC_CONTRACTS.taskRoutes.upsert.response,
          input
        ),
      resolve: (taskType: TaskType, qualityMode: QualityMode) =>
        invokeContract<ModelRouteResolution>(
          invoke,
          IPC_CONTRACTS.taskRoutes.resolve.channel,
          IPC_CONTRACTS.taskRoutes.resolve.response,
          { taskType, qualityMode }
        )
    },
    privacy: {
      get: () =>
        invokeContract<PrivacySettings>(
          invoke,
          IPC_CONTRACTS.privacy.get.channel,
          IPC_CONTRACTS.privacy.get.response
        ),
      update: (input) =>
        invokeContract<PrivacySettings>(
          invoke,
          IPC_CONTRACTS.privacy.update.channel,
          IPC_CONTRACTS.privacy.update.response,
          input
        )
    },
    routingSettings: {
      get: () =>
        invokeContract<RoutingSettings>(
          invoke,
          IPC_CONTRACTS.routingSettings.get.channel,
          IPC_CONTRACTS.routingSettings.get.response
        ),
      update: (input) =>
        invokeContract<RoutingSettings>(
          invoke,
          IPC_CONTRACTS.routingSettings.update.channel,
          IPC_CONTRACTS.routingSettings.update.response,
          input
        )
    },
    ai: {
      stream: {
        start: (request) =>
          invokeContract<StreamStartResult>(
            invoke,
            IPC_CONTRACTS.ai.stream.start.channel,
            IPC_CONTRACTS.ai.stream.start.response,
            request
          ),
        abort: (runId) =>
          invokeContract<boolean>(
            invoke,
            IPC_CONTRACTS.ai.stream.abort.channel,
            IPC_CONTRACTS.ai.stream.abort.response,
            { id: runId }
          ),
        onEvent: (listener) =>
          subscribe(AI_STREAM_EVENT_CHANNEL, (_event, value) => {
            listener(aiStreamEventSchema.parse(value));
          })
      },
      runs: {
        get: (runId) =>
          invokeContract<LLMRunRecord | null>(
            invoke,
            IPC_CONTRACTS.ai.runs.get.channel,
            IPC_CONTRACTS.ai.runs.get.response,
            { runId }
          ),
        listByChapter: (chapterId) =>
          invokeContract<LLMRunRecord[]>(
            invoke,
            IPC_CONTRACTS.ai.runs.listByChapter.channel,
            IPC_CONTRACTS.ai.runs.listByChapter.response,
            { chapterId }
          )
      },
      costs: {
        summary: (request) =>
          invokeContract<CostSummary>(
            invoke,
            IPC_CONTRACTS.ai.costs.summary.channel,
            IPC_CONTRACTS.ai.costs.summary.response,
            request
          )
      }
    }
  };
}

export { IPC_CONTRACTS };

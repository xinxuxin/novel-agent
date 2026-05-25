import type { WenForgeApi } from "@contracts/preload";
import type {
  BookRecord,
  ChapterRecord,
  ManuscriptVersionRecord,
  MemorySearchResult,
  ProjectRecord,
  StoryBibleEntryRecord,
  VolumeRecord
} from "@contracts/data";
import { IPC_CONTRACTS, ipcEnvelopeSchema } from "@shared/ipc/contracts";
import { normalizeTheme } from "@shared/theme";
import type { ThemePreference } from "@shared/theme";
import type { z } from "zod";

export type IpcInvoker = (channel: string, value?: unknown) => Promise<unknown>;

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

export function createPreloadApi(invoke: IpcInvoker): WenForgeApi {
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
    }
  };
}

export { IPC_CONTRACTS };

import { BrowserWindow, app, ipcMain } from "electron";

import { AI_STREAM_EVENT_CHANNEL } from "@contracts/ai";
import { IPC_CONTRACT_LIST, IPC_CONTRACTS } from "@shared/ipc/contracts";
import { normalizeTheme } from "@shared/theme";
import type { SettingsStore } from "@main/app/settings-store";
import type { StudioModeController } from "@main/app/studio-mode";
import type { AiGateway } from "@main/ai/ai-gateway";
import type { RepositoryRegistry } from "@main/db/service";
import type { CredentialService } from "@main/providers/credential-service";
import { ModelRouter } from "@main/providers/model-router";
import { getEnvironment } from "@main/platform/environment";
import { SafeIpcError } from "./typed-ipc";
import { registerIpcContract } from "./typed-ipc";
import { DEFAULT_PRIVACY_SETTINGS, DEFAULT_ROUTING_SETTINGS } from "@contracts/settings";
import type { PrivacySettings, RoutingSettings } from "@contracts/settings";

interface RegisterIpcOptions {
  settingsStore: SettingsStore;
  studioModeController: StudioModeController;
  repositories?: RepositoryRegistry;
  credentialService?: CredentialService;
  aiGateway?: AiGateway;
}

export function registerIpc({
  settingsStore,
  studioModeController,
  repositories,
  credentialService,
  aiGateway
}: RegisterIpcOptions): void {
  for (const contract of IPC_CONTRACT_LIST) {
    ipcMain.removeHandler(contract.channel);
  }

  registerIpcContract(IPC_CONTRACTS.app.getVersion, () => app.getVersion());
  registerIpcContract(IPC_CONTRACTS.app.getPlatform, () => process.platform);
  registerIpcContract(IPC_CONTRACTS.app.getEnvironment, () => getEnvironment(app));

  registerIpcContract(IPC_CONTRACTS.window.minimize, (_request, event) => {
    BrowserWindow.fromWebContents(event.sender)?.minimize();
    return undefined;
  });

  registerIpcContract(IPC_CONTRACTS.window.close, (_request, event) => {
    BrowserWindow.fromWebContents(event.sender)?.close();
    return undefined;
  });

  registerIpcContract(IPC_CONTRACTS.window.toggleStudioMode, (_request, event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    return studioModeController.toggle(window ?? undefined);
  });

  registerIpcContract(IPC_CONTRACTS.settings.getTheme, () => settingsStore.getTheme());
  registerIpcContract(IPC_CONTRACTS.settings.setTheme, (request) =>
    settingsStore.setTheme(normalizeTheme(request.theme))
  );

  registerIpcContract(IPC_CONTRACTS.diagnostics.ping, () => ({
    ok: true as const,
    at: new Date().toISOString()
  }));

  if (repositories) {
    registerDataIpc(repositories, credentialService, aiGateway);
  }
}

function requireConfirmation(confirmed: boolean | undefined): void {
  if (!confirmed) {
    throw new SafeIpcError("CONFIRMATION_REQUIRED", "Confirmation is required");
  }
}

function registerDataIpc(
  repositories: RepositoryRegistry,
  credentialService?: CredentialService,
  aiGateway?: AiGateway
): void {
  registerIpcContract(IPC_CONTRACTS.projects.list, () => repositories.projects.list());
  registerIpcContract(IPC_CONTRACTS.projects.get, (request) =>
    repositories.projects.get(request.id)
  );
  registerIpcContract(IPC_CONTRACTS.projects.create, (request) =>
    repositories.projects.create(request)
  );
  registerIpcContract(IPC_CONTRACTS.projects.update, (request) =>
    repositories.projects.update(
      request.id,
      request as Parameters<typeof repositories.projects.update>[1]
    )
  );
  registerIpcContract(IPC_CONTRACTS.projects.delete, (request) => {
    requireConfirmation(request.confirmed);
    return repositories.projects.delete(request.id, true);
  });

  registerIpcContract(IPC_CONTRACTS.books.listByProject, (request) =>
    repositories.books.listByProject(request.projectId)
  );
  registerIpcContract(IPC_CONTRACTS.books.get, (request) => repositories.books.get(request.id));
  registerIpcContract(IPC_CONTRACTS.books.create, (request) => repositories.books.create(request));
  registerIpcContract(IPC_CONTRACTS.books.update, (request) =>
    repositories.books.update(
      request.id,
      request as Parameters<typeof repositories.books.update>[1]
    )
  );
  registerIpcContract(IPC_CONTRACTS.books.delete, (request) => {
    requireConfirmation(request.confirmed);
    return repositories.books.delete(request.id, true);
  });

  registerIpcContract(IPC_CONTRACTS.volumes.listByBook, (request) =>
    repositories.volumes.listByBook(request.bookId)
  );
  registerIpcContract(IPC_CONTRACTS.volumes.create, (request) =>
    repositories.volumes.create(request)
  );
  registerIpcContract(IPC_CONTRACTS.volumes.update, (request) =>
    repositories.volumes.update(
      request.id,
      request as Parameters<typeof repositories.volumes.update>[1]
    )
  );
  registerIpcContract(IPC_CONTRACTS.volumes.delete, (request) => {
    requireConfirmation(request.confirmed);
    return repositories.volumes.delete(request.id, true);
  });

  registerIpcContract(IPC_CONTRACTS.chapters.listByBook, (request) =>
    repositories.chapters.listByBook(request.bookId)
  );
  registerIpcContract(IPC_CONTRACTS.chapters.get, (request) =>
    repositories.chapters.get(request.id)
  );
  registerIpcContract(IPC_CONTRACTS.chapters.create, (request) =>
    repositories.chapters.create(request)
  );
  registerIpcContract(IPC_CONTRACTS.chapters.update, (request) =>
    repositories.chapters.update(
      request.id,
      request as Parameters<typeof repositories.chapters.update>[1]
    )
  );
  registerIpcContract(IPC_CONTRACTS.chapters.reorder, (request) => {
    repositories.chapters.reorder(request.bookId, request.orderedChapterIds);
    return undefined;
  });
  registerIpcContract(IPC_CONTRACTS.chapters.setStatus, (request) =>
    repositories.chapters.setStatus(request.id, request.status)
  );
  registerIpcContract(IPC_CONTRACTS.chapters.delete, (request) => {
    requireConfirmation(request.confirmed);
    return repositories.chapters.delete(request.id, true);
  });

  registerIpcContract(IPC_CONTRACTS.manuscripts.listVersions, (request) =>
    repositories.manuscripts.listVersions(request.chapterId)
  );
  registerIpcContract(IPC_CONTRACTS.manuscripts.getVersion, (request) =>
    repositories.manuscripts.getVersion(request.id)
  );
  registerIpcContract(IPC_CONTRACTS.manuscripts.getCanonical, (request) =>
    repositories.manuscripts.getCanonical(request.chapterId)
  );
  registerIpcContract(IPC_CONTRACTS.manuscripts.saveManualVersion, (request) =>
    repositories.manuscripts.saveManualVersion(request)
  );
  registerIpcContract(IPC_CONTRACTS.manuscripts.setCanonical, (request) =>
    repositories.manuscripts.setCanonical(request.chapterId, request.versionId)
  );
  registerIpcContract(IPC_CONTRACTS.manuscripts.rollback, (request) => {
    requireConfirmation(request.confirmed);
    return repositories.manuscripts.rollback(request.chapterId, request.versionId);
  });

  registerIpcContract(IPC_CONTRACTS.storyBible.entries.list, (request) =>
    repositories.storyBible.list(request.bookId)
  );
  registerIpcContract(IPC_CONTRACTS.storyBible.entries.create, (request) =>
    repositories.storyBible.createEntry(request)
  );
  registerIpcContract(IPC_CONTRACTS.storyBible.entries.update, (request) =>
    repositories.storyBible.update(
      request.id,
      request as Parameters<typeof repositories.storyBible.update>[1]
    )
  );
  registerIpcContract(IPC_CONTRACTS.storyBible.entries.delete, (request) => {
    requireConfirmation(request.confirmed);
    return repositories.storyBible.delete(request.id, true);
  });

  registerIpcContract(IPC_CONTRACTS.dataSettings.get, (request) =>
    repositories.settings.get(request.key)
  );
  registerIpcContract(IPC_CONTRACTS.dataSettings.set, (request) => {
    repositories.settings.set(request.key, request.value);
    return undefined;
  });
  registerIpcContract(IPC_CONTRACTS.memory.search, (request) =>
    repositories.memory.search(request.bookId, request.query)
  );

  if (credentialService) {
    registerIpcContract(IPC_CONTRACTS.credentials.list, () => credentialService.listCredentials());
    registerIpcContract(IPC_CONTRACTS.credentials.save, (request) =>
      credentialService.saveCredential(
        request as Parameters<typeof credentialService.saveCredential>[0]
      )
    );
    registerIpcContract(IPC_CONTRACTS.credentials.delete, (request) => {
      requireConfirmation(request.confirmed);
      return credentialService.deleteCredential(request.id, true);
    });
    registerIpcContract(IPC_CONTRACTS.credentials.getStatus, (request) =>
      credentialService.getStatus(request.id)
    );
    registerIpcContract(IPC_CONTRACTS.credentials.testConnection, (request) =>
      credentialService.testConnection(request.id)
    );
    registerIpcContract(IPC_CONTRACTS.credentials.updateBaseUrl, (request) =>
      credentialService.updateBaseUrl(request.id, request.baseUrl)
    );
  }

  registerIpcContract(IPC_CONTRACTS.modelProfiles.list, () => repositories.modelProfiles.list());
  registerIpcContract(IPC_CONTRACTS.modelProfiles.upsert, (request) =>
    repositories.modelProfiles.upsert(
      request as Parameters<typeof repositories.modelProfiles.upsert>[0]
    )
  );
  registerIpcContract(IPC_CONTRACTS.modelPrices.list, () => repositories.modelPrices.list());
  registerIpcContract(IPC_CONTRACTS.modelPrices.upsert, (request) =>
    repositories.modelPrices.upsert(
      request as Parameters<typeof repositories.modelPrices.upsert>[0]
    )
  );
  registerIpcContract(IPC_CONTRACTS.taskRoutes.list, () => repositories.taskRoutes.list());
  registerIpcContract(IPC_CONTRACTS.taskRoutes.upsert, (request) =>
    repositories.taskRoutes.upsert(request as Parameters<typeof repositories.taskRoutes.upsert>[0])
  );
  registerIpcContract(IPC_CONTRACTS.taskRoutes.resolve, (request) => {
    const routingSettings = getRoutingSettings(repositories);
    return new ModelRouter({
      credentials: repositories.providerCredentials,
      modelProfiles: repositories.modelProfiles,
      prices: repositories.modelPrices,
      routes: repositories.taskRoutes,
      settings: routingSettings
    }).resolveRoute(request.taskType, request.qualityMode);
  });
  registerIpcContract(IPC_CONTRACTS.privacy.get, () => getPrivacySettings(repositories));
  registerIpcContract(IPC_CONTRACTS.privacy.update, (request) => {
    const next = {
      ...getPrivacySettings(repositories),
      ...withoutUndefined(request)
    } as PrivacySettings;
    repositories.settings.set("privacy", next);
    return next;
  });
  registerIpcContract(IPC_CONTRACTS.routingSettings.get, () => getRoutingSettings(repositories));
  registerIpcContract(IPC_CONTRACTS.routingSettings.update, (request) => {
    const next = {
      ...getRoutingSettings(repositories),
      ...withoutUndefined(request)
    } as RoutingSettings;
    repositories.settings.set("routing", next);
    return next;
  });

  if (aiGateway) {
    registerIpcContract(IPC_CONTRACTS.ai.stream.start, (request, event) =>
      aiGateway.startStream(request, (streamEvent) => {
        if (!event.sender.isDestroyed()) {
          event.sender.send(AI_STREAM_EVENT_CHANNEL, streamEvent);
        }
      })
    );
    registerIpcContract(IPC_CONTRACTS.ai.stream.abort, (request) => aiGateway.abortRun(request.id));
  }
  registerIpcContract(IPC_CONTRACTS.ai.runs.get, (request) =>
    repositories.cost.getRun(request.runId)
  );
  registerIpcContract(IPC_CONTRACTS.ai.runs.listByChapter, (request) =>
    repositories.cost.listRunsByChapter(request.chapterId)
  );
  registerIpcContract(IPC_CONTRACTS.ai.costs.summary, (request) =>
    repositories.cost.summarizeRuns(request)
  );
}

function withoutUndefined<T extends Record<string, unknown>>(value: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(value).filter(([, entryValue]) => typeof entryValue !== "undefined")
  ) as Partial<T>;
}

function getPrivacySettings(repositories: RepositoryRegistry): PrivacySettings {
  return repositories.settings.get<PrivacySettings>("privacy") ?? DEFAULT_PRIVACY_SETTINGS;
}

function getRoutingSettings(repositories: RepositoryRegistry): RoutingSettings {
  return repositories.settings.get<RoutingSettings>("routing") ?? DEFAULT_ROUTING_SETTINGS;
}

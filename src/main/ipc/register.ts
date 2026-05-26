import { BrowserWindow, app, ipcMain, safeStorage } from "electron";

import { AI_STREAM_EVENT_CHANNEL } from "@contracts/ai";
import { IPC_CONTRACT_LIST, IPC_CONTRACTS } from "@shared/ipc/contracts";
import { normalizeTheme } from "@shared/theme";
import {
  exportDiagnosticsBundle,
  readLatestMigrationVersion
} from "@main/diagnostics/diagnostics-service";
import type { SettingsStore } from "@main/app/settings-store";
import type { StudioModeController } from "@main/app/studio-mode";
import type { AiGateway } from "@main/ai/ai-gateway";
import type { ProviderAdapter } from "@main/ai/provider-adapter";
import { CostDashboardService, PricingRegistryService } from "@main/costs/cost-dashboard-service";
import { CostForecastService } from "@main/costs/cost-forecast-service";
import type { WenForgeDatabase } from "@main/db/connection";
import type { RepositoryRegistry } from "@main/db/service";
import { EvaluationService } from "@main/eval/evaluation-service";
import { ProviderChapterCheckService } from "@main/e2e/provider-chapter-check-service";
import { BackupService } from "@main/files/backup-service";
import { ImportExportService } from "@main/files/import-export-service";
import { ContextBuilder } from "@main/context/context-builder";
import type { StructuredLogger } from "@main/logging/logger";
import { MemoryIndexService } from "@main/memory/memory-index-service";
import type { CredentialService } from "@main/providers/credential-service";
import { ModelRouter } from "@main/providers/model-router";
import {
  applyPremiumWebnovelPreset,
  exportPremiumWebnovelPreset,
  importPremiumWebnovelPreset
} from "@main/providers/premium-webnovel-preset";
import { ProviderSmokeService } from "@main/providers/provider-smoke-service";
import { readLatestProviderCheckReport } from "@main/providers/provider-check-service";
import { ReviewSettlementService } from "@main/review/review-settlement-service";
import { ChapterWorkflowRuntime } from "@main/workflows/chapter-workflow-runtime";
import { CrossCheckService } from "@main/workflows/cross-check-service";
import { getEnvironment } from "@main/platform/environment";
import { SafeIpcError } from "./safe-ipc-error";
import { registerIpcContract } from "./typed-ipc";
import { DEFAULT_PRIVACY_SETTINGS, DEFAULT_ROUTING_SETTINGS } from "@contracts/settings";
import type { PrivacySettings, RoutingSettings } from "@contracts/settings";
import type { UpdateBudgetPolicyInput } from "@contracts/budgets";
import type { BackupSettings } from "@contracts/import-export";
import type { RoutePreviewContext } from "@contracts/model-routing";

interface RegisterIpcOptions {
  settingsStore: SettingsStore;
  studioModeController: StudioModeController;
  repositories?: RepositoryRegistry;
  database?: WenForgeDatabase;
  credentialService?: CredentialService;
  aiGateway?: AiGateway;
  providerAdapters?: ProviderAdapter[];
  logger?: StructuredLogger;
}

export function registerIpc({
  settingsStore,
  studioModeController,
  repositories,
  database,
  credentialService,
  aiGateway,
  providerAdapters = [],
  logger
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
  registerIpcContract(IPC_CONTRACTS.diagnostics.exportBundle, (request) =>
    exportDiagnosticsBundle({
      appVersion: app.getVersion(),
      platform: process.platform,
      environment: getEnvironment(app).mode,
      dbMigrationVersion: database ? readLatestMigrationVersion(database.sqlite) : "unavailable",
      safeStorageAvailable: safeStorage.isEncryptionAvailable(),
      providerHealth: repositories?.providerHealth.list() ?? [],
      recentErrors:
        logger
          ?.recent(200)
          .filter((line) => line.includes('"level":"error"'))
          .slice(-25) ?? [],
      logs: logger?.recent(200) ?? [],
      settings: repositories
        ? {
            privacy: getPrivacySettings(repositories),
            routing: getRoutingSettings(repositories),
            backup: repositories.settings.get("backup_settings")
          }
        : {},
      providerCheckSummary:
        repositories?.providerCredentials.list().map((credential) => ({
          provider: credential.provider,
          configured: credential.isConfigured,
          lastStatus: credential.lastStatus,
          lastTestedAt: credential.lastTestedAt
        })) ?? [],
      costAccountingSummary: repositories?.cost.summarizeRuns({}) ?? {},
      includeManuscripts: request?.includeManuscripts === true
    })
  );

  if (repositories) {
    registerDataIpc(repositories, credentialService, aiGateway, database, providerAdapters);
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
  aiGateway?: AiGateway,
  database?: WenForgeDatabase,
  providerAdapters: ProviderAdapter[] = []
): void {
  const workflowRuntime = database
    ? new ChapterWorkflowRuntime({
        database,
        repositories,
        aiGateway,
        credentialService,
        privacy: getPrivacySettings(repositories)
      })
    : null;
  const reviewSettlementService = database
    ? new ReviewSettlementService({ database, repositories })
    : null;
  const costDashboardService = database
    ? new CostDashboardService({
        database,
        repositories,
        priceStaleAfterDays: getRoutingSettings(repositories).priceStaleAfterDays
      })
    : null;
  const pricingRegistryService = database
    ? new PricingRegistryService({ database, repositories })
    : null;
  const costForecastService = database ? new CostForecastService({ repositories }) : null;
  const evaluationService = database
    ? new EvaluationService({
        database,
        repositories,
        aiGateway
      })
    : null;
  const importExportService = database
    ? new ImportExportService({
        database,
        repositories,
        userDataDir: app.getPath("userData")
      })
    : null;
  const backupService = database
    ? new BackupService({
        database,
        repositories,
        userDataDir: app.getPath("userData")
      })
    : null;
  const providerSmokeService =
    aiGateway && providerAdapters.length > 0
      ? new ProviderSmokeService({
          repositories,
          aiGateway,
          adapters: providerAdapters
        })
      : null;
  const providerChapterCheckService =
    aiGateway && database
      ? new ProviderChapterCheckService({
          database,
          repositories,
          aiGateway,
          credentialService,
          privacy: getPrivacySettings(repositories),
          appVersion: app.getVersion()
        })
      : null;
  const crossCheckService =
    aiGateway && database
      ? new CrossCheckService({
          repositories,
          aiGateway
        })
      : null;
  evaluationService?.ensureBuiltInSuite();
  evaluationService?.ensureRouteEvalSuite();

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
  registerIpcContract(IPC_CONTRACTS.storyBible.characters.list, (request) =>
    repositories.storyBible.listCharacters(
      request as Parameters<typeof repositories.storyBible.listCharacters>[0]
    )
  );
  registerIpcContract(IPC_CONTRACTS.storyBible.characters.create, (request) =>
    repositories.storyBible.createCharacter(
      request as Parameters<typeof repositories.storyBible.createCharacter>[0]
    )
  );
  registerIpcContract(IPC_CONTRACTS.storyBible.characters.update, (request) =>
    repositories.storyBible.updateCharacter(
      request.id,
      request as Parameters<typeof repositories.storyBible.updateCharacter>[1]
    )
  );
  registerIpcContract(IPC_CONTRACTS.storyBible.characters.delete, (request) => {
    requireConfirmation(request.confirmed);
    return repositories.storyBible.deleteCharacter(request.id, true);
  });

  registerIpcContract(IPC_CONTRACTS.storyBible.factions.list, (request) =>
    repositories.storyBible.listFactions(
      request as Parameters<typeof repositories.storyBible.listFactions>[0]
    )
  );
  registerIpcContract(IPC_CONTRACTS.storyBible.factions.create, (request) =>
    repositories.storyBible.createFaction(
      request as Parameters<typeof repositories.storyBible.createFaction>[0]
    )
  );
  registerIpcContract(IPC_CONTRACTS.storyBible.factions.update, (request) =>
    repositories.storyBible.updateFaction(
      request.id,
      request as Parameters<typeof repositories.storyBible.updateFaction>[1]
    )
  );
  registerIpcContract(IPC_CONTRACTS.storyBible.factions.delete, (request) => {
    requireConfirmation(request.confirmed);
    return repositories.storyBible.deleteFaction(request.id, true);
  });

  registerIpcContract(IPC_CONTRACTS.storyBible.locations.list, (request) =>
    repositories.storyBible.listLocations(
      request as Parameters<typeof repositories.storyBible.listLocations>[0]
    )
  );
  registerIpcContract(IPC_CONTRACTS.storyBible.locations.create, (request) =>
    repositories.storyBible.createLocation(
      request as Parameters<typeof repositories.storyBible.createLocation>[0]
    )
  );
  registerIpcContract(IPC_CONTRACTS.storyBible.locations.update, (request) =>
    repositories.storyBible.updateLocation(
      request.id,
      request as Parameters<typeof repositories.storyBible.updateLocation>[1]
    )
  );
  registerIpcContract(IPC_CONTRACTS.storyBible.locations.delete, (request) => {
    requireConfirmation(request.confirmed);
    return repositories.storyBible.deleteLocation(request.id, true);
  });

  registerIpcContract(IPC_CONTRACTS.storyBible.artifacts.list, (request) =>
    repositories.storyBible.listArtifacts(
      request as Parameters<typeof repositories.storyBible.listArtifacts>[0]
    )
  );
  registerIpcContract(IPC_CONTRACTS.storyBible.artifacts.create, (request) =>
    repositories.storyBible.createArtifact(
      request as Parameters<typeof repositories.storyBible.createArtifact>[0]
    )
  );
  registerIpcContract(IPC_CONTRACTS.storyBible.artifacts.update, (request) =>
    repositories.storyBible.updateArtifact(
      request.id,
      request as Parameters<typeof repositories.storyBible.updateArtifact>[1]
    )
  );
  registerIpcContract(IPC_CONTRACTS.storyBible.artifacts.delete, (request) => {
    requireConfirmation(request.confirmed);
    return repositories.storyBible.deleteArtifact(request.id, true);
  });

  registerIpcContract(IPC_CONTRACTS.storyBible.powerSystem.list, (request) =>
    repositories.storyBible.listPowerSystem(
      request as Parameters<typeof repositories.storyBible.listPowerSystem>[0]
    )
  );
  registerIpcContract(IPC_CONTRACTS.storyBible.powerSystem.create, (request) =>
    repositories.storyBible.createPowerSystemRule(
      request as Parameters<typeof repositories.storyBible.createPowerSystemRule>[0]
    )
  );
  registerIpcContract(IPC_CONTRACTS.storyBible.powerSystem.update, (request) =>
    repositories.storyBible.updatePowerSystemRule(
      request.id,
      request as Parameters<typeof repositories.storyBible.updatePowerSystemRule>[1]
    )
  );
  registerIpcContract(IPC_CONTRACTS.storyBible.powerSystem.delete, (request) => {
    requireConfirmation(request.confirmed);
    return repositories.storyBible.deletePowerSystemRule(request.id, true);
  });

  registerIpcContract(IPC_CONTRACTS.storyBible.timeline.list, (request) =>
    repositories.storyBible.listTimeline(
      request as Parameters<typeof repositories.storyBible.listTimeline>[0]
    )
  );
  registerIpcContract(IPC_CONTRACTS.storyBible.timeline.create, (request) =>
    repositories.storyBible.createTimelineEvent(
      request as Parameters<typeof repositories.storyBible.createTimelineEvent>[0]
    )
  );
  registerIpcContract(IPC_CONTRACTS.storyBible.timeline.update, (request) =>
    repositories.storyBible.updateTimelineEvent(
      request.id,
      request as Parameters<typeof repositories.storyBible.updateTimelineEvent>[1]
    )
  );
  registerIpcContract(IPC_CONTRACTS.storyBible.timeline.delete, (request) => {
    requireConfirmation(request.confirmed);
    return repositories.storyBible.deleteTimelineEvent(request.id, true);
  });

  registerIpcContract(IPC_CONTRACTS.storyBible.foreshadowing.list, (request) =>
    repositories.storyBible.listForeshadowing(
      request as Parameters<typeof repositories.storyBible.listForeshadowing>[0]
    )
  );
  registerIpcContract(IPC_CONTRACTS.storyBible.foreshadowing.create, (request) =>
    repositories.storyBible.createForeshadowing(
      request as Parameters<typeof repositories.storyBible.createForeshadowing>[0]
    )
  );
  registerIpcContract(IPC_CONTRACTS.storyBible.foreshadowing.update, (request) =>
    repositories.storyBible.updateForeshadowing(
      request.id,
      request as Parameters<typeof repositories.storyBible.updateForeshadowing>[1]
    )
  );
  registerIpcContract(IPC_CONTRACTS.storyBible.foreshadowing.delete, (request) => {
    requireConfirmation(request.confirmed);
    return repositories.storyBible.deleteForeshadowing(request.id, true);
  });

  registerIpcContract(IPC_CONTRACTS.storyBible.hooks.list, (request) =>
    repositories.storyBible.listHooks(
      request as Parameters<typeof repositories.storyBible.listHooks>[0]
    )
  );
  registerIpcContract(IPC_CONTRACTS.storyBible.hooks.create, (request) =>
    repositories.storyBible.createUnresolvedHook(
      request as Parameters<typeof repositories.storyBible.createUnresolvedHook>[0]
    )
  );
  registerIpcContract(IPC_CONTRACTS.storyBible.hooks.update, (request) =>
    repositories.storyBible.updateUnresolvedHook(
      request.id,
      request as Parameters<typeof repositories.storyBible.updateUnresolvedHook>[1]
    )
  );
  registerIpcContract(IPC_CONTRACTS.storyBible.hooks.delete, (request) => {
    requireConfirmation(request.confirmed);
    return repositories.storyBible.deleteUnresolvedHook(request.id, true);
  });

  registerIpcContract(IPC_CONTRACTS.storyBible.styleGuide.list, (request) =>
    repositories.storyBible.listStyleGuides(
      request as Parameters<typeof repositories.storyBible.listStyleGuides>[0]
    )
  );
  registerIpcContract(IPC_CONTRACTS.storyBible.styleGuide.create, (request) =>
    repositories.storyBible.createStyleGuide(
      request as Parameters<typeof repositories.storyBible.createStyleGuide>[0]
    )
  );
  registerIpcContract(IPC_CONTRACTS.storyBible.styleGuide.update, (request) =>
    repositories.storyBible.updateStyleGuide(
      request.id,
      request as Parameters<typeof repositories.storyBible.updateStyleGuide>[1]
    )
  );
  registerIpcContract(IPC_CONTRACTS.storyBible.styleGuide.delete, (request) => {
    requireConfirmation(request.confirmed);
    return repositories.storyBible.deleteStyleGuide(request.id, true);
  });

  registerIpcContract(IPC_CONTRACTS.storyBible.readerPositioning.list, (request) =>
    repositories.storyBible.listReaderPositioning(
      request as Parameters<typeof repositories.storyBible.listReaderPositioning>[0]
    )
  );
  registerIpcContract(IPC_CONTRACTS.storyBible.readerPositioning.create, (request) =>
    repositories.storyBible.createReaderPositioning(
      request as Parameters<typeof repositories.storyBible.createReaderPositioning>[0]
    )
  );
  registerIpcContract(IPC_CONTRACTS.storyBible.readerPositioning.update, (request) =>
    repositories.storyBible.updateReaderPositioning(
      request.id,
      request as Parameters<typeof repositories.storyBible.updateReaderPositioning>[1]
    )
  );
  registerIpcContract(IPC_CONTRACTS.storyBible.readerPositioning.delete, (request) => {
    requireConfirmation(request.confirmed);
    return repositories.storyBible.deleteReaderPositioning(request.id, true);
  });

  registerIpcContract(IPC_CONTRACTS.dataSettings.get, (request) =>
    repositories.settings.get(request.key)
  );
  registerIpcContract(IPC_CONTRACTS.dataSettings.set, (request) => {
    repositories.settings.set(request.key, request.value);
    return undefined;
  });
  registerIpcContract(IPC_CONTRACTS.memory.search, (request) =>
    repositories.memory.searchRelevant(
      request as Parameters<typeof repositories.memory.searchRelevant>[0]
    )
  );
  registerIpcContract(IPC_CONTRACTS.memory.rebuildBookIndex, (request) => {
    if (!database) {
      throw new SafeIpcError("DATABASE_UNAVAILABLE", "Database is not available");
    }
    new MemoryIndexService(repositories).rebuildBookIndex(request.bookId);
    return undefined;
  });
  registerIpcContract(IPC_CONTRACTS.context.previewForChapter, (request) => {
    if (!database) {
      throw new SafeIpcError("DATABASE_UNAVAILABLE", "Database is not available");
    }
    return new ContextBuilder(database, repositories).previewForChapter({
      ...request,
      privacy: request.privacy ?? getPrivacySettings(repositories)
    } as Parameters<ContextBuilder["previewForChapter"]>[0]);
  });

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
  registerIpcContract(IPC_CONTRACTS.modelPrices.listTiers, (request) =>
    repositories.modelPriceTiers.list(request ?? {})
  );
  registerIpcContract(IPC_CONTRACTS.modelPrices.upsertTier, (request) =>
    repositories.modelPriceTiers.upsert(request)
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
      priceTiers: repositories.modelPriceTiers,
      routes: repositories.taskRoutes,
      providerHealth: repositories.providerHealth,
      settings: routingSettings
    }).resolveRoute(request.taskType, request.qualityMode);
  });
  registerIpcContract(IPC_CONTRACTS.modelRoutes.resolvePreview, (request) => {
    const routingSettings = getRoutingSettings(repositories);
    const context = withoutUndefined({
      chapterImportance: request.chapterImportance,
      budgetMode: request.budgetMode,
      expectedTokens: request.expectedTokens,
      userOverrideModelProfileId: request.userOverrideModelProfileId
    }) as RoutePreviewContext;
    return new ModelRouter({
      credentials: repositories.providerCredentials,
      modelProfiles: repositories.modelProfiles,
      prices: repositories.modelPrices,
      priceTiers: repositories.modelPriceTiers,
      routes: repositories.taskRoutes,
      providerHealth: repositories.providerHealth,
      settings: routingSettings
    }).resolveRoute(request.taskType, request.qualityMode, context);
  });
  registerIpcContract(IPC_CONTRACTS.modelRoutes.applyPremiumWebnovelPreset, (request) => {
    requireConfirmation(request.confirmed);
    return applyPremiumWebnovelPreset(repositories, { forceRoutes: true });
  });
  registerIpcContract(IPC_CONTRACTS.modelRoutes.exportPreset, (request) => {
    if (request.qualityMode !== "premium_webnovel") {
      throw new SafeIpcError("ROUTE_PRESET_UNAVAILABLE", "Only premium_webnovel export is available");
    }
    return exportPremiumWebnovelPreset(repositories);
  });
  registerIpcContract(IPC_CONTRACTS.modelRoutes.importPreset, (request) => {
    requireConfirmation(request.confirmed);
    const parsed = JSON.parse(request.presetJson) as ReturnType<typeof exportPremiumWebnovelPreset>;
    if (parsed.quality_mode !== "premium_webnovel") {
      throw new SafeIpcError("INVALID_ROUTE_PRESET", "Only premium_webnovel presets can be imported");
    }
    return importPremiumWebnovelPreset(repositories, parsed);
  });
  registerIpcContract(IPC_CONTRACTS.budgets.getPolicies, () =>
    repositories.budgetPolicies.getDefault()
  );
  registerIpcContract(IPC_CONTRACTS.budgets.updatePolicies, (request) =>
    repositories.budgetPolicies.update(withoutUndefined(request) as UpdateBudgetPolicyInput)
  );
  registerIpcContract(IPC_CONTRACTS.costs.getSummary, (request) => {
    if (!costDashboardService) {
      throw new SafeIpcError("DATABASE_UNAVAILABLE", "Database is not available");
    }
    return costDashboardService.getDashboard(request);
  });
  registerIpcContract(IPC_CONTRACTS.costs.getByProject, (request) => {
    if (!costDashboardService) {
      throw new SafeIpcError("DATABASE_UNAVAILABLE", "Database is not available");
    }
    return costDashboardService.getByProject(request);
  });
  registerIpcContract(IPC_CONTRACTS.costs.getByBook, (request) => {
    if (!costDashboardService) {
      throw new SafeIpcError("DATABASE_UNAVAILABLE", "Database is not available");
    }
    return costDashboardService.getByBook(request);
  });
  registerIpcContract(IPC_CONTRACTS.costs.getByChapter, (request) => {
    if (!costDashboardService) {
      throw new SafeIpcError("DATABASE_UNAVAILABLE", "Database is not available");
    }
    return costDashboardService.getByChapter(request);
  });
  registerIpcContract(IPC_CONTRACTS.costs.getByRun, (request) => {
    if (!costDashboardService) {
      throw new SafeIpcError("DATABASE_UNAVAILABLE", "Database is not available");
    }
    return costDashboardService.getByRun(request);
  });
  registerIpcContract(IPC_CONTRACTS.costs.getByModel, (request) => {
    if (!costDashboardService) {
      throw new SafeIpcError("DATABASE_UNAVAILABLE", "Database is not available");
    }
    return costDashboardService.getByModel(request);
  });
  registerIpcContract(IPC_CONTRACTS.costs.exportCsv, (request) => {
    if (!costDashboardService) {
      throw new SafeIpcError("DATABASE_UNAVAILABLE", "Database is not available");
    }
    return costDashboardService.exportCsv(request);
  });
  registerIpcContract(IPC_CONTRACTS.costs.forecastChapters, (request) => {
    if (!costForecastService) {
      throw new SafeIpcError("DATABASE_UNAVAILABLE", "Database is not available");
    }
    return costForecastService.forecastChapters(request);
  });
  registerIpcContract(IPC_CONTRACTS.costs.compareQualityModes, (request) => {
    if (!costForecastService) {
      throw new SafeIpcError("DATABASE_UNAVAILABLE", "Database is not available");
    }
    return costForecastService.compareQualityModes(request);
  });
  registerIpcContract(IPC_CONTRACTS.costs.quotaSummary, (request) => {
    if (!costForecastService) {
      throw new SafeIpcError("DATABASE_UNAVAILABLE", "Database is not available");
    }
    return costForecastService.getProviderQuotaSummary(request);
  });
  registerIpcContract(IPC_CONTRACTS.export.bookMarkdown, (request) => {
    if (!importExportService) {
      throw new SafeIpcError("DATABASE_UNAVAILABLE", "Database is not available");
    }
    return importExportService.exportBookMarkdown(request);
  });
  registerIpcContract(IPC_CONTRACTS.export.bookTxt, (request) => {
    if (!importExportService) {
      throw new SafeIpcError("DATABASE_UNAVAILABLE", "Database is not available");
    }
    return importExportService.exportBookTxt(request);
  });
  registerIpcContract(IPC_CONTRACTS.export.projectJson, (request) => {
    if (!importExportService) {
      throw new SafeIpcError("DATABASE_UNAVAILABLE", "Database is not available");
    }
    return importExportService.exportProjectJson(request);
  });
  registerIpcContract(IPC_CONTRACTS.export.projectPackage, (request) => {
    if (!importExportService) {
      throw new SafeIpcError("DATABASE_UNAVAILABLE", "Database is not available");
    }
    return importExportService.exportProjectPackage(request);
  });
  registerIpcContract(IPC_CONTRACTS.export.costCsv, (request) => {
    if (!importExportService) {
      throw new SafeIpcError("DATABASE_UNAVAILABLE", "Database is not available");
    }
    return importExportService.exportCostCsv(request);
  });
  registerIpcContract(IPC_CONTRACTS.import.markdown, (request) => {
    if (!importExportService) {
      throw new SafeIpcError("DATABASE_UNAVAILABLE", "Database is not available");
    }
    return importExportService.importMarkdown(request);
  });
  registerIpcContract(IPC_CONTRACTS.import.txt, (request) => {
    if (!importExportService) {
      throw new SafeIpcError("DATABASE_UNAVAILABLE", "Database is not available");
    }
    return importExportService.importTxt(request);
  });
  registerIpcContract(IPC_CONTRACTS.import.projectJson, (request) => {
    if (!importExportService) {
      throw new SafeIpcError("DATABASE_UNAVAILABLE", "Database is not available");
    }
    return importExportService.importProjectJson(request);
  });
  registerIpcContract(IPC_CONTRACTS.import.projectPackage, (request) => {
    if (!importExportService) {
      throw new SafeIpcError("DATABASE_UNAVAILABLE", "Database is not available");
    }
    return importExportService.importProjectPackage(request);
  });
  registerIpcContract(IPC_CONTRACTS.backup.create, (request) => {
    if (!backupService) {
      throw new SafeIpcError("DATABASE_UNAVAILABLE", "Database is not available");
    }
    return backupService.create(request);
  });
  registerIpcContract(IPC_CONTRACTS.backup.list, () => {
    if (!backupService) {
      throw new SafeIpcError("DATABASE_UNAVAILABLE", "Database is not available");
    }
    return backupService.list();
  });
  registerIpcContract(IPC_CONTRACTS.backup.restore, (request) => {
    if (!backupService) {
      throw new SafeIpcError("DATABASE_UNAVAILABLE", "Database is not available");
    }
    return backupService.restore(request);
  });
  registerIpcContract(IPC_CONTRACTS.backup.updateSettings, (request) => {
    if (!backupService) {
      throw new SafeIpcError("DATABASE_UNAVAILABLE", "Database is not available");
    }
    return backupService.updateSettings(withoutUndefined(request) as Partial<BackupSettings>);
  });
  registerIpcContract(IPC_CONTRACTS.backup.getSettings, () => {
    if (!backupService) {
      throw new SafeIpcError("DATABASE_UNAVAILABLE", "Database is not available");
    }
    return backupService.getSettings();
  });
  registerIpcContract(IPC_CONTRACTS.pricing.importJson, (request) => {
    if (!pricingRegistryService) {
      throw new SafeIpcError("DATABASE_UNAVAILABLE", "Database is not available");
    }
    return pricingRegistryService.importJson(request.json);
  });
  registerIpcContract(IPC_CONTRACTS.pricing.exportJson, () => {
    if (!pricingRegistryService) {
      throw new SafeIpcError("DATABASE_UNAVAILABLE", "Database is not available");
    }
    return pricingRegistryService.exportJson();
  });
  registerIpcContract(IPC_CONTRACTS.pricing.markStale, (request) => {
    if (!pricingRegistryService) {
      throw new SafeIpcError("DATABASE_UNAVAILABLE", "Database is not available");
    }
    return pricingRegistryService.markStalePrices(request.priceIds, request.effectiveDate);
  });
  registerIpcContract(IPC_CONTRACTS.pricing.routeWarnings, (request) => {
    if (!pricingRegistryService) {
      throw new SafeIpcError("DATABASE_UNAVAILABLE", "Database is not available");
    }
    return pricingRegistryService.listRoutePriceWarnings(
      typeof request?.staleAfterDays === "undefined"
        ? {}
        : { staleAfterDays: request.staleAfterDays }
    );
  });
  registerIpcContract(IPC_CONTRACTS.pricing.listQuotas, () => repositories.providerQuotas.list());
  registerIpcContract(IPC_CONTRACTS.pricing.upsertQuota, (request) =>
    repositories.providerQuotas.upsert(request)
  );
  registerIpcContract(IPC_CONTRACTS.providerHealth.list, () => repositories.providerHealth.list());
  registerIpcContract(IPC_CONTRACTS.providerHealth.reset, (request) => {
    repositories.providerHealth.reset(request?.provider);
    return undefined;
  });
  registerIpcContract(IPC_CONTRACTS.providerSmoke.run, (request) => {
    if (!providerSmokeService) {
      throw new SafeIpcError("PROVIDER_SMOKE_UNAVAILABLE", "Provider smoke service is unavailable");
    }
    requireConfirmation(request.confirmed);
    return providerSmokeService.runProviderSmoke({
      provider: request.provider,
      confirmed: true,
      ...(typeof request.budgetCapUsd === "number" ? { budgetCapUsd: request.budgetCapUsd } : {})
    });
  });
  registerIpcContract(IPC_CONTRACTS.providerSmoke.runAll, (request) => {
    if (!providerSmokeService) {
      throw new SafeIpcError("PROVIDER_SMOKE_UNAVAILABLE", "Provider smoke service is unavailable");
    }
    requireConfirmation(request.confirmed);
    return providerSmokeService.runAllConfigured({
      confirmed: true,
      ...(typeof request.budgetCapUsd === "number" ? { budgetCapUsd: request.budgetCapUsd } : {})
    });
  });
  registerIpcContract(
    IPC_CONTRACTS.providerSmoke.report,
    () => providerSmokeService?.buildUntestedReport() ?? []
  );
  registerIpcContract(IPC_CONTRACTS.providerSmoke.latestReport, () =>
    readLatestProviderCheckReport()
  );
  registerIpcContract(IPC_CONTRACTS.providerChapterCheck.run, (request) => {
    if (!providerChapterCheckService) {
      throw new SafeIpcError(
        "PROVIDER_CHAPTER_CHECK_UNAVAILABLE",
        "Provider chapter check service is unavailable"
      );
    }
    requireConfirmation(request.confirmed);
    return providerChapterCheckService.run(
      withoutUndefined({
        budgetCapUsd: request.budgetCapUsd,
        qualityMode: request.qualityMode,
        confirmed: true
      }) as Parameters<typeof providerChapterCheckService.run>[0]
    );
  });
  registerIpcContract(IPC_CONTRACTS.crossCheck.run, (request) => {
    if (!crossCheckService) {
      throw new SafeIpcError("CROSS_CHECK_UNAVAILABLE", "Cross-check service is unavailable");
    }
    requireConfirmation(request.confirmed);
    return crossCheckService.run({ ...request, confirmed: true });
  });
  registerIpcContract(IPC_CONTRACTS.reviews.listByGenerationRun, (request) => {
    if (!reviewSettlementService) {
      throw new SafeIpcError("DATABASE_UNAVAILABLE", "Database is not available");
    }
    return reviewSettlementService.listReviewsByGenerationRun(request.runId);
  });
  registerIpcContract(IPC_CONTRACTS.reviews.updateStatus, (request) => {
    if (!reviewSettlementService) {
      throw new SafeIpcError("DATABASE_UNAVAILABLE", "Database is not available");
    }
    return reviewSettlementService.updateReviewStatus(request.id, request.status);
  });
  registerIpcContract(IPC_CONTRACTS.reviews.rerunAudit, (request) => {
    if (!reviewSettlementService) {
      throw new SafeIpcError("DATABASE_UNAVAILABLE", "Database is not available");
    }
    repositories.generation.addEvent({
      generationRunId: request.runId,
      eventType: "audit_rerun_requested",
      message: "Audit rerun requested",
      payload: { auditType: request.auditType ?? "all" }
    });
    return reviewSettlementService.listReviewsByGenerationRun(request.runId);
  });
  registerIpcContract(IPC_CONTRACTS.reviews.qualityGate, (request) => {
    if (!reviewSettlementService) {
      throw new SafeIpcError("DATABASE_UNAVAILABLE", "Database is not available");
    }
    return reviewSettlementService.qualityGate(
      request.runId,
      request.overrideBlockingWarnings ?? false
    );
  });
  registerIpcContract(IPC_CONTRACTS.manuscript.diffVersions, (request) => {
    if (!reviewSettlementService) {
      throw new SafeIpcError("DATABASE_UNAVAILABLE", "Database is not available");
    }
    return reviewSettlementService.diffVersions(request);
  });
  registerIpcContract(IPC_CONTRACTS.manuscript.diffArtifact, (request) => {
    if (!reviewSettlementService) {
      throw new SafeIpcError("DATABASE_UNAVAILABLE", "Database is not available");
    }
    return reviewSettlementService.diffArtifact(request);
  });
  registerIpcContract(IPC_CONTRACTS.manuscript.saveArtifactAsVersion, (request) => {
    if (!reviewSettlementService) {
      throw new SafeIpcError("DATABASE_UNAVAILABLE", "Database is not available");
    }
    return reviewSettlementService.saveArtifactAsVersion(request);
  });
  registerIpcContract(IPC_CONTRACTS.settlement.preview, (request) => {
    if (!reviewSettlementService) {
      throw new SafeIpcError("DATABASE_UNAVAILABLE", "Database is not available");
    }
    return reviewSettlementService.previewSettlement(request);
  });
  registerIpcContract(IPC_CONTRACTS.settlement.listByRun, (request) => {
    if (!reviewSettlementService) {
      throw new SafeIpcError("DATABASE_UNAVAILABLE", "Database is not available");
    }
    return reviewSettlementService.previewSettlement(request);
  });
  registerIpcContract(IPC_CONTRACTS.settlement.applySelected, (request) => {
    if (!reviewSettlementService) {
      throw new SafeIpcError("DATABASE_UNAVAILABLE", "Database is not available");
    }
    return reviewSettlementService.applySelectedSettlementItems(request);
  });
  registerIpcContract(IPC_CONTRACTS.settlement.rejectSelected, (request) => {
    if (!reviewSettlementService) {
      throw new SafeIpcError("DATABASE_UNAVAILABLE", "Database is not available");
    }
    return reviewSettlementService.rejectSettlementItems(request);
  });
  registerIpcContract(IPC_CONTRACTS.settlement.editItem, (request) => {
    if (!reviewSettlementService) {
      throw new SafeIpcError("DATABASE_UNAVAILABLE", "Database is not available");
    }
    return reviewSettlementService.editSettlementItem(request);
  });
  registerIpcContract(IPC_CONTRACTS.eval.suites.list, () => {
    if (!evaluationService) {
      throw new SafeIpcError("DATABASE_UNAVAILABLE", "Database is not available");
    }
    return evaluationService.listSuites();
  });
  registerIpcContract(IPC_CONTRACTS.eval.suites.create, (request) => {
    if (!evaluationService) {
      throw new SafeIpcError("DATABASE_UNAVAILABLE", "Database is not available");
    }
    return evaluationService.createSuite(request);
  });
  registerIpcContract(IPC_CONTRACTS.eval.suites.update, (request) => {
    if (!evaluationService) {
      throw new SafeIpcError("DATABASE_UNAVAILABLE", "Database is not available");
    }
    const { id, ...patch } = request;
    return evaluationService.updateSuite(id, withoutUndefined(patch));
  });
  registerIpcContract(IPC_CONTRACTS.eval.suites.delete, (request) => {
    if (!evaluationService) {
      throw new SafeIpcError("DATABASE_UNAVAILABLE", "Database is not available");
    }
    requireConfirmation(request.confirmed);
    return evaluationService.deleteSuite(request.id, true);
  });
  registerIpcContract(IPC_CONTRACTS.eval.cases.list, (request) => {
    if (!evaluationService) {
      throw new SafeIpcError("DATABASE_UNAVAILABLE", "Database is not available");
    }
    return evaluationService.listCases(request.suiteId);
  });
  registerIpcContract(IPC_CONTRACTS.eval.cases.create, (request) => {
    if (!evaluationService) {
      throw new SafeIpcError("DATABASE_UNAVAILABLE", "Database is not available");
    }
    return evaluationService.createCase(request);
  });
  registerIpcContract(IPC_CONTRACTS.eval.cases.update, (request) => {
    if (!evaluationService) {
      throw new SafeIpcError("DATABASE_UNAVAILABLE", "Database is not available");
    }
    const { id, ...patch } = request;
    return evaluationService.updateCase(id, withoutUndefined(patch));
  });
  registerIpcContract(IPC_CONTRACTS.eval.cases.delete, (request) => {
    if (!evaluationService) {
      throw new SafeIpcError("DATABASE_UNAVAILABLE", "Database is not available");
    }
    requireConfirmation(request.confirmed);
    return evaluationService.deleteCase(request.id, true);
  });
  registerIpcContract(IPC_CONTRACTS.eval.run.start, async (request) => {
    if (!evaluationService) {
      throw new SafeIpcError("DATABASE_UNAVAILABLE", "Database is not available");
    }
    return request.executionMode === "provider"
      ? evaluationService.startRunProvider(request)
      : evaluationService.startRun(request);
  });
  registerIpcContract(IPC_CONTRACTS.eval.run.abort, (request) => {
    if (!evaluationService) {
      throw new SafeIpcError("DATABASE_UNAVAILABLE", "Database is not available");
    }
    return evaluationService.abortRun(request.runId);
  });
  registerIpcContract(IPC_CONTRACTS.eval.outputs.list, (request) => {
    if (!evaluationService) {
      throw new SafeIpcError("DATABASE_UNAVAILABLE", "Database is not available");
    }
    return evaluationService.listOutputs(
      request.runId,
      typeof request.blind === "undefined" ? {} : { blind: request.blind }
    );
  });
  registerIpcContract(IPC_CONTRACTS.eval.score.human, (request) => {
    if (!evaluationService) {
      throw new SafeIpcError("DATABASE_UNAVAILABLE", "Database is not available");
    }
    return evaluationService.scoreHuman(request);
  });
  registerIpcContract(IPC_CONTRACTS.eval.score.llmJudge, async (request) => {
    if (!evaluationService) {
      throw new SafeIpcError("DATABASE_UNAVAILABLE", "Database is not available");
    }
    return request.executionMode === "provider"
      ? evaluationService.scoreLlmJudgeProvider(request)
      : evaluationService.scoreLlmJudge(request);
  });
  registerIpcContract(IPC_CONTRACTS.eval.leaderboard, (request) => {
    if (!evaluationService) {
      throw new SafeIpcError("DATABASE_UNAVAILABLE", "Database is not available");
    }
    return evaluationService.leaderboard(request.runId);
  });
  registerIpcContract(IPC_CONTRACTS.eval.promoteWinnerToRoute, (request) => {
    if (!evaluationService) {
      throw new SafeIpcError("DATABASE_UNAVAILABLE", "Database is not available");
    }
    return evaluationService.promoteWinnerToRoute(request);
  });
  registerIpcContract(IPC_CONTRACTS.eval.recommendRoutes, (request) => {
    if (!evaluationService) {
      throw new SafeIpcError("DATABASE_UNAVAILABLE", "Database is not available");
    }
    return evaluationService.recommendRoutes(request.runId);
  });
  registerIpcContract(IPC_CONTRACTS.eval.applyRecommendationToRoute, (request) => {
    if (!evaluationService) {
      throw new SafeIpcError("DATABASE_UNAVAILABLE", "Database is not available");
    }
    return evaluationService.applyRecommendationToRoute(request);
  });
  registerIpcContract(IPC_CONTRACTS.eval.exportReport, (request) => {
    if (!evaluationService) {
      throw new SafeIpcError("DATABASE_UNAVAILABLE", "Database is not available");
    }
    return evaluationService.exportReport(request);
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

  registerIpcContract(IPC_CONTRACTS.generation.chapter.start, (request) => {
    if (!workflowRuntime) {
      throw new SafeIpcError("DATABASE_UNAVAILABLE", "Database is not available");
    }
    return workflowRuntime.startChapterWorkflow(request);
  });
  registerIpcContract(IPC_CONTRACTS.generation.getRun, (request) => {
    if (!workflowRuntime) {
      throw new SafeIpcError("DATABASE_UNAVAILABLE", "Database is not available");
    }
    return workflowRuntime.getRun(request.runId);
  });
  registerIpcContract(IPC_CONTRACTS.generation.listRunsByChapter, (request) => {
    if (!workflowRuntime) {
      throw new SafeIpcError("DATABASE_UNAVAILABLE", "Database is not available");
    }
    return workflowRuntime.listRunsByChapter(request.chapterId);
  });
  registerIpcContract(IPC_CONTRACTS.generation.streamEvents, (request) => {
    if (!workflowRuntime) {
      throw new SafeIpcError("DATABASE_UNAVAILABLE", "Database is not available");
    }
    return workflowRuntime.streamEvents(request.runId, request.sinceEventId);
  });
  registerIpcContract(IPC_CONTRACTS.generation.abort, (request) => {
    if (!workflowRuntime) {
      throw new SafeIpcError("DATABASE_UNAVAILABLE", "Database is not available");
    }
    return workflowRuntime.abort(request);
  });
  registerIpcContract(IPC_CONTRACTS.generation.resume, (request) => {
    if (!workflowRuntime) {
      throw new SafeIpcError("DATABASE_UNAVAILABLE", "Database is not available");
    }
    return workflowRuntime.resume(request);
  });
  registerIpcContract(IPC_CONTRACTS.generation.resumeAfterBudgetWarning, (request) => {
    if (!workflowRuntime) {
      throw new SafeIpcError("DATABASE_UNAVAILABLE", "Database is not available");
    }
    requireConfirmation(request.confirmed);
    return workflowRuntime.getRun(request.runId)?.run ?? null;
  });
  registerIpcContract(IPC_CONTRACTS.generation.requestRevision, (request) => {
    if (!workflowRuntime) {
      throw new SafeIpcError("DATABASE_UNAVAILABLE", "Database is not available");
    }
    return workflowRuntime.requestRevision(request);
  });
  registerIpcContract(IPC_CONTRACTS.generation.acceptArtifactAsVersion, (request) => {
    if (!workflowRuntime) {
      throw new SafeIpcError("DATABASE_UNAVAILABLE", "Database is not available");
    }
    return workflowRuntime.acceptArtifactAsVersion(request);
  });
  registerIpcContract(IPC_CONTRACTS.generation.setAcceptedVersionCanonical, (request) => {
    if (!workflowRuntime) {
      throw new SafeIpcError("DATABASE_UNAVAILABLE", "Database is not available");
    }
    return workflowRuntime.setAcceptedVersionCanonical(request);
  });
  registerIpcContract(IPC_CONTRACTS.generation.cancel, (request) => {
    if (!workflowRuntime) {
      throw new SafeIpcError("DATABASE_UNAVAILABLE", "Database is not available");
    }
    return workflowRuntime.cancel(request);
  });
}

function withoutUndefined<T extends Record<string, unknown>>(value: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(value).filter(([, entryValue]) => typeof entryValue !== "undefined")
  ) as Partial<T>;
}

function getPrivacySettings(repositories: RepositoryRegistry): PrivacySettings {
  return {
    ...DEFAULT_PRIVACY_SETTINGS,
    ...(repositories.settings.get<Partial<PrivacySettings>>("privacy") ?? {})
  };
}

function getRoutingSettings(repositories: RepositoryRegistry): RoutingSettings {
  return repositories.settings.get<RoutingSettings>("routing") ?? DEFAULT_ROUTING_SETTINGS;
}

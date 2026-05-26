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
  ProviderHealthRecord,
  ProviderModelListResult,
  RoutePreviewContext,
  TaskRouteRecord
} from "@contracts/model-routing";
import type { BudgetPolicyRecord } from "@contracts/budgets";
import type {
  CostForecast,
  CostDashboardSummary,
  CostGroup,
  CsvExportResult,
  ModelPriceTierDto,
  PriceImportResult,
  ProviderQuotaNoteDto,
  ProviderQuotaSummary,
  QualityModeComparison,
  RoutePriceWarning
} from "@contracts/cost-dashboard";
import type { CrossCheckRequest, CrossCheckResult } from "@contracts/cross-check";
import type { ProviderSmokeResult } from "@contracts/provider-smoke";
import type {
  ProviderChapterCheckResult,
  ProviderCheckReportRecord
} from "@contracts/provider-check";
import type {
  BackupRecord,
  BackupRestoreResult,
  BackupSettings,
  ExportFilesResult,
  ExportPackageResult,
  ExportTextResult,
  ImportResult,
  ProjectJsonPackage
} from "@contracts/import-export";
import type {
  EvalCaseRecord,
  EvalLeaderboardEntry,
  EvalOutputRecord,
  EvalRunRecord,
  EvalScoreRecord,
  EvalReportResult,
  EvalRouteRecommendations,
  EvalSuiteRecord
} from "@contracts/evaluation";
import type { PrivacySettings, RoutingSettings } from "@contracts/settings";
import type { ContextPreviewPack, ContextPreviewRequest } from "@contracts/context";
import type {
  ChapterWorkflowDetail,
  SettlementProposalItem,
  WorkflowEventRecord,
  WorkflowReviewCard,
  WorkflowRunRecord
} from "@contracts/workflow";
import type {
  ApplySettlementResult,
  ManuscriptDiff,
  QualityGateResult,
  SettlementPreview
} from "@contracts/review-settlement";
import type {
  ChapterPlanRecord,
  OutlineSourceRecord,
  OutlineVersionRecord,
  PlanEditProposalRecord
} from "@contracts/planning";
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
} from "@contracts/story-bible";
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

function createStoryBibleEntityApi<RecordType, InputType>(
  invoke: IpcInvoker,
  contracts: {
    list: { channel: string; response: z.ZodType };
    create: { channel: string; response: z.ZodType };
    update: { channel: string; response: z.ZodType };
    delete: { channel: string; response: z.ZodType };
  }
) {
  return {
    list: (query: StoryBibleListQuery) =>
      invokeContract<RecordType[]>(
        invoke,
        contracts.list.channel,
        contracts.list.response as z.ZodType<RecordType[]>,
        query
      ),
    create: (input: InputType) =>
      invokeContract<RecordType>(
        invoke,
        contracts.create.channel,
        contracts.create.response as z.ZodType<RecordType>,
        input
      ),
    update: (id: string, input: Partial<InputType>) =>
      invokeContract<RecordType | null>(
        invoke,
        contracts.update.channel,
        contracts.update.response as z.ZodType<RecordType | null>,
        { id, ...input }
      ),
    delete: (id: string, confirmed: boolean) =>
      invokeContract<boolean>(
        invoke,
        contracts.delete.channel,
        contracts.delete.response as z.ZodType<boolean>,
        {
          id,
          confirmed
        }
      )
  };
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
        ),
      exportBundle: (request = {}) =>
        invokeContract(
          invoke,
          IPC_CONTRACTS.diagnostics.exportBundle.channel,
          IPC_CONTRACTS.diagnostics.exportBundle.response,
          request
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
      update: (id, input) =>
        invokeContract<BookRecord | null>(
          invoke,
          IPC_CONTRACTS.books.update.channel,
          IPC_CONTRACTS.books.update.response,
          { id, ...input }
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
        ),
      update: (id, input) =>
        invokeContract<VolumeRecord | null>(
          invoke,
          IPC_CONTRACTS.volumes.update.channel,
          IPC_CONTRACTS.volumes.update.response,
          { id, ...input }
        ),
      delete: (id, confirmed) =>
        invokeContract<boolean>(
          invoke,
          IPC_CONTRACTS.volumes.delete.channel,
          IPC_CONTRACTS.volumes.delete.response,
          { id, confirmed }
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
      update: (id, input) =>
        invokeContract<ChapterRecord | null>(
          invoke,
          IPC_CONTRACTS.chapters.update.channel,
          IPC_CONTRACTS.chapters.update.response,
          { id, ...input }
        ),
      reorder: async (bookId, orderedChapterIds) => {
        await invokeContract<void>(
          invoke,
          IPC_CONTRACTS.chapters.reorder.channel,
          IPC_CONTRACTS.chapters.reorder.response,
          { bookId, orderedChapterIds }
        );
      },
      setStatus: (id, status) =>
        invokeContract<ChapterRecord | null>(
          invoke,
          IPC_CONTRACTS.chapters.setStatus.channel,
          IPC_CONTRACTS.chapters.setStatus.response,
          { id, status }
        ),
      delete: (id, confirmed) =>
        invokeContract<boolean>(
          invoke,
          IPC_CONTRACTS.chapters.delete.channel,
          IPC_CONTRACTS.chapters.delete.response,
          { id, confirmed }
        )
    },
    planning: {
      outlineSources: {
        list: (bookId) =>
          invokeContract<OutlineSourceRecord[]>(
            invoke,
            IPC_CONTRACTS.planning.outlineSources.list.channel,
            IPC_CONTRACTS.planning.outlineSources.list.response,
            { bookId }
          ),
        create: (input) =>
          invokeContract<OutlineSourceRecord>(
            invoke,
            IPC_CONTRACTS.planning.outlineSources.create.channel,
            IPC_CONTRACTS.planning.outlineSources.create.response,
            input
          )
      },
      outlineVersions: {
        list: (bookId) =>
          invokeContract<OutlineVersionRecord[]>(
            invoke,
            IPC_CONTRACTS.planning.outlineVersions.list.channel,
            IPC_CONTRACTS.planning.outlineVersions.list.response,
            { bookId }
          ),
        create: (input) =>
          invokeContract<OutlineVersionRecord>(
            invoke,
            IPC_CONTRACTS.planning.outlineVersions.create.channel,
            IPC_CONTRACTS.planning.outlineVersions.create.response,
            input
          ),
        setActive: (bookId, id) =>
          invokeContract<OutlineVersionRecord | null>(
            invoke,
            IPC_CONTRACTS.planning.outlineVersions.setActive.channel,
            IPC_CONTRACTS.planning.outlineVersions.setActive.response,
            { bookId, id }
          )
      },
      chapterPlans: {
        list: (bookId) =>
          invokeContract<ChapterPlanRecord[]>(
            invoke,
            IPC_CONTRACTS.planning.chapterPlans.list.channel,
            IPC_CONTRACTS.planning.chapterPlans.list.response,
            { bookId }
          ),
        getAccepted: (chapterId) =>
          invokeContract<ChapterPlanRecord | null>(
            invoke,
            IPC_CONTRACTS.planning.chapterPlans.getAccepted.channel,
            IPC_CONTRACTS.planning.chapterPlans.getAccepted.response,
            { chapterId }
          ),
        upsert: (input) =>
          invokeContract<ChapterPlanRecord>(
            invoke,
            IPC_CONTRACTS.planning.chapterPlans.upsert.channel,
            IPC_CONTRACTS.planning.chapterPlans.upsert.response,
            input
          )
      },
      proposals: {
        list: (bookId) =>
          invokeContract<PlanEditProposalRecord[]>(
            invoke,
            IPC_CONTRACTS.planning.proposals.list.channel,
            IPC_CONTRACTS.planning.proposals.list.response,
            { bookId }
          ),
        create: (input) =>
          invokeContract<PlanEditProposalRecord>(
            invoke,
            IPC_CONTRACTS.planning.proposals.create.channel,
            IPC_CONTRACTS.planning.proposals.create.response,
            input
          ),
        accept: (id) =>
          invokeContract<PlanEditProposalRecord | null>(
            invoke,
            IPC_CONTRACTS.planning.proposals.accept.channel,
            IPC_CONTRACTS.planning.proposals.accept.response,
            { id }
          ),
        reject: (id) =>
          invokeContract<PlanEditProposalRecord | null>(
            invoke,
            IPC_CONTRACTS.planning.proposals.reject.channel,
            IPC_CONTRACTS.planning.proposals.reject.response,
            { id }
          )
      }
    },
    manuscripts: {
      listVersions: (chapterId) =>
        invokeContract<ManuscriptVersionRecord[]>(
          invoke,
          IPC_CONTRACTS.manuscripts.listVersions.channel,
          IPC_CONTRACTS.manuscripts.listVersions.response,
          { chapterId }
        ),
      getVersion: (id) =>
        invokeContract<ManuscriptVersionRecord | null>(
          invoke,
          IPC_CONTRACTS.manuscripts.getVersion.channel,
          IPC_CONTRACTS.manuscripts.getVersion.response,
          { id }
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
      setCanonical: (chapterId, versionId) =>
        invokeContract<ManuscriptVersionRecord | null>(
          invoke,
          IPC_CONTRACTS.manuscripts.setCanonical.channel,
          IPC_CONTRACTS.manuscripts.setCanonical.response,
          { chapterId, versionId }
        ),
      rollback: (chapterId, versionId, confirmed) =>
        invokeContract<ManuscriptVersionRecord>(
          invoke,
          IPC_CONTRACTS.manuscripts.rollback.channel,
          IPC_CONTRACTS.manuscripts.rollback.response,
          { chapterId, versionId, confirmed }
        )
    },
    reviews: {
      listByGenerationRun: (runId) =>
        invokeContract<WorkflowReviewCard[]>(
          invoke,
          IPC_CONTRACTS.reviews.listByGenerationRun.channel,
          IPC_CONTRACTS.reviews.listByGenerationRun.response,
          { runId }
        ),
      updateStatus: (id, status) =>
        invokeContract<WorkflowReviewCard | null>(
          invoke,
          IPC_CONTRACTS.reviews.updateStatus.channel,
          IPC_CONTRACTS.reviews.updateStatus.response,
          { id, status }
        ),
      rerunAudit: (runId, auditType) =>
        invokeContract<WorkflowReviewCard[]>(
          invoke,
          IPC_CONTRACTS.reviews.rerunAudit.channel,
          IPC_CONTRACTS.reviews.rerunAudit.response,
          { runId, auditType }
        ),
      qualityGate: (runId, overrideBlockingWarnings) =>
        invokeContract<QualityGateResult>(
          invoke,
          IPC_CONTRACTS.reviews.qualityGate.channel,
          IPC_CONTRACTS.reviews.qualityGate.response,
          { runId, overrideBlockingWarnings }
        )
    },
    manuscript: {
      diffVersions: (fromVersionId, toVersionId) =>
        invokeContract<ManuscriptDiff>(
          invoke,
          IPC_CONTRACTS.manuscript.diffVersions.channel,
          IPC_CONTRACTS.manuscript.diffVersions.response,
          { fromVersionId, toVersionId }
        ),
      diffArtifact: (artifactId, baseVersionId) =>
        invokeContract<ManuscriptDiff>(
          invoke,
          IPC_CONTRACTS.manuscript.diffArtifact.channel,
          IPC_CONTRACTS.manuscript.diffArtifact.response,
          { artifactId, baseVersionId }
        ),
      saveArtifactAsVersion: (input) =>
        invokeContract<ManuscriptVersionRecord>(
          invoke,
          IPC_CONTRACTS.manuscript.saveArtifactAsVersion.channel,
          IPC_CONTRACTS.manuscript.saveArtifactAsVersion.response,
          input
        )
    },
    settlement: {
      preview: (runId) =>
        invokeContract<SettlementPreview | null>(
          invoke,
          IPC_CONTRACTS.settlement.preview.channel,
          IPC_CONTRACTS.settlement.preview.response,
          { runId }
        ),
      listByRun: (runId) =>
        invokeContract<SettlementPreview | null>(
          invoke,
          IPC_CONTRACTS.settlement.listByRun.channel,
          IPC_CONTRACTS.settlement.listByRun.response,
          { runId }
        ),
      applySelected: (input) =>
        invokeContract<ApplySettlementResult>(
          invoke,
          IPC_CONTRACTS.settlement.applySelected.channel,
          IPC_CONTRACTS.settlement.applySelected.response,
          input
        ),
      rejectSelected: (proposalId, itemIds) =>
        invokeContract<SettlementProposalItem[]>(
          invoke,
          IPC_CONTRACTS.settlement.rejectSelected.channel,
          IPC_CONTRACTS.settlement.rejectSelected.response,
          { proposalId, itemIds }
        ),
      editItem: (itemId, afterJson, status) =>
        invokeContract<SettlementProposalItem>(
          invoke,
          IPC_CONTRACTS.settlement.editItem.channel,
          IPC_CONTRACTS.settlement.editItem.response,
          { itemId, afterJson, status }
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
          ),
        update: (id, input) =>
          invokeContract<StoryBibleEntryRecord | null>(
            invoke,
            IPC_CONTRACTS.storyBible.entries.update.channel,
            IPC_CONTRACTS.storyBible.entries.update.response,
            { id, ...input }
          ),
        delete: (id, confirmed) =>
          invokeContract<boolean>(
            invoke,
            IPC_CONTRACTS.storyBible.entries.delete.channel,
            IPC_CONTRACTS.storyBible.entries.delete.response,
            { id, confirmed }
          )
      },
      characters: createStoryBibleEntityApi<CharacterRecord, CharacterInput>(
        invoke,
        IPC_CONTRACTS.storyBible.characters
      ),
      factions: createStoryBibleEntityApi<NamedStoryBibleRecord, NamedEntityInput>(
        invoke,
        IPC_CONTRACTS.storyBible.factions
      ),
      locations: createStoryBibleEntityApi<NamedStoryBibleRecord, NamedEntityInput>(
        invoke,
        IPC_CONTRACTS.storyBible.locations
      ),
      artifacts: createStoryBibleEntityApi<NamedStoryBibleRecord, NamedEntityInput>(
        invoke,
        IPC_CONTRACTS.storyBible.artifacts
      ),
      powerSystem: createStoryBibleEntityApi<PowerSystemRuleRecord, PowerSystemRuleInput>(
        invoke,
        IPC_CONTRACTS.storyBible.powerSystem
      ),
      timeline: createStoryBibleEntityApi<TimelineEventRecord, TimelineEventInput>(
        invoke,
        IPC_CONTRACTS.storyBible.timeline
      ),
      foreshadowing: createStoryBibleEntityApi<ForeshadowingRecord, ForeshadowingInput>(
        invoke,
        IPC_CONTRACTS.storyBible.foreshadowing
      ),
      hooks: createStoryBibleEntityApi<UnresolvedHookRecord, UnresolvedHookInput>(
        invoke,
        IPC_CONTRACTS.storyBible.hooks
      ),
      styleGuide: createStoryBibleEntityApi<StyleGuideRecord, StyleGuideInput>(
        invoke,
        IPC_CONTRACTS.storyBible.styleGuide
      ),
      readerPositioning: createStoryBibleEntityApi<ReaderPositioningRecord, ReaderPositioningInput>(
        invoke,
        IPC_CONTRACTS.storyBible.readerPositioning
      )
    },
    memory: {
      search: (bookId, query, options = {}) =>
        invokeContract<MemorySearchResult[]>(
          invoke,
          IPC_CONTRACTS.memory.search.channel,
          IPC_CONTRACTS.memory.search.response,
          { bookId, query, ...options }
        ),
      rebuildBookIndex: async (bookId) => {
        await invokeContract<void>(
          invoke,
          IPC_CONTRACTS.memory.rebuildBookIndex.channel,
          IPC_CONTRACTS.memory.rebuildBookIndex.response,
          { bookId }
        );
      }
    },
    context: {
      previewForChapter: (request: ContextPreviewRequest) =>
        invokeContract<ContextPreviewPack>(
          invoke,
          IPC_CONTRACTS.context.previewForChapter.channel,
          IPC_CONTRACTS.context.previewForChapter.response,
          request
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
    providerModels: {
      list: (provider) =>
        invokeContract<ProviderModelListResult>(
          invoke,
          IPC_CONTRACTS.providerModels.list.channel,
          IPC_CONTRACTS.providerModels.list.response,
          { provider }
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
        ),
      listTiers: (filter) =>
        invokeContract<ModelPriceTierDto[]>(
          invoke,
          IPC_CONTRACTS.modelPrices.listTiers.channel,
          IPC_CONTRACTS.modelPrices.listTiers.response,
          filter
        ),
      upsertTier: (input) =>
        invokeContract<ModelPriceTierDto>(
          invoke,
          IPC_CONTRACTS.modelPrices.upsertTier.channel,
          IPC_CONTRACTS.modelPrices.upsertTier.response,
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
    modelRoutes: {
      resolvePreview: (
        taskType: TaskType,
        qualityMode: QualityMode,
        context?: RoutePreviewContext
      ) =>
        invokeContract<ModelRouteResolution>(
          invoke,
          IPC_CONTRACTS.modelRoutes.resolvePreview.channel,
          IPC_CONTRACTS.modelRoutes.resolvePreview.response,
          { ...context, taskType, qualityMode }
        ),
      applyPremiumWebnovelPreset: (confirmed: boolean) =>
        invokeContract(
          invoke,
          IPC_CONTRACTS.modelRoutes.applyPremiumWebnovelPreset.channel,
          IPC_CONTRACTS.modelRoutes.applyPremiumWebnovelPreset.response,
          { confirmed }
        ),
      exportPreset: (qualityMode: QualityMode) =>
        invokeContract(
          invoke,
          IPC_CONTRACTS.modelRoutes.exportPreset.channel,
          IPC_CONTRACTS.modelRoutes.exportPreset.response,
          { qualityMode }
        ),
      importPreset: (presetJson: string, confirmed: boolean) =>
        invokeContract(
          invoke,
          IPC_CONTRACTS.modelRoutes.importPreset.channel,
          IPC_CONTRACTS.modelRoutes.importPreset.response,
          { presetJson, confirmed }
        )
    },
    budgets: {
      getPolicies: () =>
        invokeContract<BudgetPolicyRecord>(
          invoke,
          IPC_CONTRACTS.budgets.getPolicies.channel,
          IPC_CONTRACTS.budgets.getPolicies.response
        ),
      updatePolicies: (input) =>
        invokeContract<BudgetPolicyRecord>(
          invoke,
          IPC_CONTRACTS.budgets.updatePolicies.channel,
          IPC_CONTRACTS.budgets.updatePolicies.response,
          input
        )
    },
    costs: {
      getSummary: (request = {}) =>
        invokeContract<CostDashboardSummary>(
          invoke,
          IPC_CONTRACTS.costs.getSummary.channel,
          IPC_CONTRACTS.costs.getSummary.response,
          request
        ),
      getByProject: (request = {}) =>
        invokeContract<CostGroup[]>(
          invoke,
          IPC_CONTRACTS.costs.getByProject.channel,
          IPC_CONTRACTS.costs.getByProject.response,
          request
        ),
      getByBook: (request = {}) =>
        invokeContract<CostGroup[]>(
          invoke,
          IPC_CONTRACTS.costs.getByBook.channel,
          IPC_CONTRACTS.costs.getByBook.response,
          request
        ),
      getByChapter: (request = {}) =>
        invokeContract<CostGroup[]>(
          invoke,
          IPC_CONTRACTS.costs.getByChapter.channel,
          IPC_CONTRACTS.costs.getByChapter.response,
          request
        ),
      getByRun: (request = {}) =>
        invokeContract<CostGroup[]>(
          invoke,
          IPC_CONTRACTS.costs.getByRun.channel,
          IPC_CONTRACTS.costs.getByRun.response,
          request
        ),
      getByModel: (request = {}) =>
        invokeContract<CostGroup[]>(
          invoke,
          IPC_CONTRACTS.costs.getByModel.channel,
          IPC_CONTRACTS.costs.getByModel.response,
          request
        ),
      exportCsv: (request = {}) =>
        invokeContract<CsvExportResult>(
          invoke,
          IPC_CONTRACTS.costs.exportCsv.channel,
          IPC_CONTRACTS.costs.exportCsv.response,
          request
        ),
      forecastChapters: (request = {}) =>
        invokeContract<CostForecast>(
          invoke,
          IPC_CONTRACTS.costs.forecastChapters.channel,
          IPC_CONTRACTS.costs.forecastChapters.response,
          request
        ),
      compareQualityModes: (request = {}) =>
        invokeContract<QualityModeComparison>(
          invoke,
          IPC_CONTRACTS.costs.compareQualityModes.channel,
          IPC_CONTRACTS.costs.compareQualityModes.response,
          request
        ),
      quotaSummary: (forecast, providers) =>
        invokeContract<ProviderQuotaSummary>(
          invoke,
          IPC_CONTRACTS.costs.quotaSummary.channel,
          IPC_CONTRACTS.costs.quotaSummary.response,
          { forecast, providers }
        )
    },
    export: {
      bookMarkdown: (request) =>
        invokeContract<ExportFilesResult>(
          invoke,
          IPC_CONTRACTS.export.bookMarkdown.channel,
          IPC_CONTRACTS.export.bookMarkdown.response,
          request
        ),
      bookTxt: (request) =>
        invokeContract<ExportTextResult>(
          invoke,
          IPC_CONTRACTS.export.bookTxt.channel,
          IPC_CONTRACTS.export.bookTxt.response,
          request
        ),
      projectJson: (request) =>
        invokeContract<ProjectJsonPackage>(
          invoke,
          IPC_CONTRACTS.export.projectJson.channel,
          IPC_CONTRACTS.export.projectJson.response,
          request
        ),
      projectPackage: (request) =>
        invokeContract<ExportPackageResult>(
          invoke,
          IPC_CONTRACTS.export.projectPackage.channel,
          IPC_CONTRACTS.export.projectPackage.response,
          request
        ),
      costCsv: (request = {}) =>
        invokeContract<ExportTextResult>(
          invoke,
          IPC_CONTRACTS.export.costCsv.channel,
          IPC_CONTRACTS.export.costCsv.response,
          request
        )
    },
    import: {
      markdown: (request) =>
        invokeContract<ImportResult>(
          invoke,
          IPC_CONTRACTS.import.markdown.channel,
          IPC_CONTRACTS.import.markdown.response,
          request
        ),
      txt: (request) =>
        invokeContract<ImportResult>(
          invoke,
          IPC_CONTRACTS.import.txt.channel,
          IPC_CONTRACTS.import.txt.response,
          request
        ),
      projectJson: (request) =>
        invokeContract<ImportResult>(
          invoke,
          IPC_CONTRACTS.import.projectJson.channel,
          IPC_CONTRACTS.import.projectJson.response,
          request
        ),
      projectPackage: (request) =>
        invokeContract<ImportResult>(
          invoke,
          IPC_CONTRACTS.import.projectPackage.channel,
          IPC_CONTRACTS.import.projectPackage.response,
          request
        )
    },
    backup: {
      create: (request = {}) =>
        invokeContract<BackupRecord>(
          invoke,
          IPC_CONTRACTS.backup.create.channel,
          IPC_CONTRACTS.backup.create.response,
          request
        ),
      list: () =>
        invokeContract<BackupRecord[]>(
          invoke,
          IPC_CONTRACTS.backup.list.channel,
          IPC_CONTRACTS.backup.list.response
        ),
      restore: (request) =>
        invokeContract<BackupRestoreResult>(
          invoke,
          IPC_CONTRACTS.backup.restore.channel,
          IPC_CONTRACTS.backup.restore.response,
          request
        ),
      getSettings: () =>
        invokeContract<BackupSettings>(
          invoke,
          IPC_CONTRACTS.backup.getSettings.channel,
          IPC_CONTRACTS.backup.getSettings.response
        ),
      updateSettings: (request) =>
        invokeContract<BackupSettings>(
          invoke,
          IPC_CONTRACTS.backup.updateSettings.channel,
          IPC_CONTRACTS.backup.updateSettings.response,
          request
        )
    },
    pricing: {
      importJson: (json) =>
        invokeContract<PriceImportResult>(
          invoke,
          IPC_CONTRACTS.pricing.importJson.channel,
          IPC_CONTRACTS.pricing.importJson.response,
          { json }
        ),
      exportJson: () =>
        invokeContract<string>(
          invoke,
          IPC_CONTRACTS.pricing.exportJson.channel,
          IPC_CONTRACTS.pricing.exportJson.response
        ),
      markStale: (priceIds, effectiveDate) =>
        invokeContract<ModelPriceRecord[]>(
          invoke,
          IPC_CONTRACTS.pricing.markStale.channel,
          IPC_CONTRACTS.pricing.markStale.response,
          { priceIds, effectiveDate }
        ),
      routeWarnings: (staleAfterDays) =>
        invokeContract<RoutePriceWarning[]>(
          invoke,
          IPC_CONTRACTS.pricing.routeWarnings.channel,
          IPC_CONTRACTS.pricing.routeWarnings.response,
          typeof staleAfterDays === "undefined" ? undefined : { staleAfterDays }
        ),
      listQuotas: () =>
        invokeContract<ProviderQuotaNoteDto[]>(
          invoke,
          IPC_CONTRACTS.pricing.listQuotas.channel,
          IPC_CONTRACTS.pricing.listQuotas.response
        ),
      upsertQuota: (input) =>
        invokeContract<ProviderQuotaNoteDto>(
          invoke,
          IPC_CONTRACTS.pricing.upsertQuota.channel,
          IPC_CONTRACTS.pricing.upsertQuota.response,
          input
        )
    },
    providerHealth: {
      list: () =>
        invokeContract<ProviderHealthRecord[]>(
          invoke,
          IPC_CONTRACTS.providerHealth.list.channel,
          IPC_CONTRACTS.providerHealth.list.response
        ),
      reset: (provider) =>
        invokeContract<void>(
          invoke,
          IPC_CONTRACTS.providerHealth.reset.channel,
          IPC_CONTRACTS.providerHealth.reset.response,
          typeof provider === "undefined" ? undefined : { provider }
        )
    },
    providerSmoke: {
      run: (request) =>
        invokeContract<ProviderSmokeResult>(
          invoke,
          IPC_CONTRACTS.providerSmoke.run.channel,
          IPC_CONTRACTS.providerSmoke.run.response,
          request
        ),
      runAll: (request) =>
        invokeContract<ProviderSmokeResult[]>(
          invoke,
          IPC_CONTRACTS.providerSmoke.runAll.channel,
          IPC_CONTRACTS.providerSmoke.runAll.response,
          request
        ),
      report: () =>
        invokeContract<ProviderSmokeResult[]>(
          invoke,
          IPC_CONTRACTS.providerSmoke.report.channel,
          IPC_CONTRACTS.providerSmoke.report.response
        ),
      latestReport: () =>
        invokeContract<ProviderCheckReportRecord | null>(
          invoke,
          IPC_CONTRACTS.providerSmoke.latestReport.channel,
          IPC_CONTRACTS.providerSmoke.latestReport.response
        )
    },
    providerChapterCheck: {
      run: (request) =>
        invokeContract<ProviderChapterCheckResult>(
          invoke,
          IPC_CONTRACTS.providerChapterCheck.run.channel,
          IPC_CONTRACTS.providerChapterCheck.run.response,
          request
        )
    },
    crossCheck: {
      run: (request: CrossCheckRequest) =>
        invokeContract<CrossCheckResult>(
          invoke,
          IPC_CONTRACTS.crossCheck.run.channel,
          IPC_CONTRACTS.crossCheck.run.response,
          request
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
    },
    eval: {
      suites: {
        list: () =>
          invokeContract<EvalSuiteRecord[]>(
            invoke,
            IPC_CONTRACTS.eval.suites.list.channel,
            IPC_CONTRACTS.eval.suites.list.response
          ),
        create: (input) =>
          invokeContract<EvalSuiteRecord>(
            invoke,
            IPC_CONTRACTS.eval.suites.create.channel,
            IPC_CONTRACTS.eval.suites.create.response,
            input
          ),
        update: (id, input) =>
          invokeContract<EvalSuiteRecord | null>(
            invoke,
            IPC_CONTRACTS.eval.suites.update.channel,
            IPC_CONTRACTS.eval.suites.update.response,
            { id, ...input }
          ),
        delete: (id, confirmed) =>
          invokeContract<boolean>(
            invoke,
            IPC_CONTRACTS.eval.suites.delete.channel,
            IPC_CONTRACTS.eval.suites.delete.response,
            { id, confirmed }
          )
      },
      cases: {
        list: (suiteId) =>
          invokeContract<EvalCaseRecord[]>(
            invoke,
            IPC_CONTRACTS.eval.cases.list.channel,
            IPC_CONTRACTS.eval.cases.list.response,
            { suiteId }
          ),
        create: (input) =>
          invokeContract<EvalCaseRecord>(
            invoke,
            IPC_CONTRACTS.eval.cases.create.channel,
            IPC_CONTRACTS.eval.cases.create.response,
            input
          ),
        update: (id, input) =>
          invokeContract<EvalCaseRecord | null>(
            invoke,
            IPC_CONTRACTS.eval.cases.update.channel,
            IPC_CONTRACTS.eval.cases.update.response,
            { id, ...input }
          ),
        delete: (id, confirmed) =>
          invokeContract<boolean>(
            invoke,
            IPC_CONTRACTS.eval.cases.delete.channel,
            IPC_CONTRACTS.eval.cases.delete.response,
            { id, confirmed }
          )
      },
      run: {
        start: (request) =>
          invokeContract<EvalRunRecord>(
            invoke,
            IPC_CONTRACTS.eval.run.start.channel,
            IPC_CONTRACTS.eval.run.start.response,
            request
          ),
        abort: (runId) =>
          invokeContract<EvalRunRecord | null>(
            invoke,
            IPC_CONTRACTS.eval.run.abort.channel,
            IPC_CONTRACTS.eval.run.abort.response,
            { runId }
          )
      },
      outputs: {
        list: (runId, blind) =>
          invokeContract<EvalOutputRecord[]>(
            invoke,
            IPC_CONTRACTS.eval.outputs.list.channel,
            IPC_CONTRACTS.eval.outputs.list.response,
            { runId, blind }
          )
      },
      score: {
        human: (request) =>
          invokeContract<EvalScoreRecord>(
            invoke,
            IPC_CONTRACTS.eval.score.human.channel,
            IPC_CONTRACTS.eval.score.human.response,
            request
          ),
        llmJudge: (request) =>
          invokeContract<EvalScoreRecord>(
            invoke,
            IPC_CONTRACTS.eval.score.llmJudge.channel,
            IPC_CONTRACTS.eval.score.llmJudge.response,
            typeof request === "string" ? { outputId: request } : request
          )
      },
      leaderboard: (runId) =>
        invokeContract<EvalLeaderboardEntry[]>(
          invoke,
          IPC_CONTRACTS.eval.leaderboard.channel,
          IPC_CONTRACTS.eval.leaderboard.response,
          { runId }
        ),
      promoteWinnerToRoute: (request) =>
        invokeContract<TaskRouteRecord>(
          invoke,
          IPC_CONTRACTS.eval.promoteWinnerToRoute.channel,
          IPC_CONTRACTS.eval.promoteWinnerToRoute.response,
          request
        ),
      recommendRoutes: (runId) =>
        invokeContract<EvalRouteRecommendations>(
          invoke,
          IPC_CONTRACTS.eval.recommendRoutes.channel,
          IPC_CONTRACTS.eval.recommendRoutes.response,
          { runId }
        ),
      applyRecommendationToRoute: (request) =>
        invokeContract<TaskRouteRecord>(
          invoke,
          IPC_CONTRACTS.eval.applyRecommendationToRoute.channel,
          IPC_CONTRACTS.eval.applyRecommendationToRoute.response,
          request
        ),
      exportReport: (request) =>
        invokeContract<EvalReportResult>(
          invoke,
          IPC_CONTRACTS.eval.exportReport.channel,
          IPC_CONTRACTS.eval.exportReport.response,
          request
        )
    },
    generation: {
      chapter: {
        start: (request) =>
          invokeContract<WorkflowRunRecord>(
            invoke,
            IPC_CONTRACTS.generation.chapter.start.channel,
            IPC_CONTRACTS.generation.chapter.start.response,
            request
          )
      },
      getRun: (runId) =>
        invokeContract<ChapterWorkflowDetail | null>(
          invoke,
          IPC_CONTRACTS.generation.getRun.channel,
          IPC_CONTRACTS.generation.getRun.response,
          { runId }
        ),
      listRunsByChapter: (chapterId) =>
        invokeContract<WorkflowRunRecord[]>(
          invoke,
          IPC_CONTRACTS.generation.listRunsByChapter.channel,
          IPC_CONTRACTS.generation.listRunsByChapter.response,
          { chapterId }
        ),
      streamEvents: (runId, sinceEventId) =>
        invokeContract<WorkflowEventRecord[]>(
          invoke,
          IPC_CONTRACTS.generation.streamEvents.channel,
          IPC_CONTRACTS.generation.streamEvents.response,
          { runId, sinceEventId }
        ),
      abort: (runId) =>
        invokeContract<WorkflowRunRecord | null>(
          invoke,
          IPC_CONTRACTS.generation.abort.channel,
          IPC_CONTRACTS.generation.abort.response,
          { runId }
        ),
      resume: (request) =>
        invokeContract<WorkflowRunRecord>(
          invoke,
          IPC_CONTRACTS.generation.resume.channel,
          IPC_CONTRACTS.generation.resume.response,
          request
        ),
      resumeAfterBudgetWarning: (runId, confirmed) =>
        invokeContract<WorkflowRunRecord | null>(
          invoke,
          IPC_CONTRACTS.generation.resumeAfterBudgetWarning.channel,
          IPC_CONTRACTS.generation.resumeAfterBudgetWarning.response,
          { runId, confirmed }
        ),
      requestRevision: (request) =>
        invokeContract<WorkflowRunRecord>(
          invoke,
          IPC_CONTRACTS.generation.requestRevision.channel,
          IPC_CONTRACTS.generation.requestRevision.response,
          request
        ),
      acceptArtifactAsVersion: (request) =>
        invokeContract<ManuscriptVersionRecord>(
          invoke,
          IPC_CONTRACTS.generation.acceptArtifactAsVersion.channel,
          IPC_CONTRACTS.generation.acceptArtifactAsVersion.response,
          request
        ),
      setAcceptedVersionCanonical: (request) =>
        invokeContract<ManuscriptVersionRecord | null>(
          invoke,
          IPC_CONTRACTS.generation.setAcceptedVersionCanonical.channel,
          IPC_CONTRACTS.generation.setAcceptedVersionCanonical.response,
          request
        ),
      cancel: (runId, confirmed) =>
        invokeContract<WorkflowRunRecord | null>(
          invoke,
          IPC_CONTRACTS.generation.cancel.channel,
          IPC_CONTRACTS.generation.cancel.response,
          { runId, confirmed }
        )
    }
  };
}

export { IPC_CONTRACTS };

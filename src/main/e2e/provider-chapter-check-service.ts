import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import type { CostSummary, LLMTaskType } from "@contracts/ai";
import type { PrivacySettings } from "@contracts/settings";
import { DEFAULT_PRIVACY_SETTINGS } from "@contracts/settings";
import type { WorkflowArtifactRecord, WorkflowEventRecord } from "@contracts/workflow";
import { AiGateway } from "@main/ai/ai-gateway";
import type { WenForgeDatabase } from "@main/db/connection";
import type { RepositoryRegistry } from "@main/db/service";
import { ContextBuilder } from "@main/context/context-builder";
import type { CredentialService } from "@main/providers/credential-service";
import { ModelRouter } from "@main/providers/model-router";
import { ChapterWorkflowRuntime } from "@main/workflows/chapter-workflow-runtime";
import type { QualityMode } from "@shared/domain/model-routing";
import {
  assertNoSensitiveDiagnosticsText,
  redactSensitiveDiagnosticsText
} from "@main/diagnostics/sensitive-value-scan";

export interface ProviderChapterCheckRequest {
  confirmed: boolean;
  budgetCapUsd?: number | null;
  qualityMode?: QualityMode;
}

export interface ProviderChapterCheckResult {
  status: "skipped" | "passed" | "failed" | "blocked";
  runId: string | null;
  reportPath: string | null;
  reportMarkdown: string;
  providersCalled: string[];
  modelsCalled: string[];
  workflowNodes: string[];
  tokenEstimates: Array<{
    taskType: string;
    inputTokensEstimated: number;
    outputTokensEstimatedLive: number;
  }>;
  estimatedCost: number;
  finalCost: number;
  currency: string;
  retryFallbackEvents: Array<Record<string, unknown>>;
  generatedArtifactIds: string[];
  reviewCardCount: number;
  settlementProposalItemCount: number;
  canonicalManuscriptChanged: boolean;
  storyBibleChanged: boolean;
  llmRunIds: string[];
  savedNonCanonicalVersionId: string | null;
  warnings: string[];
  errors: string[];
}

export interface ProviderChapterCheckServiceOptions {
  database: WenForgeDatabase;
  repositories: RepositoryRegistry;
  aiGateway: AiGateway;
  credentialService?: CredentialService | undefined;
  privacy?: PrivacySettings | undefined;
  appVersion?: string | undefined;
  reportsRoot?: string | undefined;
  now?: () => Date;
}

const CHECK_TASKS: LLMTaskType[] = [
  "chapter_outline",
  "scene_cards",
  "draft_chapter",
  "continuity_audit",
  "suspense_hook_audit",
  "revise_chapter",
  "state_settlement"
];

const OUTPUT_TOKEN_BUDGETS: Record<LLMTaskType, number> = {
  brainstorm: 1_000,
  story_bible: 1_000,
  volume_outline: 1_000,
  chapter_outline: 1_500,
  scene_cards: 2_000,
  draft_chapter: 3_000,
  webnovel_style_rewrite: 1_000,
  originality_audit: 1_500,
  plot_logic_audit: 1_500,
  continuity_audit: 1_500,
  suspense_hook_audit: 1_500,
  revise_chapter: 3_000,
  state_settlement: 1_200,
  summarize_chapter: 1_000,
  embedding_or_memory_indexing: 1_000
};

export class ProviderChapterCheckService {
  private readonly privacy: PrivacySettings;

  constructor(private readonly options: ProviderChapterCheckServiceOptions) {
    this.privacy = options.privacy ?? DEFAULT_PRIVACY_SETTINGS;
  }

  async run(request: ProviderChapterCheckRequest): Promise<ProviderChapterCheckResult> {
    if (!request.confirmed) {
      throw new Error("Confirmation is required before running provider chapter check");
    }

    const qualityMode = request.qualityMode ?? "balanced";
    const estimatedCost = this.estimateRouteCost(qualityMode);
    if (
      typeof request.budgetCapUsd === "number" &&
      estimatedCost.summary.maxCost > request.budgetCapUsd
    ) {
      const blocked = this.blockedResult(
        qualityMode,
        `Provider chapter check budget cap exceeded before provider calls: ${estimatedCost.summary.maxCost.toFixed(
          6
        )} USD`,
        estimatedCost.summary.maxCost
      );
      const report = this.writeReport(blocked);
      return { ...blocked, reportPath: report.path, reportMarkdown: report.content };
    }

    const fixture = this.createFixture();
    const beforeCanonical = this.options.repositories.manuscripts.getCanonical(fixture.chapter.id);
    const beforeStoryBibleEntries = this.options.repositories.storyBible.list(fixture.book.id);
    new ContextBuilder(this.options.database, this.options.repositories).previewForChapter({
      projectId: fixture.project.id,
      bookId: fixture.book.id,
      volumeId: fixture.volume.id,
      chapterId: fixture.chapter.id,
      taskType: "draft_chapter",
      qualityMode,
      targetTokenBudget: 12_000,
      includeRecentChapters: 2,
      includeFullRecentChapters: false,
      privacy: this.privacy
    });

    const runtime = new ChapterWorkflowRuntime({
      database: this.options.database,
      repositories: this.options.repositories,
      aiGateway: this.options.aiGateway,
      credentialService: this.options.credentialService,
      privacy: this.privacy
    });

    try {
      const paused = await runtime.startChapterWorkflow({
        projectId: fixture.project.id,
        bookId: fixture.book.id,
        volumeId: fixture.volume.id,
        chapterId: fixture.chapter.id,
        qualityMode,
        executionMode: "provider",
        userInstruction:
          "Provider connectivity QA only. Keep output concise, around 1200-1800 Chinese characters.",
        targetTokenBudget: 12_000,
        confirmed: true
      });
      const pausedDetail = runtime.getRun(paused.id);
      const revisionArtifact = pausedDetail?.artifacts.find(
        (artifact) => artifact.artifactType === "revision"
      );
      const savedVersion = revisionArtifact
        ? runtime.acceptArtifactAsVersion({
            runId: paused.id,
            artifactId: revisionArtifact.id,
            title: "Provider check generated non-canonical version"
          })
        : null;

      await runtime.resume({ runId: paused.id, action: "accept" });
      const detail = runtime.getRun(paused.id);
      const afterCanonical = this.options.repositories.manuscripts.getCanonical(fixture.chapter.id);
      const afterStoryBibleEntries = this.options.repositories.storyBible.list(fixture.book.id);
      const canonicalManuscriptChanged =
        beforeCanonical?.id !== afterCanonical?.id ||
        beforeCanonical?.contentMarkdown !== afterCanonical?.contentMarkdown;
      const storyBibleChanged = beforeStoryBibleEntries.length !== afterStoryBibleEntries.length;
      const result = this.createPassedResult({
        runId: paused.id,
        qualityMode,
        costSummary: detail?.costSummary ?? {
          runCount: 0,
          estimatedCostLive: 0,
          finalCost: 0,
          currency: "USD"
        },
        artifacts: detail?.artifacts ?? [],
        events: detail?.events ?? [],
        reviewCardCount: detail?.reviewCards.length ?? 0,
        settlementProposalItemCount: detail?.settlementProposal?.items.length ?? 0,
        canonicalManuscriptChanged,
        storyBibleChanged,
        savedNonCanonicalVersionId: savedVersion?.id ?? null,
        llmRunIds: detail?.llmRuns.map((run) => run.id) ?? [],
        providersCalled: [...new Set(detail?.llmRuns.map((run) => run.provider) ?? [])],
        modelsCalled: [...new Set(detail?.llmRuns.map((run) => run.model) ?? [])],
        tokenEstimates:
          detail?.llmRuns.map((run) => ({
            taskType: run.taskType,
            inputTokensEstimated: run.inputTokensEstimated,
            outputTokensEstimatedLive: run.outputTokensEstimatedLive
          })) ?? [],
        errors: []
      });
      const report = this.writeReport(result);
      return { ...result, reportPath: report.path, reportMarkdown: report.content };
    } catch (error) {
      const message = redactSensitiveDiagnosticsText(error instanceof Error ? error.message : "");
      const failed = this.createFailedResult(qualityMode, message, estimatedCost.summary.maxCost);
      const report = this.writeReport(failed);
      return { ...failed, reportPath: report.path, reportMarkdown: report.content };
    }
  }

  private estimateRouteCost(qualityMode: QualityMode): {
    summary: { maxCost: number; currency: string };
    warnings: string[];
  } {
    const router = new ModelRouter({
      credentials: this.options.repositories.providerCredentials,
      modelProfiles: this.options.repositories.modelProfiles,
      prices: this.options.repositories.modelPrices,
      priceTiers: this.options.repositories.modelPriceTiers,
      routes: this.options.repositories.taskRoutes,
      providerHealth: this.options.repositories.providerHealth,
      settings: this.options.repositories.settings.get("routing") ?? {
        priceStaleAfterDays: 90,
        missingPriceBehavior: "warn"
      }
    });
    let maxCost = 0;
    let currency = "USD";
    const warnings: string[] = [];
    for (const taskType of CHECK_TASKS) {
      const resolution = router.resolveRoute(taskType, qualityMode, {
        expectedTokens: { inputTokens: 4_000, outputTokens: OUTPUT_TOKEN_BUDGETS[taskType] }
      });
      if (!resolution.available) {
        throw new Error(
          `Provider route unavailable for ${taskType}: ${resolution.errors.join(", ")}`
        );
      }
      maxCost += resolution.estimatedCostRange.maxCost;
      currency = resolution.estimatedCostRange.currency;
      warnings.push(...resolution.warnings.map((warning) => `${taskType}: ${warning}`));
    }
    return { summary: { maxCost, currency }, warnings };
  }

  private createFixture() {
    const project = this.options.repositories.projects.create({
      name: "Provider connectivity chapter check",
      description: "Local QA fixture for provider connectivity checks.",
      genre: "都市异能",
      targetReader: "喜欢快节奏悬疑钩子的中文网文读者"
    });
    const book = this.options.repositories.books.create({
      projectId: project.id,
      title: "雨夜连接检查",
      logline: "一次短小的 provider 连接检查，不进入正式创作 canon。",
      genre: "都市异能",
      targetLengthChapters: 1
    });
    const volume = this.options.repositories.volumes.create({
      bookId: book.id,
      title: "检查卷",
      volumeIndex: 1,
      summary: "只用于本地 provider QA。"
    });
    const chapter = this.options.repositories.chapters.create({
      bookId: book.id,
      volumeId: volume.id,
      chapterIndex: 1,
      title: "雨夜短测",
      targetWords: 1600
    });
    this.options.repositories.manuscripts.saveManualVersion({
      chapterId: chapter.id,
      title: "检查前正稿",
      contentMarkdown: "这是 provider 检查前的本地正稿，不应被自动覆盖。",
      isCanonical: true
    });
    this.options.repositories.storyBible.createEntry({
      bookId: book.id,
      entryType: "world_rule",
      title: "检查隔离规则",
      content: "Provider 检查只能产生提案，不能自动修改 story bible。"
    });
    return { project, book, volume, chapter };
  }

  private createPassedResult(input: {
    runId: string;
    qualityMode: QualityMode;
    costSummary: CostSummary;
    artifacts: WorkflowArtifactRecord[];
    events: WorkflowEventRecord[];
    reviewCardCount: number;
    settlementProposalItemCount: number;
    canonicalManuscriptChanged: boolean;
    storyBibleChanged: boolean;
    savedNonCanonicalVersionId: string | null;
    llmRunIds: string[];
    providersCalled: string[];
    modelsCalled: string[];
    tokenEstimates: ProviderChapterCheckResult["tokenEstimates"];
    errors: string[];
  }): ProviderChapterCheckResult {
    return {
      status: input.canonicalManuscriptChanged || input.storyBibleChanged ? "failed" : "passed",
      runId: input.runId,
      reportPath: null,
      reportMarkdown: "",
      providersCalled: input.providersCalled,
      modelsCalled: input.modelsCalled,
      workflowNodes: input.events
        .filter((event) => event.eventType === "node_completed")
        .map((event) => event.nodeName ?? "unknown"),
      tokenEstimates: input.tokenEstimates,
      estimatedCost: input.costSummary.estimatedCostLive,
      finalCost: input.costSummary.finalCost,
      currency: input.costSummary.currency,
      retryFallbackEvents: input.events
        .filter((event) => event.eventType === "model_route_completed")
        .map((event) => event.payload),
      generatedArtifactIds: input.artifacts.map((artifact) => artifact.id),
      reviewCardCount: input.reviewCardCount,
      settlementProposalItemCount: input.settlementProposalItemCount,
      canonicalManuscriptChanged: input.canonicalManuscriptChanged,
      storyBibleChanged: input.storyBibleChanged,
      llmRunIds: input.llmRunIds,
      savedNonCanonicalVersionId: input.savedNonCanonicalVersionId,
      warnings: [],
      errors: input.errors
    };
  }

  private createFailedResult(
    qualityMode: QualityMode,
    error: string,
    estimatedCost: number
  ): ProviderChapterCheckResult {
    return {
      status: "failed",
      runId: null,
      reportPath: null,
      reportMarkdown: "",
      providersCalled: [],
      modelsCalled: [],
      workflowNodes: [],
      tokenEstimates: [],
      estimatedCost,
      finalCost: 0,
      currency: "USD",
      retryFallbackEvents: [],
      generatedArtifactIds: [],
      reviewCardCount: 0,
      settlementProposalItemCount: 0,
      canonicalManuscriptChanged: false,
      storyBibleChanged: false,
      llmRunIds: [],
      savedNonCanonicalVersionId: null,
      warnings: [`quality mode: ${qualityMode}`],
      errors: [error]
    };
  }

  private blockedResult(
    qualityMode: QualityMode,
    error: string,
    estimatedCost: number
  ): ProviderChapterCheckResult {
    return {
      ...this.createFailedResult(qualityMode, error, estimatedCost),
      status: "blocked"
    };
  }

  private writeReport(result: ProviderChapterCheckResult): { path: string; content: string } {
    const report = this.renderReport(result);
    const outputDir = join(this.options.reportsRoot ?? "reports", "e2e-provider-checks");
    mkdirSync(outputDir, { recursive: true });
    const now = this.options.now?.() ?? new Date();
    const outputPath = join(outputDir, `${formatReportTimestamp(now)}.md`);
    writeFileSync(outputPath, report, "utf8");
    return { path: outputPath, content: report };
  }

  private renderReport(result: ProviderChapterCheckResult): string {
    const lines = [
      "# Provider Chapter Connectivity Check",
      "",
      `timestamp: ${(this.options.now?.() ?? new Date()).toISOString()}`,
      `app version: ${this.options.appVersion ?? "unknown"}`,
      `status: ${result.status}`,
      `run id: ${result.runId ?? "none"}`,
      `providers called: ${result.providersCalled.join(", ") || "none"}`,
      `models called: ${result.modelsCalled.join(", ") || "none"}`,
      `workflow nodes: ${result.workflowNodes.join(", ") || "none"}`,
      `estimated cost: ${result.estimatedCost.toFixed(6)} ${result.currency}`,
      `final cost: ${result.finalCost.toFixed(6)} ${result.currency}`,
      `llm runs: ${result.llmRunIds.join(", ") || "none"}`,
      `generated artifact IDs: ${result.generatedArtifactIds.join(", ") || "none"}`,
      `review card count: ${result.reviewCardCount}`,
      `settlement proposal count: ${result.settlementProposalItemCount}`,
      `canonical manuscript changed: ${String(result.canonicalManuscriptChanged)}`,
      `story bible changed: ${String(result.storyBibleChanged)}`,
      `saved non-canonical version id: ${result.savedNonCanonicalVersionId ?? "none"}`,
      "sensitive values omitted: true",
      "",
      "## Token Estimates",
      "",
      "| task | input estimated | output estimated/live |",
      "| --- | --- | --- |",
      ...result.tokenEstimates.map(
        (entry) =>
          `| ${entry.taskType} | ${entry.inputTokensEstimated} | ${entry.outputTokensEstimatedLive} |`
      ),
      "",
      "## Retry And Fallback Events",
      "",
      result.retryFallbackEvents.length === 0
        ? "none"
        : JSON.stringify(result.retryFallbackEvents, null, 2),
      "",
      "## Warnings And Errors",
      "",
      result.warnings.concat(result.errors).length === 0
        ? "none"
        : result.warnings.concat(result.errors).join("\n")
    ];
    const report = redactSensitiveDiagnosticsText(lines.join("\n"));
    assertNoSensitiveDiagnosticsText(report);
    return report;
  }
}

export function shouldRunProviderChapterCheck(env: Record<string, string | undefined>): boolean {
  if (env.CI) {
    return false;
  }
  return env.RUN_REAL_PROVIDER_CHECKS?.toLowerCase() === "true";
}

export function parseProviderChapterCheckBudget(env: Record<string, string | undefined>): number {
  const parsed = Number(env.REAL_E2E_CHECK_BUDGET_USD ?? "3");
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 3;
}

function formatReportTimestamp(date: Date): string {
  const pad = (value: number): string => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}-${pad(
    date.getHours()
  )}-${pad(date.getMinutes())}`;
}

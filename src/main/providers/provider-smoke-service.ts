import type { AIProviderId, LLMTaskType, StreamRequest } from "@contracts/ai";
import type { ModelPriceRecord, ModelProfileRecord } from "@contracts/model-routing";
import { PROVIDERS } from "@shared/domain/model-routing";
import type { ProviderId } from "@shared/domain/model-routing";
import type { AiGateway } from "@main/ai/ai-gateway";
import { CostCalculator } from "@main/ai/cost-calculator";
import type { ProviderAdapter } from "@main/ai/provider-adapter";
import { ProviderAdapterError } from "@main/ai/provider-adapter";
import { TokenEstimator } from "@main/ai/token-estimator";
import type { RepositoryRegistry } from "@main/db/service";
import type { CredentialService } from "@main/providers/credential-service";
import { RedactionService } from "@main/security/redaction-service";
import { selectSmokeModel } from "./provider-model-catalog-service";

export type ProviderSmokeStatus = "skipped" | "passed" | "failed" | "blocked";

export interface ProviderSmokeRunRequest {
  provider: ProviderId;
  confirmed: boolean;
  budgetCapUsd?: number | null;
}

export interface ProviderSmokeResult {
  provider: ProviderId;
  model: string | null;
  configured: boolean;
  tested: boolean;
  status: ProviderSmokeStatus;
  streamingSupported: boolean;
  nonStreamingSupported: boolean;
  usageParsed: boolean;
  finalCostComputed: boolean;
  fallbackEligible: boolean;
  error: string | null;
  testedAt: string | null;
  latencyMs: number | null;
  estimatedCost: number | null;
  finalCost: number | null;
  runIds: string[];
}

export interface ProviderSmokeServiceOptions {
  repositories: RepositoryRegistry;
  aiGateway: AiGateway;
  adapters: ProviderAdapter[];
  credentialService?: CredentialService;
  tokenEstimator?: TokenEstimator;
  costCalculator?: CostCalculator;
}

const SMOKE_TASK_TYPE: LLMTaskType = "brainstorm";
const SMOKE_MAX_OUTPUT_TOKENS = 80;

export class ProviderSmokeService {
  private readonly adapters: Map<AIProviderId, ProviderAdapter>;
  private readonly tokenEstimator: TokenEstimator;
  private readonly costCalculator: CostCalculator;
  private readonly redaction = new RedactionService();

  constructor(private readonly options: ProviderSmokeServiceOptions) {
    this.adapters = new Map(options.adapters.map((adapter) => [adapter.id, adapter]));
    this.tokenEstimator = options.tokenEstimator ?? new TokenEstimator();
    this.costCalculator = options.costCalculator ?? new CostCalculator();
  }

  async runProviderSmoke(request: ProviderSmokeRunRequest): Promise<ProviderSmokeResult> {
    if (!request.confirmed) {
      throw new Error("Confirmation is required before making a real provider smoke call");
    }

    const adapter = this.adapters.get(request.provider);
    const modelProfile = this.options.repositories.modelProfiles
      .list()
      .find((profile) => profile.provider === request.provider && profile.enabled);
    const credential = this.options.repositories.providerCredentials.listConfiguredByProvider(
      request.provider
    )[0];
    let baseResult = this.createBaseResult(request.provider, {
      model: modelProfile?.model ?? null,
      configured: Boolean(credential && modelProfile),
      streamingSupported: Boolean(adapter?.capabilities.streaming),
      nonStreamingSupported: Boolean(adapter)
    });

    if (!credential || !modelProfile) {
      return {
        ...baseResult,
        status: "skipped",
        error: "Provider credential or enabled model profile is missing"
      };
    }
    if (!adapter) {
      return { ...baseResult, status: "failed", tested: true, error: "provider_not_implemented" };
    }
    if (!adapter.capabilities.streaming && !adapter.capabilities.json) {
      return { ...baseResult, status: "failed", tested: true, error: "provider_not_implemented" };
    }

    const price = this.options.repositories.modelPrices.findActive(
      modelProfile.provider,
      modelProfile.model
    );
    const preflightCost = this.estimatePreflightCost(price);
    if (typeof request.budgetCapUsd === "number" && preflightCost > request.budgetCapUsd) {
      return {
        ...baseResult,
        status: "blocked",
        error: `Smoke test budget cap exceeded before provider call: ${preflightCost.toFixed(6)} USD`,
        estimatedCost: preflightCost
      };
    }

    const runIds: string[] = [];
    const startedAt = Date.now();
    try {
      const decryptedCredential =
        this.options.credentialService?.getDecryptedProviderCredential(request.provider) ?? null;
      const availableModels =
        adapter.listModels && decryptedCredential
          ? await adapter.listModels({
              apiKey: decryptedCredential.apiKey,
              baseUrl: decryptedCredential.baseUrl
            })
          : [];
      const smokeModel = selectSmokeModel({
        provider: request.provider,
        configuredModel: modelProfile.model,
        availableModels
      });
      this.ensureSmokeModelProfile(request.provider, smokeModel, modelProfile);
      baseResult = { ...baseResult, model: smokeModel };

      if (adapter.capabilities.streaming) {
        const streamStarted = await this.options.aiGateway.startStream(
          this.createRequest(request.provider, smokeModel),
          () => undefined
        );
        runIds.push(streamStarted.runId);
        await this.options.aiGateway.waitForRun(streamStarted.runId);
      }

      const generated = await this.options.aiGateway.generateText(
        this.createRequest(request.provider, smokeModel)
      );
      runIds.push(generated.runId);

      const runs = runIds
        .map((runId) => this.options.repositories.cost.getRun(runId))
        .filter((run) => run !== null);
      const failedRun = runs.find((run) => run.status === "failed" || run.status === "cancelled");
      if (failedRun) {
        throw new Error(failedRun.errorMessage ?? failedRun.errorCode ?? "Provider smoke failed");
      }

      const finalCost = runs.reduce((sum, run) => sum + (run.finalCost ?? 0), 0);
      this.options.repositories.providerHealth.recordSuccess(
        request.provider,
        smokeModel,
        generated.runId
      );
      this.options.repositories.providerCredentials.updateStatus(
        credential.id,
        "test_passed",
        new Date().toISOString()
      );
      return {
        ...baseResult,
        tested: true,
        status: "passed",
        usageParsed: runs.some((run) => run.usageSource === "provider"),
        finalCostComputed: runs.every((run) => run.finalCost !== null),
        testedAt: new Date().toISOString(),
        latencyMs: Date.now() - startedAt,
        estimatedCost: finalCost,
        finalCost,
        runIds
      };
    } catch (error) {
      const safeError = this.safeError(error);
      this.options.repositories.providerHealth.recordFailure({
        provider: request.provider,
        model: baseResult.model ?? modelProfile.model,
        code: safeError.code,
        message: safeError.message,
        terminal: safeError.code.includes("auth")
      });
      this.options.repositories.providerCredentials.updateStatus(
        credential.id,
        "test_failed",
        new Date().toISOString()
      );
      return {
        ...baseResult,
        tested: true,
        status: "failed",
        error: safeError.message,
        testedAt: new Date().toISOString(),
        latencyMs: Date.now() - startedAt,
        runIds
      };
    }
  }

  async runAllConfigured(input: {
    confirmed: boolean;
    budgetCapUsd?: number | null;
  }): Promise<ProviderSmokeResult[]> {
    const configuredProviders = new Set(
      this.options.repositories.providerCredentials
        .list()
        .filter((credential) => credential.isConfigured)
        .map((credential) => credential.provider)
    );
    const results: ProviderSmokeResult[] = [];
    let remainingBudget = typeof input.budgetCapUsd === "number" ? input.budgetCapUsd : null;
    let budgetExhausted = false;
    for (const provider of PROVIDERS) {
      if (!configuredProviders.has(provider)) {
        const adapter = this.adapters.get(provider);
        results.push(
          this.createBaseResult(provider, {
            configured: false,
            streamingSupported: Boolean(adapter?.capabilities.streaming),
            nonStreamingSupported: Boolean(adapter)
          })
        );
        continue;
      }
      if (budgetExhausted) {
        const adapter = this.adapters.get(provider);
        const modelProfile = this.options.repositories.modelProfiles
          .list()
          .find((profile) => profile.provider === provider && profile.enabled);
        results.push({
          ...this.createBaseResult(provider, {
            model: modelProfile?.model ?? null,
            configured: true,
            streamingSupported: Boolean(adapter?.capabilities.streaming),
            nonStreamingSupported: Boolean(adapter)
          }),
          status: "blocked",
          error: "Global provider check budget cap exceeded before provider call"
        });
        continue;
      }
      const result = await this.runProviderSmoke({
        provider,
        confirmed: input.confirmed,
        ...(typeof remainingBudget === "number" ? { budgetCapUsd: remainingBudget } : {})
      });
      results.push(result);
      if (typeof remainingBudget === "number") {
        remainingBudget -= result.finalCost ?? result.estimatedCost ?? 0;
        if (result.status === "blocked" || remainingBudget <= 0) {
          budgetExhausted = true;
        }
      }
    }
    return results;
  }

  buildUntestedReport(): ProviderSmokeResult[] {
    return PROVIDERS.map((provider) => {
      const configured = Boolean(
        this.options.repositories.providerCredentials.listConfiguredByProvider(provider)[0]
      );
      const adapter = this.adapters.get(provider);
      return this.createBaseResult(provider, {
        configured,
        streamingSupported: Boolean(adapter?.capabilities.streaming),
        nonStreamingSupported: Boolean(adapter)
      });
    });
  }

  private createRequest(provider: ProviderId, model: string): StreamRequest {
    return {
      provider,
      model,
      taskType: SMOKE_TASK_TYPE,
      messages: [
        {
          role: "user",
          content: `Return a tiny JSON object only: { "ok": true, "provider": "${provider}", "message": "pong" }`
        }
      ],
      creativityIntent: "deterministic",
      maxOutputTokens: SMOKE_MAX_OUTPUT_TOKENS
    };
  }

  private estimatePreflightCost(price: ModelPriceRecord | null): number {
    const inputTokens = this.tokenEstimator.estimateMessages(
      this.createRequest("openai", "smoke-model").messages
    );
    const singleCall = this.costCalculator.calculate({
      usage: { inputTokens, outputTokens: SMOKE_MAX_OUTPUT_TOKENS },
      price: price ?? {
        inputPricePerMillion: 0,
        outputPricePerMillion: 0,
        cachedInputPricePerMillion: null,
        currency: "USD"
      },
      estimated: true
    }).totalCost;
    return singleCall * 2;
  }

  private ensureSmokeModelProfile(
    provider: ProviderId,
    model: string,
    baseProfile: ModelProfileRecord
  ): void {
    if (this.options.repositories.modelProfiles.find(provider, model)) {
      return;
    }
    this.options.repositories.modelProfiles.upsert({
      provider,
      model,
      alias: null,
      displayName: model,
      contextWindow: baseProfile.contextWindow,
      maxOutputTokens: baseProfile.maxOutputTokens,
      supportsStreaming: baseProfile.supportsStreaming,
      supportsJson: baseProfile.supportsJson,
      supportsTools: baseProfile.supportsTools,
      supportsVision: baseProfile.supportsVision,
      supportsPromptCaching: baseProfile.supportsPromptCaching,
      supportsTemperature:
        provider === "anthropic" || provider === "moonshot_kimi"
          ? false
          : baseProfile.supportsTemperature,
      supportsTopP: provider === "anthropic" ? false : baseProfile.supportsTopP,
      supportsTopK: provider === "anthropic" ? false : baseProfile.supportsTopK,
      supportsFrequencyPenalty: baseProfile.supportsFrequencyPenalty,
      supportsPresencePenalty: baseProfile.supportsPresencePenalty,
      supportsStop: baseProfile.supportsStop,
      supportsReasoningEffort: baseProfile.supportsReasoningEffort,
      supportsAdaptiveThinking: baseProfile.supportsAdaptiveThinking,
      supportsManualThinkingBudget: baseProfile.supportsManualThinkingBudget,
      maxOutputParamName: baseProfile.maxOutputParamName,
      endpointFamily: baseProfile.endpointFamily,
      supportsResponsesApi: baseProfile.supportsResponsesApi,
      supportsChatCompletions: baseProfile.supportsChatCompletions,
      defaultTemperature: baseProfile.defaultTemperature,
      enabled: true
    });
  }

  private createBaseResult(
    provider: ProviderId,
    input: {
      model?: string | null;
      configured: boolean;
      streamingSupported: boolean;
      nonStreamingSupported: boolean;
    }
  ): ProviderSmokeResult {
    return {
      provider,
      model: input.model ?? null,
      configured: input.configured,
      tested: false,
      status: "skipped",
      streamingSupported: input.streamingSupported,
      nonStreamingSupported: input.nonStreamingSupported,
      usageParsed: false,
      finalCostComputed: false,
      fallbackEligible: input.configured,
      error: null,
      testedAt: null,
      latencyMs: null,
      estimatedCost: null,
      finalCost: null,
      runIds: []
    };
  }

  private safeError(error: unknown): { code: string; message: string } {
    if (error instanceof ProviderAdapterError) {
      return {
        code: error.providerError.code,
        message: this.redaction.redact(error.providerError.message)
      };
    }
    if (error instanceof Error) {
      return { code: "provider_smoke_failed", message: this.redaction.redact(error.message) };
    }
    return { code: "provider_smoke_failed", message: "Provider smoke test failed" };
  }
}

export function shouldRunRealProviderSmoke(env: Record<string, string | undefined>): boolean {
  if (env.CI) {
    return false;
  }
  return (
    env.RUN_REAL_PROVIDER_TESTS?.toLowerCase() === "true" ||
    env.RUN_REAL_PROVIDER_CHECKS?.toLowerCase() === "true"
  );
}

export function parseProviderSmokeBudget(env: Record<string, string | undefined>): number {
  const parsed = Number(env.REAL_PROVIDER_TEST_BUDGET_USD ?? env.REAL_PROVIDER_CHECK_BUDGET_USD);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 2;
}

export function renderProviderConformanceReport(results: ProviderSmokeResult[]): string {
  const redaction = new RedactionService();
  const lines = [
    "# Provider Conformance Report",
    "",
    `Generated: ${new Date().toISOString()}`,
    "",
    "| provider | configured | tested | streaming | usage parsed | final cost | fallback eligible | status | error |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- |"
  ];
  for (const result of results) {
    lines.push(
      [
        result.provider,
        String(result.configured),
        String(result.tested),
        String(result.streamingSupported),
        String(result.usageParsed),
        String(result.finalCostComputed),
        String(result.fallbackEligible),
        result.status,
        redaction.redact(result.error ?? "")
      ]
        .join(" | ")
        .replace(/^/, "| ")
        .replace(/$/, " |")
    );
  }
  lines.push("");
  return lines.join("\n");
}

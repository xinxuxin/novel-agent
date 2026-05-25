import type {
  AIProviderId,
  AIStreamEvent,
  CostBreakdown,
  StreamRequest,
  StreamStartResult,
  TokenUsage
} from "@contracts/ai";
import { toModelProviderId } from "@contracts/ai";
import type { ModelPriceRecord } from "@contracts/model-routing";
import { DEFAULT_ROUTING_SETTINGS } from "@contracts/settings";
import type { RoutingSettings } from "@contracts/settings";
import type { RepositoryRegistry } from "@main/db/service";
import type { CredentialService } from "@main/providers/credential-service";
import { ModelRouter } from "@main/providers/model-router";
import { SafeIpcError } from "@main/ipc/typed-ipc";
import { CostCalculator } from "./cost-calculator";
import { hashMessages, sha256Hex } from "./hash";
import type { ProviderAdapter, ProviderAdapterConfig } from "./provider-adapter";
import { ProviderAdapterError } from "./provider-adapter";
import { TokenEstimator } from "./token-estimator";

export interface AiGatewayOptions {
  repositories: RepositoryRegistry;
  credentialService: CredentialService;
  adapters: ProviderAdapter[];
  tokenEstimator?: TokenEstimator;
  costCalculator?: CostCalculator;
}

interface ResolvedRequest {
  provider: AIProviderId;
  model: string;
  price: ModelPriceRecord | null;
  config: ProviderAdapterConfig;
  temperature: number | undefined;
  maxOutputTokens: number | undefined;
  warnings: string[];
}

interface ActiveRun {
  abortController: AbortController;
  finished: Promise<void>;
}

export class AiGateway {
  private readonly adapters: Map<AIProviderId, ProviderAdapter>;
  private readonly tokenEstimator: TokenEstimator;
  private readonly costCalculator: CostCalculator;
  private readonly activeRuns = new Map<string, ActiveRun>();

  constructor(private readonly options: AiGatewayOptions) {
    this.adapters = new Map(options.adapters.map((adapter) => [adapter.id, adapter]));
    this.tokenEstimator = options.tokenEstimator ?? new TokenEstimator();
    this.costCalculator = options.costCalculator ?? new CostCalculator();
  }

  async startStream(
    request: StreamRequest,
    emit: (event: AIStreamEvent) => void
  ): Promise<StreamStartResult> {
    const resolved = this.resolveRequest(request);
    const adapter = this.adapters.get(resolved.provider);
    if (!adapter) {
      throw new SafeIpcError("PROVIDER_UNAVAILABLE", "No provider adapter is available");
    }
    adapter.validateConfig(resolved.config);

    const inputTokensEstimated = this.tokenEstimator.estimateMessages(request.messages);
    const initialCost = this.calculateCost(
      {
        inputTokens: inputTokensEstimated,
        outputTokens: 0
      },
      resolved.price,
      true
    );
    const run = this.options.repositories.cost.createLlmRun({
      provider: resolved.provider,
      model: resolved.model,
      taskType: request.taskType,
      projectId: request.projectId ?? null,
      bookId: request.bookId ?? null,
      chapterId: request.chapterId ?? null,
      inputTokensEstimated,
      estimatedCostLive: initialCost.totalCost,
      currency: initialCost.currency,
      promptHash: hashMessages(request.messages)
    });

    const abortController = new AbortController();
    const startedAt = Date.now();
    const runRequest: StreamRequest = {
      ...request,
      provider: resolved.provider,
      model: resolved.model,
      temperature: request.temperature ?? resolved.temperature,
      maxOutputTokens: request.maxOutputTokens ?? resolved.maxOutputTokens
    };
    const finished = this.runProviderStream({
      adapter,
      request: runRequest,
      resolved,
      runId: run.id,
      startedAt,
      inputTokensEstimated,
      abortController,
      emit
    }).finally(() => {
      this.activeRuns.delete(run.id);
    });
    this.activeRuns.set(run.id, { abortController, finished });

    emit({
      type: "cost",
      runId: run.id,
      provider: resolved.provider,
      model: resolved.model,
      taskType: request.taskType,
      at: new Date().toISOString(),
      inputTokensEstimated,
      outputTokensEstimatedLive: 0,
      estimatedCostLive: initialCost.totalCost,
      currency: initialCost.currency,
      usageSource: "estimated",
      warnings: resolved.warnings
    });

    return { runId: run.id };
  }

  abortRun(runId: string): boolean {
    const activeRun = this.activeRuns.get(runId);
    if (!activeRun) {
      return false;
    }
    activeRun.abortController.abort();
    return true;
  }

  async waitForRun(runId: string): Promise<void> {
    await this.activeRuns.get(runId)?.finished;
  }

  private async runProviderStream(input: {
    adapter: ProviderAdapter;
    request: StreamRequest;
    resolved: ResolvedRequest;
    runId: string;
    startedAt: number;
    inputTokensEstimated: number;
    abortController: AbortController;
    emit: (event: AIStreamEvent) => void;
  }): Promise<void> {
    let generatedText = "";
    let latestUsage: TokenUsage | null = null;
    let outputTokensEstimatedLive = 0;
    let estimatedCostLive = 0;

    const emitCost = (): void => {
      const cost = this.calculateCost(
        {
          inputTokens: input.inputTokensEstimated,
          outputTokens: outputTokensEstimatedLive
        },
        input.resolved.price,
        true
      );
      estimatedCostLive = cost.totalCost;
      this.options.repositories.cost.updateLiveRun(input.runId, {
        outputTokensEstimatedLive,
        estimatedCostLive
      });
      input.emit({
        type: "cost",
        runId: input.runId,
        provider: input.resolved.provider,
        model: input.resolved.model,
        taskType: input.request.taskType,
        at: new Date().toISOString(),
        inputTokensEstimated: input.inputTokensEstimated,
        outputTokensEstimatedLive,
        estimatedCostLive,
        currency: cost.currency,
        usageSource: "estimated",
        warnings: input.resolved.warnings
      });
    };

    try {
      const response = await input.adapter.streamChat(
        input.request,
        {
          onDelta: (delta) => {
            generatedText += delta;
            outputTokensEstimatedLive = this.tokenEstimator.estimateText(generatedText);
            input.emit({
              type: "delta",
              runId: input.runId,
              provider: input.resolved.provider,
              model: input.resolved.model,
              taskType: input.request.taskType,
              at: new Date().toISOString(),
              text: delta
            });
            emitCost();
          },
          onUsage: (usage) => {
            latestUsage = usage;
          }
        },
        input.abortController.signal,
        input.resolved.config
      );
      latestUsage = response.usage ?? latestUsage;
      const finalUsage = latestUsage ?? {
        inputTokens: input.inputTokensEstimated,
        outputTokens: outputTokensEstimatedLive
      };
      const usageSource = latestUsage ? "provider" : "estimated";
      const finalCost = this.calculateCost(finalUsage, input.resolved.price, !latestUsage);
      this.options.repositories.cost.finishRun(input.runId, {
        status: "succeeded",
        outputTokensEstimatedLive,
        inputTokensReported: latestUsage?.inputTokens ?? null,
        outputTokensReported: latestUsage?.outputTokens ?? null,
        cachedInputTokensReported: latestUsage?.cachedInputTokens ?? null,
        usageSource,
        estimatedCostLive,
        finalCost: finalCost.totalCost,
        latencyMs: Date.now() - input.startedAt,
        responseHash: sha256Hex(response.text)
      });
      input.emit({
        type: "complete",
        runId: input.runId,
        provider: input.resolved.provider,
        model: input.resolved.model,
        taskType: input.request.taskType,
        at: new Date().toISOString(),
        text: response.text,
        usage: finalUsage,
        cost: finalCost,
        usageSource
      });
    } catch (error) {
      const providerError = this.normalizeError(input.adapter, error);
      const status = providerError.code === "aborted" ? "cancelled" : "failed";
      const estimatedUsage = {
        inputTokens: input.inputTokensEstimated,
        outputTokens: outputTokensEstimatedLive
      };
      const finalCost = this.calculateCost(estimatedUsage, input.resolved.price, true);
      this.options.repositories.cost.finishRun(input.runId, {
        status,
        outputTokensEstimatedLive,
        usageSource: "estimated",
        estimatedCostLive: finalCost.totalCost,
        finalCost: finalCost.totalCost,
        latencyMs: Date.now() - input.startedAt,
        errorCode: providerError.code,
        errorMessage: providerError.message,
        responseHash: generatedText ? sha256Hex(generatedText) : null
      });
      input.emit({
        type: "error",
        runId: input.runId,
        provider: input.resolved.provider,
        model: input.resolved.model,
        taskType: input.request.taskType,
        at: new Date().toISOString(),
        code: providerError.code,
        message: providerError.message,
        retryable: providerError.retryable
      });
    }
  }

  private resolveRequest(request: StreamRequest): ResolvedRequest {
    if (request.provider === "fake") {
      return {
        provider: "fake",
        model: request.model ?? "fake-story-model",
        price: null,
        config: {},
        temperature: request.temperature,
        maxOutputTokens: request.maxOutputTokens,
        warnings: ["fake_provider"]
      };
    }

    if (request.provider && request.model) {
      const providerId = toModelProviderId(request.provider);
      if (!providerId) {
        throw new SafeIpcError("INVALID_PROVIDER", "Invalid model provider");
      }
      const credential = this.options.credentialService.getDecryptedProviderCredential(providerId);
      if (!credential) {
        throw new SafeIpcError("MISSING_CREDENTIAL", "No configured credential is available");
      }
      return {
        provider: request.provider,
        model: request.model,
        price: this.options.repositories.modelPrices.findActive(providerId, request.model),
        config: { apiKey: credential.apiKey, baseUrl: credential.baseUrl },
        temperature: request.temperature,
        maxOutputTokens: request.maxOutputTokens,
        warnings: []
      };
    }

    const routingSettings =
      this.options.repositories.settings.get<RoutingSettings>("routing") ??
      DEFAULT_ROUTING_SETTINGS;
    const resolved = new ModelRouter({
      credentials: this.options.repositories.providerCredentials,
      modelProfiles: this.options.repositories.modelProfiles,
      prices: this.options.repositories.modelPrices,
      routes: this.options.repositories.taskRoutes,
      settings: routingSettings
    }).resolveRoute(request.taskType, request.qualityMode ?? "balanced");

    if (!resolved.available || !resolved.modelProfile) {
      throw new SafeIpcError(
        "ROUTE_UNAVAILABLE",
        resolved.errors.join(", ") || "No available route"
      );
    }
    const credential = this.options.credentialService.getDecryptedProviderCredential(
      resolved.modelProfile.provider
    );
    if (!credential) {
      throw new SafeIpcError("MISSING_CREDENTIAL", "No configured credential is available");
    }

    return {
      provider: resolved.modelProfile.provider,
      model: resolved.modelProfile.model,
      price: resolved.price,
      config: { apiKey: credential.apiKey, baseUrl: credential.baseUrl },
      temperature: request.temperature ?? resolved.route?.temperature,
      maxOutputTokens: request.maxOutputTokens ?? resolved.route?.maxOutputTokens,
      warnings: resolved.warnings
    };
  }

  private calculateCost(
    usage: TokenUsage,
    price: ModelPriceRecord | null,
    estimated: boolean
  ): CostBreakdown {
    return this.costCalculator.calculate({
      usage,
      price: price ?? {
        inputPricePerMillion: 0,
        outputPricePerMillion: 0,
        cachedInputPricePerMillion: null,
        currency: "USD"
      },
      estimated
    });
  }

  private normalizeError(adapter: ProviderAdapter, error: unknown) {
    if (error instanceof ProviderAdapterError) {
      return error.providerError;
    }
    return adapter.normalizeError(error);
  }
}

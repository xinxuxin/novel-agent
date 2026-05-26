import type { ChatMessage, LLMTaskType, ProviderError, StreamRequest } from "@contracts/ai";
import type { ModelProfileRecord, RoutePreviewContext } from "@contracts/model-routing";
import { DEFAULT_ROUTING_SETTINGS } from "@contracts/settings";
import type { RoutingSettings } from "@contracts/settings";
import type { QualityMode } from "@shared/domain/model-routing";
import type { AiGateway } from "@main/ai/ai-gateway";
import { ProviderAdapterError } from "@main/ai/provider-adapter";
import type { RepositoryRegistry } from "@main/db/service";
import type { CredentialService } from "@main/providers/credential-service";
import { ModelRouter } from "@main/providers/model-router";

export interface WorkflowModelAttempt {
  provider: string;
  model: string;
  status: "succeeded" | "failed";
  llmRunId: string | null;
  errorCode: string | null;
  latencyMs: number | null;
}

export interface WorkflowModelExecutorResult {
  text: string;
  provider: string;
  model: string;
  llmRunId: string;
  attempts: WorkflowModelAttempt[];
  repairedJson: boolean;
  budgetAction: "none" | "warn" | "pause" | "abort";
}

export interface WorkflowModelExecutorInput {
  generationRunId: string;
  taskType: LLMTaskType;
  qualityMode: QualityMode;
  projectId?: string | undefined;
  bookId?: string | undefined;
  chapterId?: string | undefined;
  messages: ChatMessage[];
  expectedOutputTokens: number;
  requireJson?: boolean | undefined;
  preflightMaxCost?: number | undefined;
  userOverrideModelProfileId?: string | null | undefined;
}

export class WorkflowProviderError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly attempts: WorkflowModelAttempt[]
  ) {
    super(message);
    this.name = "WorkflowProviderError";
  }
}

export interface WorkflowModelExecutorOptions {
  aiGateway: AiGateway;
  repositories: RepositoryRegistry;
  credentialService?: CredentialService | undefined;
  retryDelayMs?: number | undefined;
}

export class WorkflowModelExecutor {
  constructor(private readonly options: WorkflowModelExecutorOptions) {}

  async runNode(input: WorkflowModelExecutorInput): Promise<WorkflowModelExecutorResult> {
    const routingSettings =
      this.options.repositories.settings.get<RoutingSettings>("routing") ??
      DEFAULT_ROUTING_SETTINGS;
    const router = new ModelRouter({
      credentials: this.options.repositories.providerCredentials,
      modelProfiles: this.options.repositories.modelProfiles,
      prices: this.options.repositories.modelPrices,
      priceTiers: this.options.repositories.modelPriceTiers,
      routes: this.options.repositories.taskRoutes,
      providerHealth: this.options.repositories.providerHealth,
      settings: routingSettings
    });
    const routeContext: RoutePreviewContext = {
      expectedTokens: {
        inputTokens: estimateMessages(input.messages),
        outputTokens: input.expectedOutputTokens
      }
    };
    if (typeof input.userOverrideModelProfileId !== "undefined") {
      routeContext.userOverrideModelProfileId = input.userOverrideModelProfileId;
    }
    const route = router.resolveRoute(input.taskType, input.qualityMode, routeContext);
    if (!route.available || !route.modelProfile) {
      throw new WorkflowProviderError(
        "route_unavailable",
        route.errors.join(", ") || "Route unavailable",
        []
      );
    }

    const policy = this.options.repositories.budgetPolicies.getDefault();
    if (
      policy.perCallBudgetCap !== null &&
      route.estimatedCostRange.maxCost > policy.perCallBudgetCap
    ) {
      throw new WorkflowProviderError("budget_exceeded", "Per-call budget cap exceeded", []);
    }

    const candidates = [route.modelProfile, ...route.fallbackModels];
    const attempts: WorkflowModelAttempt[] = [];
    let lastError: ProviderError | null = null;

    for (const candidate of candidates) {
      const result = await this.tryCandidate(input, candidate, attempts);
      if (result.ok) {
        router.recordRouteOutcome(result.value.llmRunId, candidate.provider, candidate.model, {
          status: "succeeded"
        });
        const budgetAction = this.evaluateLiveBudget(input.preflightMaxCost, result.value.cost);
        return {
          text: result.value.text,
          provider: candidate.provider,
          model: candidate.model,
          llmRunId: result.value.llmRunId,
          attempts,
          repairedJson: result.value.repairedJson,
          budgetAction
        };
      }

      lastError = result.error;
      router.recordRouteOutcome(input.generationRunId, candidate.provider, candidate.model, {
        status: "failed",
        code: result.error.code,
        message: result.error.message
      });

      if (!router.shouldUseFallback(result.error, route.providerHealth?.status)) {
        throw new WorkflowProviderError(result.error.code, result.error.message, attempts);
      }

      if (result.error.retryable && result.error.code !== "rate_limit" && candidates.length === 1) {
        await this.delay();
        const retry = await this.tryCandidate(input, candidate, attempts);
        if (retry.ok) {
          return {
            text: retry.value.text,
            provider: candidate.provider,
            model: candidate.model,
            llmRunId: retry.value.llmRunId,
            attempts,
            repairedJson: retry.value.repairedJson,
            budgetAction: this.evaluateLiveBudget(input.preflightMaxCost, retry.value.cost)
          };
        }
        lastError = retry.error;
      }
    }

    throw new WorkflowProviderError(
      lastError?.code ?? "provider_failed",
      lastError?.message ?? "Provider route failed",
      attempts
    );
  }

  private async tryCandidate(
    input: WorkflowModelExecutorInput,
    candidate: ModelProfileRecord,
    attempts: WorkflowModelAttempt[]
  ): Promise<
    | {
        ok: true;
        value: {
          text: string;
          llmRunId: string;
          repairedJson: boolean;
          cost: number;
        };
      }
    | { ok: false; error: ProviderError }
  > {
    const startedAt = Date.now();
    try {
      const response = await this.options.aiGateway.generateText(
        this.createGatewayRequest(input, candidate, input.messages)
      );
      attempts.push({
        provider: candidate.provider,
        model: candidate.model,
        status: "succeeded",
        llmRunId: response.runId,
        errorCode: null,
        latencyMs: response.latencyMs
      });

      if (input.requireJson && !isValidJson(response.response.text)) {
        const lastAttempt = attempts[attempts.length - 1];
        if (lastAttempt) {
          attempts[attempts.length - 1] = {
            ...lastAttempt,
            status: "failed",
            errorCode: "invalid_json"
          };
        }
        const repair = await this.options.aiGateway.generateText(
          this.createGatewayRequest(
            input,
            candidate,
            [
              {
                role: "user",
                content: `Repair this JSON and return only valid JSON:\n${response.response.text}`
              }
            ],
            "state_settlement"
          )
        );
        attempts.push({
          provider: candidate.provider,
          model: candidate.model,
          status: "succeeded",
          llmRunId: repair.runId,
          errorCode: null,
          latencyMs: repair.latencyMs
        });
        if (!isValidJson(repair.response.text)) {
          return {
            ok: false,
            error: { code: "invalid_json", message: "JSON repair failed", retryable: false }
          };
        }
        return {
          ok: true,
          value: {
            text: repair.response.text,
            llmRunId: repair.runId,
            repairedJson: true,
            cost: repair.finalCost.totalCost
          }
        };
      }

      return {
        ok: true,
        value: {
          text: response.response.text,
          llmRunId: response.runId,
          repairedJson: false,
          cost: response.finalCost.totalCost
        }
      };
    } catch (error) {
      const providerError = normalizeWorkflowError(error);
      attempts.push({
        provider: candidate.provider,
        model: candidate.model,
        status: "failed",
        llmRunId: null,
        errorCode: providerError.code,
        latencyMs: Date.now() - startedAt
      });
      return { ok: false, error: providerError };
    }
  }

  private evaluateLiveBudget(preflightMaxCost: number | undefined, cost: number) {
    if (typeof preflightMaxCost !== "number" || preflightMaxCost <= 0) return "none" as const;
    const policy = this.options.repositories.budgetPolicies.getDefault();
    const limit = preflightMaxCost * (1 + policy.warningThresholdPercent / 100);
    return cost > limit ? policy.onBudgetExceeded : "none";
  }

  private async delay(): Promise<void> {
    const delayMs = this.options.retryDelayMs ?? 100;
    if (delayMs <= 0) return;
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  private createGatewayRequest(
    input: WorkflowModelExecutorInput,
    candidate: ModelProfileRecord,
    messages: ChatMessage[],
    taskType: LLMTaskType = input.taskType
  ): StreamRequest {
    const request: StreamRequest = {
      provider: candidate.provider,
      model: candidate.model,
      generationRunId: input.generationRunId,
      taskType,
      qualityMode: input.qualityMode,
      messages
    };
    if (input.projectId) request.projectId = input.projectId;
    if (input.bookId) request.bookId = input.bookId;
    if (input.chapterId) request.chapterId = input.chapterId;
    return request;
  }
}

function normalizeWorkflowError(error: unknown): ProviderError {
  if (error instanceof ProviderAdapterError) {
    return error.providerError;
  }
  if (error instanceof WorkflowProviderError) {
    return { code: error.code, message: error.message };
  }
  if (error instanceof Error) {
    return { code: "provider_error", message: error.message, retryable: true };
  }
  return { code: "provider_error", message: "Provider route failed", retryable: true };
}

function estimateMessages(messages: ChatMessage[]): number {
  return messages.reduce((total, message) => total + message.content.length, 0);
}

function isValidJson(value: string): boolean {
  try {
    JSON.parse(value);
    return true;
  } catch {
    return false;
  }
}

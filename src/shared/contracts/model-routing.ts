import type {
  CredentialStatus,
  ProviderId,
  QualityMode,
  TaskType
} from "@shared/domain/model-routing";
import type { ProviderModelInfo } from "./ai";

export interface ProviderCredentialDto {
  id: string;
  provider: ProviderId;
  displayName: string;
  baseUrl: string | null;
  isConfigured: boolean;
  redactedKeyLabel: string;
  lastTestedAt: string | null;
  lastStatus: CredentialStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CredentialStatusDto {
  id: string;
  provider: ProviderId;
  isConfigured: boolean;
  lastStatus: CredentialStatus;
  lastTestedAt: string | null;
  message: string;
}

export interface CredentialTestResult {
  id: string;
  status: "configured_but_untested" | "test_passed" | "test_failed" | "not_configured";
  message: string;
  testedAt: string;
}

export interface ProviderModelListResult {
  provider: ProviderId;
  configured: boolean;
  status: "skipped" | "passed" | "failed";
  models: ProviderModelInfo[];
  fetchedAt: string | null;
  error: string | null;
}

export interface SaveCredentialInput {
  provider: ProviderId;
  displayName: string;
  apiKey: string;
  baseUrl?: string | null | undefined;
}

export interface ModelProfileRecord {
  id: string;
  provider: ProviderId;
  model: string;
  alias: string | null;
  displayName: string;
  contextWindow: number | null;
  maxOutputTokens: number | null;
  supportsStreaming: boolean;
  supportsJson: boolean;
  supportsTools: boolean;
  supportsVision: boolean;
  supportsPromptCaching: boolean;
  supportsTemperature: boolean;
  supportsTopP: boolean;
  supportsTopK: boolean;
  supportsFrequencyPenalty: boolean;
  supportsPresencePenalty: boolean;
  supportsStop: boolean;
  supportsReasoningEffort: boolean;
  supportsAdaptiveThinking: boolean;
  supportsManualThinkingBudget: boolean;
  maxOutputParamName:
    | "max_tokens"
    | "max_completion_tokens"
    | "max_output_tokens"
    | "output_token_limit"
    | "generation_config_max_output_tokens";
  endpointFamily:
    | "openai_chat_completions"
    | "openai_responses"
    | "anthropic_messages"
    | "gemini_generate_content"
    | "openai_compatible"
    | "dashscope_openai_compatible"
    | "moonshot_openai_compatible"
    | "deepseek_openai_compatible"
    | "xai_openai_compatible"
    | "openrouter_openai_compatible";
  supportsResponsesApi: boolean;
  supportsChatCompletions: boolean;
  defaultTemperature: number;
  recommendedTasksJson: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ModelPriceRecord {
  id: string;
  provider: ProviderId;
  model: string;
  inputPricePerMillion: number;
  outputPricePerMillion: number;
  cachedInputPricePerMillion: number | null;
  currency: string;
  contextWindow: number | null;
  maxOutputTokens: number | null;
  effectiveDate: string;
  sourceNote: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ModelPriceTierRecord {
  id: string;
  modelPriceId: string;
  provider: ProviderId;
  model: string;
  deploymentMode: string | null;
  minInputTokens: number;
  maxInputTokens: number | null;
  inputPricePerMillion: number;
  outputPricePerMillion: number;
  cachedInputPricePerMillion: number | null;
  cacheWritePricePerMillion: number | null;
  currency: string;
  effectiveDate: string;
  sourceNote: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UsageCalibrationRecord {
  id: string;
  provider: ProviderId;
  model: string;
  samples: number;
  inputEstimateFactor: number;
  outputEstimateFactor: number;
  meanAbsoluteError: number;
  lastSampleAt: string | null;
  createdAt: string;
  updatedAt: string;
  confidence?: number;
}

export interface ProviderQuotaNoteRecord {
  id: string;
  provider: ProviderId;
  creditBalance: number | null;
  monthlyBudget: number | null;
  freeQuotaRemaining: number | null;
  refreshedAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TaskRouteRecord {
  id: string;
  taskType: TaskType;
  qualityMode: QualityMode;
  primaryModelProfileId: string;
  fallbackModelProfileId1: string | null;
  fallbackModelProfileId2: string | null;
  temperature: number;
  creativityIntent: "deterministic" | "balanced" | "creative" | "wild";
  contextBudgetMode: "conservative" | "balanced" | "max_safe" | "manual";
  maxOutputTokens: number;
  budgetCapPerCall: number | null;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ModelRouteResolution {
  available: boolean;
  taskType: TaskType;
  qualityMode: QualityMode;
  route: TaskRouteRecord | null;
  modelProfile: ModelProfileRecord | null;
  fallbackModels: ModelProfileRecord[];
  price: ModelPriceRecord | null;
  credential: ProviderCredentialDto | null;
  providerHealth: ProviderHealthRecord | null;
  estimatedCostRange: {
    minCost: number;
    maxCost: number;
    currency: string;
  };
  warnings: string[];
  errors: string[];
}

export type ChapterImportance =
  | "normal"
  | "opening"
  | "key_chapter"
  | "volume_start"
  | "volume_climax"
  | "climax"
  | "finale";
export type BudgetMode = "strict" | "flexible";

export interface RoutePreviewContext {
  chapterImportance?: ChapterImportance;
  budgetMode?: BudgetMode;
  expectedTokens?: {
    inputTokens: number;
    outputTokens: number;
  };
  userOverrideModelProfileId?: string | null;
}

export interface ProviderHealthRecord {
  id: string;
  provider: ProviderId;
  model: string | null;
  status: "unknown" | "healthy" | "degraded" | "down";
  checkedAt: string;
  errorCode: string | null;
  errorMessage: string | null;
}

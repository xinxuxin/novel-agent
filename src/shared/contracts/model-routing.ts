import type {
  CredentialStatus,
  ProviderId,
  QualityMode,
  TaskType
} from "@shared/domain/model-routing";

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
  displayName: string;
  contextWindow: number | null;
  maxOutputTokens: number | null;
  supportsStreaming: boolean;
  supportsJson: boolean;
  supportsTools: boolean;
  supportsVision: boolean;
  supportsPromptCaching: boolean;
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

export interface TaskRouteRecord {
  id: string;
  taskType: TaskType;
  qualityMode: QualityMode;
  primaryModelProfileId: string;
  fallbackModelProfileId1: string | null;
  fallbackModelProfileId2: string | null;
  temperature: number;
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
  price: ModelPriceRecord | null;
  credential: ProviderCredentialDto | null;
  warnings: string[];
  errors: string[];
}

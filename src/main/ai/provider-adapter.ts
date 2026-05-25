import type {
  AIProviderId,
  NormalizedProviderResponse,
  ProviderError,
  StreamRequest,
  TokenUsage
} from "@contracts/ai";

export interface ProviderAdapterCapabilities {
  streaming: boolean;
  json: boolean;
  tools: boolean;
  vision: boolean;
  promptCaching: boolean;
}

export interface ProviderAdapterConfig {
  apiKey?: string | undefined;
  baseUrl?: string | null | undefined;
  headers?: Record<string, string> | undefined;
}

export interface ProviderStreamCallbacks {
  onDelta?: (delta: string) => void;
  onUsage?: (usage: TokenUsage) => void;
}

export interface ProviderAdapter {
  id: AIProviderId;
  displayName: string;
  capabilities: ProviderAdapterCapabilities;
  validateConfig: (config: ProviderAdapterConfig) => void;
  streamChat: (
    request: StreamRequest,
    callbacks: ProviderStreamCallbacks,
    abortSignal: AbortSignal,
    config?: ProviderAdapterConfig
  ) => Promise<NormalizedProviderResponse>;
  generateText: (
    request: StreamRequest,
    abortSignal: AbortSignal,
    config?: ProviderAdapterConfig
  ) => Promise<NormalizedProviderResponse>;
  normalizeUsage: (raw: unknown) => TokenUsage | null;
  normalizeError: (error: unknown) => ProviderError;
}

export class ProviderAdapterError extends Error {
  constructor(
    public readonly providerError: ProviderError,
    options?: ErrorOptions
  ) {
    super(providerError.message, options);
    this.name = "ProviderAdapterError";
  }
}

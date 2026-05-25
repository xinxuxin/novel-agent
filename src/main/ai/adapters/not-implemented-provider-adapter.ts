import type {
  AIProviderId,
  NormalizedProviderResponse,
  ProviderError,
  TokenUsage
} from "@contracts/ai";
import type { ProviderAdapter, ProviderAdapterCapabilities } from "@main/ai/provider-adapter";
import { ProviderAdapterError } from "@main/ai/provider-adapter";

export class NotImplementedProviderAdapter implements ProviderAdapter {
  readonly capabilities: ProviderAdapterCapabilities = {
    streaming: false,
    json: false,
    tools: false,
    vision: false,
    promptCaching: false
  };

  constructor(
    readonly id: AIProviderId,
    readonly displayName: string
  ) {}

  validateConfig(): void {
    return undefined;
  }

  streamChat(): Promise<NormalizedProviderResponse> {
    throw new ProviderAdapterError(this.notImplementedError());
  }

  generateText(): Promise<NormalizedProviderResponse> {
    throw new ProviderAdapterError(this.notImplementedError());
  }

  normalizeUsage(): TokenUsage | null {
    return null;
  }

  normalizeError(error: unknown): ProviderError {
    if (error instanceof ProviderAdapterError) {
      return error.providerError;
    }
    return this.notImplementedError();
  }

  private notImplementedError(): ProviderError {
    return {
      code: "not_implemented",
      message: `${this.displayName} adapter is not implemented yet`
    };
  }
}

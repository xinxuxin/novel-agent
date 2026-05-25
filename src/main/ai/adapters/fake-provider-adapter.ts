import type {
  AIProviderId,
  NormalizedProviderResponse,
  ProviderError,
  StreamRequest,
  TokenUsage
} from "@contracts/ai";
import type {
  ProviderAdapter,
  ProviderAdapterCapabilities,
  ProviderStreamCallbacks
} from "@main/ai/provider-adapter";
import { ProviderAdapterError } from "@main/ai/provider-adapter";

export interface FakeProviderAdapterOptions {
  id?: AIProviderId;
  chunks?: string[];
  usage?: TokenUsage;
  error?: ProviderError;
  delayMs?: number;
  onBeforeStream?: () => void;
}

export class FakeProviderAdapter implements ProviderAdapter {
  readonly id: AIProviderId;
  readonly displayName = "Fake Provider";
  readonly capabilities: ProviderAdapterCapabilities = {
    streaming: true,
    json: true,
    tools: false,
    vision: false,
    promptCaching: false
  };

  constructor(private readonly options: FakeProviderAdapterOptions = {}) {
    this.id = options.id ?? "fake";
  }

  validateConfig(): void {
    return undefined;
  }

  async streamChat(
    _request: StreamRequest,
    callbacks: ProviderStreamCallbacks,
    abortSignal: AbortSignal
  ): Promise<NormalizedProviderResponse> {
    this.options.onBeforeStream?.();
    if (this.options.error) {
      throw new ProviderAdapterError(this.options.error);
    }

    let text = "";
    for (const chunk of this.options.chunks ?? ["WenForge fake stream."]) {
      if (abortSignal.aborted) {
        throw new ProviderAdapterError({ code: "aborted", message: "Run aborted" });
      }
      if (this.options.delayMs) {
        await delay(this.options.delayMs, abortSignal);
      }
      if (abortSignal.aborted) {
        throw new ProviderAdapterError({ code: "aborted", message: "Run aborted" });
      }
      text += chunk;
      callbacks.onDelta?.(chunk);
    }

    const usage = this.options.usage ?? {
      inputTokens: 0,
      outputTokens: text.length
    };
    callbacks.onUsage?.(usage);
    return { text, usage };
  }

  generateText(
    request: StreamRequest,
    abortSignal: AbortSignal
  ): Promise<NormalizedProviderResponse> {
    return this.streamChat(request, {}, abortSignal);
  }

  normalizeUsage(raw: unknown): TokenUsage | null {
    return raw && typeof raw === "object" ? (raw as TokenUsage) : null;
  }

  normalizeError(error: unknown): ProviderError {
    if (error instanceof ProviderAdapterError) {
      return error.providerError;
    }
    if (error instanceof Error) {
      return { code: "fake_error", message: error.message };
    }
    return { code: "fake_error", message: "Fake provider failed" };
  }
}

async function delay(ms: number, abortSignal: AbortSignal): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(resolve, ms);
    abortSignal.addEventListener(
      "abort",
      () => {
        clearTimeout(timeout);
        reject(new ProviderAdapterError({ code: "aborted", message: "Run aborted" }));
      },
      { once: true }
    );
  });
}

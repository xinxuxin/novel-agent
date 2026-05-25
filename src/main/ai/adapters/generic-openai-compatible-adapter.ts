import type {
  AIProviderId,
  NormalizedProviderResponse,
  ProviderError,
  StreamRequest,
  TokenUsage
} from "@contracts/ai";
import { SseParser } from "@main/ai/sse-parser";
import type {
  ProviderAdapter,
  ProviderAdapterCapabilities,
  ProviderAdapterConfig,
  ProviderStreamCallbacks
} from "@main/ai/provider-adapter";
import { ProviderAdapterError } from "@main/ai/provider-adapter";

export interface GenericOpenAICompatibleAdapterOptions {
  id: AIProviderId;
  displayName: string;
  defaultBaseUrl: string;
  headers?: Record<string, string>;
  fetchImpl?: typeof fetch;
}

export class GenericOpenAICompatibleAdapter implements ProviderAdapter {
  readonly id: AIProviderId;
  readonly displayName: string;
  readonly capabilities: ProviderAdapterCapabilities = {
    streaming: true,
    json: true,
    tools: false,
    vision: false,
    promptCaching: false
  };

  private readonly fetchImpl: typeof fetch;

  constructor(private readonly options: GenericOpenAICompatibleAdapterOptions) {
    this.id = options.id;
    this.displayName = options.displayName;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  validateConfig(config: ProviderAdapterConfig): void {
    if (!config.apiKey) {
      throw new ProviderAdapterError({
        code: "missing_api_key",
        message: `${this.displayName} requires an API key`
      });
    }
  }

  async streamChat(
    request: StreamRequest,
    callbacks: ProviderStreamCallbacks,
    abortSignal: AbortSignal,
    config: ProviderAdapterConfig = {}
  ): Promise<NormalizedProviderResponse> {
    this.validateConfig(config);
    const response = await this.fetchImpl(`${this.baseUrl(config)}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
        ...this.options.headers,
        ...config.headers
      },
      body: JSON.stringify({
        model: request.model,
        messages: request.messages,
        temperature: request.temperature,
        max_tokens: request.maxOutputTokens,
        stream: true,
        stream_options: { include_usage: true }
      }),
      signal: abortSignal
    });

    if (!response.ok) {
      throw new ProviderAdapterError({
        code: "provider_http_error",
        message: `${this.displayName} returned HTTP ${response.status}`,
        status: response.status
      });
    }
    if (!response.body) {
      throw new ProviderAdapterError({
        code: "empty_stream",
        message: `${this.displayName} did not return a response body`
      });
    }

    const parser = new SseParser();
    const decoder = new TextDecoder();
    let text = "";
    let usage: TokenUsage | null = null;

    for await (const rawChunk of response.body as unknown as AsyncIterable<Uint8Array>) {
      if (abortSignal.aborted) {
        throw new ProviderAdapterError({ code: "aborted", message: "Run aborted" });
      }
      for (const event of parser.push(decoder.decode(rawChunk, { stream: true }))) {
        if (event.done) {
          continue;
        }
        const parsed = safeJsonParse(event.data);
        if (!parsed) {
          continue;
        }
        const delta = extractDelta(parsed);
        if (delta) {
          text += delta;
          callbacks.onDelta?.(delta);
        }
        const nextUsage = this.normalizeUsage((parsed as { usage?: unknown }).usage);
        if (nextUsage) {
          usage = nextUsage;
          callbacks.onUsage?.(nextUsage);
        }
      }
    }

    for (const event of parser.finish()) {
      if (event.done) {
        continue;
      }
      const parsed = safeJsonParse(event.data);
      const nextUsage = parsed ? this.normalizeUsage((parsed as { usage?: unknown }).usage) : null;
      if (nextUsage) {
        usage = nextUsage;
      }
    }

    return { text, usage };
  }

  async generateText(
    request: StreamRequest,
    abortSignal: AbortSignal,
    config?: ProviderAdapterConfig
  ): Promise<NormalizedProviderResponse> {
    return this.streamChat(request, {}, abortSignal, config);
  }

  normalizeUsage(raw: unknown): TokenUsage | null {
    if (!raw || typeof raw !== "object") {
      return null;
    }
    const usage = raw as {
      prompt_tokens?: unknown;
      completion_tokens?: unknown;
      cached_tokens?: unknown;
      prompt_tokens_details?: { cached_tokens?: unknown };
      total_tokens?: unknown;
    };
    const inputTokens = numberOrNull(usage.prompt_tokens);
    const outputTokens = numberOrNull(usage.completion_tokens);
    if (inputTokens === null && outputTokens === null) {
      return null;
    }
    const cachedInputTokens =
      numberOrNull(usage.cached_tokens) ??
      numberOrNull(usage.prompt_tokens_details?.cached_tokens) ??
      undefined;
    return {
      inputTokens: inputTokens ?? 0,
      outputTokens: outputTokens ?? 0,
      cachedInputTokens,
      totalTokens: numberOrNull(usage.total_tokens) ?? undefined
    };
  }

  normalizeError(error: unknown): ProviderError {
    if (error instanceof ProviderAdapterError) {
      return error.providerError;
    }
    if (error instanceof DOMException && error.name === "AbortError") {
      return { code: "aborted", message: "Run aborted" };
    }
    if (error instanceof Error) {
      return { code: "provider_error", message: error.message };
    }
    return { code: "provider_error", message: `${this.displayName} request failed` };
  }

  private baseUrl(config: ProviderAdapterConfig): string {
    return (config.baseUrl ?? this.options.defaultBaseUrl).replace(/\/+$/, "");
  }
}

function extractDelta(value: unknown): string {
  const choices = (value as { choices?: Array<{ delta?: { content?: unknown } }> }).choices;
  const content = choices?.[0]?.delta?.content;
  return typeof content === "string" ? content : "";
}

function safeJsonParse(value: string): unknown | null {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

function numberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

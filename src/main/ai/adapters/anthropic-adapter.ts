import type {
  ChatMessage,
  NormalizedProviderResponse,
  ProviderError,
  ProviderModelInfo,
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

export class AnthropicAdapter implements ProviderAdapter {
  readonly id = "anthropic" as const;
  readonly displayName = "Anthropic";
  readonly capabilities: ProviderAdapterCapabilities = {
    streaming: true,
    json: true,
    tools: false,
    vision: false,
    promptCaching: true
  };

  constructor(private readonly fetchImpl: typeof fetch = fetch) {}

  validateConfig(config: ProviderAdapterConfig): void {
    if (!config.apiKey) {
      throw new ProviderAdapterError({
        code: "missing_api_key",
        message: "Anthropic requires an API key"
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
    const response = await this.fetchImpl(`${baseUrl(config)}/messages`, {
      method: "POST",
      headers: anthropicHeaders(config),
      body: JSON.stringify(toAnthropicBody(request, true, config)),
      signal: abortSignal
    });

    if (!response.ok) {
      throw await httpError("Anthropic", response);
    }
    if (!response.body) {
      throw new ProviderAdapterError({
        code: "empty_stream",
        message: "Anthropic did not return a response body"
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
        const parsed = safeJsonParse(event.data);
        if (!parsed) continue;
        const delta = extractAnthropicDelta(parsed);
        if (delta) {
          text += delta;
          callbacks.onDelta?.(delta);
        }
        const nextUsage = this.normalizeUsage(parsed);
        if (nextUsage) {
          usage = mergeUsage(usage, nextUsage);
          callbacks.onUsage?.(usage);
        }
      }
    }

    for (const event of parser.finish()) {
      const parsed = safeJsonParse(event.data);
      const nextUsage = parsed ? this.normalizeUsage(parsed) : null;
      if (nextUsage) usage = mergeUsage(usage, nextUsage);
    }

    return { text, usage };
  }

  async generateText(
    request: StreamRequest,
    abortSignal: AbortSignal,
    config: ProviderAdapterConfig = {}
  ): Promise<NormalizedProviderResponse> {
    this.validateConfig(config);
    const response = await this.fetchImpl(`${baseUrl(config)}/messages`, {
      method: "POST",
      headers: anthropicHeaders(config),
      body: JSON.stringify(toAnthropicBody(request, false, config)),
      signal: abortSignal
    });

    if (!response.ok) {
      throw await httpError("Anthropic", response);
    }
    const parsed = (await response.json()) as unknown;
    return {
      text: extractAnthropicText(parsed),
      usage: this.normalizeUsage(parsed),
      raw: parsed
    };
  }

  async listModels(
    config: ProviderAdapterConfig,
    abortSignal?: AbortSignal
  ): Promise<ProviderModelInfo[]> {
    this.validateConfig(config);
    const response = await this.fetchImpl(`${baseUrl(config)}/models`, {
      method: "GET",
      headers: anthropicHeaders(config),
      ...(abortSignal ? { signal: abortSignal } : {})
    });
    if (!response.ok) {
      throw await httpError("Anthropic", response);
    }
    const parsed = (await response.json()) as { data?: unknown };
    const models = Array.isArray(parsed.data) ? parsed.data : [];
    return models.flatMap((model): ProviderModelInfo[] => {
        if (!model || typeof model !== "object") return [];
        const value = model as { id?: unknown; display_name?: unknown; type?: unknown };
        if (typeof value.id !== "string") return [];
        return [{
          id: value.id,
          displayName: typeof value.display_name === "string" ? value.display_name : value.id,
          supportsGeneration: value.type === "model" || typeof value.type !== "string"
        }];
      });
  }

  normalizeUsage(raw: unknown): TokenUsage | null {
    const usage =
      raw && typeof raw === "object" && "usage" in raw
        ? (raw as { usage?: unknown }).usage
        : raw;
    if (!usage || typeof usage !== "object") return null;
    const value = usage as {
      input_tokens?: unknown;
      output_tokens?: unknown;
      cache_read_input_tokens?: unknown;
      cache_creation_input_tokens?: unknown;
    };
    const inputTokens = numberOrNull(value.input_tokens);
    const outputTokens = numberOrNull(value.output_tokens);
    if (inputTokens === null && outputTokens === null) return null;
    return {
      inputTokens: inputTokens ?? 0,
      outputTokens: outputTokens ?? 0,
      cachedInputTokens: numberOrNull(value.cache_read_input_tokens) ?? undefined
    };
  }

  normalizeError(error: unknown): ProviderError {
    if (error instanceof ProviderAdapterError) return error.providerError;
    if (error instanceof DOMException && error.name === "AbortError") {
      return { code: "aborted", message: "Run aborted" };
    }
    if (error instanceof Error) return { code: "provider_error", message: error.message };
    return { code: "provider_error", message: "Anthropic request failed" };
  }
}

function toAnthropicBody(
  request: StreamRequest,
  stream: boolean,
  config: ProviderAdapterConfig
): Record<string, unknown> {
  const system = request.messages
    .filter((message) => message.role === "system")
    .map((message) => message.content)
    .join("\n\n");
  const messages = normalizeAnthropicMessages(
    request.messages.filter((message) => message.role !== "system")
  );
  const params = config.normalizedParams
    ? filterAnthropicParams(config.normalizedParams.bodyParams)
    : {
        max_tokens: request.maxOutputTokens ?? 1024,
        ...(typeof request.temperature === "number" ? { temperature: request.temperature } : {})
      };
  return {
    model: request.model,
    ...params,
    stream,
    ...(system ? { system } : {}),
    messages
  };
}

function filterAnthropicParams(params: Record<string, unknown>): Record<string, unknown> {
  const allowed = new Set(["max_tokens", "temperature", "top_p", "top_k", "stop_sequences"]);
  return Object.fromEntries(Object.entries(params).filter(([name]) => allowed.has(name)));
}

function normalizeAnthropicMessages(messages: ChatMessage[]): Array<{
  role: "user" | "assistant";
  content: string;
}> {
  const normalized: Array<{ role: "user" | "assistant"; content: string }> = [];
  for (const message of messages) {
    const role = message.role === "assistant" ? "assistant" : "user";
    const previous = normalized.at(-1);
    if (previous?.role === role) {
      previous.content += `\n\n${message.content}`;
    } else {
      normalized.push({ role, content: message.content });
    }
  }
  return normalized.length > 0 ? normalized : [{ role: "user", content: "" }];
}

function anthropicHeaders(config: ProviderAdapterConfig): Record<string, string> {
  return {
    "x-api-key": config.apiKey ?? "",
    "anthropic-version": "2023-06-01",
    "Content-Type": "application/json",
    ...config.headers
  };
}

function baseUrl(config: ProviderAdapterConfig): string {
  return (config.baseUrl ?? "https://api.anthropic.com/v1").replace(/\/+$/, "");
}

function extractAnthropicDelta(value: unknown): string {
  const delta = (value as { delta?: { text?: unknown; type?: unknown } }).delta;
  return typeof delta?.text === "string" ? delta.text : "";
}

function extractAnthropicText(value: unknown): string {
  const content = (value as { content?: Array<{ type?: string; text?: unknown }> }).content;
  return Array.isArray(content)
    ? content.map((part) => (typeof part.text === "string" ? part.text : "")).join("")
    : "";
}

function mergeUsage(current: TokenUsage | null, next: TokenUsage): TokenUsage {
  return {
    inputTokens: Math.max(current?.inputTokens ?? 0, next.inputTokens),
    outputTokens: Math.max(current?.outputTokens ?? 0, next.outputTokens),
    cachedInputTokens: Math.max(current?.cachedInputTokens ?? 0, next.cachedInputTokens ?? 0)
  };
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

async function httpError(provider: string, response: Response): Promise<ProviderAdapterError> {
  const detail = await readError(response);
  return new ProviderAdapterError({
    code: "provider_http_error",
    message: `${provider} returned HTTP ${response.status}${detail ? `: ${detail}` : ""}`,
    status: response.status
  });
}

async function readError(response: Response): Promise<string> {
  try {
    const text = await response.text();
    const parsed = safeJsonParse(text);
    const message =
      parsed && typeof parsed === "object"
        ? ((parsed as { error?: { message?: unknown }; message?: unknown }).error?.message ??
          (parsed as { message?: unknown }).message)
        : null;
    return String(typeof message === "string" ? message : text).slice(0, 500);
  } catch {
    return "";
  }
}

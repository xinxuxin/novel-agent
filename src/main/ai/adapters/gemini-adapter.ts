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

export class GeminiAdapter implements ProviderAdapter {
  readonly id = "gemini" as const;
  readonly displayName = "Google Gemini";
  readonly capabilities: ProviderAdapterCapabilities = {
    streaming: true,
    json: true,
    tools: false,
    vision: true,
    promptCaching: true
  };

  constructor(private readonly fetchImpl: typeof fetch = fetch) {}

  validateConfig(config: ProviderAdapterConfig): void {
    if (!config.apiKey) {
      throw new ProviderAdapterError({
        code: "missing_api_key",
        message: "Gemini requires an API key"
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
    const response = await this.fetchImpl(
      `${baseUrl(config)}/models/${encodeURIComponent(request.model ?? "")}:streamGenerateContent?alt=sse`,
      {
        method: "POST",
        headers: geminiHeaders(config),
        body: JSON.stringify(toGeminiBody(request, config)),
        signal: abortSignal
      }
    );
    if (!response.ok) throw await httpError("Gemini", response);
    if (!response.body) {
      throw new ProviderAdapterError({
        code: "empty_stream",
        message: "Gemini did not return a response body"
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
        const delta = extractGeminiText(parsed);
        if (delta) {
          text += delta;
          callbacks.onDelta?.(delta);
        }
        const nextUsage = this.normalizeUsage(parsed);
        if (nextUsage) {
          usage = nextUsage;
          callbacks.onUsage?.(nextUsage);
        }
      }
    }
    for (const event of parser.finish()) {
      const parsed = safeJsonParse(event.data);
      const nextUsage = parsed ? this.normalizeUsage(parsed) : null;
      if (nextUsage) usage = nextUsage;
    }
    return { text, usage };
  }

  async generateText(
    request: StreamRequest,
    abortSignal: AbortSignal,
    config: ProviderAdapterConfig = {}
  ): Promise<NormalizedProviderResponse> {
    this.validateConfig(config);
    const response = await this.fetchImpl(
      `${baseUrl(config)}/models/${encodeURIComponent(request.model ?? "")}:generateContent`,
      {
        method: "POST",
        headers: geminiHeaders(config),
        body: JSON.stringify(toGeminiBody(request, config)),
        signal: abortSignal
      }
    );
    if (!response.ok) throw await httpError("Gemini", response);
    const parsed = (await response.json()) as unknown;
    return {
      text: extractGeminiText(parsed),
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
      headers: geminiHeaders(config),
      ...(abortSignal ? { signal: abortSignal } : {})
    });
    if (!response.ok) throw await httpError("Gemini", response);
    const parsed = (await response.json()) as { models?: unknown };
    const models = Array.isArray(parsed.models) ? parsed.models : [];
    return models.flatMap((model): ProviderModelInfo[] => {
        if (!model || typeof model !== "object") return [];
        const value = model as {
          name?: unknown;
          displayName?: unknown;
          inputTokenLimit?: unknown;
          supportedGenerationMethods?: unknown;
        };
        if (typeof value.name !== "string") return [];
        const id = value.name.replace(/^models\//, "");
        const methods = Array.isArray(value.supportedGenerationMethods)
          ? value.supportedGenerationMethods
          : [];
        const contextWindow = numberOrNull(value.inputTokenLimit);
        return [{
          id,
          displayName: typeof value.displayName === "string" ? value.displayName : id,
          ...(contextWindow !== null ? { contextWindow } : {}),
          supportsGeneration:
            methods.length === 0 ||
            methods.includes("generateContent") ||
            methods.includes("streamGenerateContent")
        }];
      });
  }

  normalizeUsage(raw: unknown): TokenUsage | null {
    const usage =
      raw && typeof raw === "object" && "usageMetadata" in raw
        ? (raw as { usageMetadata?: unknown }).usageMetadata
        : raw;
    if (!usage || typeof usage !== "object") return null;
    const value = usage as {
      promptTokenCount?: unknown;
      candidatesTokenCount?: unknown;
      totalTokenCount?: unknown;
      cachedContentTokenCount?: unknown;
    };
    const inputTokens = numberOrNull(value.promptTokenCount);
    const outputTokens = numberOrNull(value.candidatesTokenCount);
    if (inputTokens === null && outputTokens === null) return null;
    return {
      inputTokens: inputTokens ?? 0,
      outputTokens: outputTokens ?? 0,
      cachedInputTokens: numberOrNull(value.cachedContentTokenCount) ?? undefined,
      totalTokens: numberOrNull(value.totalTokenCount) ?? undefined
    };
  }

  normalizeError(error: unknown): ProviderError {
    if (error instanceof ProviderAdapterError) return error.providerError;
    if (error instanceof DOMException && error.name === "AbortError") {
      return { code: "aborted", message: "Run aborted" };
    }
    if (error instanceof Error) return { code: "provider_error", message: error.message };
    return { code: "provider_error", message: "Gemini request failed" };
  }
}

function toGeminiBody(request: StreamRequest, config: ProviderAdapterConfig): Record<string, unknown> {
  const systemInstruction = request.messages
    .filter((message) => message.role === "system")
    .map((message) => message.content)
    .join("\n\n");
  const params = geminiGenerationConfig(config, request);
  return {
    contents: normalizeGeminiContents(request.messages.filter((message) => message.role !== "system")),
    ...(systemInstruction
      ? { systemInstruction: { parts: [{ text: systemInstruction }] } }
      : {}),
    generationConfig: params
  };
}

function geminiGenerationConfig(
  config: ProviderAdapterConfig,
  request: StreamRequest
): Record<string, unknown> {
  if (!config.normalizedParams) {
    return {
      ...(typeof request.temperature === "number" ? { temperature: request.temperature } : {}),
      ...(typeof request.maxOutputTokens === "number" ? { maxOutputTokens: request.maxOutputTokens } : {})
    };
  }
  const params = config.normalizedParams.bodyParams;
  return {
    ...(typeof params.temperature === "number" ? { temperature: params.temperature } : {}),
    ...(typeof params.generation_config_max_output_tokens === "number"
      ? { maxOutputTokens: params.generation_config_max_output_tokens }
      : {}),
    ...(typeof params.output_token_limit === "number"
      ? { maxOutputTokens: params.output_token_limit }
      : {})
  };
}

function normalizeGeminiContents(messages: ChatMessage[]): Array<{
  role: "user" | "model";
  parts: Array<{ text: string }>;
}> {
  const normalized: Array<{ role: "user" | "model"; parts: Array<{ text: string }> }> = [];
  for (const message of messages) {
    const role = message.role === "assistant" ? "model" : "user";
    const previous = normalized.at(-1);
    if (previous?.role === role) {
      previous.parts.push({ text: message.content });
    } else {
      normalized.push({ role, parts: [{ text: message.content }] });
    }
  }
  return normalized.length > 0 ? normalized : [{ role: "user", parts: [{ text: "" }] }];
}

function extractGeminiText(value: unknown): string {
  const candidates = (value as { candidates?: Array<{ content?: { parts?: unknown } }> })
    .candidates;
  const parts = candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return "";
  return parts
    .map((part) =>
      part && typeof part === "object" && typeof (part as { text?: unknown }).text === "string"
        ? (part as { text: string }).text
        : ""
    )
    .join("");
}

function geminiHeaders(config: ProviderAdapterConfig): Record<string, string> {
  return {
    "x-goog-api-key": config.apiKey ?? "",
    "Content-Type": "application/json",
    ...config.headers
  };
}

function baseUrl(config: ProviderAdapterConfig): string {
  return (config.baseUrl ?? "https://generativelanguage.googleapis.com/v1beta").replace(/\/+$/, "");
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

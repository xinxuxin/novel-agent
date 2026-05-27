import type { ProviderAdapter } from "@main/ai/provider-adapter";
import { AnthropicAdapter } from "./anthropic-adapter";
import { FakeProviderAdapter } from "./fake-provider-adapter";
import { GeminiAdapter } from "./gemini-adapter";
import { GenericOpenAICompatibleAdapter } from "./generic-openai-compatible-adapter";

export function createDefaultProviderAdapters(): ProviderAdapter[] {
  return [
    new FakeProviderAdapter(),
    new GenericOpenAICompatibleAdapter({
      id: "generic_openai_compatible",
      displayName: "Generic OpenAI-compatible",
      defaultBaseUrl: "http://localhost:11434/v1"
    }),
    new GenericOpenAICompatibleAdapter({
      id: "openai",
      displayName: "OpenAI",
      defaultBaseUrl: "https://api.openai.com/v1"
    }),
    new GenericOpenAICompatibleAdapter({
      id: "deepseek",
      displayName: "DeepSeek",
      defaultBaseUrl: "https://api.deepseek.com/v1"
    }),
    new GenericOpenAICompatibleAdapter({
      id: "dashscope_qwen",
      displayName: "DashScope / Qwen",
      defaultBaseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1"
    }),
    new GenericOpenAICompatibleAdapter({
      id: "moonshot_kimi",
      displayName: "Moonshot / Kimi",
      defaultBaseUrl: "https://api.moonshot.ai/v1"
    }),
    new GenericOpenAICompatibleAdapter({
      id: "xai",
      displayName: "xAI",
      defaultBaseUrl: "https://api.x.ai/v1"
    }),
    new GenericOpenAICompatibleAdapter({
      id: "openrouter",
      displayName: "OpenRouter",
      defaultBaseUrl: "https://openrouter.ai/api/v1",
      headers: {
        "HTTP-Referer": "https://wenforge.local",
        "X-Title": "WenForge Studio"
      }
    }),
    new AnthropicAdapter(),
    new GeminiAdapter()
  ];
}

export { AnthropicAdapter } from "./anthropic-adapter";
export { FakeProviderAdapter } from "./fake-provider-adapter";
export { GeminiAdapter } from "./gemini-adapter";
export { GenericOpenAICompatibleAdapter } from "./generic-openai-compatible-adapter";
export { NotImplementedProviderAdapter } from "./not-implemented-provider-adapter";

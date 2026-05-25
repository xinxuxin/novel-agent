import type { ProviderAdapter } from "@main/ai/provider-adapter";
import { FakeProviderAdapter } from "./fake-provider-adapter";
import { GenericOpenAICompatibleAdapter } from "./generic-openai-compatible-adapter";
import { NotImplementedProviderAdapter } from "./not-implemented-provider-adapter";

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
      defaultBaseUrl: "https://api.moonshot.cn/v1"
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
    new NotImplementedProviderAdapter("anthropic", "Anthropic"),
    new NotImplementedProviderAdapter("gemini", "Google Gemini")
  ];
}

export { FakeProviderAdapter } from "./fake-provider-adapter";
export { GenericOpenAICompatibleAdapter } from "./generic-openai-compatible-adapter";
export { NotImplementedProviderAdapter } from "./not-implemented-provider-adapter";

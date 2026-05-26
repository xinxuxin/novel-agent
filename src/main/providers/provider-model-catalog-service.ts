import type { ProviderModelInfo } from "@contracts/ai";
import type { ProviderId } from "@shared/domain/model-routing";
import type { ProviderAdapter } from "@main/ai/provider-adapter";
import { ProviderAdapterError } from "@main/ai/provider-adapter";
import type { CredentialService } from "@main/providers/credential-service";
import { RedactionService } from "@main/security/redaction-service";

export type ProviderModelListStatus = "skipped" | "passed" | "failed";

export interface ProviderModelListResult {
  provider: ProviderId;
  configured: boolean;
  status: ProviderModelListStatus;
  models: ProviderModelInfo[];
  fetchedAt: string | null;
  error: string | null;
}

export class ProviderModelCatalogService {
  private readonly adapters: Map<string, ProviderAdapter>;
  private readonly redaction = new RedactionService();

  constructor(
    private readonly credentialService: CredentialService,
    adapters: ProviderAdapter[]
  ) {
    this.adapters = new Map(adapters.map((adapter) => [adapter.id, adapter]));
  }

  async listModels(provider: ProviderId): Promise<ProviderModelListResult> {
    const credential = this.credentialService.getDecryptedProviderCredential(provider);
    const adapter = this.adapters.get(provider);
    const base = {
      provider,
      configured: Boolean(credential),
      models: [],
      fetchedAt: new Date().toISOString()
    };

    if (!credential) {
      return {
        ...base,
        status: "skipped",
        fetchedAt: null,
        error: "Provider credential is missing"
      };
    }

    if (!adapter?.listModels) {
      return {
        ...base,
        status: "failed",
        error: "provider_model_list_not_supported"
      };
    }

    try {
      const models = await adapter.listModels({
        apiKey: credential.apiKey,
        baseUrl: credential.baseUrl
      });
      return {
        ...base,
        status: "passed",
        models: models.filter((model) => model.supportsGeneration !== false),
        error: null
      };
    } catch (error) {
      return {
        ...base,
        status: "failed",
        error: this.safeError(error)
      };
    }
  }

  private safeError(error: unknown): string {
    if (error instanceof ProviderAdapterError) {
      return this.redaction.redact(error.providerError.message);
    }
    if (error instanceof Error) {
      return this.redaction.redact(error.message);
    }
    return "Provider model list failed";
  }
}

export function selectSmokeModel(input: {
  provider: ProviderId;
  configuredModel: string;
  availableModels: ProviderModelInfo[];
}): string {
  const available = input.availableModels
    .map((model) => model.id)
    .filter((id) => Boolean(id.trim()));
  if (available.length === 0) return input.configuredModel;
  if (available.includes(input.configuredModel)) return input.configuredModel;
  const preferred = preferredModelPatterns(input.provider);
  return (
    available.find((model) => preferred.some((pattern) => model.toLowerCase().includes(pattern))) ??
    available[0] ??
    input.configuredModel
  );
}

function preferredModelPatterns(provider: ProviderId): string[] {
  switch (provider) {
    case "openai":
      return ["gpt-5.3", "gpt-5.2", "gpt-5.1", "gpt-5", "gpt-4.1", "gpt-4o"];
    case "anthropic":
      return ["claude-opus", "claude-sonnet", "claude"];
    case "gemini":
      return ["gemini-3.5", "gemini-3", "gemini-2.5", "gemini"];
    case "deepseek":
      return ["deepseek-chat", "deepseek-reasoner", "deepseek-v4", "deepseek"];
    case "dashscope_qwen":
      return ["qwen3", "qwen-max", "qwen-plus", "qwen"];
    case "moonshot_kimi":
      return ["kimi", "moonshot"];
    case "xai":
      return ["grok"];
    case "openrouter":
    case "generic_openai_compatible":
      return ["gpt", "claude", "gemini", "deepseek", "qwen", "kimi"];
  }
}

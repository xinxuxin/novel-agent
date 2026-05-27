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
        models: sortProviderModels(
          provider,
          models.filter((model) => model.supportsGeneration !== false)
        ),
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
  const available = sortProviderModels(
    input.provider,
    input.availableModels.filter((model) => model.supportsGeneration !== false)
  )
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
      return ["gpt-5.5", "gpt-5.4", "gpt-5.3", "gpt-5.2", "gpt-5.1", "gpt-5", "gpt-4.1", "gpt-4o"];
    case "anthropic":
      return ["claude-opus", "claude-sonnet", "claude"];
    case "gemini":
      return ["gemini-3.5", "gemini-3", "gemini-2.5", "gemini"];
    case "deepseek":
      return ["deepseek-v4-pro", "deepseek-chat", "deepseek-reasoner", "deepseek-v3", "deepseek"];
    case "dashscope_qwen":
      return ["qwen3.7-max", "qwen3-max", "qwen-max-latest", "qwen-max", "qwen-plus", "qwen"];
    case "moonshot_kimi":
      return [
        "kimi-k2.6",
        "kimi-k2",
        "kimi-latest",
        "moonshot-v1-128k",
        "moonshot-v1-32k",
        "moonshot-v1-8k",
        "kimi",
        "moonshot"
      ];
    case "xai":
      return ["grok"];
    case "openrouter":
    case "generic_openai_compatible":
      return ["gpt", "claude", "gemini", "deepseek", "qwen", "kimi"];
  }
}

export function sortProviderModels(
  provider: ProviderId,
  models: ProviderModelInfo[]
): ProviderModelInfo[] {
  const preferred = preferredModelPatterns(provider);
  return [...models].sort((a, b) => {
    const aRank = preferredRank(a.id, preferred);
    const bRank = preferredRank(b.id, preferred);
    if (aRank !== bRank) return aRank - bRank;
    if (provider === "openai") {
      return compareOpenAiModelFreshness(a.id, b.id);
    }
    return a.id.localeCompare(b.id);
  });
}

function preferredRank(model: string, preferred: string[]): number {
  const lower = model.toLowerCase();
  const index = preferred.findIndex((pattern) => lower.includes(pattern));
  return index === -1 ? preferred.length : index;
}

function compareOpenAiModelFreshness(a: string, b: string): number {
  const aScore = openAiModelFreshnessScore(a);
  const bScore = openAiModelFreshnessScore(b);
  if (aScore !== bScore) return bScore - aScore;
  return a.localeCompare(b);
}

function openAiModelFreshnessScore(model: string): number {
  const lower = model.toLowerCase();
  const match = lower.match(/^gpt-(\d+)(?:\.(\d+))?(?:-(mini|nano))?/);
  if (!match) return 0;
  const major = Number(match[1] ?? 0);
  const minor = Number(match[2] ?? 0);
  const sizePenalty = match[3] === "nano" ? 0.2 : match[3] === "mini" ? 0.1 : 0;
  return major * 100 + minor - sizePenalty;
}

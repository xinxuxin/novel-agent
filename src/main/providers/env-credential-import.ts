import type { ProviderCredentialDto, SaveCredentialInput } from "@contracts/model-routing";
import { PROVIDERS } from "@shared/domain/model-routing";
import type { ProviderId } from "@shared/domain/model-routing";

export interface EnvCredentialImportOptions {
  confirmed: boolean;
  saveCredential: (
    input: SaveCredentialInput
  ) => Pick<ProviderCredentialDto, "provider" | "displayName" | "redactedKeyLabel">;
}

export interface EnvCredentialImportResult {
  imported: Array<{
    provider: ProviderId;
    displayName: string;
    configured: boolean;
    redactedKeyLabel: string;
  }>;
  skipped: ProviderId[];
}

const ENV_PROVIDER_MAP: Array<{
  provider: ProviderId;
  envKey: string;
  displayName: string;
}> = [
  { provider: "openai", envKey: "OPENAI_API_KEY", displayName: "OpenAI local smoke key" },
  { provider: "anthropic", envKey: "ANTHROPIC_API_KEY", displayName: "Anthropic local smoke key" },
  { provider: "gemini", envKey: "GEMINI_API_KEY", displayName: "Gemini local smoke key" },
  { provider: "deepseek", envKey: "DEEPSEEK_API_KEY", displayName: "DeepSeek local smoke key" },
  {
    provider: "dashscope_qwen",
    envKey: "DASHSCOPE_API_KEY",
    displayName: "DashScope/Qwen local smoke key"
  },
  {
    provider: "moonshot_kimi",
    envKey: "MOONSHOT_API_KEY",
    displayName: "Moonshot/Kimi local smoke key"
  },
  { provider: "xai", envKey: "XAI_API_KEY", displayName: "xAI local smoke key" },
  {
    provider: "openrouter",
    envKey: "OPENROUTER_API_KEY",
    displayName: "OpenRouter local smoke key"
  }
];

export function importEnvCredentialsFromText(
  envText: string,
  options: EnvCredentialImportOptions
): EnvCredentialImportResult {
  if (!options.confirmed) {
    throw new Error("Refusing to import local secrets without --confirm-import-local-secrets");
  }

  const env = parseEnvText(envText);
  const imported: EnvCredentialImportResult["imported"] = [];
  const skipped: ProviderId[] = [];

  for (const mapping of ENV_PROVIDER_MAP) {
    const apiKey = env[mapping.envKey]?.trim();
    if (!apiKey) {
      skipped.push(mapping.provider);
      continue;
    }

    const saved = options.saveCredential({
      provider: mapping.provider,
      displayName: mapping.displayName,
      apiKey,
      baseUrl: null
    });
    imported.push({
      provider: saved.provider,
      displayName: saved.displayName,
      configured: true,
      redactedKeyLabel: saved.redactedKeyLabel
    });
  }

  for (const provider of PROVIDERS) {
    if (!imported.some((item) => item.provider === provider) && !skipped.includes(provider)) {
      skipped.push(provider);
    }
  }

  return { imported, skipped };
}

export function parseEnvText(envText: string): Record<string, string> {
  const env: Record<string, string> = {};
  for (const line of envText.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }
    const key = trimmed.slice(0, separatorIndex).trim();
    const rawValue = trimmed.slice(separatorIndex + 1).trim();
    env[key] = unquoteEnvValue(rawValue);
  }
  return env;
}

function unquoteEnvValue(value: string): string {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

import { existsSync, readFileSync } from "node:fs";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createDefaultProviderAdapters } from "../src/main/ai/adapters";
import { AiGateway } from "../src/main/ai/ai-gateway";
import { createDatabaseConnection } from "../src/main/db/connection";
import { createRepositories } from "../src/main/db/service";
import { migrateDatabase } from "../src/main/db/migrate";
import { CredentialService } from "../src/main/providers/credential-service";
import {
  importEnvCredentialsFromText,
  parseEnvText
} from "../src/main/providers/env-credential-import";
import { ProviderSmokeService } from "../src/main/providers/provider-smoke-service";
import { RedactionService } from "../src/main/security/redaction-service";
import { SecretEncryptionService } from "../src/main/security/secret-encryption-service";
import type { ProviderId } from "../src/shared/domain/model-routing";
import { PROVIDERS } from "../src/shared/domain/model-routing";

const DEFAULT_SMOKE_MODELS: Partial<Record<ProviderId, string>> = {
  openai: "gpt-4o-mini",
  anthropic: "claude-3-5-haiku-latest",
  gemini: "gemini-1.5-flash",
  deepseek: "deepseek-chat",
  dashscope_qwen: "qwen-plus",
  moonshot_kimi: "moonshot-v1-8k",
  xai: "grok-2-latest",
  openrouter: "openai/gpt-4o-mini"
};

const MODEL_ENV_KEYS: Partial<Record<ProviderId, string>> = {
  openai: "OPENAI_SMOKE_MODEL",
  anthropic: "ANTHROPIC_SMOKE_MODEL",
  gemini: "GEMINI_SMOKE_MODEL",
  deepseek: "DEEPSEEK_SMOKE_MODEL",
  dashscope_qwen: "DASHSCOPE_SMOKE_MODEL",
  moonshot_kimi: "MOONSHOT_SMOKE_MODEL",
  xai: "XAI_SMOKE_MODEL",
  openrouter: "OPENROUTER_SMOKE_MODEL",
  generic_openai_compatible: "GENERIC_OPENAI_COMPATIBLE_SMOKE_MODEL"
};

export function loadLocalEnv(): Record<string, string> {
  if (!existsSync(".env.local")) {
    return {};
  }
  return parseEnvText(readFileSync(".env.local", "utf8"));
}

export function createProviderSmokeHarness(env: Record<string, string>) {
  const connection = createDatabaseConnection(
    join(mkdtempSync(join(tmpdir(), "wenforge-smoke-")), "smoke.sqlite")
  );
  migrateDatabase(connection.sqlite);
  const repositories = createRepositories(connection.db);
  const credentialService = new CredentialService({
    repository: repositories.providerCredentials,
    encryption: new SecretEncryptionService({
      isEncryptionAvailable: () => true,
      encryptString: (value) => Buffer.from([...value].reverse().join(""), "utf8"),
      decryptString: (value) => [...value.toString("utf8")].reverse().join("")
    }),
    redaction: new RedactionService()
  });

  importEnvCredentialsFromText(formatEnv(env), {
    confirmed: true,
    saveCredential: (input) => credentialService.saveCredential(input)
  });

  seedSmokeModels(repositories, env);
  const adapters = createDefaultProviderAdapters();
  const aiGateway = new AiGateway({
    repositories,
    credentialService,
    adapters
  });
  return {
    connection,
    repositories,
    credentialService,
    aiGateway,
    adapters,
    service: new ProviderSmokeService({
      repositories,
      aiGateway,
      adapters
    })
  };
}

function seedSmokeModels(
  repositories: ReturnType<typeof createRepositories>,
  env: Record<string, string>
): void {
  for (const provider of PROVIDERS) {
    const model = getSmokeModel(provider, env);
    if (!model) {
      continue;
    }
    repositories.modelProfiles.upsert({
      provider,
      model,
      displayName: `${provider} smoke model`,
      supportsStreaming: true,
      supportsJson: true,
      defaultTemperature: 0,
      enabled: true
    });
    repositories.modelPrices.upsert({
      provider,
      model,
      inputPricePerMillion: 0,
      outputPricePerMillion: 0,
      currency: "USD",
      effectiveDate: new Date().toISOString().slice(0, 10),
      sourceNote: "Local smoke-test placeholder price; edit before cost-sensitive use.",
      enabled: true
    });
  }
}

function getSmokeModel(provider: ProviderId, env: Record<string, string>): string | null {
  const envKey = MODEL_ENV_KEYS[provider];
  return (envKey ? env[envKey] : undefined) ?? DEFAULT_SMOKE_MODELS[provider] ?? null;
}

function formatEnv(env: Record<string, string>): string {
  return Object.entries(env)
    .map(([key, value]) => `${key}=${JSON.stringify(value)}`)
    .join("\n");
}

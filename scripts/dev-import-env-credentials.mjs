import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import Database from "better-sqlite3";
import { app, safeStorage } from "electron";

const PROVIDERS = [
  ["openai", "OPENAI_API_KEY", "OpenAI local provider key"],
  ["anthropic", "ANTHROPIC_API_KEY", "Anthropic local provider key"],
  ["gemini", "GEMINI_API_KEY", "Gemini local provider key"],
  ["deepseek", "DEEPSEEK_API_KEY", "DeepSeek local provider key"],
  ["dashscope_qwen", "DASHSCOPE_API_KEY", "DashScope/Qwen local provider key"],
  ["moonshot_kimi", "MOONSHOT_API_KEY", "Moonshot/Kimi local provider key"],
  ["xai", "XAI_API_KEY", "xAI local provider key"],
  ["openrouter", "OPENROUTER_API_KEY", "OpenRouter local provider key"]
];

if (process.env.CI) {
  console.error("Refusing to import local secrets in CI.");
  process.exit(1);
}

if (!process.argv.includes("--confirm-import-local-secrets")) {
  console.error("Refusing to import local secrets without --confirm-import-local-secrets.");
  process.exit(1);
}

if (!existsSync(".env.local")) {
  console.error(".env.local was not found.");
  process.exit(1);
}

await app.whenReady();

try {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error("safeStorage is unavailable; refusing plaintext credential import.");
  }

  const env = parseEnv(readFileSync(".env.local", "utf8"));
  const dataDir = join(app.getPath("userData"), "data");
  const dbPath = join(dataDir, "wenforge.sqlite");
  mkdirSync(dataDir, { recursive: true });
  const db = new Database(dbPath);
  ensureCredentialTableExists(db);

  let imported = 0;
  for (const [provider, envKey, displayName] of PROVIDERS) {
    const apiKey = env[envKey]?.trim();
    if (!apiKey) {
      console.log(`${provider}: skipped`);
      continue;
    }
    const now = new Date().toISOString();
    db.prepare(
      `insert into provider_credentials
      (id, provider, display_name, base_url, encrypted_secret_base64, redacted_key_label,
        is_configured, last_status, created_at, updated_at)
      values (@id, @provider, @displayName, null, @encryptedSecretBase64, @redactedKeyLabel,
        1, 'configured', @createdAt, @updatedAt)
      on conflict(id) do update set
        provider = excluded.provider,
        display_name = excluded.display_name,
        encrypted_secret_base64 = excluded.encrypted_secret_base64,
        redacted_key_label = excluded.redacted_key_label,
        is_configured = 1,
        last_status = 'configured',
        updated_at = excluded.updated_at`
    ).run({
      id: `env_${provider}`,
      provider,
      displayName,
      encryptedSecretBase64: safeStorage.encryptString(apiKey).toString("base64"),
      redactedKeyLabel: createKeyLabel(apiKey),
      createdAt: now,
      updatedAt: now
    });
    imported += 1;
    console.log(`${provider}: imported ${createKeyLabel(apiKey)}`);
  }
  db.close();
  console.log(`Imported ${imported} local credential(s) into encrypted app storage.`);
} finally {
  app.quit();
}

function ensureCredentialTableExists(db) {
  const row = db
    .prepare(
      "select name from sqlite_master where type = 'table' and name = 'provider_credentials'"
    )
    .get();
  if (!row) {
    throw new Error("provider_credentials table is missing. Run WenForge Studio once first.");
  }
}

function parseEnv(text) {
  const env = {};
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const index = trimmed.indexOf("=");
    if (index === -1) {
      continue;
    }
    env[trimmed.slice(0, index).trim()] = trimmed
      .slice(index + 1)
      .trim()
      .replace(/^["']|["']$/g, "");
  }
  return env;
}

function createKeyLabel(secret) {
  const trimmed = secret.trim();
  if (trimmed.length <= 8) {
    return "[redacted]";
  }
  const prefix = trimmed.startsWith("sk-") ? "sk-" : `${trimmed.slice(0, 2)}-`;
  return `${prefix}...${trimmed.slice(-4)}`;
}

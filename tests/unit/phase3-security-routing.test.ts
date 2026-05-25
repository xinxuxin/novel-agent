import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { createDatabaseConnection } from "@main/db/connection";
import { migrateDatabase } from "@main/db/migrate";
import { ModelPriceRepository } from "@main/db/repositories/model-price-repository";
import { ModelProfileRepository } from "@main/db/repositories/model-profile-repository";
import { ProviderCredentialRepository } from "@main/db/repositories/provider-credential-repository";
import { TaskRouteRepository } from "@main/db/repositories/task-route-repository";
import { CredentialService } from "@main/providers/credential-service";
import { ModelRouter } from "@main/providers/model-router";
import { calculateModelCost, isPriceStale } from "@main/providers/model-pricing";
import { RedactionService } from "@main/security/redaction-service";
import { SecretEncryptionService } from "@main/security/secret-encryption-service";
import { executeIpcContract } from "@main/ipc/typed-ipc";
import { IPC_CONTRACTS } from "@shared/ipc/contracts";

let tempDir = "";

function createTestDatabase() {
  tempDir = mkdtempSync(join(tmpdir(), "wenforge-phase3-"));
  const connection = createDatabaseConnection(join(tempDir, "test.sqlite"));
  migrateDatabase(connection.sqlite);
  return connection;
}

function mockSafeStorage() {
  return {
    isEncryptionAvailable: () => true,
    encryptString: (value: string) => Buffer.from([...value].reverse().join(""), "utf8"),
    decryptString: (value: Buffer) => [...value.toString("utf8")].reverse().join("")
  };
}

afterEach(() => {
  if (tempDir) {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

describe("phase 3 secure credentials, pricing, and routing", () => {
  it("encrypts and decrypts secrets through safeStorage without plaintext fallback", () => {
    const encryption = new SecretEncryptionService(mockSafeStorage());

    const encrypted = encryption.encryptToBase64("sk-live-secret-123456");

    expect(encrypted).not.toContain("sk-live-secret-123456");
    expect(encryption.decryptFromBase64(encrypted)).toBe("sk-live-secret-123456");
    expect(() =>
      new SecretEncryptionService({
        ...mockSafeStorage(),
        isEncryptionAvailable: () => false
      }).encryptToBase64("sk-live-secret-123456")
    ).toThrow(/safeStorage is unavailable/);
  });

  it("persists only encrypted credential material and returns renderer-safe DTOs", () => {
    const { db, sqlite } = createTestDatabase();
    const service = new CredentialService({
      repository: new ProviderCredentialRepository(db),
      encryption: new SecretEncryptionService(mockSafeStorage()),
      redaction: new RedactionService()
    });
    const secret = "sk-live-secret-123456";

    const saved = service.saveCredential({
      provider: "openai",
      displayName: "OpenAI main",
      apiKey: secret,
      baseUrl: "https://api.openai.com/v1"
    });
    const raw = sqlite.prepare("select * from provider_credentials where id = ?").get(saved.id);

    expect(JSON.stringify(raw)).not.toContain(secret);
    expect(saved).not.toHaveProperty("apiKey");
    expect(saved).not.toHaveProperty("encryptedSecretBase64");
    expect(saved).toMatchObject({
      provider: "openai",
      displayName: "OpenAI main",
      isConfigured: true,
      lastStatus: "configured"
    });
    expect(saved.redactedKeyLabel).toMatch(/^sk-\.\.\./);
  });

  it("redacts API keys, authorization headers, and key-like values from logs", () => {
    const redaction = new RedactionService();
    const input =
      "Authorization: Bearer sk-live-secret-123456\napi_key=moonshot-secret-value\nnormal text";

    const output = redaction.redact(input);

    expect(output).not.toContain("sk-live-secret-123456");
    expect(output).not.toContain("moonshot-secret-value");
    expect(output).toContain("[redacted]");
    expect(output).toContain("normal text");
  });

  it("calculates model costs and detects stale prices", () => {
    expect(
      calculateModelCost({
        inputTokens: 1_000_000,
        outputTokens: 500_000,
        cachedInputTokens: 100_000,
        inputPricePerMillion: 2,
        outputPricePerMillion: 8,
        cachedInputPricePerMillion: 0.5
      })
    ).toBe(5.85);

    expect(
      isPriceStale({
        effectiveDate: "2026-01-01",
        staleAfterDays: 30,
        now: new Date("2026-05-25T00:00:00.000Z")
      })
    ).toBe(true);
  });

  it("resolves an enabled task route when credential, model, and price are available", () => {
    const { db } = createTestDatabase();
    const credentials = new CredentialService({
      repository: new ProviderCredentialRepository(db),
      encryption: new SecretEncryptionService(mockSafeStorage()),
      redaction: new RedactionService()
    });
    const modelProfiles = new ModelProfileRepository(db);
    const prices = new ModelPriceRepository(db);
    const routes = new TaskRouteRepository(db);
    const credential = credentials.saveCredential({
      provider: "openai",
      displayName: "OpenAI main",
      apiKey: "sk-live-secret-123456"
    });
    const profile = modelProfiles.create({
      provider: "openai",
      model: "gpt-5.4-mini",
      displayName: "GPT-5.4 mini",
      supportsStreaming: true,
      supportsJson: true,
      enabled: true
    });
    prices.upsert({
      provider: "openai",
      model: "gpt-5.4-mini",
      inputPricePerMillion: 1,
      outputPricePerMillion: 4,
      currency: "USD",
      effectiveDate: "2026-05-25",
      sourceNote: "Test price",
      enabled: true
    });
    routes.upsert({
      taskType: "draft_chapter",
      qualityMode: "balanced",
      primaryModelProfileId: profile.id,
      temperature: 0.8,
      maxOutputTokens: 6000,
      enabled: true
    });

    const resolved = new ModelRouter({
      credentials: new ProviderCredentialRepository(db),
      modelProfiles,
      prices,
      routes,
      settings: { priceStaleAfterDays: 180, missingPriceBehavior: "warn" }
    }).resolveRoute("draft_chapter", "balanced");

    expect(resolved.available).toBe(true);
    expect(resolved.credential?.id).toBe(credential.id);
    expect(resolved.modelProfile?.id).toBe(profile.id);
    expect(resolved.warnings).toEqual([]);
  });

  it("marks a route unavailable when its provider credential is missing", () => {
    const { db } = createTestDatabase();
    const modelProfiles = new ModelProfileRepository(db);
    const profile = modelProfiles.create({
      provider: "anthropic",
      model: "claude-sonnet-4.6",
      displayName: "Claude Sonnet 4.6",
      enabled: true
    });
    new TaskRouteRepository(db).upsert({
      taskType: "continuity_audit",
      qualityMode: "premium",
      primaryModelProfileId: profile.id,
      temperature: 0.2,
      maxOutputTokens: 4000,
      enabled: true
    });

    const resolved = new ModelRouter({
      credentials: new ProviderCredentialRepository(db),
      modelProfiles,
      prices: new ModelPriceRepository(db),
      routes: new TaskRouteRepository(db),
      settings: { priceStaleAfterDays: 180, missingPriceBehavior: "warn" }
    }).resolveRoute("continuity_audit", "premium");

    expect(resolved.available).toBe(false);
    expect(resolved.errors).toContain("missing_credential");
  });

  it("upserts routes after migrating a legacy table with required provider and model columns", () => {
    tempDir = mkdtempSync(join(tmpdir(), "wenforge-phase3-legacy-"));
    const connection = createDatabaseConnection(join(tempDir, "legacy.sqlite"));
    connection.sqlite.exec(`
      create table task_model_routes (
        id text primary key,
        task_type text not null unique,
        provider text not null,
        model text not null,
        temperature real not null default 0.7,
        max_output_tokens integer not null default 4000,
        enabled integer not null default 1,
        created_at text not null,
        updated_at text not null
      );
    `);
    migrateDatabase(connection.sqlite);
    const modelProfiles = new ModelProfileRepository(connection.db);
    const profile = modelProfiles.create({
      provider: "openai",
      model: "gpt-5.4-mini",
      displayName: "GPT-5.4 mini"
    });

    const route = new TaskRouteRepository(connection.db).upsert({
      taskType: "draft_chapter",
      qualityMode: "balanced",
      primaryModelProfileId: profile.id,
      temperature: 0.8,
      maxOutputTokens: 6000,
      enabled: true
    });
    const economyRoute = new TaskRouteRepository(connection.db).upsert({
      taskType: "draft_chapter",
      qualityMode: "economy",
      primaryModelProfileId: profile.id,
      temperature: 0.7,
      maxOutputTokens: 4000,
      enabled: true
    });
    const raw = connection.sqlite
      .prepare("select provider, model from task_model_routes where id = ?")
      .get(route.id) as { provider: string; model: string };

    expect(route.primaryModelProfileId).toBe(profile.id);
    expect(economyRoute.qualityMode).toBe("economy");
    expect(raw).toEqual({ provider: "openai", model: "gpt-5.4-mini" });
  });

  it("rejects invalid credential IPC payloads before handler execution", async () => {
    const result = await executeIpcContract(
      IPC_CONTRACTS.credentials.save,
      async () => {
        throw new Error("handler should not run");
      },
      { provider: "openai", displayName: "OpenAI", apiKey: "" }
    );

    expect(result).toEqual({
      ok: false,
      error: {
        code: "VALIDATION_FAILED",
        message: "Invalid IPC payload"
      }
    });
  });
});

import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { FakeProviderAdapter } from "@main/ai/adapters";
import { AiGateway } from "@main/ai/ai-gateway";
import { createDatabaseConnection } from "@main/db/connection";
import { migrateDatabase } from "@main/db/migrate";
import { createRepositories } from "@main/db/service";
import { importEnvCredentialsFromText } from "@main/providers/env-credential-import";
import {
  ProviderSmokeService,
  renderProviderConformanceReport,
  shouldRunRealProviderSmoke
} from "@main/providers/provider-smoke-service";
import { CredentialService } from "@main/providers/credential-service";
import { RedactionService } from "@main/security/redaction-service";
import { SecretEncryptionService } from "@main/security/secret-encryption-service";

let tempDir = "";

afterEach(() => {
  if (tempDir) {
    rmSync(tempDir, { recursive: true, force: true });
    tempDir = "";
  }
});

describe("phase 15a real provider bring-up safety", () => {
  it("keeps local env files and provider reports out of git", () => {
    const gitignore = readFileSync(".gitignore", "utf8");
    const example = readFileSync(".env.example", "utf8");

    expect(gitignore).toContain(".env.local");
    expect(gitignore).toContain(".env.*.local");
    expect(gitignore).toContain("reports/");
    expect(example).toContain("OPENAI_API_KEY=");
    expect(example).toContain("RUN_REAL_PROVIDER_TESTS=false");
    expect(example).toContain("REAL_PROVIDER_TEST_BUDGET_USD=2");
    expect(example).not.toMatch(/sk-[A-Za-z0-9]/);
  });

  it("refuses env credential import without an explicit confirmation flag", () => {
    expect(() =>
      importEnvCredentialsFromText("OPENAI_API_KEY=sk-test-secret-1234567890", {
        confirmed: false,
        saveCredential: () => {
          throw new Error("must not save");
        }
      })
    ).toThrow(/confirm/i);
  });

  it("imports env credentials with redacted output only", () => {
    const saved: string[] = [];
    const result = importEnvCredentialsFromText("OPENAI_API_KEY=sk-test-secret-1234567890", {
      confirmed: true,
      saveCredential: (input) => {
        saved.push(input.apiKey);
        return {
          provider: input.provider,
          displayName: input.displayName,
          redactedKeyLabel: "sk-...7890"
        };
      }
    });

    expect(saved).toEqual(["sk-test-secret-1234567890"]);
    expect(JSON.stringify(result)).not.toContain("sk-test-secret-1234567890");
    expect(result.imported[0]).toMatchObject({
      provider: "openai",
      configured: true,
      redactedKeyLabel: "sk-...7890"
    });
  });

  it("skips real provider smoke runs unless explicitly opted in", () => {
    expect(shouldRunRealProviderSmoke({ RUN_REAL_PROVIDER_TESTS: "false" })).toBe(false);
    expect(shouldRunRealProviderSmoke({ RUN_REAL_PROVIDER_TESTS: "TRUE" })).toBe(true);
    expect(shouldRunRealProviderSmoke({ CI: "true", RUN_REAL_PROVIDER_TESTS: "true" })).toBe(false);
  });

  it("creates llm_runs for fake smoke calls without storing prompt or response text", async () => {
    const { service, repositories } = createSmokeHarness({
      provider: "openai",
      model: "smoke-model",
      inputPricePerMillion: 0.01,
      outputPricePerMillion: 0.01
    });

    const result = await service.runProviderSmoke({
      provider: "openai",
      confirmed: true,
      budgetCapUsd: 0.5
    });

    expect(result.tested).toBe(true);
    expect(result.status).toBe("passed");
    expect(result.runIds.length).toBeGreaterThan(0);
    const run = repositories.cost.getRun(result.runIds[0] ?? "");
    expect(run).toMatchObject({
      provider: "openai",
      taskType: "brainstorm",
      status: "succeeded"
    });
    expect(JSON.stringify(run)).not.toContain("Return a tiny JSON object");
    expect(JSON.stringify(run)).not.toContain("pong");
    expect(run?.promptHash).toMatch(/^[a-f0-9]{64}$/);
    expect(run?.responseHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("blocks smoke calls before provider execution when the tiny budget cap is exceeded", async () => {
    let called = false;
    const { service, repositories } = createSmokeHarness({
      provider: "openai",
      model: "expensive-model",
      inputPricePerMillion: 100_000,
      outputPricePerMillion: 100_000,
      onBeforeStream: () => {
        called = true;
      }
    });

    const result = await service.runProviderSmoke({
      provider: "openai",
      confirmed: true,
      budgetCapUsd: 0.0001
    });

    expect(result.status).toBe("blocked");
    expect(result.error).toMatch(/budget/i);
    expect(called).toBe(false);
    expect(repositories.cost.summarizeRuns({}).runCount).toBe(0);
  });

  it("renders provider conformance reports with redacted errors", () => {
    const report = renderProviderConformanceReport([
      {
        provider: "openai",
        model: "smoke-model",
        configured: true,
        tested: true,
        status: "failed",
        streamingSupported: true,
        nonStreamingSupported: true,
        usageParsed: false,
        finalCostComputed: false,
        fallbackEligible: false,
        error: "Authorization: Bearer sk-secret-1234567890",
        testedAt: "2026-05-25T00:00:00.000Z",
        latencyMs: null,
        estimatedCost: null,
        finalCost: null,
        runIds: []
      }
    ]);

    expect(report).toContain("| openai | true | true |");
    expect(report).not.toContain("sk-secret");
    expect(report).not.toContain("Authorization: Bearer");
  });

  it("keeps provider UI and CI away from decrypted keys and real provider scripts", () => {
    const settingsPanel = readFileSync("src/renderer/features/settings/SettingsPanel.tsx", "utf8");
    const ci = readFileSync(".github/workflows/ci.yml", "utf8");

    expect(settingsPanel).not.toContain("encryptedSecretBase64");
    expect(settingsPanel).not.toContain("credential.apiKey");
    expect(settingsPanel).toContain("redactedKeyLabel");
    expect(settingsPanel).toContain("providerSmoke.runAll");
    expect(settingsPanel).toContain("summarizeSmokeResults");
    expect(settingsPanel).toContain("checkingProviders");
    expect(ci).not.toContain("providers:smoke");
    expect(ci).not.toContain("RUN_REAL_PROVIDER_TESTS=true");
  });
});

function createSmokeHarness(input: {
  provider: "openai";
  model: string;
  inputPricePerMillion: number;
  outputPricePerMillion: number;
  onBeforeStream?: () => void;
}) {
  tempDir = mkdtempSync(join(tmpdir(), "wenforge-phase15a-"));
  const connection = createDatabaseConnection(join(tempDir, "smoke.sqlite"));
  migrateDatabase(connection.sqlite);
  const repositories = createRepositories(connection.db);
  const credentials = new CredentialService({
    repository: repositories.providerCredentials,
    encryption: new SecretEncryptionService({
      isEncryptionAvailable: () => true,
      encryptString: (value) => Buffer.from([...value].reverse().join(""), "utf8"),
      decryptString: (value) => [...value.toString("utf8")].reverse().join("")
    }),
    redaction: new RedactionService()
  });
  credentials.saveCredential({
    provider: input.provider,
    displayName: "Smoke provider",
    apiKey: "sk-smoke-secret-1234567890"
  });
  repositories.modelProfiles.create({
    provider: input.provider,
    model: input.model,
    displayName: input.model,
    supportsStreaming: true,
    supportsJson: true,
    enabled: true
  });
  repositories.modelPrices.upsert({
    provider: input.provider,
    model: input.model,
    inputPricePerMillion: input.inputPricePerMillion,
    outputPricePerMillion: input.outputPricePerMillion,
    currency: "USD",
    effectiveDate: "2026-05-25",
    sourceNote: "test",
    enabled: true
  });
  const gateway = new AiGateway({
    repositories: repositories as never,
    credentialService: credentials,
    adapters: [
      new FakeProviderAdapter({
        id: input.provider,
        chunks: ['{"ok":true,"provider":"openai","message":"pong"}'],
        usage: { inputTokens: 12, outputTokens: 8 },
        ...(input.onBeforeStream ? { onBeforeStream: input.onBeforeStream } : {})
      })
    ]
  });
  return {
    repositories,
    service: new ProviderSmokeService({
      repositories: repositories as never,
      aiGateway: gateway,
      adapters: [
        new FakeProviderAdapter({
          id: input.provider,
          chunks: ['{"ok":true,"provider":"openai","message":"pong"}'],
          usage: { inputTokens: 12, outputTokens: 8 }
        })
      ]
    })
  };
}

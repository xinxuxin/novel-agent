import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { createDatabaseConnection } from "@main/db/connection";
import { migrateDatabase } from "@main/db/migrate";
import { createRepositories } from "@main/db/service";
import { AiGateway } from "@main/ai/ai-gateway";
import { CostCalculator } from "@main/ai/cost-calculator";
import { TokenEstimator } from "@main/ai/token-estimator";
import { FakeProviderAdapter } from "@main/ai/adapters/fake-provider-adapter";
import { CredentialService } from "@main/providers/credential-service";
import { RedactionService } from "@main/security/redaction-service";
import { SecretEncryptionService } from "@main/security/secret-encryption-service";

let tempDir = "";

function mockSafeStorage() {
  return {
    isEncryptionAvailable: () => true,
    encryptString: (value: string) => Buffer.from([...value].reverse().join(""), "utf8"),
    decryptString: (value: Buffer) => [...value.toString("utf8")].reverse().join("")
  };
}

function createGatewayTestHarness(options: { failProvider?: boolean; delayMs?: number } = {}) {
  tempDir = mkdtempSync(join(tmpdir(), "wenforge-ai-gateway-"));
  const connection = createDatabaseConnection(join(tempDir, "test.sqlite"));
  migrateDatabase(connection.sqlite);
  const repositories = createRepositories(connection.db);
  const credentialService = new CredentialService({
    repository: repositories.providerCredentials,
    encryption: new SecretEncryptionService(mockSafeStorage()),
    redaction: new RedactionService()
  });
  credentialService.saveCredential({
    provider: "openai",
    displayName: "OpenAI test",
    apiKey: "sk-test-secret"
  });
  repositories.modelPrices.upsert({
    provider: "openai",
    model: "fake-story-model",
    inputPricePerMillion: 2,
    outputPricePerMillion: 8,
    cachedInputPricePerMillion: 1,
    currency: "USD",
    effectiveDate: "2026-05-25",
    sourceNote: "Unit test price"
  });
  const fakeAdapter = new FakeProviderAdapter({
    id: "openai",
    chunks: ["雨声", "落下", "，故事开始。"],
    usage: {
      inputTokens: 12,
      outputTokens: 9,
      cachedInputTokens: 2
    },
    delayMs: options.delayMs ?? 0,
    ...(options.failProvider
      ? {
          error: {
            code: "fake_failure",
            message: "Fake provider failed"
          }
        }
      : {}),
    onBeforeStream: () => {
      expect(repositories.cost.listRunsByChapter("chapter-1")[0]).toMatchObject({
        status: "running",
        promptHash: expect.any(String)
      });
    }
  });
  const gateway = new AiGateway({
    repositories,
    credentialService,
    adapters: [fakeAdapter],
    tokenEstimator: new TokenEstimator(),
    costCalculator: new CostCalculator()
  });

  return { connection, repositories, gateway };
}

afterEach(() => {
  if (tempDir) {
    rmSync(tempDir, { recursive: true, force: true });
    tempDir = "";
  }
});

describe("AI gateway streaming and llm_run accounting", () => {
  it("streams fake provider deltas, emits live costs, and reconciles reported usage", async () => {
    const { repositories, gateway } = createGatewayTestHarness();
    const events: unknown[] = [];

    const { runId } = await gateway.startStream(
      {
        provider: "openai",
        model: "fake-story-model",
        taskType: "brainstorm",
        projectId: "project-1",
        bookId: "book-1",
        chapterId: "chapter-1",
        messages: [{ role: "user", content: "写一个雨夜开场" }],
        temperature: 0.7,
        maxOutputTokens: 1000
      },
      (event) => events.push(event)
    );
    await gateway.waitForRun(runId);

    const run = repositories.cost.getRun(runId);
    expect(events.map((event) => (event as { type: string }).type)).toContain("delta");
    expect(events.map((event) => (event as { type: string }).type)).toContain("cost");
    expect(events.at(-1)).toMatchObject({ type: "complete", runId });
    expect(run).toMatchObject({
      id: runId,
      provider: "openai",
      model: "fake-story-model",
      taskType: "brainstorm",
      status: "succeeded",
      inputTokensReported: 12,
      outputTokensReported: 9,
      cachedInputTokensReported: 2,
      usageSource: "provider",
      finalCost: 0.000094,
      promptHash: expect.any(String),
      responseHash: expect.any(String)
    });
    expect(JSON.stringify(run)).not.toContain("写一个雨夜开场");
    expect(JSON.stringify(run)).not.toContain("雨声落下");
  });

  it("updates llm_runs with safe provider errors", async () => {
    const { repositories, gateway } = createGatewayTestHarness({ failProvider: true });
    const events: unknown[] = [];

    const { runId } = await gateway.startStream(
      {
        provider: "openai",
        model: "fake-story-model",
        taskType: "brainstorm",
        chapterId: "chapter-1",
        messages: [{ role: "user", content: "触发错误" }]
      },
      (event) => events.push(event)
    );
    await gateway.waitForRun(runId);

    expect(events.at(-1)).toMatchObject({
      type: "error",
      code: "fake_failure",
      message: "Fake provider failed"
    });
    expect(repositories.cost.getRun(runId)).toMatchObject({
      status: "failed",
      errorCode: "fake_failure",
      errorMessage: "Fake provider failed",
      usageSource: "estimated",
      finalCost: expect.any(Number)
    });
  });

  it("aborts active streams and records cancelled runs", async () => {
    const { repositories, gateway } = createGatewayTestHarness({ delayMs: 5 });
    const events: unknown[] = [];

    const { runId } = await gateway.startStream(
      {
        provider: "openai",
        model: "fake-story-model",
        taskType: "brainstorm",
        chapterId: "chapter-1",
        messages: [{ role: "user", content: "开始后中止" }]
      },
      (event) => {
        events.push(event);
        if ((event as { type: string }).type === "delta") {
          gateway.abortRun(runId);
        }
      }
    );
    await gateway.waitForRun(runId);

    expect(events.at(-1)).toMatchObject({ type: "error", code: "aborted" });
    expect(repositories.cost.getRun(runId)).toMatchObject({
      status: "cancelled",
      errorCode: "aborted"
    });
  });

  it("summarizes run costs by chapter and time range", async () => {
    const { repositories, gateway } = createGatewayTestHarness();
    const { runId } = await gateway.startStream(
      {
        provider: "openai",
        model: "fake-story-model",
        taskType: "brainstorm",
        chapterId: "chapter-1",
        messages: [{ role: "user", content: "统计费用" }]
      },
      () => undefined
    );
    await gateway.waitForRun(runId);

    const summary = repositories.cost.summarizeRuns({ chapterId: "chapter-1" });

    expect(summary).toMatchObject({
      runCount: 1,
      finalCost: 0.000094,
      estimatedCostLive: expect.any(Number),
      currency: "USD"
    });
  });
});

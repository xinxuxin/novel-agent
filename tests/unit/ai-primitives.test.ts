import { describe, expect, it } from "vitest";

import { CostCalculator } from "@main/ai/cost-calculator";
import { SseParser } from "@main/ai/sse-parser";
import { TokenEstimator } from "@main/ai/token-estimator";
import { FakeProviderAdapter } from "@main/ai/adapters/fake-provider-adapter";
import { GenericOpenAICompatibleAdapter } from "@main/ai/adapters/generic-openai-compatible-adapter";

describe("AI primitive services", () => {
  it("estimates Chinese, English, and code tokens conservatively", () => {
    const estimator = new TokenEstimator();

    expect(estimator.estimateText("你好世界")).toBe(4);
    expect(estimator.estimateText("hello world")).toBe(3);
    expect(
      estimator.estimateMessages([
        { role: "system", content: "你是小说助手" },
        { role: "user", content: "Write: const value = 1;" }
      ])
    ).toBeGreaterThan(10);
  });

  it("calculates estimated and final cost breakdowns with cached input support", () => {
    const calculator = new CostCalculator();

    expect(
      calculator.calculate({
        usage: {
          inputTokens: 1_000_000,
          outputTokens: 500_000,
          cachedInputTokens: 100_000
        },
        price: {
          inputPricePerMillion: 2,
          outputPricePerMillion: 8,
          cachedInputPricePerMillion: 0.5,
          currency: "USD"
        },
        estimated: false
      })
    ).toEqual({
      inputCost: 1.8,
      outputCost: 4,
      cachedInputCost: 0.05,
      totalCost: 5.85,
      currency: "USD",
      estimated: false
    });
  });

  it("parses SSE data lines, multi-line events, done markers, and malformed chunks", () => {
    const parser = new SseParser();

    expect(
      parser.push(
        'event: message\ndata: {"choices":[{"delta":{"content":"你"}}]}\n\n' +
          "data: line one\ndata: line two\n\n" +
          "data: [DONE]\n\n" +
          "malformed\n\n"
      )
    ).toEqual([
      {
        event: "message",
        data: '{"choices":[{"delta":{"content":"你"}}]}',
        done: false
      },
      {
        event: null,
        data: "line one\nline two",
        done: false
      },
      {
        event: null,
        data: "[DONE]",
        done: true
      }
    ]);
    expect(parser.finish()).toEqual([]);
  });

  it("streams deterministic fake provider chunks and usage without network calls", async () => {
    const adapter = new FakeProviderAdapter({
      id: "openai",
      chunks: ["A", "B"],
      usage: { inputTokens: 3, outputTokens: 2 }
    });
    const deltas: string[] = [];

    const response = await adapter.streamChat(
      {
        provider: "openai",
        model: "fake",
        taskType: "brainstorm",
        messages: [{ role: "user", content: "test" }]
      },
      {
        onDelta: (delta) => deltas.push(delta)
      },
      new AbortController().signal
    );

    expect(deltas).toEqual(["A", "B"]);
    expect(response).toMatchObject({
      text: "AB",
      usage: { inputTokens: 3, outputTokens: 2 }
    });
  });

  it("extracts OpenAI-compatible streaming deltas and final usage from SSE payloads", async () => {
    const adapter = new GenericOpenAICompatibleAdapter({
      id: "openai",
      displayName: "OpenAI-compatible test",
      defaultBaseUrl: "https://example.test/v1",
      fetchImpl: async () =>
        new Response(
          [
            'data: {"choices":[{"delta":{"content":"雨"}}]}\n\n',
            'data: {"choices":[{"delta":{"content":"夜"}}],"usage":{"prompt_tokens":5,"completion_tokens":2,"total_tokens":7}}\n\n',
            "data: [DONE]\n\n"
          ].join(""),
          { status: 200 }
        )
    });
    const deltas: string[] = [];

    const response = await adapter.streamChat(
      {
        provider: "openai",
        model: "test-model",
        taskType: "brainstorm",
        messages: [{ role: "user", content: "test" }]
      },
      { onDelta: (delta) => deltas.push(delta) },
      new AbortController().signal,
      { apiKey: "sk-test", baseUrl: "https://example.test/v1" }
    );

    expect(deltas).toEqual(["雨", "夜"]);
    expect(response).toMatchObject({
      text: "雨夜",
      usage: {
        inputTokens: 5,
        outputTokens: 2
      }
    });
  });
});

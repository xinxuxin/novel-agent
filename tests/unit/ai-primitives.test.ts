import { describe, expect, it } from "vitest";

import { CostCalculator } from "@main/ai/cost-calculator";
import { SseParser } from "@main/ai/sse-parser";
import { TokenEstimator } from "@main/ai/token-estimator";
import { AnthropicAdapter } from "@main/ai/adapters/anthropic-adapter";
import { FakeProviderAdapter } from "@main/ai/adapters/fake-provider-adapter";
import { GeminiAdapter } from "@main/ai/adapters/gemini-adapter";
import { GenericOpenAICompatibleAdapter } from "@main/ai/adapters/generic-openai-compatible-adapter";
import { selectSmokeModel } from "@main/providers/provider-model-catalog-service";

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

  it("lists OpenAI-compatible models for UI-supported model selection", async () => {
    const adapter = new GenericOpenAICompatibleAdapter({
      id: "openai",
      displayName: "OpenAI-compatible test",
      defaultBaseUrl: "https://example.test/v1",
      fetchImpl: async () =>
        Response.json({
          data: [
            { id: "gpt-4o-mini", object: "model", owned_by: "openai" },
            { id: "text-embedding-3-small", object: "model" }
          ]
        })
    });

    await expect(adapter.listModels?.({ apiKey: "sk-test" })).resolves.toEqual([
      {
        id: "gpt-4o-mini",
        displayName: "gpt-4o-mini",
        ownedBy: "openai",
        supportsGeneration: true
      },
      {
        id: "text-embedding-3-small",
        displayName: "text-embedding-3-small",
        ownedBy: null,
        supportsGeneration: false
      }
    ]);
  });

  it("chooses a listed smoke model instead of an unavailable placeholder alias", () => {
    expect(
      selectSmokeModel({
        provider: "openai",
        configuredModel: "gpt-5.5",
        availableModels: [
          { id: "text-embedding-3-large", supportsGeneration: false },
          { id: "gpt-4o-mini", supportsGeneration: true }
        ]
      })
    ).toBe("gpt-4o-mini");
  });

  it("generates Anthropic text and parses usage through the REST adapter", async () => {
    const adapter = new AnthropicAdapter(
      async (_url, init) => {
        expect(init?.headers).toMatchObject({
          "x-api-key": "sk-ant-test",
          "anthropic-version": "2023-06-01"
        });
        return Response.json({
          id: "msg_test",
          type: "message",
          content: [{ type: "text", text: '{"ok":true,"message":"pong"}' }],
          usage: { input_tokens: 11, output_tokens: 7, cache_read_input_tokens: 2 }
        });
      }
    );

    await expect(
      adapter.generateText(
        {
          provider: "anthropic",
          model: "claude-test",
          taskType: "brainstorm",
          messages: [{ role: "user", content: "ping" }],
          maxOutputTokens: 80
        },
        new AbortController().signal,
        { apiKey: "sk-ant-test" }
      )
    ).resolves.toMatchObject({
      text: '{"ok":true,"message":"pong"}',
      usage: { inputTokens: 11, outputTokens: 7, cachedInputTokens: 2 }
    });
  });

  it("lists Anthropic models for the provider settings panel", async () => {
    const adapter = new AnthropicAdapter(async () =>
      Response.json({
        data: [
          { id: "claude-opus-4-1", display_name: "Claude Opus 4.1", type: "model" }
        ]
      })
    );

    await expect(adapter.listModels?.({ apiKey: "sk-ant-test" })).resolves.toEqual([
      {
        id: "claude-opus-4-1",
        displayName: "Claude Opus 4.1",
        supportsGeneration: true
      }
    ]);
  });

  it("generates Gemini text and parses usage through the REST adapter", async () => {
    const adapter = new GeminiAdapter(
      async (_url, init) => {
        expect(init?.headers).toMatchObject({
          "x-goog-api-key": "AIza-test",
          "Content-Type": "application/json"
        });
        return Response.json({
          candidates: [
            {
              content: {
                parts: [{ text: '{"ok":true,"message":"pong"}' }]
              }
            }
          ],
          usageMetadata: {
            promptTokenCount: 9,
            candidatesTokenCount: 6,
            totalTokenCount: 15
          }
        });
      }
    );

    await expect(
      adapter.generateText(
        {
          provider: "gemini",
          model: "gemini-test",
          taskType: "brainstorm",
          messages: [{ role: "user", content: "ping" }],
          maxOutputTokens: 80
        },
        new AbortController().signal,
        { apiKey: "AIza-test" }
      )
    ).resolves.toMatchObject({
      text: '{"ok":true,"message":"pong"}',
      usage: { inputTokens: 9, outputTokens: 6, totalTokens: 15 }
    });
  });

  it("lists Gemini generation-capable models for the provider settings panel", async () => {
    const adapter = new GeminiAdapter(async () =>
      Response.json({
        models: [
          {
            name: "models/gemini-2.5-pro",
            displayName: "Gemini 2.5 Pro",
            inputTokenLimit: 1_048_576,
            supportedGenerationMethods: ["generateContent", "streamGenerateContent"]
          }
        ]
      })
    );

    await expect(adapter.listModels?.({ apiKey: "AIza-test" })).resolves.toEqual([
      {
        id: "gemini-2.5-pro",
        displayName: "Gemini 2.5 Pro",
        contextWindow: 1_048_576,
        supportsGeneration: true
      }
    ]);
  });
});

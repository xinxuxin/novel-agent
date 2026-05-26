import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { ModelParameterPolicy } from "@main/ai/model-parameter-policy";
import { AnthropicAdapter } from "@main/ai/adapters/anthropic-adapter";
import { GenericOpenAICompatibleAdapter } from "@main/ai/adapters/generic-openai-compatible-adapter";
import { createDatabaseConnection } from "@main/db/connection";
import { migrateDatabase } from "@main/db/migrate";
import { BookRepository } from "@main/db/repositories/book-repository";
import { ChapterRepository } from "@main/db/repositories/chapter-repository";
import { PlanningRepository } from "@main/db/repositories/planning-repository";
import { ProjectRepository } from "@main/db/repositories/project-repository";

let tempDir = "";
let currentSqlite: ReturnType<typeof createDatabaseConnection>["sqlite"] | undefined;

function createTestDatabase() {
  tempDir = mkdtempSync(join(tmpdir(), "wenforge-phase18-"));
  const connection = createDatabaseConnection(join(tempDir, "test.sqlite"));
  migrateDatabase(connection.sqlite);
  currentSqlite = connection.sqlite;
  return connection;
}

afterEach(() => {
  currentSqlite?.close();
  currentSqlite = undefined;
  if (tempDir) {
    rmSync(tempDir, { recursive: true, force: true });
    tempDir = "";
  }
});

describe("phase 18 model parameter policy", () => {
  it("omits deprecated Anthropic sampling params and uses max_tokens for Claude Opus 4.7", () => {
    const normalized = new ModelParameterPolicy().normalize({
      provider: "anthropic",
      model: "claude-opus-4.7",
      endpointFamily: "anthropic_messages",
      outputTokenBudget: 2048,
      creativityIntent: "creative",
      supportsTemperature: false,
      supportsTopP: false,
      supportsTopK: false,
      maxOutputParamName: "max_tokens"
    });

    expect(normalized.bodyParams).toMatchObject({ max_tokens: 2048 });
    expect(normalized.bodyParams).not.toHaveProperty("temperature");
    expect(normalized.bodyParams).not.toHaveProperty("top_p");
    expect(normalized.bodyParams).not.toHaveProperty("top_k");
    expect(normalized.omittedParams).toContainEqual(
      expect.objectContaining({ name: "temperature", reason: expect.stringContaining("unsupported") })
    );
    expect(normalized.promptInstructions.join("\n")).toContain("更有变化");
  });

  it("uses model-controlled OpenAI max output parameter names without sending max_tokens", () => {
    const chat = new ModelParameterPolicy().normalize({
      provider: "openai",
      model: "gpt-5.5",
      endpointFamily: "openai_chat_completions",
      outputTokenBudget: 1200,
      creativityIntent: "balanced",
      supportsTemperature: true,
      maxOutputParamName: "max_completion_tokens"
    });

    expect(chat.bodyParams).toMatchObject({ max_completion_tokens: 1200 });
    expect(chat.bodyParams).not.toHaveProperty("max_tokens");
    expect(chat.bodyParams).not.toHaveProperty("max_output_tokens");

    const responses = new ModelParameterPolicy().normalize({
      provider: "openai",
      model: "gpt-5.5",
      endpointFamily: "openai_responses",
      outputTokenBudget: 1200,
      creativityIntent: "balanced",
      supportsTemperature: true,
      maxOutputParamName: "max_output_tokens"
    });

    expect(responses.bodyParams).toMatchObject({ max_output_tokens: 1200 });
    expect(responses.bodyParams).not.toHaveProperty("max_tokens");
    expect(responses.bodyParams).not.toHaveProperty("max_completion_tokens");
  });

  it("keeps OpenAI-compatible model params profile-driven and calculates max_safe context", () => {
    const normalized = new ModelParameterPolicy().normalize({
      provider: "deepseek",
      model: "deepseek-v4-pro",
      endpointFamily: "deepseek_openai_compatible",
      outputTokenBudget: 4096,
      contextWindow: 128_000,
      contextBudgetMode: "max_safe",
      creativityIntent: "deterministic",
      supportsTemperature: true,
      maxOutputParamName: "max_tokens"
    });

    expect(normalized.bodyParams).toMatchObject({ max_tokens: 4096, temperature: 0.2 });
    expect(normalized.effectiveContextTokenBudget).toBeGreaterThan(120_000);
    expect(normalized.effectiveContextTokenBudget).toBeLessThan(128_000);
  });

  it("classifies known provider parameter compatibility errors as retryable", () => {
    const policy = new ModelParameterPolicy();

    expect(policy.classifyParameterError("Unsupported parameter: max_tokens is not supported")).toEqual(
      expect.objectContaining({
        retryable: true,
        removeParams: expect.arrayContaining(["max_tokens"])
      })
    );
    expect(policy.classifyParameterError("temperature is deprecated for this model")).toEqual(
      expect.objectContaining({
        retryable: true,
        removeParams: expect.arrayContaining(["temperature"])
      })
    );
  });

  it("normalizes actual OpenAI-compatible request bodies before provider fetch", async () => {
    let body: Record<string, unknown> = {};
    const adapter = new GenericOpenAICompatibleAdapter({
      id: "openai",
      displayName: "OpenAI test",
      defaultBaseUrl: "https://example.test/v1",
      fetchImpl: async (_url, init) => {
        body = JSON.parse(String(init?.body)) as Record<string, unknown>;
        return Response.json({
          choices: [{ message: { content: "pong" } }],
          usage: { prompt_tokens: 1, completion_tokens: 1 }
        });
      }
    });
    const normalized = new ModelParameterPolicy().normalize({
      provider: "openai",
      model: "gpt-5.5",
      endpointFamily: "openai_chat_completions",
      outputTokenBudget: 80,
      maxOutputParamName: "max_completion_tokens"
    });

    await adapter.generateText(
      { provider: "openai", model: "gpt-5.5", taskType: "brainstorm", messages: [{ role: "user", content: "ping" }] },
      new AbortController().signal,
      { apiKey: "sk-test", normalizedParams: normalized }
    );

    expect(body).toMatchObject({ max_completion_tokens: 80 });
    expect(body).not.toHaveProperty("max_tokens");
  });

  it("normalizes actual Anthropic request bodies before provider fetch", async () => {
    let body: Record<string, unknown> = {};
    const adapter = new AnthropicAdapter(async (_url, init) => {
      body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return Response.json({
        content: [{ type: "text", text: "pong" }],
        usage: { input_tokens: 1, output_tokens: 1 }
      });
    });
    const normalized = new ModelParameterPolicy().normalize({
      provider: "anthropic",
      model: "claude-opus-4.7",
      endpointFamily: "anthropic_messages",
      outputTokenBudget: 80,
      supportsTemperature: false,
      maxOutputParamName: "max_tokens"
    });

    await adapter.generateText(
      { provider: "anthropic", model: "claude-opus-4.7", taskType: "brainstorm", messages: [{ role: "user", content: "ping" }] },
      new AbortController().signal,
      { apiKey: "sk-ant-test", normalizedParams: normalized }
    );

    expect(body).toMatchObject({ max_tokens: 80 });
    expect(body).not.toHaveProperty("temperature");
  });
});

describe("phase 18 planning data foundation", () => {
  it("creates editable planning tables and preserves imported outline sources", () => {
    const { sqlite, db } = createTestDatabase();
    const tables = sqlite
      .prepare("select name from sqlite_master where type = 'table' order by name")
      .all()
      .map((row) => (row as { name: string }).name);

    expect(tables).toEqual(expect.arrayContaining([
      "outline_sources",
      "outline_versions",
      "volume_plans",
      "chapter_plans",
      "plan_edit_proposals"
    ]));

    const projects = new ProjectRepository(db);
    const books = new BookRepository(db);
    const chapters = new ChapterRepository(db);
    const planning = new PlanningRepository(db);

    const project = projects.create({ name: "规划测试" });
    const book = books.create({ projectId: project.id, title: "书" });
    const chapter = chapters.create({
      bookId: book.id,
      chapterIndex: 1,
      title: "第一章",
      targetWords: 3000,
      minWords: 2600,
      maxWords: 3400,
      lockWordCount: true,
      wordCountPriority: "strict"
    });

    const source = planning.createOutlineSource({
      projectId: project.id,
      bookId: book.id,
      sourceType: "file",
      title: "详细大纲.docx",
      originalText: "第一卷：雨夜觉醒\n第一章：钟楼异响"
    });
    const version = planning.createOutlineVersion({
      bookId: book.id,
      title: "解析版 v1",
      contentJson: JSON.stringify({ volumes: [{ title: "雨夜觉醒" }] }),
      contentMarkdown: "## 第一卷\n- 第一章：钟楼异响",
      sourceId: source.id,
      isActive: true
    });
    const plan = planning.upsertChapterPlan({
      bookId: book.id,
      chapterId: chapter.id,
      outlineVersionId: version.id,
      chapterIndex: 1,
      title: "第一章：钟楼异响",
      targetWords: 3200,
      minWords: 3000,
      maxWords: 3600,
      chapterPromise: "主角确认雨夜异响不是幻觉",
      openingHook: "钟声缺了一拍",
      mainConflict: "是否进入钟楼",
      emotionalTurn: "从逃避到主动记录证据",
      payoff: "拿到异常声纹",
      endingHook: "门后传来自己的声音",
      continuityDependenciesJson: JSON.stringify(["雨夜感知规则"]),
      userNotes: "不要改掉钟楼",
      status: "accepted"
    });
    const proposal = planning.createPlanEditProposal({
      bookId: book.id,
      targetType: "chapter",
      targetId: plan.id,
      instruction: "结尾钩子更强",
      beforeJson: JSON.stringify({ endingHook: plan.endingHook }),
      afterJson: JSON.stringify({ endingHook: "门后的人说出母亲旧案日期" }),
      rationale: "提高章末悬念，同时不改世界观"
    });

    expect(planning.listOutlineSources(book.id)[0]?.originalText).toContain("雨夜觉醒");
    expect(planning.getAcceptedChapterPlan(chapter.id)?.endingHook).toBe("门后传来自己的声音");
    expect(planning.acceptPlanEditProposal(proposal.id)?.status).toBe("accepted");
    expect(planning.rejectPlanEditProposal(proposal.id)?.status).toBe("rejected");
  });
});

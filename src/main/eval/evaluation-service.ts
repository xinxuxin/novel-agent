import type {
  EvalApplyRecommendationRequest,
  EvalCaseRecord,
  EvalHumanScoreRequest,
  EvalJudgeRequest,
  EvalLeaderboardEntry,
  EvalOutputRecord,
  EvalPromoteRequest,
  EvalReportRequest,
  EvalReportResult,
  EvalRouteRecommendations,
  EvalRunRecord,
  EvalScoreRecord,
  EvalStartRequest,
  EvalSuiteRecord
} from "@contracts/evaluation";
import { EVAL_DIMENSIONS, ROUTING_EVAL_TASK_TYPES } from "@contracts/evaluation";
import type { AiGateway } from "@main/ai/ai-gateway";
import { sha256Hex } from "@main/ai/hash";
import type { WenForgeDatabase } from "@main/db/connection";
import { createId } from "@main/db/id";
import { nowIso } from "@main/db/repositories/types";
import type { RepositoryRegistry } from "@main/db/service";
import { RedactionService } from "@main/security/redaction-service";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export interface EvaluationServiceOptions {
  database: WenForgeDatabase;
  repositories: RepositoryRegistry;
  aiGateway?: AiGateway | undefined;
  reportsDir?: string | undefined;
  now?: () => string;
}

const BUILT_IN_CASES: Array<{ title: string; genre: string; focus: string[]; prompt: string }> = [
  {
    title: "都市异能开篇",
    genre: "都市异能",
    focus: ["opening_hook", "conflict_density", "ending_hook"],
    prompt: "写一段都市异能小说开篇，主角在雨夜发现异常感知。"
  },
  {
    title: "玄幻退婚流反转",
    genre: "玄幻",
    focus: ["emotional_turn", "webnovel_pacing", "originality"],
    prompt: "写一段退婚流场景，但用反转让主角掌握主动。"
  },
  {
    title: "仙侠宗门危机",
    genre: "仙侠",
    focus: ["continuity_respect", "character_voice", "conflict_density"],
    prompt: "写一段宗门大阵将破、弟子必须抉择的危机场景。"
  },
  {
    title: "无限流副本开局",
    genre: "无限流",
    focus: ["opening_hook", "chinese_naturalness", "webnovel_pacing"],
    prompt: "写一段无限流副本开局，规则诡异且立刻压迫主角。"
  },
  {
    title: "女频追妻火葬场",
    genre: "女频",
    focus: ["emotional_turn", "character_voice", "low_ai_smell"],
    prompt: "写一段追妻火葬场中的情绪反转，不要用空泛哭喊。"
  },
  {
    title: "末世重生复仇",
    genre: "末世",
    focus: ["conflict_density", "opening_hook", "originality"],
    prompt: "写一段末世重生复仇开局，主角保留前世关键信息。"
  },
  {
    title: "科幻机甲学院",
    genre: "科幻",
    focus: ["worldbuilding", "character_voice", "ending_hook"],
    prompt: "写一段机甲学院入学测试，技术细节要服务冲突。"
  },
  {
    title: "修真境界突破",
    genre: "修真",
    focus: ["continuity_respect", "chinese_naturalness", "emotional_turn"],
    prompt: "写一段修真境界突破，体现代价、限制和危险。"
  },
  {
    title: "群像势力冲突",
    genre: "群像",
    focus: ["conflict_density", "character_voice", "continuity_respect"],
    prompt: "写一段三方势力冲突，每一方都有清晰目标。"
  },
  {
    title: "章末悬念改写",
    genre: "改写",
    focus: ["ending_hook", "low_ai_smell", "webnovel_pacing"],
    prompt: "将一个平淡章末改写成具体、有画面感的悬念钩子。"
  }
];

const ROUTING_EVAL_CASES: Array<{
  title: string;
  genre: string;
  focus: string[];
  prompt: string;
}> = [
  ...BUILT_IN_CASES,
  {
    title: "世界观原创性检查",
    genre: "世界观",
    focus: ["originality", "structural_logic", "market_fit"],
    prompt:
      "审查一个都市异能/玄幻混合世界观，指出设定撞车、俗套风险、可强化的原创钩子，并给出结构化建议。"
  },
  {
    title: "卷纲逻辑漏洞检查",
    genre: "卷纲",
    focus: ["structural_logic", "continuity_respect", "market_fit"],
    prompt:
      "审查一个二十章卷纲，找出动机断裂、因果跳跃、升级节奏和伏笔回收风险，并给出结构化修复方案。"
  }
];

const RECOMMENDATION_DEFINITIONS = [
  {
    id: "daily_author",
    label: "best daily主笔",
    taskType: "draft_chapter",
    reason: "综合质量、中文网文市场适配和成本，适合日常稳定出稿。"
  },
  {
    id: "key_chapter_author",
    label: "best关键章主笔",
    taskType: "draft_chapter",
    reason: "优先选择综合质量最高的模型，用于开篇、高潮和关键章。"
  },
  {
    id: "hook_reviewer",
    label: "best钩子审稿",
    taskType: "suspense_hook_audit",
    reason: "重点看开篇钩子、章末悬念和市场适配。"
  },
  {
    id: "continuity_reviewer",
    label: "best连贯性审稿",
    taskType: "continuity_audit",
    reason: "重点看连续性、结构逻辑和低成本审稿稳定性。"
  },
  {
    id: "state_settlement",
    label: "best状态结算",
    taskType: "state_settlement",
    reason: "重点看事实抽取、结构逻辑和状态更新可靠性。"
  },
  {
    id: "best_value_route",
    label: "best性价比路线",
    taskType: "draft_chapter",
    reason: "按成本调整分排序，适合预算敏感的日常路线。"
  },
  {
    id: "best_quality_route",
    label: "best效果优先路线",
    taskType: "revise_chapter",
    reason: "按纯质量优先排序，适合高价值章节。"
  }
] as const;

export class EvaluationService {
  private readonly redaction = new RedactionService();

  constructor(private readonly options: EvaluationServiceOptions) {}

  ensureBuiltInSuite(): EvalSuiteRecord {
    const existing = this.options.database.sqlite
      .prepare("select * from eval_suites where name = ? and version = ?")
      .get("中文网文基础评测 v1", "1") as Record<string, unknown> | undefined;
    if (existing) {
      return mapSuite(existing);
    }
    const now = this.now();
    const id = createId("evalsuite");
    this.options.database.sqlite
      .prepare(
        `insert into eval_suites
        (id, name, description, version, built_in, created_at, updated_at)
        values (?, ?, ?, ?, 1, ?, ?)`
      )
      .run(id, "中文网文基础评测 v1", "Chinese web novel task evaluation suite.", "1", now, now);
    for (const item of BUILT_IN_CASES) {
      this.options.database.sqlite
        .prepare(
          `insert into eval_cases
          (id, suite_id, title, genre, prompt_text, reference_context, expected_focus_json,
            created_at, updated_at)
          values (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          createId("evalcase"),
          id,
          item.title,
          item.genre,
          item.prompt,
          null,
          JSON.stringify(item.focus),
          now,
          now
        );
    }
    return this.getSuite(id) as EvalSuiteRecord;
  }

  ensureRouteEvalSuite(): EvalSuiteRecord {
    const existing = this.options.database.sqlite
      .prepare("select * from eval_suites where name = ? and version = ?")
      .get("中文网文路由评测 v2", "2") as Record<string, unknown> | undefined;
    const suite = existing
      ? mapSuite(existing)
      : this.createBuiltInSuite({
          name: "中文网文路由评测 v2",
          description:
            "WenForge routing evaluation for Chinese webnovel quality, cost, latency, and route recommendations.",
          version: "2",
          cases: ROUTING_EVAL_CASES
        });
    this.ensureSuiteCases(suite.id, ROUTING_EVAL_CASES);
    return this.getSuite(suite.id) as EvalSuiteRecord;
  }

  getSupportedRoutingEvalTaskTypes(): string[] {
    return [...ROUTING_EVAL_TASK_TYPES];
  }

  listSuites(): EvalSuiteRecord[] {
    return this.options.database.sqlite
      .prepare("select * from eval_suites order by built_in desc, name asc")
      .all()
      .map((row) => mapSuite(row as Record<string, unknown>));
  }

  createSuite(input: {
    name: string;
    description?: string | null | undefined;
    version?: string | undefined;
  }): EvalSuiteRecord {
    const now = this.now();
    const id = createId("evalsuite");
    this.options.database.sqlite
      .prepare(
        `insert into eval_suites
        (id, name, description, version, built_in, created_at, updated_at)
        values (?, ?, ?, ?, 0, ?, ?)`
      )
      .run(id, input.name, input.description ?? null, input.version ?? "custom", now, now);
    return this.getSuite(id) as EvalSuiteRecord;
  }

  updateSuite(
    id: string,
    input: Partial<{
      name: string | undefined;
      description: string | null | undefined;
      version: string | undefined;
    }>
  ): EvalSuiteRecord | null {
    const existing = this.getSuite(id);
    if (!existing) return null;
    this.options.database.sqlite
      .prepare(
        "update eval_suites set name = ?, description = ?, version = ?, updated_at = ? where id = ?"
      )
      .run(
        input.name ?? existing.name,
        input.description === undefined ? existing.description : input.description,
        input.version ?? existing.version,
        this.now(),
        id
      );
    return this.getSuite(id);
  }

  deleteSuite(id: string, confirmed = false): boolean {
    if (!confirmed) return false;
    return (
      this.options.database.sqlite.prepare("delete from eval_suites where id = ?").run(id).changes >
      0
    );
  }

  listCases(suiteId: string): EvalCaseRecord[] {
    return this.options.database.sqlite
      .prepare("select * from eval_cases where suite_id = ? order by created_at asc")
      .all(suiteId)
      .map((row) => mapCase(row as Record<string, unknown>));
  }

  createCase(input: {
    suiteId: string;
    title: string;
    genre: string;
    promptText: string;
    referenceContext?: string | null | undefined;
    expectedFocusJson?: string | undefined;
  }): EvalCaseRecord {
    const now = this.now();
    const id = createId("evalcase");
    this.options.database.sqlite
      .prepare(
        `insert into eval_cases
        (id, suite_id, title, genre, prompt_text, reference_context, expected_focus_json,
          created_at, updated_at)
        values (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        input.suiteId,
        input.title,
        input.genre,
        input.promptText,
        input.referenceContext ?? null,
        input.expectedFocusJson ?? "[]",
        now,
        now
      );
    return this.getCase(id) as EvalCaseRecord;
  }

  updateCase(
    id: string,
    input: Partial<{
      title: string | undefined;
      genre: string | undefined;
      promptText: string | undefined;
      referenceContext: string | null | undefined;
      expectedFocusJson: string | undefined;
    }>
  ): EvalCaseRecord | null {
    const existing = this.getCase(id);
    if (!existing) return null;
    this.options.database.sqlite
      .prepare(
        `update eval_cases set title = ?, genre = ?, prompt_text = ?, reference_context = ?,
          expected_focus_json = ?, updated_at = ? where id = ?`
      )
      .run(
        input.title ?? existing.title,
        input.genre ?? existing.genre,
        input.promptText ?? existing.promptText,
        input.referenceContext === undefined ? existing.referenceContext : input.referenceContext,
        input.expectedFocusJson ?? existing.expectedFocusJson,
        this.now(),
        id
      );
    return this.getCase(id);
  }

  deleteCase(id: string, confirmed = false): boolean {
    if (!confirmed) return false;
    return (
      this.options.database.sqlite.prepare("delete from eval_cases where id = ?").run(id).changes >
      0
    );
  }

  async startRunProvider(input: EvalStartRequest): Promise<EvalRunRecord> {
    if (input.executionMode !== "provider") {
      return this.startRun(input);
    }
    this.assertProviderEvalAllowed(input);
    const cases = this.listCases(input.suiteId);
    if (cases.length === 0) {
      throw new Error("Eval suite has no cases");
    }
    const profiles = input.modelProfileIds.map((id) => {
      const profile = this.options.repositories.modelProfiles.get(id);
      if (!profile) throw new Error(`Model profile not found: ${id}`);
      return profile;
    });
    this.assertEvalBudget(input, profiles, cases.length);
    const now = this.now();
    const runId = createId("evalrun");
    this.options.database.sqlite
      .prepare(
        `insert into eval_runs
        (id, suite_id, book_id, mode, status, model_profile_ids_json, route_task_type,
          quality_mode, started_at, finished_at, notes, created_at, updated_at)
        values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        runId,
        input.suiteId,
        input.bookId ?? null,
        input.mode,
        "running",
        JSON.stringify(input.modelProfileIds),
        input.taskType,
        input.qualityMode,
        now,
        null,
        "Provider-backed evaluation outputs. LLM judge scores are advisory when used.",
        now,
        now
      );

    let spent = 0;
    const profilesByBlindLabel = this.assignBlindLabels(profiles, runId);
    for (const { profile, blindLabel } of profilesByBlindLabel) {
      for (const evalCase of cases) {
        const result = await this.options.aiGateway!.generateText({
          modelProfileId: profile.id,
          taskType: input.taskType,
          qualityMode: input.qualityMode,
          bookId: input.bookId ?? null,
          messages: buildEvalMessages(evalCase, input.taskType),
          temperature: profile.defaultTemperature,
          maxOutputTokens: input.maxOutputTokens ?? 900
        });
        spent += result.finalCost.totalCost;
        if (input.budgetCapUsd && spent > input.budgetCapUsd) {
          throw new Error("Eval budget cap exceeded");
        }
        this.createOutputRecord({
          runId,
          evalCase,
          profile,
          text: result.response.text,
          llmRunId: result.runId,
          latencyMs: result.latencyMs,
          cost: result.finalCost.totalCost,
          blindLabel
        });
      }
    }
    this.options.database.sqlite
      .prepare(
        "update eval_runs set status = 'completed', finished_at = ?, updated_at = ? where id = ?"
      )
      .run(this.now(), this.now(), runId);
    return this.getRun(runId) as EvalRunRecord;
  }

  startRun(input: EvalStartRequest): EvalRunRecord {
    if (input.executionMode === "provider") {
      this.assertProviderEvalAllowed(input);
      throw new Error("Use startRunProvider for provider-backed eval execution");
    }
    const cases = this.listCases(input.suiteId);
    if (cases.length === 0) {
      throw new Error("Eval suite has no cases");
    }
    const profiles = input.modelProfileIds.map((id) => {
      const profile = this.options.repositories.modelProfiles.get(id);
      if (!profile) throw new Error(`Model profile not found: ${id}`);
      return profile;
    });
    const now = this.now();
    const runId = createId("evalrun");
    this.options.database.sqlite
      .prepare(
        `insert into eval_runs
        (id, suite_id, book_id, mode, status, model_profile_ids_json, route_task_type,
          quality_mode, started_at, finished_at, notes, created_at, updated_at)
        values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        runId,
        input.suiteId,
        input.bookId ?? null,
        input.mode,
        "running",
        JSON.stringify(input.modelProfileIds),
        input.taskType,
        input.qualityMode,
        now,
        null,
        "Mock evaluation outputs. LLM judge scores are advisory when used.",
        now,
        now
      );

    for (const { profile, blindLabel } of this.assignBlindLabels(profiles, runId)) {
      for (const evalCase of cases) {
        this.createMockOutput({
          runId,
          evalCase,
          profile,
          taskType: input.taskType,
          projectBookId: input.bookId ?? null,
          blindLabel
        });
      }
    }
    this.options.database.sqlite
      .prepare(
        "update eval_runs set status = 'completed', finished_at = ?, updated_at = ? where id = ?"
      )
      .run(this.now(), this.now(), runId);
    return this.getRun(runId) as EvalRunRecord;
  }

  abortRun(runId: string): EvalRunRecord | null {
    this.options.database.sqlite
      .prepare(
        "update eval_runs set status = 'cancelled', finished_at = ?, updated_at = ? where id = ?"
      )
      .run(this.now(), this.now(), runId);
    return this.getRun(runId);
  }

  getRun(id: string): EvalRunRecord | null {
    const row = this.options.database.sqlite
      .prepare("select * from eval_runs where id = ?")
      .get(id);
    return row ? mapRun(row as Record<string, unknown>) : null;
  }

  listOutputs(runId: string, options: { blind?: boolean | undefined } = {}): EvalOutputRecord[] {
    return this.options.database.sqlite
      .prepare(
        "select * from eval_outputs where eval_run_id = ? order by blind_label asc, created_at asc, id asc"
      )
      .all(runId)
      .map((row) => mapOutput(row as Record<string, unknown>, options.blind ?? false));
  }

  scoreHuman(input: EvalHumanScoreRequest): EvalScoreRecord {
    return this.createScore({
      outputId: input.outputId,
      scorerType: "human",
      scorerLabel: "Human",
      dimensions: input.dimensions,
      ...(typeof input.overallScore === "undefined" ? {} : { overallScore: input.overallScore }),
      notes: input.notes ?? null
    });
  }

  scoreLlmJudge(input: string | EvalJudgeRequest): EvalScoreRecord {
    const request = typeof input === "string" ? { outputId: input, executionMode: "mock" as const } : input;
    if (request.executionMode === "provider") {
      this.assertProviderJudgeAllowed(request);
      throw new Error("Provider-backed judge scoring requires async scoreLlmJudgeProvider");
    }
    const outputId = request.outputId;
    const output = this.getOutput(outputId);
    if (!output) throw new Error("Eval output not found");
    const judgeProfile = request.judgeModelProfileId
      ? this.options.repositories.modelProfiles.get(request.judgeModelProfileId)
      : null;
    const judgeModel = judgeProfile?.model ?? "mock-judge";
    const judgeProvider = judgeProfile?.provider ?? "fake";
    const evidence = output.outputText.slice(0, 60);
    const llmRun = this.options.repositories.cost.createLlmRun({
      generationRunId: null,
      provider: judgeProvider,
      model: judgeModel,
      taskType: "continuity_audit",
      inputTokensEstimated: 900,
      estimatedCostLive: 0,
      currency: "USD",
      promptHash: sha256Hex(`judge:${output.id}`)
    });
    this.options.repositories.cost.finishRun(llmRun.id, {
      status: "succeeded",
      outputTokensEstimatedLive: 350,
      inputTokensReported: null,
      outputTokensReported: null,
      usageSource: "estimated",
      estimatedCostLive: 0,
      finalCost: 0,
      latencyMs: 420,
      responseHash: sha256Hex(`advisory:${evidence}`)
    });
    const dimensions = Object.fromEntries(
      EVAL_DIMENSIONS.map((dimension) => [
        dimension,
        dimension.includes("cost") || dimension.includes("latency") ? 8 : 7
      ])
    );
    return this.createScore({
      outputId,
      scorerType: "llm_judge",
      scorerLabel: `LLM judge advisory (${judgeModel})`,
      dimensions,
      notes: `Advisory mock judge score; not ground truth. evidence: ${evidence}`
    });
  }

  async scoreLlmJudgeProvider(input: EvalJudgeRequest): Promise<EvalScoreRecord> {
    if (input.executionMode !== "provider") {
      return this.scoreLlmJudge(input);
    }
    this.assertProviderJudgeAllowed(input);
    const output = this.getOutput(input.outputId);
    if (!output) throw new Error("Eval output not found");
    if (!input.judgeModelProfileId) throw new Error("Judge model profile is required");
    const response = await this.options.aiGateway!.generateText({
      modelProfileId: input.judgeModelProfileId,
      taskType: "continuity_audit",
      messages: buildJudgeMessages(output),
      temperature: 0,
      maxOutputTokens: 700
    });
    if (input.budgetCapUsd && response.finalCost.totalCost > input.budgetCapUsd) {
      throw new Error("Judge budget cap exceeded");
    }
    const parsed = parseJudgeResponse(response.response.text, output.outputText);
    return this.createScore({
      outputId: output.id,
      scorerType: "llm_judge",
      scorerLabel: `LLM judge advisory (${response.model})`,
      dimensions: parsed.dimensions,
      notes: `Advisory provider judge score; not ground truth. evidence: ${parsed.evidence.join(" | ")}`
    });
  }

  leaderboard(runId: string): EvalLeaderboardEntry[] {
    const outputs = this.listOutputs(runId);
    return [...groupBy(outputs, (output) => output.modelProfileId ?? "").entries()]
      .filter(([profileId]) => profileId.length > 0)
      .map(([profileId, profileOutputs]) => {
        const scores = profileOutputs.flatMap((output) => this.listScores(output.id));
        const qualityScore =
          scores.length > 0 ? average(scores.map((score) => score.overallScore)) : 0;
        const cost = sum(profileOutputs.map((output) => output.cost));
        const latencyMs = average(profileOutputs.map((output) => output.latencyMs ?? 0));
        const first = profileOutputs[0] as EvalOutputRecord;
        return {
          modelProfileId: profileId,
          provider: first.provider ?? "unknown",
          model: first.model ?? "unknown",
          outputCount: profileOutputs.length,
          qualityScore: round(qualityScore),
          cost: round(cost),
          latencyMs: round(latencyMs),
          costAdjustedScore: round(qualityScore / (1 + cost * 10)),
          notes: scores.at(-1)?.notes ?? null,
          outputIds: profileOutputs.map((output) => output.id)
        };
      })
      .sort((left, right) => right.costAdjustedScore - left.costAdjustedScore);
  }

  promoteWinnerToRoute(input: EvalPromoteRequest) {
    if (!input.confirmed) {
      throw new Error("Promotion requires confirmation");
    }
    const output = this.getOutput(input.outputId);
    if (!output || output.evalRunId !== input.evalRunId || !output.modelProfileId) {
      throw new Error("Eval output not found");
    }
    const profile = this.options.repositories.modelProfiles.get(output.modelProfileId);
    if (!profile) {
      throw new Error("Model profile not found");
    }
    return this.options.repositories.taskRoutes.upsert({
      taskType: input.taskType,
      qualityMode: input.qualityMode,
      primaryModelProfileId: profile.id,
      temperature: profile.defaultTemperature,
      maxOutputTokens: profile.maxOutputTokens ?? 4000,
      enabled: true
    });
  }

  recommendRoutes(runId: string): EvalRouteRecommendations {
    const metrics = this.profileMetrics(runId);
    const items = RECOMMENDATION_DEFINITIONS.map((definition) => {
      const selected = this.selectRecommendation(definition.id, metrics);
      return {
        id: definition.id,
        label: definition.label,
        taskType: definition.taskType,
        modelProfileId: selected.profileId,
        provider: selected.provider,
        model: selected.model,
        modelAlias: selected.alias,
        score: round(selected.selectionScore),
        cost: round(selected.cost),
        latencyMs: round(selected.latencyMs),
        reason: definition.reason,
        requiresConfirmation: true
      };
    });
    return { runId, generatedAt: this.now(), items };
  }

  applyRecommendationToRoute(input: EvalApplyRecommendationRequest) {
    if (!input.confirmed) {
      throw new Error("Recommendation route application requires confirmation");
    }
    const recommendation = this.recommendRoutes(input.runId).items.find(
      (item) => item.id === input.recommendationId
    );
    if (!recommendation) {
      throw new Error("Recommendation not found");
    }
    const profile = this.options.repositories.modelProfiles.get(recommendation.modelProfileId);
    if (!profile) {
      throw new Error("Model profile not found");
    }
    return this.options.repositories.taskRoutes.upsert({
      taskType: recommendation.taskType,
      qualityMode: input.qualityMode,
      primaryModelProfileId: profile.id,
      temperature: profile.defaultTemperature,
      maxOutputTokens: profile.maxOutputTokens ?? 4000,
      enabled: true
    });
  }

  exportReport(input: EvalReportRequest): EvalReportResult {
    const run = this.getRun(input.runId);
    if (!run) throw new Error("Eval run not found");
    const outputs = this.listOutputs(run.id);
    const leaderboard = this.leaderboard(run.id);
    const recommendations = this.recommendRoutes(run.id);
    const lines = [
      "# WenForge Model Eval Report",
      "",
      `Generated: ${this.now()}`,
      `Run: ${run.id}`,
      `Task: ${run.routeTaskType}`,
      `Quality mode: ${run.qualityMode}`,
      "",
      "Sensitive values omitted. Reports do not include API keys, Authorization headers, decrypted credentials, full prompts, or manuscripts by default.",
      "",
      "## Leaderboard",
      "",
      "| model | score | cost | latency | cost-adjusted |",
      "| --- | ---: | ---: | ---: | ---: |",
      ...leaderboard.map(
        (entry) =>
          `| ${entry.provider}/${entry.model} | ${entry.qualityScore.toFixed(2)} | ${entry.cost.toFixed(
            6
          )} | ${entry.latencyMs.toFixed(0)}ms | ${entry.costAdjustedScore.toFixed(2)} |`
      ),
      "",
      "## recommended route changes",
      "",
      ...recommendations.items.map(
        (item) =>
          `- ${item.label}: ${item.provider}/${item.model} for ${item.taskType} (${item.reason})`
      ),
      "",
      "## Outputs",
      "",
      input.includeRawOutputs
        ? outputs
            .map((output) => `### ${output.provider}/${output.model}\n\n${output.outputText}`)
            .join("\n\n")
        : "Raw outputs omitted by privacy setting."
    ];
    const content = this.redaction.redact(lines.join("\n"));
    const directory = this.options.reportsDir ?? join(process.cwd(), "reports", "model-evals");
    mkdirSync(directory, { recursive: true });
    const filePath = join(directory, `${reportTimestamp(this.now())}.md`);
    writeFileSync(filePath, content, "utf8");
    return { filePath, content, outputCount: outputs.length, redacted: true };
  }

  private createBuiltInSuite(input: {
    name: string;
    description: string;
    version: string;
    cases: Array<{ title: string; genre: string; focus: string[]; prompt: string }>;
  }): EvalSuiteRecord {
    const now = this.now();
    const id = createId("evalsuite");
    this.options.database.sqlite
      .prepare(
        `insert into eval_suites
        (id, name, description, version, built_in, created_at, updated_at)
        values (?, ?, ?, ?, 1, ?, ?)`
      )
      .run(id, input.name, input.description, input.version, now, now);
    this.ensureSuiteCases(id, input.cases);
    return this.getSuite(id) as EvalSuiteRecord;
  }

  private ensureSuiteCases(
    suiteId: string,
    cases: Array<{ title: string; genre: string; focus: string[]; prompt: string }>
  ): void {
    const existing = new Set(this.listCases(suiteId).map((item) => item.title));
    const now = this.now();
    for (const item of cases) {
      if (existing.has(item.title)) continue;
      this.options.database.sqlite
        .prepare(
          `insert into eval_cases
          (id, suite_id, title, genre, prompt_text, reference_context, expected_focus_json,
            created_at, updated_at)
          values (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          createId("evalcase"),
          suiteId,
          item.title,
          item.genre,
          item.prompt,
          null,
          JSON.stringify(item.focus),
          now,
          now
        );
    }
  }

  private assignBlindLabels<T extends { id: string }>(
    profiles: T[],
    runId: string
  ): Array<{ profile: T; blindLabel: string }> {
    return profiles
      .map((profile) => ({
        profile,
        sortKey: sha256Hex(`${runId}:${profile.id}`)
      }))
      .sort((left, right) => left.sortKey.localeCompare(right.sortKey))
      .map((item, index) => ({
        profile: item.profile,
        blindLabel: String.fromCharCode("A".charCodeAt(0) + index)
      }));
  }

  private assertProviderEvalAllowed(input: EvalStartRequest): void {
    if (!input.confirmed) throw new Error("Real eval calls require confirmation");
    if (process.env.CI === "true") throw new Error("Real eval calls are disabled in CI");
    if (process.env.RUN_REAL_PROVIDER_CHECKS !== "true") {
      throw new Error("Real eval calls require RUN_REAL_PROVIDER_CHECKS=true");
    }
    if (!input.budgetCapUsd || input.budgetCapUsd <= 0) {
      throw new Error("Real eval calls require a budget cap");
    }
    if (!this.options.aiGateway) throw new Error("AI gateway is unavailable");
  }

  private assertProviderJudgeAllowed(input: EvalJudgeRequest): void {
    if (!input.confirmed) throw new Error("Real judge calls require confirmation");
    if (process.env.CI === "true") throw new Error("Real judge calls are disabled in CI");
    if (process.env.RUN_REAL_PROVIDER_CHECKS !== "true") {
      throw new Error("Real judge calls require RUN_REAL_PROVIDER_CHECKS=true");
    }
    if (!input.budgetCapUsd || input.budgetCapUsd <= 0) {
      throw new Error("Real judge calls require a budget cap");
    }
    if (!this.options.aiGateway) throw new Error("AI gateway is unavailable");
  }

  private assertEvalBudget(
    input: EvalStartRequest,
    profiles: Array<{ provider: string; model: string }>,
    caseCount: number
  ): void {
    const estimate = sum(
      profiles.map((profile) => {
        const price = this.options.repositories.modelPrices.findActive(
          profile.provider as never,
          profile.model
        );
        if (!price) return 0;
        return (
          ((1_200 / 1_000_000) * price.inputPricePerMillion +
            (((input.maxOutputTokens ?? 900) / 1_000_000) * price.outputPricePerMillion)) *
          caseCount
        );
      })
    );
    if (input.budgetCapUsd && estimate > input.budgetCapUsd) {
      throw new Error("Eval budget cap exceeded before provider calls");
    }
  }

  private createOutputRecord(input: {
    runId: string;
    evalCase: EvalCaseRecord;
    profile: { id: string; provider: string; model: string };
    text: string;
    llmRunId: string | null;
    latencyMs: number | null;
    cost: number;
    blindLabel: string;
  }): void {
    this.options.database.sqlite
      .prepare(
        `insert into eval_outputs
        (id, eval_run_id, eval_case_id, model_profile_id, provider, model, output_text,
          prompt_hash, response_hash, llm_run_id, latency_ms, cost, status, blind_label, created_at)
        values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        createId("evalout"),
        input.runId,
        input.evalCase.id,
        input.profile.id,
        input.profile.provider,
        input.profile.model,
        input.text,
        sha256Hex(input.evalCase.promptText),
        sha256Hex(input.text),
        input.llmRunId,
        input.latencyMs,
        input.cost,
        "completed",
        input.blindLabel,
        this.now()
      );
  }

  private profileMetrics(runId: string): ProfileMetric[] {
    const outputs = this.listOutputs(runId);
    return [...groupBy(outputs, (output) => output.modelProfileId ?? "").entries()]
      .filter(([profileId]) => profileId.length > 0)
      .map(([profileId, profileOutputs]) => {
        const profile = this.options.repositories.modelProfiles.get(profileId);
        const scores = profileOutputs.flatMap((output) => this.listScores(output.id));
        const dimensions = averageDimensions(scores);
        const quality = average(
          [
            dimensions.opening_hook,
            dimensions.conflict_density,
            dimensions.character_voice,
            dimensions.chinese_naturalness,
            dimensions.webnovel_pacing,
            dimensions.emotional_turn,
            dimensions.originality,
            dimensions.continuity_respect,
            dimensions.ending_hook,
            dimensions.low_ai_smell,
            dimensions.structural_logic,
            dimensions.market_fit
          ].filter((value): value is number => typeof value === "number")
        );
        const cost = sum(profileOutputs.map((output) => output.cost));
        const latencyMs = average(profileOutputs.map((output) => output.latencyMs ?? 0));
        return {
          profileId,
          provider: profile?.provider ?? profileOutputs[0]?.provider ?? "unknown",
          model: profile?.model ?? profileOutputs[0]?.model ?? "unknown",
          alias: profile?.alias ?? null,
          dimensions,
          quality,
          cost,
          latencyMs,
          costAdjusted: quality / (1 + cost * 10)
        };
      });
  }

  private selectRecommendation(
    id: (typeof RECOMMENDATION_DEFINITIONS)[number]["id"],
    metrics: ProfileMetric[]
  ): ProfileMetric & { selectionScore: number } {
    if (metrics.length === 0) throw new Error("No scored eval outputs are available");
    const score = (metric: ProfileMetric): number => {
      const dim = metric.dimensions;
      if (id === "daily_author") {
        return metric.quality * 0.65 + (dim.cost_score ?? 0) * 0.25 + (dim.market_fit ?? 0) * 0.1;
      }
      if (id === "key_chapter_author" || id === "best_quality_route") return metric.quality;
      if (id === "hook_reviewer") {
        return (
          average([dim.opening_hook, dim.ending_hook, dim.market_fit].filter(isNumber)) * 0.85 +
          (dim.cost_score ?? 0) * 0.15
        );
      }
      if (id === "continuity_reviewer" || id === "state_settlement") {
        return (
          average([dim.continuity_respect, dim.structural_logic].filter(isNumber)) * 0.8 +
          (dim.cost_score ?? 0) * 0.2
        );
      }
      return metric.costAdjusted;
    };
    const selected = metrics
      .map((metric) => ({ ...metric, selectionScore: score(metric) }))
      .sort((left, right) => right.selectionScore - left.selectionScore)[0];
    if (!selected) throw new Error("No recommendation candidate is available");
    return selected;
  }

  private createMockOutput(input: {
    runId: string;
    evalCase: EvalCaseRecord;
    profile: {
      id: string;
      provider: string;
      model: string;
      displayName: string;
    };
    taskType: EvalStartRequest["taskType"];
    projectBookId: string | null;
    blindLabel: string;
  }): void {
    const text = `【${input.evalCase.title}】${input.profile.displayName} 的模拟输出：冲突立即出现，人物目标清晰，结尾留下具体悬念。`;
    const price = this.options.repositories.modelPrices.findActive(
      input.profile.provider as never,
      input.profile.model
    );
    const cost = price
      ? (1200 / 1_000_000) * price.inputPricePerMillion +
        (700 / 1_000_000) * price.outputPricePerMillion
      : 0;
    const llmRun = this.options.repositories.cost.createLlmRun({
      generationRunId: null,
      provider: input.profile.provider,
      model: input.profile.model,
      taskType: input.taskType,
      bookId: input.projectBookId,
      inputTokensEstimated: 1200,
      estimatedCostLive: cost,
      currency: price?.currency ?? "USD",
      promptHash: sha256Hex(input.evalCase.promptText)
    });
    this.options.repositories.cost.finishRun(llmRun.id, {
      status: "succeeded",
      outputTokensEstimatedLive: 700,
      inputTokensReported: null,
      outputTokensReported: null,
      usageSource: "estimated",
      estimatedCostLive: cost,
      finalCost: cost,
      latencyMs: 500 + input.blindLabel.charCodeAt(0),
      responseHash: sha256Hex(text)
    });
    this.options.database.sqlite
      .prepare(
        `insert into eval_outputs
        (id, eval_run_id, eval_case_id, model_profile_id, provider, model, output_text,
          prompt_hash, response_hash, llm_run_id, latency_ms, cost, status, blind_label, created_at)
        values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        createId("evalout"),
        input.runId,
        input.evalCase.id,
        input.profile.id,
        input.profile.provider,
        input.profile.model,
        text,
        sha256Hex(input.evalCase.promptText),
        sha256Hex(text),
        llmRun.id,
        500 + input.blindLabel.charCodeAt(0),
        cost,
        "completed",
        input.blindLabel,
        this.now()
      );
  }

  private createScore(input: {
    outputId: string;
    scorerType: "human" | "llm_judge";
    scorerLabel: string;
    dimensions: Record<string, number>;
    overallScore?: number;
    notes?: string | null;
  }): EvalScoreRecord {
    const output = this.getOutput(input.outputId);
    if (!output) throw new Error("Eval output not found");
    const values = Object.values(input.dimensions);
    const overallScore = input.overallScore ?? average(values);
    const id = createId("evalscore");
    this.options.database.sqlite
      .prepare(
        `insert into eval_scores
        (id, eval_output_id, scorer_type, scorer_label, dimensions_json, overall_score, notes, created_at)
        values (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        input.outputId,
        input.scorerType,
        input.scorerLabel,
        JSON.stringify(input.dimensions),
        overallScore,
        input.notes ?? null,
        this.now()
      );
    return this.getScore(id) as EvalScoreRecord;
  }

  private getSuite(id: string): EvalSuiteRecord | null {
    const row = this.options.database.sqlite
      .prepare("select * from eval_suites where id = ?")
      .get(id);
    return row ? mapSuite(row as Record<string, unknown>) : null;
  }

  private getCase(id: string): EvalCaseRecord | null {
    const row = this.options.database.sqlite
      .prepare("select * from eval_cases where id = ?")
      .get(id);
    return row ? mapCase(row as Record<string, unknown>) : null;
  }

  private getOutput(id: string): EvalOutputRecord | null {
    const row = this.options.database.sqlite
      .prepare("select * from eval_outputs where id = ?")
      .get(id);
    return row ? mapOutput(row as Record<string, unknown>, false) : null;
  }

  private listScores(outputId: string): EvalScoreRecord[] {
    return this.options.database.sqlite
      .prepare("select * from eval_scores where eval_output_id = ? order by created_at asc")
      .all(outputId)
      .map((row) => mapScore(row as Record<string, unknown>));
  }

  private getScore(id: string): EvalScoreRecord | null {
    const row = this.options.database.sqlite
      .prepare("select * from eval_scores where id = ?")
      .get(id);
    return row ? mapScore(row as Record<string, unknown>) : null;
  }

  private now(): string {
    return this.options.now?.() ?? nowIso();
  }
}

function mapSuite(row: Record<string, unknown>): EvalSuiteRecord {
  return {
    id: String(row.id),
    name: String(row.name),
    description: row.description === null ? null : String(row.description),
    version: String(row.version),
    builtIn: row.built_in === 1 || row.built_in === true,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

function mapCase(row: Record<string, unknown>): EvalCaseRecord {
  return {
    id: String(row.id),
    suiteId: String(row.suite_id),
    title: String(row.title),
    genre: String(row.genre),
    promptText: String(row.prompt_text),
    referenceContext: row.reference_context === null ? null : String(row.reference_context),
    expectedFocusJson: String(row.expected_focus_json),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

function mapRun(row: Record<string, unknown>): EvalRunRecord {
  return {
    id: String(row.id),
    suiteId: String(row.suite_id),
    bookId: row.book_id === null ? null : String(row.book_id),
    mode: String(row.mode) as EvalRunRecord["mode"],
    status: String(row.status) as EvalRunRecord["status"],
    modelProfileIdsJson: String(row.model_profile_ids_json),
    routeTaskType: String(row.route_task_type) as EvalRunRecord["routeTaskType"],
    qualityMode: String(row.quality_mode) as EvalRunRecord["qualityMode"],
    startedAt: String(row.started_at),
    finishedAt: row.finished_at === null ? null : String(row.finished_at),
    notes: row.notes === null ? null : String(row.notes),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

function mapOutput(row: Record<string, unknown>, blind: boolean): EvalOutputRecord {
  return {
    id: String(row.id),
    evalRunId: String(row.eval_run_id),
    evalCaseId: String(row.eval_case_id),
    modelProfileId: blind ? null : String(row.model_profile_id),
    provider: blind ? null : String(row.provider),
    model: blind ? null : String(row.model),
    outputText: String(row.output_text),
    promptHash: row.prompt_hash === null ? null : String(row.prompt_hash),
    responseHash: row.response_hash === null ? null : String(row.response_hash),
    llmRunId: row.llm_run_id === null ? null : String(row.llm_run_id),
    latencyMs: row.latency_ms === null ? null : Number(row.latency_ms),
    cost: Number(row.cost),
    status: String(row.status),
    blindLabel: String(row.blind_label),
    createdAt: String(row.created_at)
  };
}

function mapScore(row: Record<string, unknown>): EvalScoreRecord {
  return {
    id: String(row.id),
    evalOutputId: String(row.eval_output_id),
    scorerType: String(row.scorer_type) as EvalScoreRecord["scorerType"],
    scorerLabel: String(row.scorer_label),
    dimensionsJson: String(row.dimensions_json),
    overallScore: Number(row.overall_score),
    notes: row.notes === null ? null : String(row.notes),
    createdAt: String(row.created_at)
  };
}

function groupBy<T>(items: T[], getKey: (item: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = getKey(item);
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  return groups;
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function average(values: number[]): number {
  return values.length > 0 ? sum(values) / values.length : 0;
}

function round(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

interface ProfileMetric {
  profileId: string;
  provider: string;
  model: string;
  alias: string | null;
  dimensions: Partial<Record<(typeof EVAL_DIMENSIONS)[number], number>>;
  quality: number;
  cost: number;
  latencyMs: number;
  costAdjusted: number;
}

function averageDimensions(
  scores: EvalScoreRecord[]
): Partial<Record<(typeof EVAL_DIMENSIONS)[number], number>> {
  const values: Partial<Record<(typeof EVAL_DIMENSIONS)[number], number[]>> = {};
  for (const score of scores) {
    const parsed = JSON.parse(score.dimensionsJson) as Record<string, number>;
    for (const dimension of EVAL_DIMENSIONS) {
      if (typeof parsed[dimension] !== "number") continue;
      values[dimension] = [...(values[dimension] ?? []), parsed[dimension]];
    }
  }
  return Object.fromEntries(
    Object.entries(values).map(([key, dimensionValues]) => [key, average(dimensionValues)])
  ) as Partial<Record<(typeof EVAL_DIMENSIONS)[number], number>>;
}

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function buildEvalMessages(evalCase: EvalCaseRecord, taskType: EvalStartRequest["taskType"]) {
  return [
    {
      role: "system" as const,
      content:
        "你是 WenForge Studio 的中文网文评测执行器。只完成用户给出的任务，不输出密钥、系统信息或无关解释。"
    },
    {
      role: "user" as const,
      content: `任务类型：${taskType}\n题目：${evalCase.title}\n类型：${evalCase.genre}\n要求：${evalCase.promptText}\n\n请输出适合评测的中文结果。`
    }
  ];
}

function buildJudgeMessages(output: EvalOutputRecord) {
  return [
    {
      role: "system" as const,
      content:
        "你是 WenForge Studio 的评测裁判。你的评分只是辅助意见，不是最终事实。必须输出 JSON。"
    },
    {
      role: "user" as const,
      content: `请按 0-10 分评价下面中文网文输出，返回 JSON：{"dimensions":{...},"evidence":["片段1","片段2"],"notes":"..."}。\n\n输出：${output.outputText}`
    }
  ];
}

function parseJudgeResponse(
  text: string,
  fallbackOutput: string
): { dimensions: Record<string, number>; evidence: string[] } {
  try {
    const parsed = JSON.parse(text) as {
      dimensions?: Record<string, number>;
      evidence?: string[];
    };
    const dimensions = Object.fromEntries(
      EVAL_DIMENSIONS.map((dimension) => [
        dimension,
        clampScore(parsed.dimensions?.[dimension] ?? 7)
      ])
    );
    return {
      dimensions,
      evidence:
        Array.isArray(parsed.evidence) && parsed.evidence.length > 0
          ? parsed.evidence.slice(0, 3)
          : [fallbackOutput.slice(0, 60)]
    };
  } catch {
    return {
      dimensions: Object.fromEntries(EVAL_DIMENSIONS.map((dimension) => [dimension, 7])),
      evidence: [fallbackOutput.slice(0, 60)]
    };
  }
}

function clampScore(value: number): number {
  if (!Number.isFinite(value)) return 7;
  return Math.max(0, Math.min(10, value));
}

function reportTimestamp(value: string): string {
  return value.slice(0, 16).replace(/:/g, "-").replace("T", "-");
}

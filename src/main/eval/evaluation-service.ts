import type {
  EvalCaseRecord,
  EvalHumanScoreRequest,
  EvalLeaderboardEntry,
  EvalOutputRecord,
  EvalPromoteRequest,
  EvalRunRecord,
  EvalScoreRecord,
  EvalStartRequest,
  EvalSuiteRecord
} from "@contracts/evaluation";
import { EVAL_DIMENSIONS } from "@contracts/evaluation";
import { sha256Hex } from "@main/ai/hash";
import type { WenForgeDatabase } from "@main/db/connection";
import { createId } from "@main/db/id";
import { nowIso } from "@main/db/repositories/types";
import type { RepositoryRegistry } from "@main/db/service";

export interface EvaluationServiceOptions {
  database: WenForgeDatabase;
  repositories: RepositoryRegistry;
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

export class EvaluationService {
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

  startRun(input: EvalStartRequest): EvalRunRecord {
    if (input.executionMode !== "mock") {
      throw new Error("Provider-backed evals are not implemented in this phase");
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

    let blindIndex = 0;
    for (const profile of profiles) {
      const blindLabel = String.fromCharCode("A".charCodeAt(0) + blindIndex);
      blindIndex += 1;
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

  scoreLlmJudge(outputId: string): EvalScoreRecord {
    const output = this.getOutput(outputId);
    if (!output) throw new Error("Eval output not found");
    const dimensions = Object.fromEntries(
      EVAL_DIMENSIONS.map((dimension) => [dimension, dimension.includes("cost") ? 8 : 7])
    );
    return this.createScore({
      outputId,
      scorerType: "llm_judge",
      scorerLabel: "Mock LLM judge",
      dimensions,
      notes: "Advisory mock judge score; not ground truth."
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

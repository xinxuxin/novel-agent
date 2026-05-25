import type { CostSummary, CostSummaryRequest, LLMRunRecord } from "@contracts/ai";
import type { LLMTaskType } from "@contracts/ai";
import type { WenForgeDatabase } from "@main/db/connection";
import { createId } from "@main/db/id";
import { nowIso } from "./types";

export interface CreateLlmRunInput {
  generationRunId?: string | null;
  provider: string;
  model: string;
  taskType: LLMTaskType;
  projectId?: string | null;
  bookId?: string | null;
  chapterId?: string | null;
  inputTokensEstimated: number;
  estimatedCostLive: number;
  currency: string;
  promptHash?: string | null;
}

export interface CompleteLlmRunInput {
  status: "succeeded" | "failed" | "cancelled";
  outputTokensEstimatedLive: number;
  inputTokensReported?: number | null;
  outputTokensReported?: number | null;
  cachedInputTokensReported?: number | null;
  usageSource: "estimated" | "provider" | "mixed";
  estimatedCostLive: number;
  finalCost?: number | null;
  latencyMs?: number | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  responseHash?: string | null;
}

export class CostRepository {
  constructor(private readonly db: WenForgeDatabase) {}

  createModelPrice(input: {
    provider: string;
    model: string;
    inputPricePerMillion: number;
    outputPricePerMillion: number;
    cachedInputPricePerMillion?: number | null;
    currency?: string;
    effectiveDate: string;
    sourceNote: string;
    enabled?: boolean;
  }): string {
    const now = nowIso();
    const id = createId("price");
    this.db.sqlite
      .prepare(
        `insert into model_prices
        (id, provider, model, input_price_per_million, output_price_per_million,
          cached_input_price_per_million, currency, effective_date, source_note, enabled, created_at, updated_at)
        values (@id, @provider, @model, @inputPricePerMillion, @outputPricePerMillion,
          @cachedInputPricePerMillion, @currency, @effectiveDate, @sourceNote, @enabled, @createdAt, @updatedAt)`
      )
      .run({
        id,
        provider: input.provider,
        model: input.model,
        inputPricePerMillion: input.inputPricePerMillion,
        outputPricePerMillion: input.outputPricePerMillion,
        cachedInputPricePerMillion: input.cachedInputPricePerMillion ?? null,
        currency: input.currency ?? "USD",
        effectiveDate: input.effectiveDate,
        sourceNote: input.sourceNote,
        enabled: input.enabled === false ? 0 : 1,
        createdAt: now,
        updatedAt: now
      });
    return id;
  }

  createLlmRun(input: CreateLlmRunInput): LLMRunRecord {
    const now = nowIso();
    const id = createId("llm");
    this.db.sqlite
      .prepare(
        `insert into llm_runs
        (id, generation_run_id, provider, model, task_type, project_id, book_id, chapter_id,
          request_started_at, request_finished_at, status, input_tokens_estimated,
          output_tokens_estimated_live, input_tokens_reported, output_tokens_reported,
          cached_input_tokens_reported, usage_source, estimated_cost_live, final_cost, currency,
          latency_ms, error_code, error_message, prompt_hash, response_hash, created_at)
        values
        (@id, @generationRunId, @provider, @model, @taskType, @projectId, @bookId, @chapterId,
          @requestStartedAt, null, 'running', @inputTokensEstimated, 0, null, null, null,
          'estimated', @estimatedCostLive, null, @currency, null, null, null, @promptHash, null,
          @createdAt)`
      )
      .run({
        id,
        generationRunId: input.generationRunId ?? null,
        provider: input.provider,
        model: input.model,
        taskType: input.taskType,
        projectId: input.projectId ?? null,
        bookId: input.bookId ?? null,
        chapterId: input.chapterId ?? null,
        requestStartedAt: now,
        inputTokensEstimated: input.inputTokensEstimated,
        estimatedCostLive: input.estimatedCostLive,
        currency: input.currency,
        promptHash: input.promptHash ?? null,
        createdAt: now
      });
    return this.getRun(id) as LLMRunRecord;
  }

  updateLiveRun(
    id: string,
    input: {
      outputTokensEstimatedLive: number;
      estimatedCostLive: number;
    }
  ): LLMRunRecord | null {
    this.db.sqlite
      .prepare(
        `update llm_runs
        set output_tokens_estimated_live = ?, estimated_cost_live = ?
        where id = ?`
      )
      .run(input.outputTokensEstimatedLive, input.estimatedCostLive, id);
    return this.getRun(id);
  }

  finishRun(id: string, input: CompleteLlmRunInput): LLMRunRecord | null {
    this.db.sqlite
      .prepare(
        `update llm_runs
        set request_finished_at = @requestFinishedAt,
          status = @status,
          output_tokens_estimated_live = @outputTokensEstimatedLive,
          input_tokens_reported = @inputTokensReported,
          output_tokens_reported = @outputTokensReported,
          cached_input_tokens_reported = @cachedInputTokensReported,
          usage_source = @usageSource,
          estimated_cost_live = @estimatedCostLive,
          final_cost = @finalCost,
          latency_ms = @latencyMs,
          error_code = @errorCode,
          error_message = @errorMessage,
          response_hash = @responseHash
        where id = @id`
      )
      .run({
        id,
        requestFinishedAt: nowIso(),
        status: input.status,
        outputTokensEstimatedLive: input.outputTokensEstimatedLive,
        inputTokensReported: input.inputTokensReported ?? null,
        outputTokensReported: input.outputTokensReported ?? null,
        cachedInputTokensReported: input.cachedInputTokensReported ?? null,
        usageSource: input.usageSource,
        estimatedCostLive: input.estimatedCostLive,
        finalCost: input.finalCost ?? null,
        latencyMs: input.latencyMs ?? null,
        errorCode: input.errorCode ?? null,
        errorMessage: input.errorMessage ?? null,
        responseHash: input.responseHash ?? null
      });
    return this.getRun(id);
  }

  getRun(id: string): LLMRunRecord | null {
    const row = this.db.sqlite.prepare("select * from llm_runs where id = ?").get(id);
    return row ? mapLlmRun(row as Record<string, unknown>) : null;
  }

  listRunsByChapter(chapterId: string): LLMRunRecord[] {
    return this.db.sqlite
      .prepare("select * from llm_runs where chapter_id = ? order by request_started_at desc")
      .all(chapterId)
      .map((row) => mapLlmRun(row as Record<string, unknown>));
  }

  summarizeRuns(input: CostSummaryRequest): CostSummary {
    const filters: string[] = [];
    const values: unknown[] = [];
    if (input.projectId) {
      filters.push("project_id = ?");
      values.push(input.projectId);
    }
    if (input.bookId) {
      filters.push("book_id = ?");
      values.push(input.bookId);
    }
    if (input.chapterId) {
      filters.push("chapter_id = ?");
      values.push(input.chapterId);
    }
    if (input.since) {
      filters.push("request_started_at >= ?");
      values.push(input.since);
    }
    if (input.until) {
      filters.push("request_started_at <= ?");
      values.push(input.until);
    }
    const where = filters.length > 0 ? `where ${filters.join(" and ")}` : "";
    const row = this.db.sqlite
      .prepare(
        `select
          count(*) as run_count,
          coalesce(sum(estimated_cost_live), 0) as estimated_cost_live,
          coalesce(sum(final_cost), 0) as final_cost,
          coalesce(max(currency), 'USD') as currency
        from llm_runs ${where}`
      )
      .get(...values) as Record<string, unknown>;

    return {
      runCount: Number(row.run_count),
      estimatedCostLive: Number(row.estimated_cost_live),
      finalCost: Number(row.final_cost),
      currency: String(row.currency)
    };
  }
}

function mapLlmRun(row: Record<string, unknown>): LLMRunRecord {
  return {
    id: String(row.id),
    generationRunId: nullableString(row.generation_run_id),
    provider: String(row.provider),
    model: String(row.model),
    taskType: String(row.task_type) as LLMTaskType,
    projectId: nullableString(row.project_id),
    bookId: nullableString(row.book_id),
    chapterId: nullableString(row.chapter_id),
    requestStartedAt: String(row.request_started_at),
    requestFinishedAt: nullableString(row.request_finished_at),
    status: String(row.status),
    inputTokensEstimated: Number(row.input_tokens_estimated),
    outputTokensEstimatedLive: Number(row.output_tokens_estimated_live),
    inputTokensReported: nullableNumber(row.input_tokens_reported),
    outputTokensReported: nullableNumber(row.output_tokens_reported),
    cachedInputTokensReported: nullableNumber(row.cached_input_tokens_reported),
    usageSource: String(row.usage_source) as "estimated" | "provider" | "mixed",
    estimatedCostLive: Number(row.estimated_cost_live),
    finalCost: nullableNumber(row.final_cost),
    currency: String(row.currency),
    latencyMs: nullableNumber(row.latency_ms),
    errorCode: nullableString(row.error_code),
    errorMessage: nullableString(row.error_message),
    promptHash: nullableString(row.prompt_hash),
    responseHash: nullableString(row.response_hash),
    createdAt: String(row.created_at)
  };
}

function nullableString(value: unknown): string | null {
  return value === null || typeof value === "undefined" ? null : String(value);
}

function nullableNumber(value: unknown): number | null {
  return value === null || typeof value === "undefined" ? null : Number(value);
}

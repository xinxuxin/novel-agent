import { z } from "zod";

import { LLM_TASK_TYPES } from "./ai";
import { QUALITY_MODES } from "@shared/domain/model-routing";

export const EVAL_DIMENSIONS = [
  "opening_hook",
  "conflict_density",
  "character_voice",
  "chinese_naturalness",
  "webnovel_pacing",
  "emotional_turn",
  "originality",
  "continuity_respect",
  "ending_hook",
  "low_ai_smell",
  "structural_logic",
  "market_fit",
  "cost_score",
  "latency_score"
] as const;

export const ROUTING_EVAL_TASK_TYPES = [
  "draft_chapter",
  "webnovel_style_rewrite",
  "suspense_hook_audit",
  "continuity_audit",
  "chapter_outline",
  "revise_chapter",
  "originality_audit",
  "plot_logic_audit"
] as const;

export type EvalDimension = (typeof EVAL_DIMENSIONS)[number];
export type EvalMode = "human_scoring" | "llm_judge" | "blind_comparison";
export type RoutingEvalTaskType = (typeof ROUTING_EVAL_TASK_TYPES)[number];

export const evalModeSchema = z.enum(["human_scoring", "llm_judge", "blind_comparison"]);
export const evalDimensionsSchema = z.partialRecord(
  z.enum(EVAL_DIMENSIONS),
  z.number().min(0).max(10)
);

export const evalSuiteSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  version: z.string(),
  builtIn: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string()
});
export type EvalSuiteRecord = z.infer<typeof evalSuiteSchema>;

export const evalCaseSchema = z.object({
  id: z.string(),
  suiteId: z.string(),
  title: z.string(),
  genre: z.string(),
  promptText: z.string(),
  referenceContext: z.string().nullable(),
  expectedFocusJson: z.string(),
  createdAt: z.string(),
  updatedAt: z.string()
});
export type EvalCaseRecord = z.infer<typeof evalCaseSchema>;

export const evalRunSchema = z.object({
  id: z.string(),
  suiteId: z.string(),
  bookId: z.string().nullable(),
  mode: evalModeSchema,
  status: z.enum(["queued", "running", "completed", "cancelled", "error"]),
  modelProfileIdsJson: z.string(),
  routeTaskType: z.enum(LLM_TASK_TYPES),
  qualityMode: z.enum(QUALITY_MODES),
  startedAt: z.string(),
  finishedAt: z.string().nullable(),
  notes: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string()
});
export type EvalRunRecord = z.infer<typeof evalRunSchema>;

export const evalOutputSchema = z.object({
  id: z.string(),
  evalRunId: z.string(),
  evalCaseId: z.string(),
  modelProfileId: z.string().nullable(),
  provider: z.string().nullable(),
  model: z.string().nullable(),
  outputText: z.string(),
  promptHash: z.string().nullable(),
  responseHash: z.string().nullable(),
  llmRunId: z.string().nullable(),
  latencyMs: z.number().nullable(),
  cost: z.number(),
  status: z.string(),
  blindLabel: z.string(),
  createdAt: z.string()
});
export type EvalOutputRecord = z.infer<typeof evalOutputSchema>;

export const evalScoreSchema = z.object({
  id: z.string(),
  evalOutputId: z.string(),
  scorerType: z.enum(["human", "llm_judge"]),
  scorerLabel: z.string(),
  dimensionsJson: z.string(),
  overallScore: z.number().min(0).max(10),
  notes: z.string().nullable(),
  createdAt: z.string()
});
export type EvalScoreRecord = z.infer<typeof evalScoreSchema>;

export const evalLeaderboardEntrySchema = z.object({
  modelProfileId: z.string(),
  provider: z.string(),
  model: z.string(),
  outputCount: z.number().int().min(0),
  qualityScore: z.number().min(0),
  cost: z.number().min(0),
  latencyMs: z.number().min(0),
  costAdjustedScore: z.number().min(0),
  notes: z.string().nullable(),
  outputIds: z.array(z.string())
});
export type EvalLeaderboardEntry = z.infer<typeof evalLeaderboardEntrySchema>;

export const evalStartRequestSchema = z.object({
  suiteId: z.string().min(1),
  bookId: z.string().min(1).nullable().optional(),
  mode: evalModeSchema,
  modelProfileIds: z.array(z.string().min(1)).min(1),
  taskType: z.enum(LLM_TASK_TYPES),
  qualityMode: z.enum(QUALITY_MODES),
  executionMode: z.enum(["mock", "provider"]).default("mock"),
  confirmed: z.boolean().optional(),
  budgetCapUsd: z.number().positive().optional(),
  maxOutputTokens: z.number().int().positive().max(1200).optional()
});
export type EvalStartRequest = z.infer<typeof evalStartRequestSchema>;

export const evalHumanScoreRequestSchema = z.object({
  outputId: z.string().min(1),
  dimensions: evalDimensionsSchema,
  overallScore: z.number().min(0).max(10).optional(),
  notes: z.string().nullable().optional()
});
export type EvalHumanScoreRequest = z.infer<typeof evalHumanScoreRequestSchema>;

export const evalPromoteRequestSchema = z.object({
  evalRunId: z.string().min(1),
  outputId: z.string().min(1),
  taskType: z.enum(LLM_TASK_TYPES),
  qualityMode: z.enum(QUALITY_MODES),
  confirmed: z.boolean().optional()
});
export type EvalPromoteRequest = z.infer<typeof evalPromoteRequestSchema>;

export const evalJudgeRequestSchema = z.object({
  outputId: z.string().min(1),
  judgeModelProfileId: z.string().min(1).optional(),
  executionMode: z.enum(["mock", "provider"]).default("mock").optional(),
  confirmed: z.boolean().optional(),
  budgetCapUsd: z.number().positive().optional()
});
export type EvalJudgeRequest = z.infer<typeof evalJudgeRequestSchema>;

export const evalRecommendationItemSchema = z.object({
  id: z.string(),
  label: z.string(),
  taskType: z.enum(LLM_TASK_TYPES),
  modelProfileId: z.string(),
  provider: z.string(),
  model: z.string(),
  modelAlias: z.string().nullable(),
  score: z.number().min(0),
  cost: z.number().min(0),
  latencyMs: z.number().min(0),
  reason: z.string(),
  requiresConfirmation: z.boolean()
});
export type EvalRecommendationItem = z.infer<typeof evalRecommendationItemSchema>;

export const evalRouteRecommendationsSchema = z.object({
  runId: z.string(),
  generatedAt: z.string(),
  items: z.array(evalRecommendationItemSchema)
});
export type EvalRouteRecommendations = z.infer<typeof evalRouteRecommendationsSchema>;

export const evalApplyRecommendationRequestSchema = z.object({
  runId: z.string().min(1),
  recommendationId: z.string().min(1),
  qualityMode: z.enum(QUALITY_MODES),
  confirmed: z.boolean().optional()
});
export type EvalApplyRecommendationRequest = z.infer<
  typeof evalApplyRecommendationRequestSchema
>;

export const evalReportRequestSchema = z.object({
  runId: z.string().min(1),
  includeRawOutputs: z.boolean().optional()
});
export type EvalReportRequest = z.infer<typeof evalReportRequestSchema>;

export const evalReportResultSchema = z.object({
  filePath: z.string(),
  content: z.string(),
  outputCount: z.number().int().min(0),
  redacted: z.boolean()
});
export type EvalReportResult = z.infer<typeof evalReportResultSchema>;

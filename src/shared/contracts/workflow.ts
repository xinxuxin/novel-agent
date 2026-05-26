import { z } from "zod";

import { LLM_TASK_TYPES, llmRunRecordSchema } from "./ai";
import { manuscriptVersionSchemaForWorkflow } from "./workflow-data";
import { QUALITY_MODES } from "@shared/domain/model-routing";

export const CHAPTER_GENERATION_WORKFLOW_ID = "chapter_generation_v1";

export const CHAPTER_GENERATION_WORKFLOW_NODES = [
  "prepare_context",
  "retrieve_memory",
  "generate_chapter_outline",
  "generate_scene_cards",
  "draft_chapter",
  "continuity_audit",
  "webnovel_rhythm_audit",
  "revise_draft",
  "human_gate",
  "state_settlement_proposal",
  "persist_results",
  "finalize"
] as const;

export type ChapterWorkflowNode = (typeof CHAPTER_GENERATION_WORKFLOW_NODES)[number];

export const chapterWorkflowNodeSchema = z.enum(CHAPTER_GENERATION_WORKFLOW_NODES);

export const chapterWorkflowStatusSchema = z.enum([
  "queued",
  "running",
  "paused",
  "completed",
  "error",
  "cancelled"
]);
export type ChapterWorkflowStatus = z.infer<typeof chapterWorkflowStatusSchema>;

export const humanGateStatusSchema = z.enum([
  "not_required",
  "waiting",
  "accepted",
  "rejected",
  "revision_requested",
  "cancelled"
]);
export type HumanGateStatus = z.infer<typeof humanGateStatusSchema>;

const looseJsonObjectSchema = z.record(z.string(), z.unknown());

export const workflowCostEstimateSchema = z.object({
  minCost: z.number().min(0),
  maxCost: z.number().min(0),
  currency: z.string(),
  nodeCount: z.number().int().min(0),
  notes: z.array(z.string())
});
export type WorkflowCostEstimate = z.infer<typeof workflowCostEstimateSchema>;

export const chapterGenerationStartRequestSchema = z.object({
  projectId: z.string().min(1),
  bookId: z.string().min(1),
  volumeId: z.string().min(1).nullable().optional(),
  chapterId: z.string().min(1),
  qualityMode: z.enum(QUALITY_MODES),
  executionMode: z.enum(["provider", "mock"]).optional(),
  chapterImportance: z
    .enum(["normal", "opening", "key_chapter", "volume_start", "volume_climax", "climax", "finale"])
    .optional(),
  budgetMode: z.enum(["strict", "flexible"]).optional(),
  routeOverrideModelProfileId: z.string().min(1).nullable().optional(),
  userInstruction: z.string().nullable().optional(),
  targetTokenBudget: z.number().int().positive().optional(),
  costWarningThreshold: z.number().min(0).optional(),
  confirmed: z.boolean().optional()
});
export type ChapterGenerationStartRequest = z.infer<typeof chapterGenerationStartRequestSchema>;

export const workflowRunRecordSchema = z.object({
  id: z.string(),
  workflowId: z.literal(CHAPTER_GENERATION_WORKFLOW_ID),
  projectId: z.string().nullable(),
  bookId: z.string().nullable(),
  chapterId: z.string().nullable(),
  status: chapterWorkflowStatusSchema,
  currentNode: chapterWorkflowNodeSchema.nullable(),
  humanGateStatus: humanGateStatusSchema,
  costEstimate: workflowCostEstimateSchema.nullable(),
  createdAt: z.string(),
  updatedAt: z.string()
});
export type WorkflowRunRecord = z.infer<typeof workflowRunRecordSchema>;

export const workflowCheckpointRecordSchema = z.object({
  id: z.string(),
  generationRunId: z.string(),
  nodeName: chapterWorkflowNodeSchema,
  state: looseJsonObjectSchema,
  createdAt: z.string()
});
export type WorkflowCheckpointRecord = z.infer<typeof workflowCheckpointRecordSchema>;

export const workflowEventRecordSchema = z.object({
  id: z.string(),
  generationRunId: z.string(),
  eventType: z.string(),
  nodeName: chapterWorkflowNodeSchema.nullable(),
  message: z.string(),
  payload: looseJsonObjectSchema,
  createdAt: z.string()
});
export type WorkflowEventRecord = z.infer<typeof workflowEventRecordSchema>;

export const workflowArtifactRecordSchema = z.object({
  id: z.string(),
  generationRunId: z.string(),
  chapterId: z.string().nullable(),
  artifactType: z.string(),
  title: z.string().nullable(),
  contentText: z.string(),
  contentJson: z.string().nullable(),
  sourceNode: z.string().nullable(),
  createdAt: z.string()
});
export type WorkflowArtifactRecord = z.infer<typeof workflowArtifactRecordSchema>;

export const workflowReviewCardSchema = z.object({
  id: z.string(),
  generationRunId: z.string(),
  chapterId: z.string(),
  reviewType: z.string(),
  severity: z.string(),
  title: z.string(),
  issue: z.string(),
  evidence: z.string().nullable(),
  affectedEntityType: z.string().nullable(),
  affectedEntityId: z.string().nullable(),
  suggestedFix: z.string().nullable(),
  requiresHumanJudgment: z.boolean(),
  status: z.string(),
  rawJson: z.string().nullable(),
  createdAt: z.string()
});
export type WorkflowReviewCard = z.infer<typeof workflowReviewCardSchema>;

export const settlementProposalItemSchema = z.object({
  id: z.string(),
  proposalId: z.string(),
  itemType: z.string(),
  targetEntityType: z.string().nullable(),
  targetEntityId: z.string().nullable(),
  actionType: z.string(),
  evidenceSummary: z.string(),
  confidence: z.number(),
  beforeJson: z.string().nullable(),
  afterJson: z.string(),
  status: z.string(),
  createdAt: z.string(),
  updatedAt: z.string()
});
export type SettlementProposalItem = z.infer<typeof settlementProposalItemSchema>;

export const settlementProposalRecordSchema = z.object({
  id: z.string(),
  generationRunId: z.string(),
  chapterId: z.string(),
  status: z.string(),
  items: z.array(settlementProposalItemSchema),
  createdAt: z.string(),
  updatedAt: z.string()
});
export type SettlementProposalRecord = z.infer<typeof settlementProposalRecordSchema>;

export const chapterWorkflowDetailSchema = z.object({
  run: workflowRunRecordSchema,
  checkpoints: z.array(workflowCheckpointRecordSchema),
  events: z.array(workflowEventRecordSchema),
  artifacts: z.array(workflowArtifactRecordSchema),
  reviewCards: z.array(workflowReviewCardSchema),
  settlementProposal: settlementProposalRecordSchema.nullable(),
  llmRuns: z.array(llmRunRecordSchema),
  costSummary: z.object({
    runCount: z.number().int().min(0),
    estimatedCostLive: z.number().min(0),
    finalCost: z.number().min(0),
    currency: z.string()
  })
});
export type ChapterWorkflowDetail = z.infer<typeof chapterWorkflowDetailSchema>;

export const generationGetRunRequestSchema = z.object({ runId: z.string().min(1) });
export const generationListRunsByChapterRequestSchema = z.object({
  chapterId: z.string().min(1)
});
export const generationStreamEventsRequestSchema = z.object({
  runId: z.string().min(1),
  sinceEventId: z.string().min(1).optional()
});
export const generationAbortRequestSchema = z.object({ runId: z.string().min(1) });
export const generationCancelRequestSchema = z.object({
  runId: z.string().min(1),
  confirmed: z.boolean().optional()
});
export const generationResumeRequestSchema = z.object({
  runId: z.string().min(1),
  action: z.enum(["accept", "reject"]),
  userInstruction: z.string().nullable().optional()
});
export type GenerationResumeRequest = z.infer<typeof generationResumeRequestSchema>;

export const generationRequestRevisionSchema = z.object({
  runId: z.string().min(1),
  userInstruction: z.string().trim().min(1)
});
export type GenerationRequestRevision = z.infer<typeof generationRequestRevisionSchema>;

export const generationAcceptArtifactAsVersionSchema = z.object({
  runId: z.string().min(1),
  artifactId: z.string().min(1),
  title: z.string().trim().min(1).optional()
});
export type GenerationAcceptArtifactAsVersion = z.infer<
  typeof generationAcceptArtifactAsVersionSchema
>;

export const generationSetAcceptedVersionCanonicalSchema = z.object({
  chapterId: z.string().min(1),
  versionId: z.string().min(1),
  confirmed: z.boolean().optional(),
  overrideBlockingWarnings: z.boolean().optional()
});
export type GenerationSetAcceptedVersionCanonical = z.infer<
  typeof generationSetAcceptedVersionCanonicalSchema
>;

export const workflowTaskTypeSchema = z.enum(LLM_TASK_TYPES);

export const manuscriptVersionWorkflowResponseSchema = manuscriptVersionSchemaForWorkflow;

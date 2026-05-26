import { z } from "zod";

export const CROSS_CHECK_TYPES = [
  "worldbuilding_cross_check",
  "originality_audit",
  "main_plot_logic_audit",
  "volume_outline_cross_check",
  "key_chapter_preflight_cross_check"
] as const;

export type CrossCheckType = (typeof CROSS_CHECK_TYPES)[number];

export const crossCheckRequestSchema = z.object({
  type: z.enum(CROSS_CHECK_TYPES),
  projectId: z.string().min(1).nullable().optional(),
  bookId: z.string().min(1).nullable().optional(),
  chapterId: z.string().min(1).nullable().optional(),
  contextText: z.string().min(1),
  userInstruction: z.string().nullable().optional(),
  budgetCapUsd: z.number().positive().max(20),
  confirmed: z.boolean().optional()
});

export type CrossCheckRequest = z.infer<typeof crossCheckRequestSchema>;

export const crossCheckArtifactSummarySchema = z.object({
  id: z.string(),
  role: z.string(),
  sourceModel: z.string(),
  llmRunId: z.string().nullable(),
  cost: z.number().min(0),
  status: z.literal("proposed")
});

export type CrossCheckArtifactSummary = z.infer<typeof crossCheckArtifactSummarySchema>;

export const crossCheckResultSchema = z.object({
  generationRunId: z.string(),
  type: z.enum(CROSS_CHECK_TYPES),
  status: z.literal("proposed"),
  llmRunIds: z.array(z.string()),
  artifactIds: z.array(z.string()),
  summary: z.object({
    agreements: z.array(z.string()),
    disagreements: z.array(z.string()),
    logicalContradictions: z.array(z.string()),
    originalityRisks: z.array(z.string()),
    tropeClicheRisks: z.array(z.string()),
    unresolvedDecisions: z.array(z.string()),
    recommendedFinalPlan: z.string(),
    humanDecisionPoints: z.array(z.string()),
    humanDecisionRequired: z.boolean(),
    costSummary: z.object({
      estimatedTotal: z.number().min(0),
      currency: z.string()
    })
  }),
  artifacts: z.array(crossCheckArtifactSummarySchema)
});

export type CrossCheckResult = z.infer<typeof crossCheckResultSchema>;

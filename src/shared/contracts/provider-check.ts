import { z } from "zod";

import { QUALITY_MODES } from "@shared/domain/model-routing";

export const providerCheckReportRecordSchema = z.object({
  path: z.string(),
  content: z.string()
});
export type ProviderCheckReportRecord = z.infer<typeof providerCheckReportRecordSchema>;

export const providerChapterCheckRequestSchema = z.object({
  confirmed: z.boolean().optional(),
  budgetCapUsd: z.number().positive().max(3).optional(),
  qualityMode: z.enum(QUALITY_MODES).optional()
});
export type ProviderChapterCheckRequest = z.infer<typeof providerChapterCheckRequestSchema>;

export const providerChapterCheckResultSchema = z.object({
  status: z.enum(["skipped", "passed", "failed", "blocked"]),
  runId: z.string().nullable(),
  reportPath: z.string().nullable(),
  reportMarkdown: z.string(),
  providersCalled: z.array(z.string()),
  modelsCalled: z.array(z.string()),
  workflowNodes: z.array(z.string()),
  tokenEstimates: z.array(
    z.object({
      taskType: z.string(),
      inputTokensEstimated: z.number(),
      outputTokensEstimatedLive: z.number()
    })
  ),
  estimatedCost: z.number(),
  finalCost: z.number(),
  currency: z.string(),
  retryFallbackEvents: z.array(z.record(z.string(), z.unknown())),
  generatedArtifactIds: z.array(z.string()),
  reviewCardCount: z.number(),
  settlementProposalItemCount: z.number(),
  canonicalManuscriptChanged: z.boolean(),
  storyBibleChanged: z.boolean(),
  llmRunIds: z.array(z.string()),
  savedNonCanonicalVersionId: z.string().nullable(),
  warnings: z.array(z.string()),
  errors: z.array(z.string())
});
export type ProviderChapterCheckResult = z.infer<typeof providerChapterCheckResultSchema>;

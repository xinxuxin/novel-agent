import { z } from "zod";

import { LLM_TASK_TYPES } from "./ai";
import { PROVIDERS } from "@shared/domain/model-routing";

export const costScopeRequestSchema = z.object({
  projectId: z.string().optional(),
  bookId: z.string().optional(),
  chapterId: z.string().optional(),
  runId: z.string().optional(),
  activeRunId: z.string().optional(),
  sessionSince: z.string().optional(),
  since: z.string().optional(),
  until: z.string().optional()
});
export type CostScopeRequest = z.infer<typeof costScopeRequestSchema>;

export const costGroupSchema = z.object({
  key: z.string(),
  label: z.string(),
  runCount: z.number().int().min(0),
  estimatedCostLive: z.number().min(0),
  finalCost: z.number().min(0),
  currency: z.string()
});
export type CostGroup = z.infer<typeof costGroupSchema>;

export const stalePriceWarningSchema = z.object({
  priceId: z.string(),
  provider: z.string(),
  model: z.string(),
  effectiveDate: z.string(),
  staleAfterDays: z.number().int().positive()
});
export type StalePriceWarning = z.infer<typeof stalePriceWarningSchema>;

export const estimatedVsReportedSchema = z.object({
  providerReportedCost: z.number().min(0),
  estimatedOnlyCost: z.number().min(0),
  mixedCost: z.number().min(0),
  providerReportedRuns: z.number().int().min(0),
  estimatedRuns: z.number().int().min(0),
  mixedRuns: z.number().int().min(0)
});
export type EstimatedVsReported = z.infer<typeof estimatedVsReportedSchema>;

export const costDashboardSummarySchema = z.object({
  activeRunCost: costGroupSchema,
  sessionCost: costGroupSchema,
  todayCost: costGroupSchema,
  currentProjectCost: costGroupSchema,
  monthToDateCost: costGroupSchema,
  byProvider: z.array(costGroupSchema),
  byModel: z.array(costGroupSchema),
  byTaskType: z.array(costGroupSchema),
  byWorkflowNode: z.array(costGroupSchema),
  byChapter: z.array(costGroupSchema),
  spendOverTime: z.array(costGroupSchema),
  costPerChapter: z.array(costGroupSchema),
  estimatedVsReported: estimatedVsReportedSchema,
  averageCostPerApprovedChapter: z.number().min(0),
  averageCostPer1kChineseCharacters: z.number().min(0),
  stalePriceWarnings: z.array(stalePriceWarningSchema),
  currency: z.string()
});
export type CostDashboardSummary = z.infer<typeof costDashboardSummarySchema>;

export const csvExportResultSchema = z.object({
  filename: z.string(),
  content: z.string(),
  rowCount: z.number().int().min(0)
});
export type CsvExportResult = z.infer<typeof csvExportResultSchema>;

export const priceRegistryExportSchema = z.object({
  schemaVersion: z.literal(1),
  exportedAt: z.string(),
  prices: z.array(
    z.object({
      provider: z.enum(PROVIDERS),
      model: z.string(),
      inputPricePerMillion: z.number().min(0),
      outputPricePerMillion: z.number().min(0),
      cachedInputPricePerMillion: z.number().min(0).nullable().optional(),
      currency: z.string(),
      contextWindow: z.number().int().positive().nullable().optional(),
      maxOutputTokens: z.number().int().positive().nullable().optional(),
      effectiveDate: z.string(),
      sourceNote: z.string(),
      enabled: z.boolean().optional()
    })
  )
});
export type PriceRegistryExport = z.infer<typeof priceRegistryExportSchema>;

export const priceRegistryImportSchema = z.object({
  prices: priceRegistryExportSchema.shape.prices
});
export type PriceRegistryImport = z.infer<typeof priceRegistryImportSchema>;

export const priceImportResultSchema = z.object({
  importedCount: z.number().int().min(0),
  skippedCount: z.number().int().min(0)
});
export type PriceImportResult = z.infer<typeof priceImportResultSchema>;

export const routePriceWarningSchema = z.object({
  routeId: z.string(),
  taskType: z.enum(LLM_TASK_TYPES),
  qualityMode: z.enum(["economy", "balanced", "premium"]),
  provider: z.string(),
  model: z.string(),
  warningType: z.enum(["missing_price", "stale_price"])
});
export type RoutePriceWarning = z.infer<typeof routePriceWarningSchema>;

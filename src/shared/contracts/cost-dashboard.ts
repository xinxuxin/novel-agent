import { z } from "zod";

import { LLM_TASK_TYPES } from "./ai";
import { PROVIDERS, QUALITY_MODES } from "@shared/domain/model-routing";

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
  perProviderBurnDown: z.array(costGroupSchema),
  costPerChapter: z.array(costGroupSchema),
  modelRouteCostComparison: z.array(costGroupSchema),
  expensiveRunOutliers: z.array(costGroupSchema),
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
  ),
  tiers: z
    .array(
      z.object({
        modelPriceId: z.string().optional(),
        provider: z.enum(PROVIDERS),
        model: z.string(),
        deploymentMode: z.string().nullable().optional(),
        minInputTokens: z.number().int().min(0),
        maxInputTokens: z.number().int().min(0).nullable().optional(),
        inputPricePerMillion: z.number().min(0),
        outputPricePerMillion: z.number().min(0),
        cachedInputPricePerMillion: z.number().min(0).nullable().optional(),
        cacheWritePricePerMillion: z.number().min(0).nullable().optional(),
        currency: z.string(),
        effectiveDate: z.string(),
        sourceNote: z.string(),
        enabled: z.boolean().optional()
      })
    )
    .optional()
});
export type PriceRegistryExport = z.infer<typeof priceRegistryExportSchema>;

export const priceRegistryImportSchema = z.object({
  prices: priceRegistryExportSchema.shape.prices,
  tiers: priceRegistryExportSchema.shape.tiers
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
  qualityMode: z.enum(QUALITY_MODES),
  provider: z.string(),
  model: z.string(),
  warningType: z.enum(["missing_price", "stale_price"])
});
export type RoutePriceWarning = z.infer<typeof routePriceWarningSchema>;

export const modelPriceTierSchema = z.object({
  id: z.string(),
  modelPriceId: z.string(),
  provider: z.enum(PROVIDERS),
  model: z.string(),
  deploymentMode: z.string().nullable(),
  minInputTokens: z.number().int().min(0),
  maxInputTokens: z.number().int().min(0).nullable(),
  inputPricePerMillion: z.number().min(0),
  outputPricePerMillion: z.number().min(0),
  cachedInputPricePerMillion: z.number().min(0).nullable(),
  cacheWritePricePerMillion: z.number().min(0).nullable(),
  currency: z.string(),
  effectiveDate: z.string(),
  sourceNote: z.string(),
  enabled: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string()
});
export type ModelPriceTierDto = z.infer<typeof modelPriceTierSchema>;

export const providerQuotaNoteSchema = z.object({
  id: z.string(),
  provider: z.enum(PROVIDERS),
  creditBalance: z.number().min(0).nullable(),
  monthlyBudget: z.number().min(0).nullable(),
  freeQuotaRemaining: z.number().min(0).nullable(),
  refreshedAt: z.string().nullable(),
  notes: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string()
});
export type ProviderQuotaNoteDto = z.infer<typeof providerQuotaNoteSchema>;

export const costForecastRequestSchema = z.object({
  projectId: z.string().optional(),
  bookId: z.string().optional(),
  chapterId: z.string().optional(),
  qualityMode: z.enum(QUALITY_MODES).default("balanced").optional(),
  chapterCount: z.number().int().positive().max(500).default(1).optional(),
  deploymentModeByProvider: z.record(z.string(), z.string()).optional()
});
export type CostForecastRequest = z.infer<typeof costForecastRequestSchema>;

export const forecastNodeSchema = z.object({
  taskType: z.enum(LLM_TASK_TYPES),
  provider: z.enum(PROVIDERS).nullable(),
  model: z.string().nullable(),
  inputTokens: z.number().int().min(0),
  outputTokens: z.number().int().min(0),
  expectedCost: z.number().min(0),
  currency: z.string(),
  selectedTierId: z.string().nullable(),
  warnings: z.array(z.string())
});
export type ForecastNode = z.infer<typeof forecastNodeSchema>;

export const costForecastSchema = z.object({
  projectId: z.string().nullable(),
  bookId: z.string().nullable(),
  chapterId: z.string().nullable(),
  qualityMode: z.enum(QUALITY_MODES),
  chapterCount: z.number().int().positive(),
  nodes: z.array(forecastNodeSchema),
  lowCost: z.number().min(0),
  totalExpectedCost: z.number().min(0),
  highCost: z.number().min(0),
  currency: z.string(),
  providerCosts: z.record(z.string(), z.number().min(0)),
  remainingProjectBudget: z.number().nullable(),
  warnings: z.array(z.string())
});
export type CostForecast = z.infer<typeof costForecastSchema>;

export const qualityModeComparisonSchema = z.object({
  forecasts: z.array(costForecastSchema.pick({ qualityMode: true, totalExpectedCost: true, currency: true }))
});
export type QualityModeComparison = z.infer<typeof qualityModeComparisonSchema>;

export const providerQuotaSummarySchema = z.object({
  providers: z.array(
    z.object({
      provider: z.enum(PROVIDERS),
      availableBalance: z.number().min(0),
      expectedCostPerChapter: z.number().min(0),
      chaptersRemaining: z.number().int().min(0).nullable(),
      refreshedAt: z.string().nullable(),
      notes: z.string().nullable()
    })
  ),
  limitingProvider: z
    .object({
      provider: z.enum(PROVIDERS),
      chaptersRemaining: z.number().int().min(0).nullable()
    })
    .nullable(),
  warnings: z.array(z.string())
});
export type ProviderQuotaSummary = z.infer<typeof providerQuotaSummarySchema>;

import { z } from "zod";

import { PROVIDERS, TASK_TYPES } from "@shared/domain/model-routing";
import { QUALITY_MODES } from "@shared/domain/model-routing";
import type { ProviderId, TaskType } from "@shared/domain/model-routing";

export const AI_PROVIDER_IDS = [...PROVIDERS, "fake"] as const;
export type AIProviderId = (typeof AI_PROVIDER_IDS)[number];

export const LLM_TASK_TYPES = TASK_TYPES;
export type LLMTaskType = TaskType;

export const chatMessageSchema = z.object({
  role: z.enum(["system", "user", "assistant", "tool"]),
  content: z.string(),
  name: z.string().optional()
});
export type ChatMessage = z.infer<typeof chatMessageSchema>;

export const tokenUsageSchema = z.object({
  inputTokens: z.number().int().min(0),
  outputTokens: z.number().int().min(0),
  cachedInputTokens: z.number().int().min(0).optional(),
  totalTokens: z.number().int().min(0).optional()
});
export type TokenUsage = z.infer<typeof tokenUsageSchema>;

export const costBreakdownSchema = z.object({
  inputCost: z.number().min(0),
  outputCost: z.number().min(0),
  cachedInputCost: z.number().min(0),
  totalCost: z.number().min(0),
  currency: z.string(),
  estimated: z.boolean()
});
export type CostBreakdown = z.infer<typeof costBreakdownSchema>;

export const providerErrorSchema = z.object({
  code: z.string().min(1),
  message: z.string().min(1),
  status: z.number().int().optional(),
  retryable: z.boolean().optional()
});
export type ProviderError = z.infer<typeof providerErrorSchema>;

export const normalizedProviderResponseSchema = z.object({
  text: z.string(),
  usage: tokenUsageSchema.nullable().optional(),
  raw: z.unknown().optional()
});
export type NormalizedProviderResponse = z.infer<typeof normalizedProviderResponseSchema>;

export const streamRunOptionsSchema = z.object({
  storeFullPrompts: z.boolean().optional(),
  storeFullResponses: z.boolean().optional(),
  storeManuscriptsInLogs: z.boolean().optional()
});
export type StreamRunOptions = z.infer<typeof streamRunOptionsSchema>;

export const streamRequestSchema = z.object({
  provider: z.enum(AI_PROVIDER_IDS).optional(),
  model: z.string().trim().min(1).optional(),
  modelProfileId: z.string().min(1).optional(),
  taskType: z.enum(LLM_TASK_TYPES),
  qualityMode: z.enum(QUALITY_MODES).optional(),
  projectId: z.string().nullable().optional(),
  bookId: z.string().nullable().optional(),
  chapterId: z.string().nullable().optional(),
  generationRunId: z.string().nullable().optional(),
  messages: z.array(chatMessageSchema).min(1),
  temperature: z.number().min(0).max(2).optional(),
  maxOutputTokens: z.number().int().positive().optional(),
  options: streamRunOptionsSchema.optional()
});
export type StreamRequest = z.infer<typeof streamRequestSchema>;

export const streamStartResultSchema = z.object({
  runId: z.string().min(1)
});
export type StreamStartResult = z.infer<typeof streamStartResultSchema>;

const streamBaseEventSchema = z.object({
  runId: z.string().min(1),
  provider: z.enum(AI_PROVIDER_IDS),
  model: z.string(),
  taskType: z.enum(LLM_TASK_TYPES),
  at: z.string()
});

export const streamDeltaEventSchema = streamBaseEventSchema.extend({
  type: z.literal("delta"),
  text: z.string()
});
export type StreamDeltaEvent = z.infer<typeof streamDeltaEventSchema>;

export const streamCostEventSchema = streamBaseEventSchema.extend({
  type: z.literal("cost"),
  inputTokensEstimated: z.number().int().min(0),
  outputTokensEstimatedLive: z.number().int().min(0),
  estimatedCostLive: z.number().min(0),
  currency: z.string(),
  usageSource: z.enum(["estimated", "provider", "mixed"]),
  warnings: z.array(z.string()).optional()
});
export type StreamCostEvent = z.infer<typeof streamCostEventSchema>;

export const streamCompleteEventSchema = streamBaseEventSchema.extend({
  type: z.literal("complete"),
  text: z.string(),
  usage: tokenUsageSchema,
  cost: costBreakdownSchema,
  usageSource: z.enum(["estimated", "provider", "mixed"])
});
export type StreamCompleteEvent = z.infer<typeof streamCompleteEventSchema>;

export const streamErrorEventSchema = streamBaseEventSchema.extend({
  type: z.literal("error"),
  code: z.string().min(1),
  message: z.string().min(1),
  retryable: z.boolean().optional()
});
export type StreamErrorEvent = z.infer<typeof streamErrorEventSchema>;

export const aiStreamEventSchema = z.discriminatedUnion("type", [
  streamDeltaEventSchema,
  streamCostEventSchema,
  streamCompleteEventSchema,
  streamErrorEventSchema
]);
export type AIStreamEvent = z.infer<typeof aiStreamEventSchema>;

export const modelProfileForAiSchema = z.object({
  id: z.string(),
  provider: z.enum(PROVIDERS),
  model: z.string(),
  alias: z.string().nullable().optional(),
  displayName: z.string(),
  contextWindow: z.number().nullable(),
  maxOutputTokens: z.number().nullable(),
  supportsStreaming: z.boolean(),
  supportsJson: z.boolean(),
  supportsTools: z.boolean(),
  supportsVision: z.boolean(),
  supportsPromptCaching: z.boolean(),
  defaultTemperature: z.number(),
  enabled: z.boolean()
});
export type ModelProfile = z.infer<typeof modelProfileForAiSchema>;

export const llmRunRecordSchema = z.object({
  id: z.string(),
  generationRunId: z.string().nullable(),
  provider: z.string(),
  model: z.string(),
  taskType: z.enum(LLM_TASK_TYPES),
  projectId: z.string().nullable(),
  bookId: z.string().nullable(),
  chapterId: z.string().nullable(),
  requestStartedAt: z.string(),
  requestFinishedAt: z.string().nullable(),
  status: z.string(),
  inputTokensEstimated: z.number(),
  outputTokensEstimatedLive: z.number(),
  inputTokensReported: z.number().nullable(),
  outputTokensReported: z.number().nullable(),
  cachedInputTokensReported: z.number().nullable(),
  usageSource: z.enum(["estimated", "provider", "mixed"]),
  estimatedCostLive: z.number(),
  finalCost: z.number().nullable(),
  currency: z.string(),
  latencyMs: z.number().nullable(),
  errorCode: z.string().nullable(),
  errorMessage: z.string().nullable(),
  promptHash: z.string().nullable(),
  responseHash: z.string().nullable(),
  createdAt: z.string()
});
export type LLMRunRecord = z.infer<typeof llmRunRecordSchema>;

export const costSummarySchema = z.object({
  runCount: z.number().int().min(0),
  estimatedCostLive: z.number().min(0),
  finalCost: z.number().min(0),
  currency: z.string()
});
export type CostSummary = z.infer<typeof costSummarySchema>;

export const costSummaryRequestSchema = z.object({
  projectId: z.string().optional(),
  bookId: z.string().optional(),
  chapterId: z.string().optional(),
  since: z.string().optional(),
  until: z.string().optional()
});
export type CostSummaryRequest = z.infer<typeof costSummaryRequestSchema>;

export const AI_STREAM_EVENT_CHANNEL = "ai:stream:event";

export function toModelProviderId(provider: AIProviderId): ProviderId | null {
  return provider === "fake" ? null : provider;
}

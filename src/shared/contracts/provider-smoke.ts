import { z } from "zod";

import { PROVIDERS } from "@shared/domain/model-routing";

export const providerSmokeStatusSchema = z.enum(["skipped", "passed", "failed", "blocked"]);

export const providerSmokeResultSchema = z.object({
  provider: z.enum(PROVIDERS),
  configured: z.boolean(),
  tested: z.boolean(),
  status: providerSmokeStatusSchema,
  streamingSupported: z.boolean(),
  nonStreamingSupported: z.boolean(),
  usageParsed: z.boolean(),
  finalCostComputed: z.boolean(),
  fallbackEligible: z.boolean(),
  error: z.string().nullable(),
  testedAt: z.string().nullable(),
  latencyMs: z.number().nullable(),
  estimatedCost: z.number().nullable(),
  runIds: z.array(z.string())
});
export type ProviderSmokeResult = z.infer<typeof providerSmokeResultSchema>;

export const providerSmokeRunRequestSchema = z.object({
  provider: z.enum(PROVIDERS),
  confirmed: z.boolean().optional(),
  budgetCapUsd: z.number().positive().max(2).optional()
});
export type ProviderSmokeRunRequest = z.infer<typeof providerSmokeRunRequestSchema>;

export const providerSmokeRunAllRequestSchema = z.object({
  confirmed: z.boolean().optional(),
  budgetCapUsd: z.number().positive().max(2).optional()
});
export type ProviderSmokeRunAllRequest = z.infer<typeof providerSmokeRunAllRequestSchema>;

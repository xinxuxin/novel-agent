import { z } from "zod";

import { PROVIDERS } from "@shared/domain/model-routing";

export const diagnosticBundleRequestSchema = z.object({
  includeManuscripts: z.boolean().optional()
});
export type DiagnosticBundleRequest = z.infer<typeof diagnosticBundleRequestSchema>;

export const diagnosticProviderHealthSchema = z.object({
  id: z.string(),
  provider: z.enum(PROVIDERS),
  model: z.string().nullable(),
  status: z.enum(["unknown", "healthy", "degraded", "down"]),
  checkedAt: z.string(),
  errorCode: z.string().nullable(),
  errorMessage: z.string().nullable()
});

export const diagnosticBundleSchema = z.object({
  appVersion: z.string(),
  platform: z.string(),
  environment: z.string(),
  dbMigrationVersion: z.string(),
  safeStorageAvailable: z.boolean(),
  providerHealth: z.array(diagnosticProviderHealthSchema),
  recentErrors: z.array(z.string()),
  logs: z.array(z.string()),
  settings: z.unknown(),
  providerCheckSummary: z.unknown(),
  costAccountingSummary: z.unknown(),
  manuscriptsIncluded: z.boolean(),
  createdAt: z.string()
});
export type DiagnosticBundle = z.infer<typeof diagnosticBundleSchema>;

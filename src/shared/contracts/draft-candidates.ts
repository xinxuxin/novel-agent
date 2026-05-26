import { z } from "zod";

import { AI_PROVIDER_IDS } from "./ai";

export const draftCandidateGroupStatusSchema = z.enum([
  "draft",
  "running",
  "paused",
  "completed",
  "error",
  "cancelled",
  "discarded"
]);
export type DraftCandidateGroupStatus = z.infer<typeof draftCandidateGroupStatusSchema>;

export const draftCandidateStatusSchema = z.enum([
  "queued",
  "running",
  "succeeded",
  "failed",
  "saved",
  "discarded"
]);
export type DraftCandidateStatus = z.infer<typeof draftCandidateStatusSchema>;

export const draftFusionStatusSchema = z.enum([
  "proposed",
  "running",
  "succeeded",
  "failed",
  "saved",
  "discarded"
]);
export type DraftFusionStatus = z.infer<typeof draftFusionStatusSchema>;

export const candidateModelSelectionSchema = z.object({
  provider: z.enum(AI_PROVIDER_IDS),
  model: z.string().trim().min(1),
  modelProfileId: z.string().min(1).nullable().optional(),
  displayName: z.string().nullable().optional(),
  roleLabel: z.string().trim().min(1),
  enabled: z.boolean().optional()
});
export type CandidateModelSelection = z.infer<typeof candidateModelSelectionSchema>;

export const draftCandidateGroupSchema = z.object({
  id: z.string(),
  chapterId: z.string(),
  generationRunId: z.string(),
  chapterPlanId: z.string().nullable(),
  targetWords: z.number(),
  userInstruction: z.string().nullable(),
  presetName: z.string().nullable(),
  status: draftCandidateGroupStatusSchema,
  createdAt: z.string(),
  updatedAt: z.string()
});
export type DraftCandidateGroupRecord = z.infer<typeof draftCandidateGroupSchema>;

export const draftCandidateSchema = z.object({
  id: z.string(),
  groupId: z.string(),
  provider: z.enum(AI_PROVIDER_IDS),
  model: z.string(),
  roleLabel: z.string(),
  contentMarkdown: z.string(),
  contentPlaintext: z.string(),
  wordCount: z.number(),
  characterCount: z.number(),
  llmRunId: z.string().nullable(),
  cost: z.number().nullable(),
  latencyMs: z.number().nullable(),
  status: draftCandidateStatusSchema,
  errorMessage: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string()
});
export type DraftCandidateRecord = z.infer<typeof draftCandidateSchema>;

export const draftFusionSchema = z.object({
  id: z.string(),
  groupId: z.string(),
  baseCandidateId: z.string(),
  referenceCandidateIdsJson: z.string(),
  fusionInstruction: z.string().nullable(),
  fusionProvider: z.enum(AI_PROVIDER_IDS),
  fusionModel: z.string(),
  resultArtifactId: z.string().nullable(),
  resultManuscriptVersionId: z.string().nullable(),
  llmRunId: z.string().nullable(),
  cost: z.number().nullable(),
  latencyMs: z.number().nullable(),
  status: draftFusionStatusSchema,
  errorMessage: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string()
});
export type DraftFusionRecord = z.infer<typeof draftFusionSchema>;

export const draftCandidateGroupDetailSchema = z.object({
  group: draftCandidateGroupSchema,
  candidates: z.array(draftCandidateSchema),
  fusions: z.array(draftFusionSchema)
});
export type DraftCandidateGroupDetail = z.infer<typeof draftCandidateGroupDetailSchema>;

export const createCandidateGroupSchema = z.object({
  chapterId: z.string().min(1),
  presetName: z.string().nullable().optional(),
  targetWords: z.number().int().positive().optional(),
  userInstruction: z.string().nullable().optional()
});
export type CreateCandidateGroupInput = z.infer<typeof createCandidateGroupSchema>;

export const generateCandidatesSchema = z.object({
  groupId: z.string().min(1),
  executionMode: z.enum(["mock", "provider"]).optional(),
  candidates: z.array(candidateModelSelectionSchema).min(1).max(5),
  budgetCapUsd: z.number().min(0).nullable().optional(),
  maxOutputTokens: z.number().int().positive().optional(),
  confirmed: z.boolean().optional()
});
export type GenerateCandidatesInput = z.infer<typeof generateCandidatesSchema>;

export const candidateIdRequestSchema = z.object({ candidateId: z.string().min(1) });
export const groupIdRequestSchema = z.object({ groupId: z.string().min(1) });
export const chapterCandidatesRequestSchema = z.object({ chapterId: z.string().min(1) });

export const retryCandidateSchema = candidateIdRequestSchema.extend({
  confirmed: z.boolean().optional()
});
export type RetryCandidateInput = z.infer<typeof retryCandidateSchema>;

export const saveCandidateAsVersionSchema = candidateIdRequestSchema.extend({
  title: z.string().trim().min(1).optional()
});
export type SaveCandidateAsVersionInput = z.infer<typeof saveCandidateAsVersionSchema>;

export const setCandidateCanonicalSchema = candidateIdRequestSchema.extend({
  confirmed: z.boolean().optional()
});
export type SetCandidateCanonicalInput = z.infer<typeof setCandidateCanonicalSchema>;

export const deleteCandidateGroupSchema = groupIdRequestSchema.extend({
  confirmed: z.boolean().optional()
});

export const createFusionSchema = z.object({
  groupId: z.string().min(1),
  baseCandidateId: z.string().min(1),
  referenceCandidateIds: z.array(z.string().min(1)).optional(),
  fusionInstruction: z.string().nullable().optional(),
  fusionProvider: z.enum(AI_PROVIDER_IDS),
  fusionModel: z.string().trim().min(1),
  targetWords: z.number().int().positive().optional()
});
export type CreateFusionInput = z.infer<typeof createFusionSchema>;

export const generateFusionSchema = z.object({
  fusionId: z.string().min(1),
  confirmed: z.boolean().optional(),
  budgetCapUsd: z.number().min(0).nullable().optional(),
  maxOutputTokens: z.number().int().positive().optional()
});
export type GenerateFusionInput = z.infer<typeof generateFusionSchema>;

export const fusionIdRequestSchema = z.object({ fusionId: z.string().min(1) });
export const saveFusionAsVersionSchema = fusionIdRequestSchema.extend({
  title: z.string().trim().min(1).optional()
});
export type SaveFusionAsVersionInput = z.infer<typeof saveFusionAsVersionSchema>;

export const setFusionCanonicalSchema = fusionIdRequestSchema.extend({
  confirmed: z.boolean().optional()
});
export type SetFusionCanonicalInput = z.infer<typeof setFusionCanonicalSchema>;

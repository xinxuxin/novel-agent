import { z } from "zod";

export const manuscriptVersionSchemaForWorkflow = z.object({
  id: z.string(),
  chapterId: z.string(),
  parentVersionId: z.string().nullable(),
  versionIndex: z.number(),
  branchLabel: z.string().nullable(),
  title: z.string(),
  contentMarkdown: z.string(),
  contentPlaintext: z.string(),
  sourceType: z.enum(["manual", "generated", "imported", "restored"]),
  generationRunId: z.string().nullable(),
  isCanonical: z.boolean(),
  wordCount: z.number(),
  characterCount: z.number(),
  createdAt: z.string()
});

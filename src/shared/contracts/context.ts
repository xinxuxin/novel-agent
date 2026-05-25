import type { QualityMode, TaskType } from "@shared/domain/model-routing";
import type { PrivacySettings } from "./settings";

export interface ContextPreviewRequest {
  projectId: string;
  bookId: string;
  volumeId?: string | null | undefined;
  chapterId: string;
  taskType: TaskType;
  userInstruction?: string | null | undefined;
  qualityMode: QualityMode;
  targetTokenBudget: number;
  includeRecentChapters: number;
  includeFullRecentChapters: boolean;
  privacy?: PrivacySettings | undefined;
}

export interface ContextPreviewPack {
  projectBrief: string;
  bookPremise: string;
  volumeGoal: string | null;
  currentChapterMetadata: string;
  currentChapterOutline: unknown | null;
  sceneCards: unknown[];
  readerPositioning: string;
  styleGuide: string;
  relevantCharacters: string[];
  relevantFactions: string[];
  relevantLocations: string[];
  relevantArtifacts: string[];
  powerSystemDigest: string;
  timelineDigest: string;
  foreshadowingDigest: string;
  unresolvedHooks: string[];
  recentChapterSummaries: string[];
  recentChapterExcerpts: string[];
  retrievedMemoryChunks: Array<{
    sourceType: string;
    sourceId: string;
    title: string;
    content: string;
    score: number;
  }>;
  continuityWarnings: string[];
  omissions: string[];
  truncationNotes: string[];
  estimatedTokens: number;
}

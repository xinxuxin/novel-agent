export type OutlineSourceType = "paste" | "file" | "manual" | "imported";
export type PlanStatus = "draft" | "proposed" | "accepted" | "archived";
export type PlanEditTargetType = "outline" | "volume" | "chapter" | "scene" | "beat" | "manuscript";
export type PlanEditProposalStatus = "proposed" | "accepted" | "rejected" | "archived";

export interface OutlineSourceRecord {
  id: string;
  projectId: string;
  bookId: string;
  sourceType: OutlineSourceType;
  title: string;
  originalText: string;
  parsedAt: string | null;
  parserModel: string | null;
  createdAt: string;
}

export interface OutlineVersionRecord {
  id: string;
  bookId: string;
  parentVersionId: string | null;
  title: string;
  contentJson: string;
  contentMarkdown: string;
  sourceId: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface ChapterPlanRecord {
  id: string;
  bookId: string;
  volumeId: string | null;
  chapterId: string | null;
  outlineVersionId: string | null;
  chapterIndex: number;
  title: string;
  targetWords: number;
  minWords: number | null;
  maxWords: number | null;
  chapterPromise: string | null;
  openingHook: string | null;
  mainConflict: string | null;
  emotionalTurn: string | null;
  payoff: string | null;
  endingHook: string | null;
  continuityDependenciesJson: string;
  userNotes: string | null;
  status: PlanStatus;
  createdAt: string;
  updatedAt: string;
}

export interface PlanEditProposalRecord {
  id: string;
  bookId: string;
  targetType: PlanEditTargetType;
  targetId: string;
  instruction: string;
  beforeJson: string;
  afterJson: string;
  patchJson: string | null;
  rationale: string;
  modelProvider: string | null;
  modelName: string | null;
  llmRunId: string | null;
  status: PlanEditProposalStatus;
  createdAt: string;
  updatedAt: string;
}

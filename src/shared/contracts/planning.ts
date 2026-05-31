export type OutlineSourceType = "paste" | "file" | "manual" | "imported";
export type PlanStatus = "draft" | "proposed" | "accepted" | "rejected" | "archived";
export type WordCountPriority = "loose" | "normal" | "strict";
export type PlanEditTargetType = "outline" | "volume" | "chapter" | "scene" | "beat" | "manuscript";
export type PlanEditProposalStatus = "proposed" | "accepted" | "rejected" | "archived";
export type IntakeStatus = "draft" | "proposed" | "accepted" | "rejected" | "archived";
export type IntakeMessageRole = "user" | "assistant" | "system";

export interface BookSettingFileRecord {
  id: string;
  bookId: string;
  title: string;
  contentMarkdown: string;
  contentPlaintext: string;
  isActive: boolean;
  sourceType: OutlineSourceType;
  createdAt: string;
  updatedAt: string;
}

export interface IntakeSessionRecord {
  id: string;
  projectId: string;
  bookId: string | null;
  title: string;
  status: IntakeStatus;
  createdAt: string;
  updatedAt: string;
}

export interface IntakeMessageRecord {
  id: string;
  sessionId: string;
  role: IntakeMessageRole;
  content: string;
  linkedArtifactId: string | null;
  createdAt: string;
}

export interface IntakeArtifactRecord {
  id: string;
  sessionId: string;
  artifactType: string;
  title: string;
  contentJson: string;
  contentMarkdown: string;
  status: IntakeStatus;
  sourceMessageIdsJson: string;
  createdAt: string;
  updatedAt: string;
}

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

export interface MaterialDigestRecord {
  id: string;
  bookId: string;
  intakeSessionId: string | null;
  outlineVersionId: string | null;
  sourceSummaryJson: string;
  digestJson: string;
  missingInformationJson: string;
  ambiguityWarningsJson: string;
  warningsJson: string;
  acceptedAt: string | null;
  createdAt: string;
  updatedAt: string;
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
  wordCountPriority: WordCountPriority;
  chapterSummary: string | null;
  chapterPromise: string | null;
  openingHook: string | null;
  mainConflict: string | null;
  conflictEscalation: string | null;
  keyEventsJson: string;
  sceneCardsJson: string;
  emotionalTurn: string | null;
  payoff: string | null;
  endingHook: string | null;
  continuityDependenciesJson: string;
  charactersInvolvedJson: string;
  storyBibleFactsUsedJson: string;
  foreshadowingSeededJson: string;
  foreshadowingResolvedJson: string;
  unresolvedHooksCarriedForwardJson: string;
  outlineText: string | null;
  mustIncludeJson: string;
  mustAvoidJson: string;
  importSourceId: string | null;
  userNotes: string | null;
  riskNotes: string | null;
  status: PlanStatus;
  acceptedAt: string | null;
  acceptedBy: string | null;
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

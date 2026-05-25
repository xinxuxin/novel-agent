export type DiffLineType = "unchanged" | "added" | "removed";

export interface ManuscriptDiffLine {
  type: DiffLineType;
  oldLineNumber: number | null;
  newLineNumber: number | null;
  text: string;
}

export interface ManuscriptDiff {
  fromTitle: string;
  toTitle: string;
  fromWordCount: number;
  toWordCount: number;
  wordDelta: number;
  fromCharacterCount: number;
  toCharacterCount: number;
  characterDelta: number;
  lines: ManuscriptDiffLine[];
}

export interface QualityGateResult {
  canApproveCanonical: boolean;
  blockingReviewCardIds: string[];
  warnings: string[];
}

export interface SettlementPreviewItem {
  id: string;
  proposalId: string;
  itemType: string;
  targetEntityType: string | null;
  targetEntityId: string | null;
  actionType: string;
  evidenceSummary: string;
  confidence: number;
  beforeJson: string | null;
  afterJson: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  supportedByAcceptedManuscript: boolean;
  recommendedStatus: "accept" | "reject";
  group: string;
}

export interface SettlementPreview {
  id: string;
  generationRunId: string;
  chapterId: string;
  status: string;
  items: SettlementPreviewItem[];
  groups: Record<string, SettlementPreviewItem[]>;
  createdAt: string;
  updatedAt: string;
}

export interface ApplySettlementResult {
  appliedItems: SettlementPreviewItem[];
  rejectedItems: SettlementPreviewItem[];
}

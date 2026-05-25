export interface StoryBibleListQuery {
  bookId: string;
  query?: string;
  tags?: string[];
  chapterId?: string | null;
}

export interface BaseStoryBibleRecord {
  id: string;
  bookId: string;
  tags: string[];
  importance: number;
  relatedChapterIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface NamedStoryBibleRecord extends BaseStoryBibleRecord {
  name: string;
  summary: string | null;
}

export interface CharacterRecord extends NamedStoryBibleRecord {
  aliases: string[];
  role: string | null;
  firstAppearanceChapterId: string | null;
  currentState: string | null;
  goal: string | null;
  motivation: string | null;
  secret: string | null;
  contradiction: string | null;
  relationshipNotes: string | null;
  speakingStyle: string | null;
  forbiddenInconsistencies: string | null;
}

export interface CharacterInput {
  bookId: string;
  name: string;
  aliases?: string[];
  role?: string | null;
  firstAppearanceChapterId?: string | null;
  summary?: string | null;
  currentState?: string | null;
  goal?: string | null;
  motivation?: string | null;
  secret?: string | null;
  contradiction?: string | null;
  relationshipNotes?: string | null;
  speakingStyle?: string | null;
  forbiddenInconsistencies?: string | null;
  tags?: string[];
  importance?: number;
  relatedChapterIds?: string[];
}

export interface NamedEntityInput {
  bookId: string;
  name: string;
  summary?: string | null;
  tags?: string[];
  importance?: number;
  relatedChapterIds?: string[];
}

export interface PowerSystemRuleRecord extends BaseStoryBibleRecord {
  ruleType: string | null;
  rankLevelName: string;
  rankOrder: number;
  advancementConditions: string | null;
  limitsCosts: string | null;
  knownUsers: string[];
  contradictionChecks: string | null;
  notes: string | null;
}

export interface PowerSystemRuleInput {
  bookId: string;
  ruleType?: string | null;
  rankLevelName: string;
  rankOrder?: number;
  advancementConditions?: string | null;
  limitsCosts?: string | null;
  knownUsers?: string[];
  contradictionChecks?: string | null;
  notes?: string | null;
  tags?: string[];
  importance?: number;
  relatedChapterIds?: string[];
}

export interface TimelineEventRecord extends BaseStoryBibleRecord {
  chapterId: string | null;
  eventIndex: number;
  title: string;
  content: string;
}

export interface TimelineEventInput {
  bookId: string;
  chapterId?: string | null;
  eventIndex?: number;
  title: string;
  content: string;
  tags?: string[];
  importance?: number;
  relatedChapterIds?: string[];
}

export interface ForeshadowingRecord extends BaseStoryBibleRecord {
  seedChapterId: string | null;
  hintText: string;
  expectedPayoffChapterId: string | null;
  status: "seeded" | "developing" | "paid_off" | "abandoned";
  relatedEntities: string[];
  payoffNotes: string | null;
}

export interface ForeshadowingInput {
  bookId: string;
  seedChapterId?: string | null;
  hintText: string;
  expectedPayoffChapterId?: string | null;
  status?: "seeded" | "developing" | "paid_off" | "abandoned";
  relatedEntities?: string[];
  payoffNotes?: string | null;
  tags?: string[];
  importance?: number;
  relatedChapterIds?: string[];
}

export interface UnresolvedHookRecord extends BaseStoryBibleRecord {
  sourceChapterId: string | null;
  hookText: string;
  urgency: string | null;
  expectedResolutionWindow: string | null;
  status: string;
  notes: string | null;
}

export interface UnresolvedHookInput {
  bookId: string;
  sourceChapterId?: string | null;
  hookText: string;
  urgency?: string | null;
  expectedResolutionWindow?: string | null;
  status?: string;
  notes?: string | null;
  tags?: string[];
  importance?: number;
  relatedChapterIds?: string[];
}

export interface StyleGuideRecord extends BaseStoryBibleRecord {
  title: string;
  content: string;
  genre: string | null;
  tone: string | null;
  pacingRules: string | null;
  forbiddenCliches: string | null;
  preferredSentencePatterns: string | null;
  dialogueStyle: string | null;
  chapterEndingPattern: string | null;
  examples: string | null;
}

export interface StyleGuideInput {
  bookId: string;
  title?: string;
  content?: string;
  genre?: string | null;
  tone?: string | null;
  pacingRules?: string | null;
  forbiddenCliches?: string | null;
  preferredSentencePatterns?: string | null;
  dialogueStyle?: string | null;
  chapterEndingPattern?: string | null;
  examples?: string | null;
  tags?: string[];
  importance?: number;
  relatedChapterIds?: string[];
}

export interface ReaderPositioningRecord extends BaseStoryBibleRecord {
  title: string;
  content: string;
  targetReader: string | null;
  platformStyle: string | null;
  genreExpectation: string | null;
  emotionalPromise: string | null;
  updateCadenceNotes: string | null;
  commercialConstraints: string | null;
}

export interface ReaderPositioningInput {
  bookId: string;
  title?: string;
  content?: string;
  targetReader?: string | null;
  platformStyle?: string | null;
  genreExpectation?: string | null;
  emotionalPromise?: string | null;
  updateCadenceNotes?: string | null;
  commercialConstraints?: string | null;
  tags?: string[];
  importance?: number;
  relatedChapterIds?: string[];
}

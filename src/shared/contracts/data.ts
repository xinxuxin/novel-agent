export interface ProjectRecord {
  id: string;
  name: string;
  description: string | null;
  genre: string | null;
  targetReader: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface BookRecord {
  id: string;
  projectId: string;
  title: string;
  logline: string | null;
  genre: string | null;
  targetLengthChapters: number | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface VolumeRecord {
  id: string;
  bookId: string;
  title: string;
  volumeIndex: number;
  summary: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChapterRecord {
  id: string;
  bookId: string;
  volumeId: string | null;
  chapterIndex: number;
  title: string;
  status: string;
  targetWords: number;
  currentWords: number;
  summary: string | null;
  outlineJson: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ManuscriptVersionRecord {
  id: string;
  chapterId: string;
  parentVersionId: string | null;
  versionIndex: number;
  branchLabel: string | null;
  title: string;
  contentMarkdown: string;
  contentPlaintext: string;
  sourceType: "manual" | "generated" | "imported" | "restored";
  generationRunId: string | null;
  isCanonical: boolean;
  wordCount: number;
  characterCount: number;
  createdAt: string;
}

export interface StoryBibleEntryRecord {
  id: string;
  bookId: string;
  chapterId: string | null;
  entryType: string;
  title: string;
  content: string;
  provenance: string;
  sourceRunId: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface MemorySearchResult {
  sourceType: string;
  sourceId: string;
  title: string;
  content: string;
  summary?: string | null | undefined;
  tags?: string[] | undefined;
  importance?: number | undefined;
  score?: number | undefined;
}

export interface CreateProjectInput {
  name: string;
  description?: string;
  genre?: string;
  targetReader?: string;
}

export interface CreateBookInput {
  projectId: string;
  title: string;
  logline?: string;
  genre?: string;
  targetLengthChapters?: number;
  status?: string;
}

export interface CreateVolumeInput {
  bookId: string;
  title: string;
  volumeIndex: number;
  summary?: string;
  status?: string;
}

export interface CreateChapterInput {
  bookId: string;
  volumeId?: string | null;
  chapterIndex: number;
  title: string;
  targetWords?: number;
  status?: string;
}

export interface UpdateChapterInput {
  volumeId?: string | null;
  chapterIndex?: number;
  title?: string;
  status?: string;
  targetWords?: number;
  summary?: string | null;
  outlineJson?: string | null;
}

export interface SaveManualVersionInput {
  chapterId: string;
  parentVersionId?: string | null;
  title: string;
  contentMarkdown: string;
  isCanonical?: boolean;
}

export interface CreateStoryBibleEntryInput {
  bookId: string;
  chapterId?: string | null;
  entryType: string;
  title: string;
  content: string;
}

export interface UpdateStoryBibleEntryInput {
  entryType?: string;
  title?: string;
  content?: string;
  status?: string;
}

import type { RepositoryRegistry } from "@main/db/service";
import type {
  CreateMemoryChunkInput,
  MemoryChunkRecord,
  MemorySearchOptions,
  MemorySearchResult
} from "@main/db/repositories/memory-repository";
import { TokenEstimator } from "@main/ai/token-estimator";

const STORY_BIBLE_SOURCE_TYPES = [
  "story_bible_entry",
  "character",
  "faction",
  "location",
  "artifact",
  "power_system",
  "timeline",
  "foreshadowing",
  "unresolved_hook",
  "style_guide",
  "reader_positioning"
];

const MANUSCRIPT_SOURCE_TYPES = ["canonical_manuscript", "chapter_summary"];

export class MemoryIndexService {
  private readonly tokenEstimator = new TokenEstimator();

  constructor(private readonly repositories: RepositoryRegistry) {}

  upsertChunk(input: CreateMemoryChunkInput): MemoryChunkRecord {
    return this.repositories.memory.upsertChunk({
      ...input,
      tokenEstimate: input.tokenEstimate ?? this.tokenEstimator.estimateText(input.content)
    });
  }

  deleteChunk(id: string): boolean {
    return this.repositories.memory.deleteChunk(id);
  }

  searchRelevantChunks(options: MemorySearchOptions): MemorySearchResult[] {
    return this.repositories.memory.searchRelevant(options);
  }

  rebuildBookIndex(bookId: string): void {
    this.rebuildFromStoryBible(bookId);
    this.rebuildFromCanonicalManuscripts(bookId);
    this.rebuildFromChapterSummaries(bookId);
  }

  rebuildFromStoryBible(bookId: string): void {
    this.repositories.memory.deleteBookChunksBySourceTypes(bookId, STORY_BIBLE_SOURCE_TYPES);

    for (const entry of this.repositories.storyBible
      .list(bookId)
      .filter((item) => item.status === "active")) {
      this.upsertChunk({
        bookId,
        chapterId: entry.chapterId,
        sourceType: "story_bible_entry",
        sourceId: entry.id,
        title: entry.title,
        content: entry.content,
        tagsJson: JSON.stringify([entry.entryType]),
        importance: 5
      });
    }

    for (const character of this.repositories.storyBible.listCharacters({ bookId })) {
      this.upsertChunk({
        bookId,
        chapterId: character.firstAppearanceChapterId,
        sourceType: "character",
        sourceId: character.id,
        title: character.name,
        content: [
          character.role,
          character.summary,
          character.currentState,
          character.goal,
          character.motivation,
          character.secret,
          character.contradiction,
          character.relationshipNotes,
          character.speakingStyle,
          character.forbiddenInconsistencies
        ]
          .filter(Boolean)
          .join("\n"),
        tagsJson: JSON.stringify(character.tags),
        importance: character.importance
      });
    }

    for (const [sourceType, records] of [
      ["faction", this.repositories.storyBible.listFactions({ bookId })],
      ["location", this.repositories.storyBible.listLocations({ bookId })],
      ["artifact", this.repositories.storyBible.listArtifacts({ bookId })]
    ] as const) {
      for (const record of records) {
        this.upsertChunk({
          bookId,
          sourceType,
          sourceId: record.id,
          title: record.name,
          content: record.summary ?? record.name,
          tagsJson: JSON.stringify(record.tags),
          importance: record.importance
        });
      }
    }

    for (const rule of this.repositories.storyBible.listPowerSystem({ bookId })) {
      this.upsertChunk({
        bookId,
        sourceType: "power_system",
        sourceId: rule.id,
        title: rule.rankLevelName,
        content: [
          rule.ruleType,
          rule.advancementConditions,
          rule.limitsCosts,
          rule.contradictionChecks,
          rule.notes
        ]
          .filter(Boolean)
          .join("\n"),
        tagsJson: JSON.stringify(rule.tags),
        importance: rule.importance
      });
    }

    for (const event of this.repositories.storyBible.listTimeline({ bookId })) {
      this.upsertChunk({
        bookId,
        chapterId: event.chapterId,
        sourceType: "timeline",
        sourceId: event.id,
        title: event.title,
        content: event.content,
        tagsJson: JSON.stringify(event.tags),
        importance: event.importance
      });
    }

    for (const item of this.repositories.storyBible.listForeshadowing({ bookId })) {
      this.upsertChunk({
        bookId,
        chapterId: item.seedChapterId,
        sourceType: "foreshadowing",
        sourceId: item.id,
        title: item.hintText,
        content: [item.hintText, item.status, item.payoffNotes].filter(Boolean).join("\n"),
        tagsJson: JSON.stringify(item.tags),
        importance: item.importance
      });
    }

    for (const hook of this.repositories.storyBible.listHooks({ bookId })) {
      this.upsertChunk({
        bookId,
        chapterId: hook.sourceChapterId,
        sourceType: "unresolved_hook",
        sourceId: hook.id,
        title: hook.hookText,
        content: [hook.hookText, hook.urgency, hook.expectedResolutionWindow, hook.notes]
          .filter(Boolean)
          .join("\n"),
        tagsJson: JSON.stringify(hook.tags),
        importance: hook.importance
      });
    }

    for (const style of this.repositories.storyBible.listStyleGuides({ bookId })) {
      this.upsertChunk({
        bookId,
        sourceType: "style_guide",
        sourceId: style.id,
        title: style.title,
        content: style.content,
        tagsJson: JSON.stringify(style.tags),
        importance: style.importance
      });
    }

    for (const reader of this.repositories.storyBible.listReaderPositioning({ bookId })) {
      this.upsertChunk({
        bookId,
        sourceType: "reader_positioning",
        sourceId: reader.id,
        title: reader.title,
        content: reader.content,
        tagsJson: JSON.stringify(reader.tags),
        importance: reader.importance
      });
    }
  }

  rebuildFromCanonicalManuscripts(bookId: string): void {
    this.repositories.memory.deleteBookChunksBySourceTypes(bookId, ["canonical_manuscript"]);
    for (const chapter of this.repositories.chapters.listByBook(bookId)) {
      const canonical = this.repositories.manuscripts.getCanonical(chapter.id);
      if (!canonical) continue;
      this.upsertChunk({
        bookId,
        chapterId: chapter.id,
        sourceType: "canonical_manuscript",
        sourceId: canonical.id,
        title: `${chapter.chapterIndex}. ${chapter.title}`,
        content: canonical.contentPlaintext,
        summary: chapter.summary,
        importance: 6
      });
    }
  }

  rebuildFromChapterSummaries(bookId: string): void {
    this.repositories.memory.deleteBookChunksBySourceTypes(bookId, ["chapter_summary"]);
    for (const chapter of this.repositories.chapters
      .listByBook(bookId)
      .filter((item) => item.summary)) {
      this.upsertChunk({
        bookId,
        chapterId: chapter.id,
        sourceType: "chapter_summary",
        sourceId: chapter.id,
        title: `${chapter.chapterIndex}. ${chapter.title}`,
        content: chapter.summary ?? "",
        importance: 6
      });
    }
  }

  static storyBibleSourceTypes(): string[] {
    return STORY_BIBLE_SOURCE_TYPES;
  }

  static manuscriptSourceTypes(): string[] {
    return MANUSCRIPT_SOURCE_TYPES;
  }
}

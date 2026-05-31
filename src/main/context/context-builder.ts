import type { ContextPreviewPack, ContextPreviewRequest } from "@contracts/context";
import { DEFAULT_PRIVACY_SETTINGS } from "@contracts/settings";
import { TokenEstimator } from "@main/ai/token-estimator";
import type { WenForgeDatabase } from "@main/db/connection";
import type { RepositoryRegistry } from "@main/db/service";
import { MemoryIndexService } from "@main/memory/memory-index-service";
import { RedactionService } from "@main/security/redaction-service";

function isPresent<T>(value: T | null | undefined): value is T {
  return value !== null && typeof value !== "undefined";
}

export class ContextBuilder {
  private readonly estimator = new TokenEstimator();
  private readonly redaction = new RedactionService();
  private readonly memoryIndex: MemoryIndexService;

  constructor(
    private readonly db: WenForgeDatabase,
    private readonly repositories: RepositoryRegistry
  ) {
    this.memoryIndex = new MemoryIndexService(repositories);
  }

  previewForChapter(input: ContextPreviewRequest): ContextPreviewPack {
    const privacy = input.privacy ?? DEFAULT_PRIVACY_SETTINGS;
    const project = this.repositories.projects.get(input.projectId);
    const book = this.repositories.books.get(input.bookId);
    const volume = input.volumeId ? this.getVolume(input.volumeId) : null;
    const chapter = this.repositories.chapters.get(input.chapterId);
    const chapters = this.repositories.chapters.listByBook(input.bookId);
    const recentChapters = chapters
      .filter((item) => item.chapterIndex < (chapter?.chapterIndex ?? Number.MAX_SAFE_INTEGER))
      .slice(-Math.max(input.includeRecentChapters, 0));
    const styleGuides = this.repositories.storyBible.listStyleGuides({ bookId: input.bookId });
    const readerPositioning = this.repositories.storyBible.listReaderPositioning({
      bookId: input.bookId
    });
    const acceptedMaterialDigest = this.getAcceptedMaterialDigestText(input.bookId);
    const activeSettingFile = this.repositories.planning.getActiveBookSettingFile(input.bookId);
    const acceptedChapterPlan = chapter
      ? this.repositories.planning.getAcceptedChapterPlan(chapter.id)
      : null;
    const memoryQuery = [chapter?.title, chapter?.summary, input.userInstruction]
      .filter(Boolean)
      .join(" ");
    const retrievedMemoryChunks = memoryQuery
      ? this.memoryIndex.searchRelevantChunks({
          bookId: input.bookId,
          query: memoryQuery,
          sourceTypes: [
            ...MemoryIndexService.storyBibleSourceTypes(),
            "canonical_manuscript",
            "chapter_summary"
          ],
          minImportance: 4,
          limit: 8
        })
      : [];

    const omissions: string[] = [];
    const truncationNotes: string[] = [];
    const includeFullRecent =
      input.includeFullRecentChapters && privacy.allowSendingFullRecentChapters;
    if (input.includeFullRecentChapters && !privacy.allowSendingFullRecentChapters) {
      omissions.push("Full recent chapters omitted by privacy setting");
    }

    const pack: ContextPreviewPack = {
      projectBrief: this.redact(
        [project?.name, project?.description, project?.genre, project?.targetReader]
          .filter(Boolean)
          .join("\n")
      ),
      bookPremise: this.redact(
        [
          book?.title,
          book?.logline,
          book?.genre,
          activeSettingFile
            ? `活动设定文件：${activeSettingFile.title}\n${activeSettingFile.contentPlaintext}`
            : null,
          acceptedMaterialDigest
        ]
          .filter(Boolean)
          .join("\n")
      ),
      volumeGoal: this.redact(volume?.summary ?? volume?.title ?? ""),
      currentChapterMetadata: this.redact(
        [
          chapter?.title,
          chapter?.status,
          chapter?.summary,
          `targetWords=${chapter?.targetWords ?? 0}`,
          input.userInstruction ? `instruction=${input.userInstruction}` : null
        ]
          .filter(Boolean)
          .join("\n")
      ),
      currentChapterOutline: acceptedChapterPlan
        ? {
            plan_id: acceptedChapterPlan.id,
            title: acceptedChapterPlan.title,
            target_words: acceptedChapterPlan.targetWords,
            min_words: acceptedChapterPlan.minWords,
            max_words: acceptedChapterPlan.maxWords,
            word_count_priority: acceptedChapterPlan.wordCountPriority,
            outline_text: acceptedChapterPlan.outlineText ?? acceptedChapterPlan.chapterSummary,
            opening_hook: acceptedChapterPlan.openingHook,
            key_events: this.safeJson(acceptedChapterPlan.keyEventsJson),
            main_conflict: acceptedChapterPlan.mainConflict,
            emotional_turn: acceptedChapterPlan.emotionalTurn,
            payoff: acceptedChapterPlan.payoff,
            ending_hook: acceptedChapterPlan.endingHook,
            must_include: this.safeJson(acceptedChapterPlan.mustIncludeJson),
            must_avoid: this.safeJson(acceptedChapterPlan.mustAvoidJson),
            continuity_notes: this.safeJson(acceptedChapterPlan.continuityDependenciesJson),
            user_notes: acceptedChapterPlan.userNotes
          }
        : chapter?.outlineJson
          ? this.safeJson(chapter.outlineJson)
          : null,
      sceneCards: this.getSceneCards(input.chapterId),
      readerPositioning: this.redact(readerPositioning.map((item) => item.content).join("\n\n")),
      styleGuide: this.redact(styleGuides.map((item) => item.content).join("\n\n")),
      relevantCharacters: this.repositories.storyBible
        .listCharacters({ bookId: input.bookId })
        .slice(0, 8)
        .map((item) => this.redact(`${item.name}: ${item.currentState ?? item.summary ?? ""}`)),
      relevantFactions: this.repositories.storyBible
        .listFactions({ bookId: input.bookId })
        .slice(0, 6)
        .map((item) => this.redact(`${item.name}: ${item.summary ?? ""}`)),
      relevantLocations: this.repositories.storyBible
        .listLocations({ bookId: input.bookId })
        .slice(0, 6)
        .map((item) => this.redact(`${item.name}: ${item.summary ?? ""}`)),
      relevantArtifacts: this.repositories.storyBible
        .listArtifacts({ bookId: input.bookId })
        .slice(0, 6)
        .map((item) => this.redact(`${item.name}: ${item.summary ?? ""}`)),
      powerSystemDigest: this.redact(
        this.repositories.storyBible
          .listPowerSystem({ bookId: input.bookId })
          .slice(0, 8)
          .map((item) => `${item.rankLevelName}: ${item.advancementConditions ?? item.notes ?? ""}`)
          .join("\n")
      ),
      timelineDigest: this.redact(
        this.repositories.storyBible
          .listTimeline({ bookId: input.bookId })
          .slice(0, 10)
          .map((item) => `${item.eventIndex}. ${item.title}: ${item.content}`)
          .join("\n")
      ),
      foreshadowingDigest: this.redact(
        this.repositories.storyBible
          .listForeshadowing({ bookId: input.bookId })
          .filter((item) => item.status !== "abandoned")
          .slice(0, 8)
          .map((item) => `${item.status}: ${item.hintText}`)
          .join("\n")
      ),
      unresolvedHooks: this.repositories.storyBible
        .listHooks({ bookId: input.bookId })
        .filter((item) => item.status !== "closed")
        .slice(0, 8)
        .map((item) => this.redact(`${item.urgency ?? "normal"}: ${item.hookText}`)),
      recentChapterSummaries: recentChapters
        .map((item) =>
          this.redact(`${item.chapterIndex}. ${item.title}: ${item.summary ?? "No summary"}`)
        )
        .filter((item): item is string => Boolean(item)),
      recentChapterExcerpts: includeFullRecent
        ? recentChapters
            .map((item) => this.repositories.manuscripts.getCanonical(item.id))
            .filter(isPresent)
            .map((item) => this.redact(item.contentPlaintext.slice(0, 1200)))
        : [],
      retrievedMemoryChunks: retrievedMemoryChunks
        .filter((item) => !["settlement_proposal", "generated_artifact"].includes(item.sourceType))
        .map((item) => ({
          sourceType: item.sourceType,
          sourceId: item.sourceId,
          title: this.redact(item.title),
          content: this.redact(item.content),
          score: item.score ?? 0
        })),
      continuityWarnings: [
        chapter?.summary ? "" : "Current chapter is missing a summary",
        styleGuides.length > 0 ? "" : "No active style guide found",
        readerPositioning.length > 0 ? "" : "No reader positioning found"
      ].filter((item): item is string => Boolean(item)),
      omissions,
      truncationNotes,
      estimatedTokens: 0
    };

    return this.enforceBudget(pack, input.targetTokenBudget);
  }

  private enforceBudget(pack: ContextPreviewPack, targetTokenBudget: number): ContextPreviewPack {
    let next = this.withEstimate(pack);
    if (next.estimatedTokens <= targetTokenBudget) return next;

    next = {
      ...next,
      retrievedMemoryChunks: next.retrievedMemoryChunks.slice(0, 3),
      truncationNotes: [...next.truncationNotes, "Retrieved memory chunks truncated to fit budget"]
    };
    next = this.withEstimate(next);
    if (next.estimatedTokens <= targetTokenBudget) return next;

    next = {
      ...next,
      recentChapterExcerpts: [],
      truncationNotes: [...next.truncationNotes, "Recent chapter excerpts omitted to fit budget"]
    };
    next = this.withEstimate(next);
    if (next.estimatedTokens <= targetTokenBudget) return next;

    next = {
      ...next,
      relevantCharacters: next.relevantCharacters.slice(0, 2),
      relevantFactions: next.relevantFactions.slice(0, 1),
      relevantLocations: next.relevantLocations.slice(0, 1),
      relevantArtifacts: next.relevantArtifacts.slice(0, 1),
      powerSystemDigest: next.powerSystemDigest.slice(0, 160),
      timelineDigest: next.timelineDigest.slice(0, 160),
      foreshadowingDigest: next.foreshadowingDigest.slice(0, 160),
      unresolvedHooks: next.unresolvedHooks.slice(0, 2),
      truncationNotes: [...next.truncationNotes, "Secondary story bible sections shortened"]
    };
    next = this.withEstimate(next);
    if (next.estimatedTokens <= targetTokenBudget) return next;

    next = {
      ...next,
      styleGuide: next.styleGuide.slice(0, 120),
      readerPositioning: next.readerPositioning.slice(0, 120),
      recentChapterSummaries: next.recentChapterSummaries.slice(0, 1),
      truncationNotes: [
        ...next.truncationNotes,
        "Required policy sections shortened under tight budget"
      ]
    };
    next = this.withEstimate(next);
    return {
      ...next,
      estimatedTokens: Math.min(next.estimatedTokens, targetTokenBudget)
    };
  }

  private withEstimate(pack: ContextPreviewPack): ContextPreviewPack {
    return {
      ...pack,
      estimatedTokens: this.estimator.estimateText(JSON.stringify({ ...pack, estimatedTokens: 0 }))
    };
  }

  private getVolume(id: string): { id: string; title: string; summary: string | null } | null {
    const row = this.db.sqlite
      .prepare("select id, title, summary from volumes where id = ?")
      .get(id) as { id: string; title: string; summary: string | null } | undefined;
    return row ?? null;
  }

  private getSceneCards(chapterId: string): unknown[] {
    return this.db.sqlite
      .prepare("select raw_card_json from scenes where chapter_id = ? order by scene_index asc")
      .all(chapterId)
      .map((row) =>
        this.safeJson(String((row as { raw_card_json: string | null }).raw_card_json ?? "{}"))
      );
  }

  private getAcceptedMaterialDigestText(bookId: string): string {
    const digest = this.repositories.planning
      .listMaterialDigests(bookId)
      .find((item) => Boolean(item.acceptedAt));
    if (!digest) return "";
    const data = this.safeJson(digest.digestJson);
    if (!data || typeof data !== "object") return digest.digestJson.slice(0, 1200);
    return Object.entries(data as Record<string, unknown>)
      .map(([key, value]) => {
        const rendered = Array.isArray(value) ? value.join("；") : String(value ?? "");
        return `${key}: ${rendered}`;
      })
      .join("\n")
      .slice(0, 1200);
  }

  private safeJson(value: string): unknown | null {
    try {
      return JSON.parse(value) as unknown;
    } catch {
      return null;
    }
  }

  private redact(value: string): string {
    return this.redaction.redact(value);
  }
}

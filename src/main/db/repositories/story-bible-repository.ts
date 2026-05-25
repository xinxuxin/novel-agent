import type { WenForgeDatabase } from "@main/db/connection";
import { createId } from "@main/db/id";
import { nowIso } from "./types";

export interface StoryBibleListQuery {
  bookId: string;
  query?: string;
  tags?: string[];
  chapterId?: string | null;
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

export interface CreateStoryBibleEntryInput {
  bookId: string;
  chapterId?: string | null | undefined;
  entryType: string;
  title: string;
  content: string;
  provenance?: string | undefined;
  sourceRunId?: string | null | undefined;
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

export type NamedEntityInput = {
  bookId: string;
  name: string;
  summary?: string | null;
  tags?: string[];
  importance?: number;
  relatedChapterIds?: string[];
};

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

function jsonArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value !== "string" || value.length === 0) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function stringOrNull(value: unknown): string | null {
  return value === null || typeof value === "undefined" ? null : String(value);
}

function shared(row: Record<string, unknown>): BaseStoryBibleRecord {
  return {
    id: String(row.id),
    bookId: String(row.book_id),
    tags: jsonArray(row.tags_json),
    importance: Number(row.importance ?? 5),
    relatedChapterIds: jsonArray(row.related_chapter_ids_json),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

function bindJson(value: string[] | undefined, fallback: string[] = []): string {
  return JSON.stringify(value ?? fallback);
}

function filterByQueryAndTags<T extends { tags: string[] }>(
  rows: T[],
  query?: string,
  tags?: string[]
): T[] {
  const needle = query?.trim().toLowerCase();
  return rows.filter((row) => {
    const searchable = JSON.stringify(row).toLowerCase();
    const queryMatches = !needle || searchable.includes(needle);
    const tagsMatch = !tags?.length || tags.every((tag) => row.tags.includes(tag));
    return queryMatches && tagsMatch;
  });
}

function mapEntry(row: Record<string, unknown>): StoryBibleEntryRecord {
  return {
    id: String(row.id),
    bookId: String(row.book_id),
    chapterId: stringOrNull(row.chapter_id),
    entryType: String(row.entry_type),
    title: String(row.title),
    content: String(row.content),
    provenance: String(row.provenance),
    sourceRunId: stringOrNull(row.source_run_id),
    status: String(row.status),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

export class StoryBibleRepository {
  constructor(private readonly db: WenForgeDatabase) {}

  list(bookId: string): StoryBibleEntryRecord[] {
    return this.db.sqlite
      .prepare("select * from story_bible_entries where book_id = ? order by updated_at desc")
      .all(bookId)
      .map((row) => mapEntry(row as Record<string, unknown>));
  }

  createEntry(input: CreateStoryBibleEntryInput): StoryBibleEntryRecord {
    const now = nowIso();
    const row = {
      id: createId("bible"),
      bookId: input.bookId,
      chapterId: input.chapterId ?? null,
      entryType: input.entryType,
      title: input.title,
      content: input.content,
      provenance: input.provenance ?? "manual",
      sourceRunId: input.sourceRunId ?? null,
      status: "active",
      createdAt: now,
      updatedAt: now
    };
    this.db.sqlite
      .prepare(
        `insert into story_bible_entries
        (id, book_id, chapter_id, entry_type, title, content, provenance, source_run_id, status, created_at, updated_at)
        values (@id, @bookId, @chapterId, @entryType, @title, @content, @provenance, @sourceRunId, @status, @createdAt, @updatedAt)`
      )
      .run(row);
    this.indexSearch(row.bookId, "story_bible_entry", row.id, row.title, row.content, null);
    return row;
  }

  update(id: string, input: Partial<CreateStoryBibleEntryInput>): StoryBibleEntryRecord | null {
    const existing = this.db.sqlite
      .prepare("select * from story_bible_entries where id = ?")
      .get(id) as Record<string, unknown> | undefined;
    if (!existing) return null;
    const current = mapEntry(existing);
    const updated = {
      id,
      chapterId: input.chapterId ?? current.chapterId,
      entryType: input.entryType ?? current.entryType,
      title: input.title ?? current.title,
      content: input.content ?? current.content,
      provenance: input.provenance ?? current.provenance,
      sourceRunId: input.sourceRunId ?? current.sourceRunId,
      updatedAt: nowIso()
    };
    this.db.sqlite
      .prepare(
        `update story_bible_entries set chapter_id = @chapterId, entry_type = @entryType,
        title = @title, content = @content, provenance = @provenance, source_run_id = @sourceRunId,
        updated_at = @updatedAt where id = @id`
      )
      .run(updated);
    this.indexSearch(current.bookId, "story_bible_entry", id, updated.title, updated.content, null);
    return this.getEntry(id);
  }

  getEntry(id: string): StoryBibleEntryRecord | null {
    const row = this.db.sqlite.prepare("select * from story_bible_entries where id = ?").get(id);
    return row ? mapEntry(row as Record<string, unknown>) : null;
  }

  delete(id: string, confirmed = false): boolean {
    if (!confirmed) return false;
    return (
      this.db.sqlite.prepare("delete from story_bible_entries where id = ?").run(id).changes > 0
    );
  }

  listCharacters(query: StoryBibleListQuery): CharacterRecord[] {
    const rows = this.db.sqlite
      .prepare(
        "select * from characters where book_id = ? order by importance desc, updated_at desc"
      )
      .all(query.bookId)
      .map((row) => this.mapCharacter(row as Record<string, unknown>));
    return filterByQueryAndTags(rows, query.query, query.tags);
  }

  createCharacter(input: CharacterInput): CharacterRecord {
    const now = nowIso();
    const row = {
      id: createId("character"),
      bookId: input.bookId,
      name: input.name,
      aliasesJson: bindJson(input.aliases),
      role: input.role ?? null,
      firstAppearanceChapterId: input.firstAppearanceChapterId ?? null,
      summary: input.summary ?? null,
      currentState: input.currentState ?? null,
      goal: input.goal ?? null,
      motivation: input.motivation ?? null,
      secret: input.secret ?? null,
      contradiction: input.contradiction ?? null,
      relationshipNotes: input.relationshipNotes ?? null,
      speakingStyle: input.speakingStyle ?? null,
      forbiddenInconsistencies: input.forbiddenInconsistencies ?? null,
      tagsJson: bindJson(input.tags),
      importance: input.importance ?? 5,
      relatedChapterIdsJson: bindJson(input.relatedChapterIds),
      createdAt: now,
      updatedAt: now
    };
    this.db.sqlite
      .prepare(
        `insert into characters
        (id, book_id, name, aliases_json, role, first_appearance_chapter_id, summary, current_state,
          goal, motivation, secret, contradiction, relationship_notes, speaking_style,
          forbidden_inconsistencies, tags_json, importance, related_chapter_ids_json, created_at, updated_at)
        values (@id, @bookId, @name, @aliasesJson, @role, @firstAppearanceChapterId, @summary,
          @currentState, @goal, @motivation, @secret, @contradiction, @relationshipNotes,
          @speakingStyle, @forbiddenInconsistencies, @tagsJson, @importance, @relatedChapterIdsJson,
          @createdAt, @updatedAt)`
      )
      .run(row);
    return this.getCharacter(row.id) as CharacterRecord;
  }

  updateCharacter(id: string, input: Partial<CharacterInput>): CharacterRecord | null {
    const current = this.getCharacter(id);
    if (!current) return null;
    const updated = {
      id,
      name: input.name ?? current.name,
      aliasesJson: bindJson(input.aliases, current.aliases),
      role: input.role ?? current.role,
      firstAppearanceChapterId: input.firstAppearanceChapterId ?? current.firstAppearanceChapterId,
      summary: input.summary ?? current.summary,
      currentState: input.currentState ?? current.currentState,
      goal: input.goal ?? current.goal,
      motivation: input.motivation ?? current.motivation,
      secret: input.secret ?? current.secret,
      contradiction: input.contradiction ?? current.contradiction,
      relationshipNotes: input.relationshipNotes ?? current.relationshipNotes,
      speakingStyle: input.speakingStyle ?? current.speakingStyle,
      forbiddenInconsistencies: input.forbiddenInconsistencies ?? current.forbiddenInconsistencies,
      tagsJson: bindJson(input.tags, current.tags),
      importance: input.importance ?? current.importance,
      relatedChapterIdsJson: bindJson(input.relatedChapterIds, current.relatedChapterIds),
      updatedAt: nowIso()
    };
    this.db.sqlite
      .prepare(
        `update characters set name = @name, aliases_json = @aliasesJson, role = @role,
        first_appearance_chapter_id = @firstAppearanceChapterId, summary = @summary,
        current_state = @currentState, goal = @goal, motivation = @motivation, secret = @secret,
        contradiction = @contradiction, relationship_notes = @relationshipNotes,
        speaking_style = @speakingStyle, forbidden_inconsistencies = @forbiddenInconsistencies,
        tags_json = @tagsJson, importance = @importance, related_chapter_ids_json = @relatedChapterIdsJson,
        updated_at = @updatedAt where id = @id`
      )
      .run(updated);
    return this.getCharacter(id);
  }

  getCharacter(id: string): CharacterRecord | null {
    const row = this.db.sqlite.prepare("select * from characters where id = ?").get(id);
    return row ? this.mapCharacter(row as Record<string, unknown>) : null;
  }

  deleteCharacter(id: string, confirmed = false): boolean {
    return this.deleteFromTable("characters", id, confirmed);
  }

  listFactions(query: StoryBibleListQuery): NamedStoryBibleRecord[] {
    return this.listNamed("factions", query);
  }
  createFaction(input: NamedEntityInput): NamedStoryBibleRecord {
    return this.createNamed("faction", "factions", input);
  }
  updateFaction(id: string, input: Partial<NamedEntityInput>): NamedStoryBibleRecord | null {
    return this.updateNamed("factions", id, input);
  }
  deleteFaction(id: string, confirmed = false): boolean {
    return this.deleteFromTable("factions", id, confirmed);
  }

  listLocations(query: StoryBibleListQuery): NamedStoryBibleRecord[] {
    return this.listNamed("locations", query);
  }
  createLocation(input: NamedEntityInput): NamedStoryBibleRecord {
    return this.createNamed("location", "locations", input);
  }
  updateLocation(id: string, input: Partial<NamedEntityInput>): NamedStoryBibleRecord | null {
    return this.updateNamed("locations", id, input);
  }
  deleteLocation(id: string, confirmed = false): boolean {
    return this.deleteFromTable("locations", id, confirmed);
  }

  listArtifacts(query: StoryBibleListQuery): NamedStoryBibleRecord[] {
    return this.listNamed("artifacts", query);
  }
  createArtifact(input: NamedEntityInput): NamedStoryBibleRecord {
    return this.createNamed("artifact", "artifacts", input);
  }
  updateArtifact(id: string, input: Partial<NamedEntityInput>): NamedStoryBibleRecord | null {
    return this.updateNamed("artifacts", id, input);
  }
  deleteArtifact(id: string, confirmed = false): boolean {
    return this.deleteFromTable("artifacts", id, confirmed);
  }

  listPowerSystem(query: StoryBibleListQuery): PowerSystemRuleRecord[] {
    const rows = this.db.sqlite
      .prepare(
        "select * from power_system_rules where book_id = ? order by rank_order asc, importance desc"
      )
      .all(query.bookId)
      .map((row) => this.mapPowerSystem(row as Record<string, unknown>));
    return filterByQueryAndTags(rows, query.query, query.tags);
  }

  createPowerSystemRule(input: PowerSystemRuleInput): PowerSystemRuleRecord {
    const now = nowIso();
    const row = {
      id: createId("power"),
      bookId: input.bookId,
      ruleType: input.ruleType ?? null,
      rankLevelName: input.rankLevelName,
      rankOrder: input.rankOrder ?? 0,
      advancementConditions: input.advancementConditions ?? null,
      limitsCosts: input.limitsCosts ?? null,
      knownUsersJson: bindJson(input.knownUsers),
      contradictionChecks: input.contradictionChecks ?? null,
      notes: input.notes ?? null,
      title: input.rankLevelName,
      content: [input.advancementConditions, input.limitsCosts, input.notes]
        .filter(Boolean)
        .join("\n"),
      tagsJson: bindJson(input.tags),
      importance: input.importance ?? 5,
      relatedChapterIdsJson: bindJson(input.relatedChapterIds),
      createdAt: now,
      updatedAt: now
    };
    this.db.sqlite
      .prepare(
        `insert into power_system_rules
        (id, book_id, rule_type, rank_level_name, rank_order, advancement_conditions, limits_costs,
          known_users_json, contradiction_checks, notes, title, content, tags_json, importance,
          related_chapter_ids_json, created_at, updated_at)
        values (@id, @bookId, @ruleType, @rankLevelName, @rankOrder, @advancementConditions,
          @limitsCosts, @knownUsersJson, @contradictionChecks, @notes, @title, @content,
          @tagsJson, @importance, @relatedChapterIdsJson, @createdAt, @updatedAt)`
      )
      .run(row);
    return this.getPowerSystemRule(row.id) as PowerSystemRuleRecord;
  }

  updatePowerSystemRule(
    id: string,
    input: Partial<PowerSystemRuleInput>
  ): PowerSystemRuleRecord | null {
    const current = this.getPowerSystemRule(id);
    if (!current) return null;
    const row = {
      id,
      ruleType: input.ruleType ?? current.ruleType,
      rankLevelName: input.rankLevelName ?? current.rankLevelName,
      rankOrder: input.rankOrder ?? current.rankOrder,
      advancementConditions: input.advancementConditions ?? current.advancementConditions,
      limitsCosts: input.limitsCosts ?? current.limitsCosts,
      knownUsersJson: bindJson(input.knownUsers, current.knownUsers),
      contradictionChecks: input.contradictionChecks ?? current.contradictionChecks,
      notes: input.notes ?? current.notes,
      title: input.rankLevelName ?? current.rankLevelName,
      content: [
        input.advancementConditions ?? current.advancementConditions,
        input.limitsCosts ?? current.limitsCosts,
        input.notes ?? current.notes
      ]
        .filter(Boolean)
        .join("\n"),
      tagsJson: bindJson(input.tags, current.tags),
      importance: input.importance ?? current.importance,
      relatedChapterIdsJson: bindJson(input.relatedChapterIds, current.relatedChapterIds),
      updatedAt: nowIso()
    };
    this.db.sqlite
      .prepare(
        `update power_system_rules set rule_type = @ruleType, rank_level_name = @rankLevelName,
        rank_order = @rankOrder, advancement_conditions = @advancementConditions,
        limits_costs = @limitsCosts, known_users_json = @knownUsersJson,
        contradiction_checks = @contradictionChecks, notes = @notes, title = @title,
        content = @content, tags_json = @tagsJson, importance = @importance,
        related_chapter_ids_json = @relatedChapterIdsJson, updated_at = @updatedAt where id = @id`
      )
      .run(row);
    return this.getPowerSystemRule(id);
  }

  getPowerSystemRule(id: string): PowerSystemRuleRecord | null {
    const row = this.db.sqlite.prepare("select * from power_system_rules where id = ?").get(id);
    return row ? this.mapPowerSystem(row as Record<string, unknown>) : null;
  }

  deletePowerSystemRule(id: string, confirmed = false): boolean {
    return this.deleteFromTable("power_system_rules", id, confirmed);
  }

  listTimeline(query: StoryBibleListQuery): TimelineEventRecord[] {
    const rows = this.db.sqlite
      .prepare("select * from timeline_events where book_id = ? order by event_index asc")
      .all(query.bookId)
      .map((row) => this.mapTimeline(row as Record<string, unknown>));
    return filterByQueryAndTags(rows, query.query, query.tags);
  }

  createTimelineEvent(input: TimelineEventInput): TimelineEventRecord {
    const now = nowIso();
    const row = {
      id: createId("timeline"),
      bookId: input.bookId,
      chapterId: input.chapterId ?? null,
      eventIndex: input.eventIndex ?? 0,
      title: input.title,
      content: input.content,
      tagsJson: bindJson(input.tags),
      importance: input.importance ?? 5,
      relatedChapterIdsJson: bindJson(input.relatedChapterIds),
      createdAt: now,
      updatedAt: now
    };
    this.db.sqlite
      .prepare(
        `insert into timeline_events
        (id, book_id, chapter_id, event_index, title, content, tags_json, importance, related_chapter_ids_json, created_at, updated_at)
        values (@id, @bookId, @chapterId, @eventIndex, @title, @content, @tagsJson, @importance, @relatedChapterIdsJson, @createdAt, @updatedAt)`
      )
      .run(row);
    return this.mapTimeline(this.rowById("timeline_events", row.id) as Record<string, unknown>);
  }

  updateTimelineEvent(id: string, input: Partial<TimelineEventInput>): TimelineEventRecord | null {
    const current = this.mapNullable("timeline_events", id, (row) => this.mapTimeline(row));
    if (!current) return null;
    this.db.sqlite
      .prepare(
        `update timeline_events set chapter_id = @chapterId, event_index = @eventIndex, title = @title,
        content = @content, tags_json = @tagsJson, importance = @importance,
        related_chapter_ids_json = @relatedChapterIdsJson, updated_at = @updatedAt where id = @id`
      )
      .run({
        id,
        chapterId: input.chapterId ?? current.chapterId,
        eventIndex: input.eventIndex ?? current.eventIndex,
        title: input.title ?? current.title,
        content: input.content ?? current.content,
        tagsJson: bindJson(input.tags, current.tags),
        importance: input.importance ?? current.importance,
        relatedChapterIdsJson: bindJson(input.relatedChapterIds, current.relatedChapterIds),
        updatedAt: nowIso()
      });
    return this.mapNullable("timeline_events", id, (row) => this.mapTimeline(row));
  }

  deleteTimelineEvent(id: string, confirmed = false): boolean {
    return this.deleteFromTable("timeline_events", id, confirmed);
  }

  listForeshadowing(query: StoryBibleListQuery): ForeshadowingRecord[] {
    const rows = this.db.sqlite
      .prepare("select * from foreshadowing_items where book_id = ? order by importance desc")
      .all(query.bookId)
      .map((row) => this.mapForeshadowing(row as Record<string, unknown>));
    return filterByQueryAndTags(rows, query.query, query.tags);
  }

  createForeshadowing(input: ForeshadowingInput): ForeshadowingRecord {
    const now = nowIso();
    const row = {
      id: createId("foreshadow"),
      bookId: input.bookId,
      chapterId: input.seedChapterId ?? null,
      seedChapterId: input.seedChapterId ?? null,
      hintText: input.hintText,
      expectedPayoffChapterId: input.expectedPayoffChapterId ?? null,
      title: input.hintText.slice(0, 80),
      content: input.hintText,
      status: input.status ?? "seeded",
      relatedEntitiesJson: bindJson(input.relatedEntities),
      payoffNotes: input.payoffNotes ?? null,
      tagsJson: bindJson(input.tags),
      importance: input.importance ?? 5,
      relatedChapterIdsJson: bindJson(input.relatedChapterIds),
      createdAt: now,
      updatedAt: now
    };
    this.db.sqlite
      .prepare(
        `insert into foreshadowing_items
        (id, book_id, chapter_id, seed_chapter_id, hint_text, expected_payoff_chapter_id, title,
          content, status, related_entities_json, payoff_notes, tags_json, importance,
          related_chapter_ids_json, created_at, updated_at)
        values (@id, @bookId, @chapterId, @seedChapterId, @hintText, @expectedPayoffChapterId,
          @title, @content, @status, @relatedEntitiesJson, @payoffNotes, @tagsJson,
          @importance, @relatedChapterIdsJson, @createdAt, @updatedAt)`
      )
      .run(row);
    return this.mapForeshadowing(
      this.rowById("foreshadowing_items", row.id) as Record<string, unknown>
    );
  }

  updateForeshadowing(id: string, input: Partial<ForeshadowingInput>): ForeshadowingRecord | null {
    const current = this.mapNullable("foreshadowing_items", id, (row) =>
      this.mapForeshadowing(row)
    );
    if (!current) return null;
    const hintText = input.hintText ?? current.hintText;
    this.db.sqlite
      .prepare(
        `update foreshadowing_items set chapter_id = @seedChapterId, seed_chapter_id = @seedChapterId,
        hint_text = @hintText, expected_payoff_chapter_id = @expectedPayoffChapterId,
        title = @title, content = @content, status = @status, related_entities_json = @relatedEntitiesJson,
        payoff_notes = @payoffNotes, tags_json = @tagsJson, importance = @importance,
        related_chapter_ids_json = @relatedChapterIdsJson, updated_at = @updatedAt where id = @id`
      )
      .run({
        id,
        seedChapterId: input.seedChapterId ?? current.seedChapterId,
        hintText,
        expectedPayoffChapterId: input.expectedPayoffChapterId ?? current.expectedPayoffChapterId,
        title: hintText.slice(0, 80),
        content: hintText,
        status: input.status ?? current.status,
        relatedEntitiesJson: bindJson(input.relatedEntities, current.relatedEntities),
        payoffNotes: input.payoffNotes ?? current.payoffNotes,
        tagsJson: bindJson(input.tags, current.tags),
        importance: input.importance ?? current.importance,
        relatedChapterIdsJson: bindJson(input.relatedChapterIds, current.relatedChapterIds),
        updatedAt: nowIso()
      });
    return this.mapNullable("foreshadowing_items", id, (row) => this.mapForeshadowing(row));
  }

  deleteForeshadowing(id: string, confirmed = false): boolean {
    return this.deleteFromTable("foreshadowing_items", id, confirmed);
  }

  listHooks(query: StoryBibleListQuery): UnresolvedHookRecord[] {
    const rows = this.db.sqlite
      .prepare("select * from unresolved_hooks where book_id = ? order by importance desc")
      .all(query.bookId)
      .map((row) => this.mapHook(row as Record<string, unknown>));
    return filterByQueryAndTags(rows, query.query, query.tags);
  }

  createUnresolvedHook(input: UnresolvedHookInput): UnresolvedHookRecord {
    const now = nowIso();
    const row = {
      id: createId("hook"),
      bookId: input.bookId,
      chapterId: input.sourceChapterId ?? null,
      sourceChapterId: input.sourceChapterId ?? null,
      hookText: input.hookText,
      urgency: input.urgency ?? null,
      expectedResolutionWindow: input.expectedResolutionWindow ?? null,
      title: input.hookText.slice(0, 80),
      content: input.hookText,
      status: input.status ?? "open",
      notes: input.notes ?? null,
      tagsJson: bindJson(input.tags),
      importance: input.importance ?? 5,
      relatedChapterIdsJson: bindJson(input.relatedChapterIds),
      createdAt: now,
      updatedAt: now
    };
    this.db.sqlite
      .prepare(
        `insert into unresolved_hooks
        (id, book_id, chapter_id, source_chapter_id, hook_text, urgency, expected_resolution_window,
          title, content, status, notes, tags_json, importance, related_chapter_ids_json, created_at, updated_at)
        values (@id, @bookId, @chapterId, @sourceChapterId, @hookText, @urgency,
          @expectedResolutionWindow, @title, @content, @status, @notes, @tagsJson, @importance,
          @relatedChapterIdsJson, @createdAt, @updatedAt)`
      )
      .run(row);
    return this.mapHook(this.rowById("unresolved_hooks", row.id) as Record<string, unknown>);
  }

  updateUnresolvedHook(
    id: string,
    input: Partial<UnresolvedHookInput>
  ): UnresolvedHookRecord | null {
    const current = this.mapNullable("unresolved_hooks", id, (row) => this.mapHook(row));
    if (!current) return null;
    const hookText = input.hookText ?? current.hookText;
    this.db.sqlite
      .prepare(
        `update unresolved_hooks set chapter_id = @sourceChapterId, source_chapter_id = @sourceChapterId,
        hook_text = @hookText, urgency = @urgency, expected_resolution_window = @expectedResolutionWindow,
        title = @title, content = @content, status = @status, notes = @notes, tags_json = @tagsJson,
        importance = @importance, related_chapter_ids_json = @relatedChapterIdsJson,
        updated_at = @updatedAt where id = @id`
      )
      .run({
        id,
        sourceChapterId: input.sourceChapterId ?? current.sourceChapterId,
        hookText,
        urgency: input.urgency ?? current.urgency,
        expectedResolutionWindow:
          input.expectedResolutionWindow ?? current.expectedResolutionWindow,
        title: hookText.slice(0, 80),
        content: hookText,
        status: input.status ?? current.status,
        notes: input.notes ?? current.notes,
        tagsJson: bindJson(input.tags, current.tags),
        importance: input.importance ?? current.importance,
        relatedChapterIdsJson: bindJson(input.relatedChapterIds, current.relatedChapterIds),
        updatedAt: nowIso()
      });
    return this.mapNullable("unresolved_hooks", id, (row) => this.mapHook(row));
  }

  deleteUnresolvedHook(id: string, confirmed = false): boolean {
    return this.deleteFromTable("unresolved_hooks", id, confirmed);
  }

  listStyleGuides(query: StoryBibleListQuery): StyleGuideRecord[] {
    const rows = this.db.sqlite
      .prepare(
        "select * from style_guides where book_id = ? order by importance desc, updated_at desc"
      )
      .all(query.bookId)
      .map((row) => this.mapStyleGuide(row as Record<string, unknown>));
    return filterByQueryAndTags(rows, query.query, query.tags);
  }

  createStyleGuide(input: StyleGuideInput): StyleGuideRecord {
    return this.upsertStyleGuide(createId("style"), input);
  }

  updateStyleGuide(id: string, input: Partial<StyleGuideInput>): StyleGuideRecord | null {
    const current = this.mapNullable("style_guides", id, (row) => this.mapStyleGuide(row));
    if (!current) return null;
    return this.upsertStyleGuide(id, { ...current, ...input, bookId: current.bookId }, true);
  }

  deleteStyleGuide(id: string, confirmed = false): boolean {
    return this.deleteFromTable("style_guides", id, confirmed);
  }

  listReaderPositioning(query: StoryBibleListQuery): ReaderPositioningRecord[] {
    const rows = this.db.sqlite
      .prepare(
        "select * from reader_positioning where book_id = ? order by importance desc, updated_at desc"
      )
      .all(query.bookId)
      .map((row) => this.mapReaderPositioning(row as Record<string, unknown>));
    return filterByQueryAndTags(rows, query.query, query.tags);
  }

  createReaderPositioning(input: ReaderPositioningInput): ReaderPositioningRecord {
    return this.upsertReaderPositioning(createId("reader"), input);
  }

  updateReaderPositioning(
    id: string,
    input: Partial<ReaderPositioningInput>
  ): ReaderPositioningRecord | null {
    const current = this.mapNullable("reader_positioning", id, (row) =>
      this.mapReaderPositioning(row)
    );
    if (!current) return null;
    return this.upsertReaderPositioning(id, { ...current, ...input, bookId: current.bookId }, true);
  }

  deleteReaderPositioning(id: string, confirmed = false): boolean {
    return this.deleteFromTable("reader_positioning", id, confirmed);
  }

  private mapCharacter(row: Record<string, unknown>): CharacterRecord {
    return {
      ...shared(row),
      name: String(row.name),
      aliases: jsonArray(row.aliases_json),
      role: stringOrNull(row.role),
      firstAppearanceChapterId: stringOrNull(row.first_appearance_chapter_id),
      summary: stringOrNull(row.summary),
      currentState: stringOrNull(row.current_state),
      goal: stringOrNull(row.goal),
      motivation: stringOrNull(row.motivation),
      secret: stringOrNull(row.secret),
      contradiction: stringOrNull(row.contradiction),
      relationshipNotes: stringOrNull(row.relationship_notes),
      speakingStyle: stringOrNull(row.speaking_style),
      forbiddenInconsistencies: stringOrNull(row.forbidden_inconsistencies)
    };
  }

  private listNamed(table: "factions" | "locations" | "artifacts", query: StoryBibleListQuery) {
    const rows = this.db.sqlite
      .prepare(`select * from ${table} where book_id = ? order by importance desc, updated_at desc`)
      .all(query.bookId)
      .map((row) => this.mapNamed(row as Record<string, unknown>));
    return filterByQueryAndTags(rows, query.query, query.tags);
  }

  private createNamed(
    idPrefix: string,
    table: "factions" | "locations" | "artifacts",
    input: NamedEntityInput
  ): NamedStoryBibleRecord {
    const now = nowIso();
    const row = {
      id: createId(idPrefix),
      bookId: input.bookId,
      name: input.name,
      summary: input.summary ?? null,
      tagsJson: bindJson(input.tags),
      importance: input.importance ?? 5,
      relatedChapterIdsJson: bindJson(input.relatedChapterIds),
      createdAt: now,
      updatedAt: now
    };
    this.db.sqlite
      .prepare(
        `insert into ${table}
        (id, book_id, name, summary, tags_json, importance, related_chapter_ids_json, created_at, updated_at)
        values (@id, @bookId, @name, @summary, @tagsJson, @importance, @relatedChapterIdsJson, @createdAt, @updatedAt)`
      )
      .run(row);
    return this.mapNamed(this.rowById(table, row.id) as Record<string, unknown>);
  }

  private updateNamed(
    table: "factions" | "locations" | "artifacts",
    id: string,
    input: Partial<NamedEntityInput>
  ): NamedStoryBibleRecord | null {
    const current = this.mapNullable(table, id, (row) => this.mapNamed(row));
    if (!current) return null;
    this.db.sqlite
      .prepare(
        `update ${table} set name = @name, summary = @summary, tags_json = @tagsJson,
        importance = @importance, related_chapter_ids_json = @relatedChapterIdsJson,
        updated_at = @updatedAt where id = @id`
      )
      .run({
        id,
        name: input.name ?? current.name,
        summary: input.summary ?? current.summary,
        tagsJson: bindJson(input.tags, current.tags),
        importance: input.importance ?? current.importance,
        relatedChapterIdsJson: bindJson(input.relatedChapterIds, current.relatedChapterIds),
        updatedAt: nowIso()
      });
    return this.mapNullable(table, id, (row) => this.mapNamed(row));
  }

  private mapNamed(row: Record<string, unknown>): NamedStoryBibleRecord {
    return {
      ...shared(row),
      name: String(row.name),
      summary: stringOrNull(row.summary)
    };
  }

  private mapPowerSystem(row: Record<string, unknown>): PowerSystemRuleRecord {
    return {
      ...shared(row),
      ruleType: stringOrNull(row.rule_type),
      rankLevelName: String(row.rank_level_name ?? row.title),
      rankOrder: Number(row.rank_order ?? 0),
      advancementConditions: stringOrNull(row.advancement_conditions),
      limitsCosts: stringOrNull(row.limits_costs),
      knownUsers: jsonArray(row.known_users_json),
      contradictionChecks: stringOrNull(row.contradiction_checks),
      notes: stringOrNull(row.notes)
    };
  }

  private mapTimeline(row: Record<string, unknown>): TimelineEventRecord {
    return {
      ...shared(row),
      chapterId: stringOrNull(row.chapter_id),
      eventIndex: Number(row.event_index ?? 0),
      title: String(row.title),
      content: String(row.content)
    };
  }

  private mapForeshadowing(row: Record<string, unknown>): ForeshadowingRecord {
    return {
      ...shared(row),
      seedChapterId: stringOrNull(row.seed_chapter_id ?? row.chapter_id),
      hintText: String(row.hint_text ?? row.content),
      expectedPayoffChapterId: stringOrNull(row.expected_payoff_chapter_id),
      status: String(row.status ?? "seeded") as ForeshadowingRecord["status"],
      relatedEntities: jsonArray(row.related_entities_json),
      payoffNotes: stringOrNull(row.payoff_notes)
    };
  }

  private mapHook(row: Record<string, unknown>): UnresolvedHookRecord {
    return {
      ...shared(row),
      sourceChapterId: stringOrNull(row.source_chapter_id ?? row.chapter_id),
      hookText: String(row.hook_text ?? row.content),
      urgency: stringOrNull(row.urgency),
      expectedResolutionWindow: stringOrNull(row.expected_resolution_window),
      status: String(row.status),
      notes: stringOrNull(row.notes)
    };
  }

  private mapStyleGuide(row: Record<string, unknown>): StyleGuideRecord {
    return {
      ...shared(row),
      title: String(row.title),
      content: String(row.content),
      genre: stringOrNull(row.genre),
      tone: stringOrNull(row.tone),
      pacingRules: stringOrNull(row.pacing_rules),
      forbiddenCliches: stringOrNull(row.forbidden_cliches),
      preferredSentencePatterns: stringOrNull(row.preferred_sentence_patterns),
      dialogueStyle: stringOrNull(row.dialogue_style),
      chapterEndingPattern: stringOrNull(row.chapter_ending_pattern),
      examples: stringOrNull(row.examples)
    };
  }

  private mapReaderPositioning(row: Record<string, unknown>): ReaderPositioningRecord {
    return {
      ...shared(row),
      title: String(row.title),
      content: String(row.content),
      targetReader: stringOrNull(row.target_reader),
      platformStyle: stringOrNull(row.platform_style),
      genreExpectation: stringOrNull(row.genre_expectation),
      emotionalPromise: stringOrNull(row.emotional_promise),
      updateCadenceNotes: stringOrNull(row.update_cadence_notes),
      commercialConstraints: stringOrNull(row.commercial_constraints)
    };
  }

  private upsertStyleGuide(
    id: string,
    input: StyleGuideInput & { id?: string },
    update = false
  ): StyleGuideRecord {
    const now = nowIso();
    const title = input.title ?? input.genre ?? "Style Guide";
    const content =
      input.content ??
      [
        input.genre && `Genre: ${input.genre}`,
        input.tone && `Tone: ${input.tone}`,
        input.pacingRules && `Pacing: ${input.pacingRules}`,
        input.forbiddenCliches && `Forbidden cliches: ${input.forbiddenCliches}`,
        input.chapterEndingPattern && `Ending: ${input.chapterEndingPattern}`,
        input.examples && `Examples: ${input.examples}`
      ]
        .filter(Boolean)
        .join("\n");
    const row = {
      id,
      bookId: input.bookId,
      title,
      content,
      genre: input.genre ?? null,
      tone: input.tone ?? null,
      pacingRules: input.pacingRules ?? null,
      forbiddenCliches: input.forbiddenCliches ?? null,
      preferredSentencePatterns: input.preferredSentencePatterns ?? null,
      dialogueStyle: input.dialogueStyle ?? null,
      chapterEndingPattern: input.chapterEndingPattern ?? null,
      examples: input.examples ?? null,
      tagsJson: bindJson(input.tags),
      importance: input.importance ?? 5,
      relatedChapterIdsJson: bindJson(input.relatedChapterIds),
      createdAt: now,
      updatedAt: now
    };
    if (update) {
      this.db.sqlite
        .prepare(
          `update style_guides set title = @title, content = @content, genre = @genre, tone = @tone,
          pacing_rules = @pacingRules, forbidden_cliches = @forbiddenCliches,
          preferred_sentence_patterns = @preferredSentencePatterns, dialogue_style = @dialogueStyle,
          chapter_ending_pattern = @chapterEndingPattern, examples = @examples, tags_json = @tagsJson,
          importance = @importance, related_chapter_ids_json = @relatedChapterIdsJson,
          updated_at = @updatedAt where id = @id`
        )
        .run(row);
    } else {
      this.db.sqlite
        .prepare(
          `insert into style_guides
          (id, book_id, title, content, genre, tone, pacing_rules, forbidden_cliches,
            preferred_sentence_patterns, dialogue_style, chapter_ending_pattern, examples,
            tags_json, importance, related_chapter_ids_json, created_at, updated_at)
          values (@id, @bookId, @title, @content, @genre, @tone, @pacingRules, @forbiddenCliches,
            @preferredSentencePatterns, @dialogueStyle, @chapterEndingPattern, @examples,
            @tagsJson, @importance, @relatedChapterIdsJson, @createdAt, @updatedAt)`
        )
        .run(row);
    }
    return this.mapStyleGuide(this.rowById("style_guides", id) as Record<string, unknown>);
  }

  private upsertReaderPositioning(
    id: string,
    input: ReaderPositioningInput & { id?: string },
    update = false
  ): ReaderPositioningRecord {
    const now = nowIso();
    const title = input.title ?? input.targetReader ?? "Reader Positioning";
    const content =
      input.content ??
      [
        input.targetReader && `Target reader: ${input.targetReader}`,
        input.platformStyle && `Platform: ${input.platformStyle}`,
        input.genreExpectation && `Expectation: ${input.genreExpectation}`,
        input.emotionalPromise && `Promise: ${input.emotionalPromise}`,
        input.updateCadenceNotes && `Cadence: ${input.updateCadenceNotes}`,
        input.commercialConstraints && `Commercial: ${input.commercialConstraints}`
      ]
        .filter(Boolean)
        .join("\n");
    const row = {
      id,
      bookId: input.bookId,
      title,
      content,
      targetReader: input.targetReader ?? null,
      platformStyle: input.platformStyle ?? null,
      genreExpectation: input.genreExpectation ?? null,
      emotionalPromise: input.emotionalPromise ?? null,
      updateCadenceNotes: input.updateCadenceNotes ?? null,
      commercialConstraints: input.commercialConstraints ?? null,
      tagsJson: bindJson(input.tags),
      importance: input.importance ?? 5,
      relatedChapterIdsJson: bindJson(input.relatedChapterIds),
      createdAt: now,
      updatedAt: now
    };
    if (update) {
      this.db.sqlite
        .prepare(
          `update reader_positioning set title = @title, content = @content,
          target_reader = @targetReader, platform_style = @platformStyle,
          genre_expectation = @genreExpectation, emotional_promise = @emotionalPromise,
          update_cadence_notes = @updateCadenceNotes, commercial_constraints = @commercialConstraints,
          tags_json = @tagsJson, importance = @importance,
          related_chapter_ids_json = @relatedChapterIdsJson, updated_at = @updatedAt where id = @id`
        )
        .run(row);
    } else {
      this.db.sqlite
        .prepare(
          `insert into reader_positioning
          (id, book_id, title, content, target_reader, platform_style, genre_expectation,
            emotional_promise, update_cadence_notes, commercial_constraints, tags_json, importance,
            related_chapter_ids_json, created_at, updated_at)
          values (@id, @bookId, @title, @content, @targetReader, @platformStyle,
            @genreExpectation, @emotionalPromise, @updateCadenceNotes, @commercialConstraints,
            @tagsJson, @importance, @relatedChapterIdsJson, @createdAt, @updatedAt)`
        )
        .run(row);
    }
    return this.mapReaderPositioning(
      this.rowById("reader_positioning", id) as Record<string, unknown>
    );
  }

  private mapNullable<T>(
    table: string,
    id: string,
    mapper: (row: Record<string, unknown>) => T
  ): T | null {
    const row = this.rowById(table, id);
    return row ? mapper(row) : null;
  }

  private rowById(table: string, id: string): Record<string, unknown> | undefined {
    return this.db.sqlite.prepare(`select * from ${table} where id = ?`).get(id) as
      | Record<string, unknown>
      | undefined;
  }

  private deleteFromTable(table: string, id: string, confirmed: boolean): boolean {
    if (!confirmed) return false;
    return this.db.sqlite.prepare(`delete from ${table} where id = ?`).run(id).changes > 0;
  }

  private indexSearch(
    bookId: string,
    sourceType: string,
    sourceId: string,
    title: string,
    content: string,
    summary: string | null
  ): void {
    try {
      this.db.sqlite
        .prepare("delete from search_index where book_id = ? and source_type = ? and source_id = ?")
        .run(bookId, sourceType, sourceId);
      this.db.sqlite
        .prepare(
          "insert into search_index (book_id, source_type, source_id, title, content, summary) values (?, ?, ?, ?, ?, ?)"
        )
        .run(bookId, sourceType, sourceId, title, content, summary);
    } catch {
      // FTS5 can be unavailable in some SQLite builds; keyword fallback still works.
    }
  }
}

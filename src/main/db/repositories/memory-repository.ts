import type { WenForgeDatabase } from "@main/db/connection";
import { createId } from "@main/db/id";
import { nowIso } from "./types";

export interface MemoryChunkRecord {
  id: string;
  bookId: string;
  chapterId: string | null;
  sourceType: string;
  sourceId: string | null;
  title: string;
  content: string;
  summary: string | null;
  tagsJson: string;
  importance: number;
  tokenEstimate: number;
  embeddingJson: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MemorySearchResult {
  sourceType: string;
  sourceId: string;
  title: string;
  content: string;
  summary?: string | null;
  tags?: string[];
  importance?: number;
  score?: number;
}

export interface CreateMemoryChunkInput {
  bookId: string;
  chapterId?: string | null;
  sourceType: string;
  sourceId?: string | null;
  title: string;
  content: string;
  summary?: string | null;
  tagsJson?: string;
  importance?: number;
  tokenEstimate?: number;
  embeddingJson?: string | null;
}

export interface MemorySearchOptions {
  bookId: string;
  query: string;
  chapterId?: string | null;
  sourceTypes?: string[];
  tags?: string[];
  minImportance?: number;
  limit?: number;
}

function parseTags(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value !== "string") return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

export class MemoryRepository {
  constructor(private readonly db: WenForgeDatabase) {}

  createChunk(input: CreateMemoryChunkInput): MemoryChunkRecord {
    const now = nowIso();
    const row = {
      id: createId("memory"),
      bookId: input.bookId,
      chapterId: input.chapterId ?? null,
      sourceType: input.sourceType,
      sourceId: input.sourceId ?? null,
      title: input.title,
      content: input.content,
      summary: input.summary ?? null,
      tagsJson: input.tagsJson ?? "[]",
      importance: input.importance ?? 5,
      tokenEstimate: input.tokenEstimate ?? 0,
      embeddingJson: input.embeddingJson ?? null,
      createdAt: now,
      updatedAt: now
    };
    this.db.sqlite
      .prepare(
        `insert into memory_chunks
        (id, book_id, chapter_id, source_type, source_id, title, content, summary, tags_json,
          importance, token_estimate, embedding_json, created_at, updated_at)
        values (@id, @bookId, @chapterId, @sourceType, @sourceId, @title, @content, @summary,
          @tagsJson, @importance, @tokenEstimate, @embeddingJson, @createdAt, @updatedAt)`
      )
      .run(row);
    this.indexSearch(row.bookId, row.sourceType, row.id, row.title, row.content, row.summary);
    return row;
  }

  upsertChunk(input: CreateMemoryChunkInput): MemoryChunkRecord {
    if (input.sourceId) {
      const existing = this.db.sqlite
        .prepare(
          "select id from memory_chunks where book_id = ? and source_type = ? and source_id = ?"
        )
        .get(input.bookId, input.sourceType, input.sourceId) as { id: string } | undefined;
      if (existing) {
        const now = nowIso();
        this.db.sqlite
          .prepare(
            `update memory_chunks set chapter_id = @chapterId, title = @title, content = @content,
            summary = @summary, tags_json = @tagsJson, importance = @importance,
            token_estimate = @tokenEstimate, embedding_json = @embeddingJson, updated_at = @updatedAt
            where id = @id`
          )
          .run({
            id: existing.id,
            chapterId: input.chapterId ?? null,
            title: input.title,
            content: input.content,
            summary: input.summary ?? null,
            tagsJson: input.tagsJson ?? "[]",
            importance: input.importance ?? 5,
            tokenEstimate: input.tokenEstimate ?? 0,
            embeddingJson: input.embeddingJson ?? null,
            updatedAt: now
          });
        this.indexSearch(
          input.bookId,
          input.sourceType,
          existing.id,
          input.title,
          input.content,
          input.summary ?? null
        );
        return this.getChunk(existing.id) as MemoryChunkRecord;
      }
    }

    return this.createChunk(input);
  }

  getChunk(id: string): MemoryChunkRecord | null {
    const row = this.db.sqlite.prepare("select * from memory_chunks where id = ?").get(id);
    return row ? this.mapChunk(row as Record<string, unknown>) : null;
  }

  deleteChunk(id: string): boolean {
    const chunk = this.getChunk(id);
    if (!chunk) return false;
    const deleted = this.db.sqlite
      .prepare("delete from memory_chunks where id = ?")
      .run(id).changes;
    try {
      this.db.sqlite
        .prepare("delete from search_index where book_id = ? and source_id = ?")
        .run(chunk.bookId, id);
    } catch {
      // FTS may be unavailable.
    }
    return deleted > 0;
  }

  deleteBookChunksBySourceTypes(bookId: string, sourceTypes: string[]): void {
    if (sourceTypes.length === 0) return;
    const placeholders = sourceTypes.map(() => "?").join(", ");
    this.db.sqlite
      .prepare(`delete from memory_chunks where book_id = ? and source_type in (${placeholders})`)
      .run(bookId, ...sourceTypes);
    try {
      this.db.sqlite
        .prepare(`delete from search_index where book_id = ? and source_type in (${placeholders})`)
        .run(bookId, ...sourceTypes);
    } catch {
      // FTS may be unavailable.
    }
  }

  search(bookId: string, query: string): MemorySearchResult[] {
    const memoryRows = this.searchRelevant({ bookId, query });
    const storyRows = this.searchStoryBibleEntries(bookId, query);
    const seen = new Set<string>();
    return [...memoryRows, ...storyRows].filter((result) => {
      const key = `${result.sourceType}:${result.sourceId}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  searchRelevant(options: MemorySearchOptions): MemorySearchResult[] {
    try {
      const ftsRows = this.db.sqlite
        .prepare(
          `select m.*, bm25(search_index) as score
          from search_index
          join memory_chunks m on m.id = search_index.source_id and m.book_id = search_index.book_id
          where search_index.book_id = ? and search_index match ?
          order by score asc limit ?`
        )
        .all(options.bookId, options.query, options.limit ?? 20)
        .map((row) => this.mapChunkSearchResult(row as Record<string, unknown>));
      const filtered = this.filterSearchResults(ftsRows, options);
      if (filtered.length > 0) return filtered;
    } catch {
      return this.fallbackSearch(options);
    }

    return this.fallbackSearch(options);
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
        .prepare(
          "insert into search_index (book_id, source_type, source_id, title, content, summary) values (?, ?, ?, ?, ?, ?)"
        )
        .run(bookId, sourceType, sourceId, title, content, summary);
    } catch {
      // FTS5 is optional; search() falls back to LIKE queries.
    }
  }

  private mapSearchResult(row: Record<string, unknown>): MemorySearchResult {
    return {
      sourceType: String(row.source_type),
      sourceId: String(row.source_id),
      title: String(row.title),
      content: String(row.content)
    };
  }

  private mapChunk(row: Record<string, unknown>): MemoryChunkRecord {
    return {
      id: String(row.id),
      bookId: String(row.book_id),
      chapterId: row.chapter_id === null ? null : String(row.chapter_id),
      sourceType: String(row.source_type),
      sourceId: row.source_id === null ? null : String(row.source_id),
      title: String(row.title),
      content: String(row.content),
      summary: row.summary === null ? null : String(row.summary),
      tagsJson: String(row.tags_json),
      importance: Number(row.importance),
      tokenEstimate: Number(row.token_estimate),
      embeddingJson: row.embedding_json === null ? null : String(row.embedding_json),
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at)
    };
  }

  private mapChunkSearchResult(row: Record<string, unknown>): MemorySearchResult {
    const chunk = this.mapChunk(row);
    return {
      sourceType: chunk.sourceType,
      sourceId: chunk.sourceId ?? chunk.id,
      title: chunk.title,
      content: chunk.content,
      summary: chunk.summary,
      tags: parseTags(chunk.tagsJson),
      importance: chunk.importance,
      score: Math.abs(Number(row.score ?? 0))
    };
  }

  private fallbackSearch(options: MemorySearchOptions): MemorySearchResult[] {
    const like = `%${options.query}%`;
    const memoryRows = this.db.sqlite
      .prepare(
        `select *, 100.0 / (importance + 1) as score from memory_chunks
        where book_id = ? and (title like ? or content like ? or summary like ?)
        order by importance desc, updated_at desc limit ?`
      )
      .all(options.bookId, like, like, like, options.limit ?? 20)
      .map((row) => this.mapChunkSearchResult(row as Record<string, unknown>));
    const storyRows = this.searchStoryBibleEntries(options.bookId, options.query);
    return this.filterSearchResults([...memoryRows, ...storyRows], options);
  }

  private searchStoryBibleEntries(bookId: string, query: string): MemorySearchResult[] {
    const like = `%${query}%`;
    return this.db.sqlite
      .prepare(
        `select 'story_bible_entry' as source_type, id as source_id, title, content, null as summary,
        '[]' as tags_json, 5 as importance, 10.0 as score from story_bible_entries
        where book_id = ? and (title like ? or content like ?)`
      )
      .all(bookId, like, like)
      .map((row) => this.mapSearchResult(row as Record<string, unknown>));
  }

  private filterSearchResults(
    results: MemorySearchResult[],
    options: MemorySearchOptions
  ): MemorySearchResult[] {
    return results
      .filter(
        (result) => !options.sourceTypes?.length || options.sourceTypes.includes(result.sourceType)
      )
      .filter((result) => (result.importance ?? 5) >= (options.minImportance ?? 0))
      .filter((result) => {
        if (!options.tags?.length) return true;
        const tags = result.tags ?? [];
        return options.tags.every((tag) => tags.includes(tag));
      })
      .slice(0, options.limit ?? 20);
  }
}

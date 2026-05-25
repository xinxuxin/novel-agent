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
    this.indexSearch(row.bookId, "memory_chunk", row.id, row.title, row.content, row.summary);
    return row;
  }

  search(bookId: string, query: string): MemorySearchResult[] {
    try {
      const ftsResults = this.db.sqlite
        .prepare(
          `select source_type, source_id, title, content from search_index
          where book_id = ? and search_index match ?
          order by rank limit 20`
        )
        .all(bookId, query)
        .map((row) => this.mapSearchResult(row as Record<string, unknown>));
      if (ftsResults.length > 0) {
        return ftsResults;
      }
    } catch {
      return this.fallbackSearch(bookId, query);
    }

    return this.fallbackSearch(bookId, query);
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

  private fallbackSearch(bookId: string, query: string): MemorySearchResult[] {
    const like = `%${query}%`;
    const memoryRows = this.db.sqlite
      .prepare(
        `select 'memory_chunk' as source_type, id as source_id, title, content from memory_chunks
        where book_id = ? and (title like ? or content like ? or summary like ?)`
      )
      .all(bookId, like, like, like);
    const storyRows = this.db.sqlite
      .prepare(
        `select 'story_bible_entry' as source_type, id as source_id, title, content from story_bible_entries
        where book_id = ? and (title like ? or content like ?)`
      )
      .all(bookId, like, like);
    return [...memoryRows, ...storyRows].map((row) =>
      this.mapSearchResult(row as Record<string, unknown>)
    );
  }
}

import type { WenForgeDatabase } from "@main/db/connection";
import { createId } from "@main/db/id";
import { nowIso } from "./types";

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

function mapEntry(row: Record<string, unknown>): StoryBibleEntryRecord {
  return {
    id: String(row.id),
    bookId: String(row.book_id),
    chapterId: row.chapter_id === null ? null : String(row.chapter_id),
    entryType: String(row.entry_type),
    title: String(row.title),
    content: String(row.content),
    provenance: String(row.provenance),
    sourceRunId: row.source_run_id === null ? null : String(row.source_run_id),
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
    return mapEntry(
      this.db.sqlite.prepare("select * from story_bible_entries where id = ?").get(id) as Record<
        string,
        unknown
      >
    );
  }

  delete(id: string, confirmed = false): boolean {
    if (!confirmed) return false;
    return (
      this.db.sqlite.prepare("delete from story_bible_entries where id = ?").run(id).changes > 0
    );
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
      // FTS5 can be unavailable in some SQLite builds; keyword fallback still works.
    }
  }
}

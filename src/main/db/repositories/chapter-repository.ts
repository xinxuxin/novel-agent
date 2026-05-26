import type { WenForgeDatabase } from "@main/db/connection";
import { createId } from "@main/db/id";
import { nowIso } from "./types";

export interface ChapterRecord {
  id: string;
  bookId: string;
  volumeId: string | null;
  chapterIndex: number;
  title: string;
  status: string;
  targetWords: number;
  minWords: number | null;
  maxWords: number | null;
  lockWordCount: boolean;
  wordCountPriority: "loose" | "normal" | "strict";
  currentWords: number;
  summary: string | null;
  outlineJson: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateChapterInput {
  bookId: string;
  volumeId?: string | null | undefined;
  chapterIndex: number;
  title: string;
  status?: string | undefined;
  targetWords?: number | undefined;
  minWords?: number | null | undefined;
  maxWords?: number | null | undefined;
  lockWordCount?: boolean | undefined;
  wordCountPriority?: "loose" | "normal" | "strict" | undefined;
  summary?: string | null | undefined;
  outlineJson?: string | null | undefined;
}

function mapChapter(row: Record<string, unknown>): ChapterRecord {
  return {
    id: String(row.id),
    bookId: String(row.book_id),
    volumeId: row.volume_id === null ? null : String(row.volume_id),
    chapterIndex: Number(row.chapter_index),
    title: String(row.title),
    status: String(row.status),
    targetWords: Number(row.target_words),
    minWords: row.min_words === null ? null : Number(row.min_words),
    maxWords: row.max_words === null ? null : Number(row.max_words),
    lockWordCount: row.lock_word_count === true || row.lock_word_count === 1,
    wordCountPriority: normalizeWordCountPriority(row.word_count_priority),
    currentWords: Number(row.current_words),
    summary: row.summary === null ? null : String(row.summary),
    outlineJson: row.outline_json === null ? null : String(row.outline_json),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

export class ChapterRepository {
  constructor(private readonly db: WenForgeDatabase) {}

  listByBook(bookId: string): ChapterRecord[] {
    return this.db.sqlite
      .prepare("select * from chapters where book_id = ? order by chapter_index asc")
      .all(bookId)
      .map((row) => mapChapter(row as Record<string, unknown>));
  }

  get(id: string): ChapterRecord | null {
    const row = this.db.sqlite.prepare("select * from chapters where id = ?").get(id);
    return row ? mapChapter(row as Record<string, unknown>) : null;
  }

  create(input: CreateChapterInput): ChapterRecord {
    const now = nowIso();
    const row = {
      id: createId("chapter"),
      bookId: input.bookId,
      volumeId: input.volumeId ?? null,
      chapterIndex: input.chapterIndex,
      title: input.title,
      status: input.status ?? "planned",
      targetWords: input.targetWords ?? 3000,
      minWords: input.minWords ?? null,
      maxWords: input.maxWords ?? null,
      lockWordCount: input.lockWordCount ?? false,
      wordCountPriority: input.wordCountPriority ?? "normal",
      currentWords: 0,
      summary: null,
      outlineJson: null,
      createdAt: now,
      updatedAt: now
    };
    this.db.sqlite
      .prepare(
        `insert into chapters
        (id, book_id, volume_id, chapter_index, title, status, target_words, min_words, max_words,
          lock_word_count, word_count_priority, current_words, summary, outline_json, created_at, updated_at)
        values (@id, @bookId, @volumeId, @chapterIndex, @title, @status, @targetWords, @minWords,
          @maxWords, @lockWordCount, @wordCountPriority, @currentWords, @summary, @outlineJson,
          @createdAt, @updatedAt)`
      )
      .run({ ...row, lockWordCount: row.lockWordCount ? 1 : 0 });
    return row;
  }

  update(id: string, input: Partial<CreateChapterInput>): ChapterRecord | null {
    const existing = this.get(id);
    if (!existing) return null;
    this.db.sqlite
      .prepare(
        `update chapters set volume_id = @volumeId, chapter_index = @chapterIndex, title = @title,
        status = @status, target_words = @targetWords, min_words = @minWords,
        max_words = @maxWords, lock_word_count = @lockWordCount,
        word_count_priority = @wordCountPriority, summary = @summary,
        outline_json = @outlineJson, updated_at = @updatedAt where id = @id`
      )
      .run({
        id,
        volumeId: input.volumeId ?? existing.volumeId,
        chapterIndex: input.chapterIndex ?? existing.chapterIndex,
        title: input.title ?? existing.title,
        status: input.status ?? existing.status,
        targetWords: input.targetWords ?? existing.targetWords,
        minWords: input.minWords === undefined ? existing.minWords : input.minWords,
        maxWords: input.maxWords === undefined ? existing.maxWords : input.maxWords,
        lockWordCount:
          input.lockWordCount === undefined
            ? existing.lockWordCount
              ? 1
              : 0
            : input.lockWordCount
              ? 1
              : 0,
        wordCountPriority: input.wordCountPriority ?? existing.wordCountPriority,
        summary: input.summary === undefined ? existing.summary : input.summary,
        outlineJson: input.outlineJson === undefined ? existing.outlineJson : input.outlineJson,
        updatedAt: nowIso()
      });
    return this.get(id);
  }

  reorder(bookId: string, orderedChapterIds: string[]): void {
    const update = this.db.sqlite.prepare(
      "update chapters set chapter_index = ?, updated_at = ? where id = ? and book_id = ?"
    );
    const tx = this.db.sqlite.transaction(() => {
      orderedChapterIds.forEach((id, index) => update.run(index + 1, nowIso(), id, bookId));
    });
    tx();
  }

  setStatus(id: string, status: string): ChapterRecord | null {
    this.db.sqlite
      .prepare("update chapters set status = ?, updated_at = ? where id = ?")
      .run(status, nowIso(), id);
    return this.get(id);
  }

  delete(id: string, confirmed = false): boolean {
    return (
      confirmed && this.db.sqlite.prepare("delete from chapters where id = ?").run(id).changes > 0
    );
  }
}

function normalizeWordCountPriority(value: unknown): "loose" | "normal" | "strict" {
  return value === "loose" || value === "strict" ? value : "normal";
}

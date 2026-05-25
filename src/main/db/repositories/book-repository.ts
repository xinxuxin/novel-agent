import type { WenForgeDatabase } from "@main/db/connection";
import { createId } from "@main/db/id";
import { nowIso } from "./types";

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

export interface CreateBookInput {
  projectId: string;
  title: string;
  logline?: string | undefined;
  genre?: string | undefined;
  targetLengthChapters?: number | undefined;
  status?: string | undefined;
}

function mapBook(row: Record<string, unknown>): BookRecord {
  return {
    id: String(row.id),
    projectId: String(row.project_id),
    title: String(row.title),
    logline: row.logline === null ? null : String(row.logline),
    genre: row.genre === null ? null : String(row.genre),
    targetLengthChapters:
      row.target_length_chapters === null ? null : Number(row.target_length_chapters),
    status: String(row.status),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

export class BookRepository {
  constructor(private readonly db: WenForgeDatabase) {}

  listByProject(projectId: string): BookRecord[] {
    return this.db.sqlite
      .prepare("select * from books where project_id = ? order by created_at asc")
      .all(projectId)
      .map((row) => mapBook(row as Record<string, unknown>));
  }

  get(id: string): BookRecord | null {
    const row = this.db.sqlite.prepare("select * from books where id = ?").get(id);
    return row ? mapBook(row as Record<string, unknown>) : null;
  }

  create(input: CreateBookInput): BookRecord {
    const now = nowIso();
    const row = {
      id: createId("book"),
      projectId: input.projectId,
      title: input.title,
      logline: input.logline ?? null,
      genre: input.genre ?? null,
      targetLengthChapters: input.targetLengthChapters ?? null,
      status: input.status ?? "active",
      createdAt: now,
      updatedAt: now
    };
    this.db.sqlite
      .prepare(
        `insert into books
        (id, project_id, title, logline, genre, target_length_chapters, status, created_at, updated_at)
        values (@id, @projectId, @title, @logline, @genre, @targetLengthChapters, @status, @createdAt, @updatedAt)`
      )
      .run(row);
    return row;
  }

  update(id: string, input: Partial<CreateBookInput>): BookRecord | null {
    const existing = this.get(id);
    if (!existing) return null;
    const updated = {
      id,
      title: input.title ?? existing.title,
      logline: input.logline ?? existing.logline,
      genre: input.genre ?? existing.genre,
      targetLengthChapters: input.targetLengthChapters ?? existing.targetLengthChapters,
      status: input.status ?? existing.status,
      updatedAt: nowIso()
    };
    this.db.sqlite
      .prepare(
        `update books set title = @title, logline = @logline, genre = @genre,
        target_length_chapters = @targetLengthChapters, status = @status, updated_at = @updatedAt
        where id = @id`
      )
      .run(updated);
    return this.get(id);
  }

  delete(id: string, confirmed = false): boolean {
    return (
      confirmed && this.db.sqlite.prepare("delete from books where id = ?").run(id).changes > 0
    );
  }
}

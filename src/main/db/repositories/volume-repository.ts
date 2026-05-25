import type { WenForgeDatabase } from "@main/db/connection";
import { createId } from "@main/db/id";
import { nowIso } from "./types";

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

export interface CreateVolumeInput {
  bookId: string;
  title: string;
  volumeIndex: number;
  summary?: string | undefined;
  status?: string | undefined;
}

function mapVolume(row: Record<string, unknown>): VolumeRecord {
  return {
    id: String(row.id),
    bookId: String(row.book_id),
    title: String(row.title),
    volumeIndex: Number(row.volume_index),
    summary: row.summary === null ? null : String(row.summary),
    status: String(row.status),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

export class VolumeRepository {
  constructor(private readonly db: WenForgeDatabase) {}

  listByBook(bookId: string): VolumeRecord[] {
    return this.db.sqlite
      .prepare("select * from volumes where book_id = ? order by volume_index asc")
      .all(bookId)
      .map((row) => mapVolume(row as Record<string, unknown>));
  }

  create(input: CreateVolumeInput): VolumeRecord {
    const now = nowIso();
    const row = {
      id: createId("volume"),
      bookId: input.bookId,
      title: input.title,
      volumeIndex: input.volumeIndex,
      summary: input.summary ?? null,
      status: input.status ?? "planned",
      createdAt: now,
      updatedAt: now
    };
    this.db.sqlite
      .prepare(
        `insert into volumes
        (id, book_id, title, volume_index, summary, status, created_at, updated_at)
        values (@id, @bookId, @title, @volumeIndex, @summary, @status, @createdAt, @updatedAt)`
      )
      .run(row);
    return row;
  }

  update(id: string, input: Partial<CreateVolumeInput>): VolumeRecord | null {
    const existing = this.db.sqlite.prepare("select * from volumes where id = ?").get(id) as
      | Record<string, unknown>
      | undefined;
    if (!existing) return null;
    const current = mapVolume(existing);
    this.db.sqlite
      .prepare(
        `update volumes set title = @title, volume_index = @volumeIndex, summary = @summary,
        status = @status, updated_at = @updatedAt where id = @id`
      )
      .run({
        id,
        title: input.title ?? current.title,
        volumeIndex: input.volumeIndex ?? current.volumeIndex,
        summary: input.summary ?? current.summary,
        status: input.status ?? current.status,
        updatedAt: nowIso()
      });
    const row = this.db.sqlite.prepare("select * from volumes where id = ?").get(id);
    return row ? mapVolume(row as Record<string, unknown>) : null;
  }

  delete(id: string, confirmed = false): boolean {
    return (
      confirmed && this.db.sqlite.prepare("delete from volumes where id = ?").run(id).changes > 0
    );
  }
}

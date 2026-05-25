import type { WenForgeDatabase } from "@main/db/connection";
import { createId } from "@main/db/id";
import { nowIso } from "./types";

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

export interface CreateProjectInput {
  name: string;
  description?: string | undefined;
  genre?: string | undefined;
  targetReader?: string | undefined;
  status?: string | undefined;
}

function mapProject(row: Record<string, unknown>): ProjectRecord {
  return {
    id: String(row.id),
    name: String(row.name),
    description: row.description === null ? null : String(row.description),
    genre: row.genre === null ? null : String(row.genre),
    targetReader: row.target_reader === null ? null : String(row.target_reader),
    status: String(row.status),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

export class ProjectRepository {
  constructor(private readonly db: WenForgeDatabase) {}

  list(): ProjectRecord[] {
    return this.db.sqlite
      .prepare("select * from projects order by updated_at desc")
      .all()
      .map((row) => mapProject(row as Record<string, unknown>));
  }

  get(id: string): ProjectRecord | null {
    const row = this.db.sqlite.prepare("select * from projects where id = ?").get(id);
    return row ? mapProject(row as Record<string, unknown>) : null;
  }

  create(input: CreateProjectInput): ProjectRecord {
    const now = nowIso();
    const row = {
      id: createId("project"),
      name: input.name,
      description: input.description ?? null,
      genre: input.genre ?? null,
      targetReader: input.targetReader ?? null,
      status: input.status ?? "active",
      createdAt: now,
      updatedAt: now
    };
    this.db.sqlite
      .prepare(
        `insert into projects
        (id, name, description, genre, target_reader, status, created_at, updated_at)
        values (@id, @name, @description, @genre, @targetReader, @status, @createdAt, @updatedAt)`
      )
      .run(row);
    return row;
  }

  update(id: string, input: Partial<CreateProjectInput>): ProjectRecord | null {
    const existing = this.get(id);
    if (!existing) {
      return null;
    }
    const updated = {
      id,
      name: input.name ?? existing.name,
      description: input.description ?? existing.description,
      genre: input.genre ?? existing.genre,
      targetReader: input.targetReader ?? existing.targetReader,
      status: input.status ?? existing.status,
      updatedAt: nowIso()
    };
    this.db.sqlite
      .prepare(
        `update projects set
          name = @name,
          description = @description,
          genre = @genre,
          target_reader = @targetReader,
          status = @status,
          updated_at = @updatedAt
        where id = @id`
      )
      .run(updated);
    return this.get(id);
  }

  delete(id: string, confirmed = false): boolean {
    if (!confirmed) {
      return false;
    }
    return this.db.sqlite.prepare("delete from projects where id = ?").run(id).changes > 0;
  }
}

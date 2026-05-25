import type { WenForgeDatabase } from "@main/db/connection";
import { createId } from "@main/db/id";
import { nowIso } from "./types";

export interface GenerationRunRecord {
  id: string;
  projectId: string | null;
  bookId: string | null;
  chapterId: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface GeneratedArtifactRecord {
  id: string;
  generationRunId: string;
  chapterId: string | null;
  artifactType: string;
  title: string | null;
  contentText: string;
  contentJson: string | null;
  sourceNode: string | null;
  createdAt: string;
}

export interface CreateGenerationRunInput {
  projectId?: string | null;
  bookId?: string | null;
  chapterId?: string | null;
  status?: string;
}

export interface CreateGeneratedArtifactInput {
  generationRunId: string;
  chapterId?: string | null;
  artifactType: string;
  title?: string | null;
  contentText: string;
  contentJson?: string | null;
  sourceNode?: string | null;
}

function mapRun(row: Record<string, unknown>): GenerationRunRecord {
  return {
    id: String(row.id),
    projectId: row.project_id === null ? null : String(row.project_id),
    bookId: row.book_id === null ? null : String(row.book_id),
    chapterId: row.chapter_id === null ? null : String(row.chapter_id),
    status: String(row.status),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

function mapArtifact(row: Record<string, unknown>): GeneratedArtifactRecord {
  return {
    id: String(row.id),
    generationRunId: String(row.generation_run_id),
    chapterId: row.chapter_id === null ? null : String(row.chapter_id),
    artifactType: String(row.artifact_type),
    title: row.title === null ? null : String(row.title),
    contentText: String(row.content_text),
    contentJson: row.content_json === null ? null : String(row.content_json),
    sourceNode: row.source_node === null ? null : String(row.source_node),
    createdAt: String(row.created_at)
  };
}

export class GenerationRepository {
  constructor(private readonly db: WenForgeDatabase) {}

  createRun(input: CreateGenerationRunInput = {}): GenerationRunRecord {
    const now = nowIso();
    const row = {
      id: createId("generation"),
      projectId: input.projectId ?? null,
      bookId: input.bookId ?? null,
      chapterId: input.chapterId ?? null,
      status: input.status ?? "draft",
      createdAt: now,
      updatedAt: now
    };
    this.db.sqlite
      .prepare(
        `insert into generation_runs (id, project_id, book_id, chapter_id, status, created_at, updated_at)
        values (@id, @projectId, @bookId, @chapterId, @status, @createdAt, @updatedAt)`
      )
      .run(row);
    return row;
  }

  createArtifact(input: CreateGeneratedArtifactInput): GeneratedArtifactRecord {
    const row = {
      id: createId("artifact"),
      generationRunId: input.generationRunId,
      chapterId: input.chapterId ?? null,
      artifactType: input.artifactType,
      title: input.title ?? null,
      contentText: input.contentText,
      contentJson: input.contentJson ?? null,
      sourceNode: input.sourceNode ?? null,
      createdAt: nowIso()
    };
    this.db.sqlite
      .prepare(
        `insert into generated_artifacts
        (id, generation_run_id, chapter_id, artifact_type, title, content_text, content_json, source_node, created_at)
        values (@id, @generationRunId, @chapterId, @artifactType, @title, @contentText, @contentJson, @sourceNode, @createdAt)`
      )
      .run(row);
    return this.db.sqlite
      .prepare("select * from generated_artifacts where id = ?")
      .get(row.id) as GeneratedArtifactRecord;
  }

  getRun(id: string): GenerationRunRecord | null {
    const row = this.db.sqlite.prepare("select * from generation_runs where id = ?").get(id);
    return row ? mapRun(row as Record<string, unknown>) : null;
  }

  listArtifacts(generationRunId: string): GeneratedArtifactRecord[] {
    return this.db.sqlite
      .prepare(
        "select * from generated_artifacts where generation_run_id = ? order by created_at asc"
      )
      .all(generationRunId)
      .map((row) => mapArtifact(row as Record<string, unknown>));
  }
}

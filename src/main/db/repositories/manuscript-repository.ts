import type { WenForgeDatabase } from "@main/db/connection";
import { createId } from "@main/db/id";
import { countChineseAwareWords, markdownToPlaintext, nowIso } from "./types";

export type ManuscriptSourceType = "manual" | "generated" | "imported" | "restored";

export interface ManuscriptVersionRecord {
  id: string;
  chapterId: string;
  parentVersionId: string | null;
  versionIndex: number;
  branchLabel: string | null;
  title: string;
  contentMarkdown: string;
  contentPlaintext: string;
  sourceType: ManuscriptSourceType;
  generationRunId: string | null;
  isCanonical: boolean;
  wordCount: number;
  characterCount: number;
  createdAt: string;
}

export interface SaveManuscriptVersionInput {
  chapterId: string;
  parentVersionId?: string | null | undefined;
  branchLabel?: string | null | undefined;
  title: string;
  contentMarkdown: string;
  sourceType?: ManuscriptSourceType | undefined;
  generationRunId?: string | null | undefined;
  isCanonical?: boolean | undefined;
}

function boolFromSql(value: unknown): boolean {
  return value === true || value === 1;
}

function mapVersion(row: Record<string, unknown>): ManuscriptVersionRecord {
  return {
    id: String(row.id),
    chapterId: String(row.chapter_id),
    parentVersionId: row.parent_version_id === null ? null : String(row.parent_version_id),
    versionIndex: Number(row.version_index),
    branchLabel: row.branch_label === null ? null : String(row.branch_label),
    title: String(row.title),
    contentMarkdown: String(row.content_markdown),
    contentPlaintext: String(row.content_plaintext),
    sourceType: String(row.source_type) as ManuscriptSourceType,
    generationRunId: row.generation_run_id === null ? null : String(row.generation_run_id),
    isCanonical: boolFromSql(row.is_canonical),
    wordCount: Number(row.word_count),
    characterCount: Number(row.character_count),
    createdAt: String(row.created_at)
  };
}

export class ManuscriptRepository {
  constructor(private readonly db: WenForgeDatabase) {}

  listVersions(chapterId: string): ManuscriptVersionRecord[] {
    return this.db.sqlite
      .prepare("select * from manuscript_versions where chapter_id = ? order by version_index desc")
      .all(chapterId)
      .map((row) => mapVersion(row as Record<string, unknown>));
  }

  getVersion(id: string): ManuscriptVersionRecord | null {
    const row = this.db.sqlite.prepare("select * from manuscript_versions where id = ?").get(id);
    return row ? mapVersion(row as Record<string, unknown>) : null;
  }

  getCanonical(chapterId: string): ManuscriptVersionRecord | null {
    const row = this.db.sqlite
      .prepare("select * from manuscript_versions where chapter_id = ? and is_canonical = 1")
      .get(chapterId);
    return row ? mapVersion(row as Record<string, unknown>) : null;
  }

  saveManualVersion(
    input: Omit<SaveManuscriptVersionInput, "sourceType">
  ): ManuscriptVersionRecord {
    return this.saveVersion({ ...input, sourceType: "manual" });
  }

  saveVersion(input: SaveManuscriptVersionInput): ManuscriptVersionRecord {
    const contentPlaintext = markdownToPlaintext(input.contentMarkdown);
    const row = {
      id: createId("manuscript"),
      chapterId: input.chapterId,
      parentVersionId: input.parentVersionId ?? null,
      versionIndex: this.nextVersionIndex(input.chapterId),
      branchLabel: input.branchLabel ?? null,
      title: input.title,
      contentMarkdown: input.contentMarkdown,
      contentPlaintext,
      sourceType: input.sourceType ?? "manual",
      generationRunId: input.generationRunId ?? null,
      isCanonical: input.isCanonical ? 1 : 0,
      wordCount: countChineseAwareWords(contentPlaintext),
      characterCount: contentPlaintext.length,
      createdAt: nowIso()
    };

    const insert = this.db.sqlite.prepare(
      `insert into manuscript_versions
      (id, chapter_id, parent_version_id, version_index, branch_label, title, content_markdown,
        content_plaintext, source_type, generation_run_id, is_canonical, word_count, character_count, created_at)
      values (@id, @chapterId, @parentVersionId, @versionIndex, @branchLabel, @title, @contentMarkdown,
        @contentPlaintext, @sourceType, @generationRunId, @isCanonical, @wordCount, @characterCount, @createdAt)`
    );

    const tx = this.db.sqlite.transaction(() => {
      if (row.isCanonical) {
        this.clearCanonical(input.chapterId);
      }
      insert.run(row);
      this.db.sqlite
        .prepare("update chapters set current_words = ?, updated_at = ? where id = ?")
        .run(row.wordCount, nowIso(), input.chapterId);
    });
    tx();

    return this.getVersion(row.id) as ManuscriptVersionRecord;
  }

  setCanonical(chapterId: string, versionId: string): ManuscriptVersionRecord | null {
    const tx = this.db.sqlite.transaction(() => {
      this.clearCanonical(chapterId);
      this.db.sqlite
        .prepare("update manuscript_versions set is_canonical = 1 where id = ? and chapter_id = ?")
        .run(versionId, chapterId);
    });
    tx();
    return this.getCanonical(chapterId);
  }

  rollback(chapterId: string, targetVersionId: string): ManuscriptVersionRecord {
    const target = this.getVersion(targetVersionId);
    if (!target || target.chapterId !== chapterId) {
      throw new Error("Target manuscript version not found");
    }
    return this.saveVersion({
      chapterId,
      parentVersionId: this.getCanonical(chapterId)?.id ?? null,
      branchLabel: "rollback",
      title: target.title,
      contentMarkdown: target.contentMarkdown,
      sourceType: "restored",
      isCanonical: true
    });
  }

  private nextVersionIndex(chapterId: string): number {
    const row = this.db.sqlite
      .prepare(
        "select coalesce(max(version_index), 0) + 1 as nextIndex from manuscript_versions where chapter_id = ?"
      )
      .get(chapterId) as { nextIndex: number };
    return Number(row.nextIndex);
  }

  private clearCanonical(chapterId: string): void {
    this.db.sqlite
      .prepare("update manuscript_versions set is_canonical = 0 where chapter_id = ?")
      .run(chapterId);
  }
}

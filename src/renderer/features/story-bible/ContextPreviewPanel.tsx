import type { ContextPreviewPack } from "@contracts/context";
import type { BookRecord, ChapterRecord, ProjectRecord, VolumeRecord } from "@contracts/data";
import type { JSX } from "react";
import React, { useState } from "react";

interface ContextPreviewPanelProps {
  project: ProjectRecord | null;
  book: BookRecord | null;
  volume: VolumeRecord | null;
  chapter: ChapterRecord | null;
}

export function ContextPreviewPanel({
  project,
  book,
  volume,
  chapter
}: ContextPreviewPanelProps): JSX.Element {
  const [preview, setPreview] = useState<ContextPreviewPack | null>(null);
  const [loading, setLoading] = useState(false);

  const loadPreview = async (): Promise<void> => {
    if (!project || !book || !chapter) return;
    setLoading(true);
    try {
      const privacy = await window.wenforge.privacy.get();
      setPreview(
        await window.wenforge.context.previewForChapter({
          projectId: project.id,
          bookId: book.id,
          volumeId: volume?.id ?? null,
          chapterId: chapter.id,
          taskType: "draft_chapter",
          qualityMode: "balanced",
          targetTokenBudget: privacy.maxContextTokenBudget,
          includeRecentChapters: privacy.recentChapterCount,
          includeFullRecentChapters: privacy.allowSendingFullRecentChapters,
          privacy
        })
      );
    } finally {
      setLoading(false);
    }
  };

  const copyPreview = async (): Promise<void> => {
    if (!preview) return;
    await navigator.clipboard.writeText(JSON.stringify(preview, null, 2));
  };

  return (
    <section className="rounded-lg border border-white/10 bg-graphite-900/60 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-white">Context preview</h3>
          <p className="mt-1 text-xs text-slate-500">
            Main-process context pack without credentials.
          </p>
        </div>
        <button
          className="rounded-md border border-white/10 px-2 py-1 text-xs text-slate-300 hover:border-forge-blue/40 hover:text-white"
          disabled={!chapter || loading}
          onClick={() => void loadPreview()}
          type="button"
        >
          Preview
        </button>
      </div>

      {preview ? (
        <div className="mt-3 space-y-3">
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-lg border border-white/10 bg-black/20 p-3">
              <p className="text-slate-500">Estimated tokens</p>
              <p className="mt-1 text-sm text-slate-100">{preview.estimatedTokens}</p>
            </div>
            <div className="rounded-lg border border-white/10 bg-black/20 p-3">
              <p className="text-slate-500">Memory chunks</p>
              <p className="mt-1 text-sm text-slate-100">{preview.retrievedMemoryChunks.length}</p>
            </div>
          </div>
          {preview.recentChapterExcerpts.length > 0 ? (
            <p className="rounded-lg border border-forge-amber/25 bg-forge-amber/10 px-3 py-2 text-xs text-forge-amber">
              Full recent chapter excerpts are included by privacy settings.
            </p>
          ) : null}
          {[...preview.omissions, ...preview.truncationNotes].slice(0, 4).map((note) => (
            <p
              className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-slate-400"
              key={note}
            >
              {note}
            </p>
          ))}
          <button
            className="rounded-md border border-white/10 px-3 py-1.5 text-xs text-slate-300 hover:text-white"
            onClick={() => void copyPreview()}
            type="button"
          >
            Copy JSON
          </button>
        </div>
      ) : (
        <p className="mt-3 text-sm leading-6 text-slate-500">
          Generate a preview to inspect included and omitted context before running a workflow.
        </p>
      )}
    </section>
  );
}

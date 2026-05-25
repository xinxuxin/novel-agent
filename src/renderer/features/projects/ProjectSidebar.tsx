import type { JSX } from "react";
import React from "react";

import { StatusBadge } from "@components/StatusBadge";
import type { BookRecord, ChapterRecord, ProjectRecord, VolumeRecord } from "@contracts/data";

interface ProjectSidebarProps {
  compact: boolean;
  projects: ProjectRecord[];
  books: BookRecord[];
  volumes: VolumeRecord[];
  chapters: ChapterRecord[];
  selectedProjectId: string | null;
  selectedBookId: string | null;
  selectedChapterId: string | null;
  canonicalChapterIds: Set<string>;
  onSelectProject: (id: string) => void;
  onSelectBook: (id: string) => void;
  onSelectChapter: (chapter: ChapterRecord) => void;
  onCreateProject: () => void;
  onCreateBook: () => void;
  onCreateVolume: () => void;
  onCreateChapter: (volumeId?: string | null) => void;
  onRenameChapter: (chapter: ChapterRecord) => void;
  onMoveChapter: (chapter: ChapterRecord, direction: "up" | "down") => void;
  onChangeStatus: (chapter: ChapterRecord) => void;
}

function chapterLabel(chapter: ChapterRecord): string {
  return `Chapter ${String(chapter.chapterIndex).padStart(3, "0")}`;
}

export function ProjectSidebar({
  compact,
  projects,
  books,
  volumes,
  chapters,
  selectedProjectId,
  selectedBookId,
  selectedChapterId,
  canonicalChapterIds,
  onSelectProject,
  onSelectBook,
  onSelectChapter,
  onCreateProject,
  onCreateBook,
  onCreateVolume,
  onCreateChapter,
  onRenameChapter,
  onMoveChapter,
  onChangeStatus
}: ProjectSidebarProps): JSX.Element {
  if (compact) {
    return (
      <aside className="min-h-0 border-r border-white/10 bg-black/20">
        <div className="flex h-full flex-col items-center gap-3 px-2 py-4">
          <button
            aria-label="Create chapter"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-forge-blue/35 bg-forge-blue/10 text-forge-blue"
            onClick={() => onCreateChapter(null)}
            type="button"
          >
            +
          </button>
          <div className="h-px w-full bg-white/10" />
          {chapters.slice(0, 12).map((chapter) => (
            <button
              aria-label={chapter.title}
              className={`h-9 w-9 rounded-lg border text-xs transition ${
                selectedChapterId === chapter.id
                  ? "border-forge-blue/45 bg-forge-blue/15 text-forge-blue"
                  : "border-white/10 bg-white/5 text-slate-300 hover:border-white/20"
              }`}
              key={chapter.id}
              onClick={() => onSelectChapter(chapter)}
              type="button"
            >
              {chapter.chapterIndex}
            </button>
          ))}
        </div>
      </aside>
    );
  }

  const unassignedChapters = chapters.filter((chapter) => !chapter.volumeId);

  return (
    <aside className="min-h-0 overflow-hidden border-r border-white/10 bg-black/18">
      <div className="flex h-full flex-col">
        <div className="space-y-3 border-b border-white/10 px-4 py-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
              Projects
            </p>
            <button
              className="rounded-md border border-white/10 px-2 py-1 text-xs text-slate-300 hover:border-forge-blue/40 hover:text-white"
              onClick={onCreateProject}
              type="button"
            >
              New
            </button>
          </div>
          <select
            className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-slate-100 outline-none focus:border-forge-blue/50"
            onChange={(event) => onSelectProject(event.target.value)}
            value={selectedProjectId ?? ""}
          >
            {projects.length === 0 ? <option value="">No project</option> : null}
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </div>

        <div className="min-h-0 flex-1 overflow-auto px-4 py-4">
          <div className="mb-4 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
                Books
              </p>
              <button
                className="rounded-md border border-white/10 px-2 py-1 text-xs text-slate-300 hover:border-forge-violet/40 hover:text-white"
                onClick={onCreateBook}
                type="button"
              >
                Add
              </button>
            </div>
            <div className="space-y-1">
              {books.map((book) => (
                <button
                  className={`w-full rounded-lg px-3 py-2 text-left text-sm transition ${
                    selectedBookId === book.id
                      ? "bg-forge-blue/12 text-forge-blue"
                      : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
                  }`}
                  key={book.id}
                  onClick={() => onSelectBook(book.id)}
                  type="button"
                >
                  {book.title}
                </button>
              ))}
              {books.length === 0 ? (
                <p className="rounded-lg border border-white/10 px-3 py-3 text-sm text-slate-500">
                  No books yet.
                </p>
              ) : null}
            </div>
          </div>

          <div className="mb-4 flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
              Volumes & Chapters
            </p>
            <button
              className="rounded-md border border-white/10 px-2 py-1 text-xs text-slate-300 hover:border-forge-violet/40 hover:text-white"
              onClick={onCreateVolume}
              type="button"
            >
              Volume
            </button>
          </div>

          <div className="space-y-4">
            {volumes.map((volume) => {
              const volumeChapters = chapters.filter((chapter) => chapter.volumeId === volume.id);
              return (
                <section key={volume.id}>
                  <div className="mb-2 flex items-center justify-between">
                    <p className="truncate text-sm font-medium text-slate-200">{volume.title}</p>
                    <button
                      className="text-xs text-forge-blue hover:text-white"
                      onClick={() => onCreateChapter(volume.id)}
                      type="button"
                    >
                      + Chapter
                    </button>
                  </div>
                  <ChapterList
                    canonicalChapterIds={canonicalChapterIds}
                    chapters={volumeChapters}
                    onChangeStatus={onChangeStatus}
                    onMoveChapter={onMoveChapter}
                    onRenameChapter={onRenameChapter}
                    onSelectChapter={onSelectChapter}
                    selectedChapterId={selectedChapterId}
                  />
                </section>
              );
            })}

            {unassignedChapters.length > 0 || volumes.length === 0 ? (
              <section>
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-sm font-medium text-slate-200">
                    {volumes.length === 0 ? "Chapters" : "Unassigned"}
                  </p>
                  <button
                    className="text-xs text-forge-blue hover:text-white"
                    onClick={() => onCreateChapter(null)}
                    type="button"
                  >
                    + Chapter
                  </button>
                </div>
                <ChapterList
                  canonicalChapterIds={canonicalChapterIds}
                  chapters={unassignedChapters.length > 0 ? unassignedChapters : chapters}
                  onChangeStatus={onChangeStatus}
                  onMoveChapter={onMoveChapter}
                  onRenameChapter={onRenameChapter}
                  onSelectChapter={onSelectChapter}
                  selectedChapterId={selectedChapterId}
                />
              </section>
            ) : null}
          </div>
        </div>
      </div>
    </aside>
  );
}

function ChapterList({
  chapters,
  selectedChapterId,
  canonicalChapterIds,
  onSelectChapter,
  onRenameChapter,
  onMoveChapter,
  onChangeStatus
}: {
  chapters: ChapterRecord[];
  selectedChapterId: string | null;
  canonicalChapterIds: Set<string>;
  onSelectChapter: (chapter: ChapterRecord) => void;
  onRenameChapter: (chapter: ChapterRecord) => void;
  onMoveChapter: (chapter: ChapterRecord, direction: "up" | "down") => void;
  onChangeStatus: (chapter: ChapterRecord) => void;
}): JSX.Element {
  if (chapters.length === 0) {
    return (
      <p className="rounded-lg border border-white/10 px-3 py-3 text-sm text-slate-500">
        No chapters yet.
      </p>
    );
  }

  return (
    <div className="space-y-1">
      {chapters.map((chapter) => (
        <div
          className={`group rounded-lg border px-2 py-2 transition ${
            selectedChapterId === chapter.id
              ? "border-forge-blue/35 bg-forge-blue/10"
              : "border-transparent hover:border-white/10 hover:bg-white/5"
          }`}
          key={chapter.id}
        >
          <button
            className="w-full text-left"
            onClick={() => onSelectChapter(chapter)}
            type="button"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-slate-500">{chapterLabel(chapter)}</span>
              {canonicalChapterIds.has(chapter.id) ? (
                <span className="rounded-full border border-forge-mint/30 px-2 py-0.5 text-[10px] text-forge-mint">
                  Canon
                </span>
              ) : null}
            </div>
            <p className="mt-1 line-clamp-2 text-sm text-slate-100">{chapter.title}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <StatusBadge status={chapter.status} />
              <span className="text-[11px] text-slate-500">
                {chapter.currentWords}/{chapter.targetWords}
              </span>
            </div>
          </button>
          <div className="mt-2 flex gap-1 opacity-100 transition md:opacity-0 md:group-hover:opacity-100">
            <button
              className="rounded border border-white/10 px-2 py-1 text-[11px] text-slate-400 hover:text-white"
              onClick={() => onRenameChapter(chapter)}
              type="button"
            >
              Rename
            </button>
            <button
              className="rounded border border-white/10 px-2 py-1 text-[11px] text-slate-400 hover:text-white"
              onClick={() => onMoveChapter(chapter, "up")}
              type="button"
            >
              Up
            </button>
            <button
              className="rounded border border-white/10 px-2 py-1 text-[11px] text-slate-400 hover:text-white"
              onClick={() => onMoveChapter(chapter, "down")}
              type="button"
            >
              Down
            </button>
            <button
              className="rounded border border-white/10 px-2 py-1 text-[11px] text-slate-400 hover:text-white"
              onClick={() => onChangeStatus(chapter)}
              type="button"
            >
              Status
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

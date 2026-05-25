import type { JSX } from "react";
import React from "react";

import type { StoryBibleEntryRecord } from "@contracts/data";

interface StoryBiblePanelProps {
  entries: StoryBibleEntryRecord[];
  onCreateEntry: () => void;
}

export function StoryBiblePanel({ entries, onCreateEntry }: StoryBiblePanelProps): JSX.Element {
  return (
    <section className="rounded-lg border border-white/10 bg-graphite-900/60 p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-white">Story bible</h3>
        <button
          className="rounded-md border border-white/10 px-2 py-1 text-xs text-slate-300 hover:border-forge-blue/40 hover:text-white"
          onClick={onCreateEntry}
          type="button"
        >
          Add
        </button>
      </div>
      <div className="mt-3 space-y-2">
        {entries.slice(0, 5).map((entry) => (
          <article
            className="rounded-lg border border-white/10 bg-black/20 px-3 py-2"
            key={entry.id}
          >
            <div className="flex items-center justify-between gap-2">
              <p className="truncate text-sm text-slate-200">{entry.title}</p>
              <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] text-slate-500">
                {entry.entryType}
              </span>
            </div>
            <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{entry.content}</p>
          </article>
        ))}
        {entries.length === 0 ? (
          <p className="rounded-lg border border-white/10 bg-black/20 px-3 py-3 text-sm text-slate-500">
            No context entries yet.
          </p>
        ) : null}
      </div>
    </section>
  );
}

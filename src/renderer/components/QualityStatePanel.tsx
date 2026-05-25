import React from "react";
import type { JSX } from "react";

import {
  getQualityStateAction,
  redactRenderableText,
  type QualityState,
  type QualityStateTargetView
} from "./quality-state-model";

export interface QualityStatePanelProps {
  state: QualityState;
  detail?: string | null;
  onPrimaryAction: (targetView: QualityStateTargetView) => void;
}

export function QualityStatePanel({
  state,
  detail,
  onPrimaryAction
}: QualityStatePanelProps): JSX.Element {
  const copy = getQualityStateAction(state);
  const toneClass =
    copy.tone === "blue"
      ? "border-forge-blue/25 bg-forge-blue/10 text-forge-blue"
      : copy.tone === "mint"
        ? "border-forge-mint/25 bg-forge-mint/10 text-forge-mint"
        : copy.tone === "violet"
          ? "border-forge-violet/25 bg-forge-violet/10 text-forge-violet"
          : "border-forge-amber/25 bg-forge-amber/10 text-forge-amber";

  return (
    <section aria-label={copy.title} className="rounded-lg border border-white/10 bg-black/24 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <span className={`rounded-full border px-2.5 py-1 text-xs ${toneClass}`}>State</span>
          <h3 className="mt-3 text-sm font-semibold text-white">{copy.title}</h3>
          <p className="mt-1 text-sm leading-6 text-slate-400">{copy.body}</p>
          {detail ? (
            <p className="mt-2 text-xs leading-5 text-slate-500">{redactRenderableText(detail)}</p>
          ) : null}
        </div>
        <button
          className="rounded-md border border-white/10 px-3 py-2 text-sm text-slate-200 transition hover:border-forge-blue/40 hover:text-white focus:border-forge-blue/60 focus:outline-none"
          onClick={() => onPrimaryAction(copy.targetView)}
          type="button"
        >
          {copy.primaryLabel}
        </button>
      </div>
    </section>
  );
}

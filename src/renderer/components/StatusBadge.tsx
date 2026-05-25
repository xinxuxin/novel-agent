import type { JSX } from "react";
import React from "react";

const STATUS_LABELS: Record<string, string> = {
  planned: "Planned",
  outlining: "Outlining",
  drafting: "Drafting",
  reviewing: "Reviewing",
  revised: "Revised",
  approved: "Approved",
  published: "Published"
};

const STATUS_STYLES: Record<string, string> = {
  planned: "border-slate-500/35 bg-slate-500/10 text-slate-300",
  outlining: "border-forge-blue/35 bg-forge-blue/10 text-forge-blue",
  drafting: "border-forge-violet/35 bg-forge-violet/10 text-forge-violet",
  reviewing: "border-forge-amber/35 bg-forge-amber/10 text-forge-amber",
  revised: "border-cyan-300/35 bg-cyan-300/10 text-cyan-200",
  approved: "border-forge-mint/35 bg-forge-mint/10 text-forge-mint",
  published: "border-emerald-300/35 bg-emerald-300/10 text-emerald-200"
};

function statusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status.replace(/_/g, " ");
}

export function StatusBadge({ status }: { status: string }): JSX.Element {
  const label = statusLabel(status);
  return (
    <span
      aria-label={`Status: ${label}`}
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${
        STATUS_STYLES[status] ?? STATUS_STYLES.planned
      }`}
    >
      {label}
    </span>
  );
}

import type { JSX } from "react";
import React from "react";

import type { CostSummary, LLMRunRecord } from "@contracts/ai";

interface CostMeterProps {
  activeRunLabel: string;
  activeRunCost: number;
  sessionCost: number;
  costWarning: string;
  summary: CostSummary | null;
  recentRuns: LLMRunRecord[];
}

export function CostMeter({
  activeRunLabel,
  activeRunCost,
  sessionCost,
  costWarning,
  summary,
  recentRuns
}: CostMeterProps): JSX.Element {
  const total = summary?.finalCost ?? sessionCost;
  const warningActive = !["prices local", "ready", ""].includes(costWarning.toLowerCase());
  const visibleWarning = costWarning === "prices local" ? "本地价格" : costWarning;

  return (
    <section className="rounded-lg border border-white/10 bg-graphite-900/60 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-white">成本</h3>
          <p className="mt-1 text-xs text-slate-500">
            {activeRunLabel === "No active run" ? "无运行" : activeRunLabel}
          </p>
        </div>
        <span className="rounded-full border border-forge-blue/30 bg-forge-blue/10 px-3 py-1 text-xs text-forge-blue">
          ${activeRunCost.toFixed(6)}
        </span>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-lg border border-white/10 bg-black/20 p-3">
          <p className="text-slate-500">本轮</p>
          <p className="mt-1 text-sm text-slate-100">${sessionCost.toFixed(6)}</p>
        </div>
        <div className="rounded-lg border border-white/10 bg-black/20 p-3">
          <p className="text-slate-500">范围</p>
          <p className="mt-1 text-sm text-slate-100">${total.toFixed(6)}</p>
        </div>
      </div>
      <p
        className={`mt-3 rounded-lg border px-3 py-2 text-xs ${
          warningActive
            ? "animate-pulse border-forge-amber/30 bg-forge-amber/10 text-forge-amber motion-reduce:animate-none"
            : "border-white/10 bg-black/20 text-slate-400"
        }`}
      >
        {visibleWarning}
      </p>
      <div className="mt-4 space-y-2">
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
          最近调用
        </p>
        {recentRuns.slice(0, 4).map((run) => (
          <div
            className="flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-black/18 px-3 py-2 text-xs"
            key={run.id}
          >
            <span className="truncate text-slate-300">{run.taskType}</span>
            <span className="text-slate-500">{run.status}</span>
          </div>
        ))}
        {recentRuns.length === 0 ? (
          <p className="text-sm text-slate-500">暂无调用。</p>
        ) : null}
      </div>
    </section>
  );
}

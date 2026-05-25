import { motion, useReducedMotion } from "framer-motion";
import type { JSX } from "react";
import React from "react";

const STAGES = [
  ["Context", "Story bible and recent summaries"],
  ["Outline", "Chapter beats"],
  ["Scene Cards", "Goal, conflict, handoff"],
  ["Draft", "Chinese long-form prose"],
  ["Audit", "Continuity and rhythm"],
  ["Revise", "Human-gated proposal"]
] as const;

export function TaskTimeline({ activeTab }: { activeTab: string }): JSX.Element {
  const reduceMotion = useReducedMotion();

  return (
    <section className="border-t border-white/10 bg-black/20 px-5 py-3">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
          Task timeline
        </p>
        <span className="text-xs text-slate-500">Human gate before canon update</span>
      </div>
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-6">
        {STAGES.map(([stage, description], index) => (
          <div className="rounded-lg border border-white/10 bg-white/[0.035] p-3" key={stage}>
            <div className="flex items-center gap-2">
              <motion.span
                animate={
                  activeTab === "generate" && !reduceMotion
                    ? { opacity: [0.35, 1, 0.35] }
                    : { opacity: 0.8 }
                }
                className={`h-2 w-2 rounded-full ${
                  index === 0 ? "bg-forge-mint" : "bg-forge-blue"
                }`}
                transition={{ duration: 1.4, repeat: Infinity, delay: index * 0.08 }}
              />
              <p className="text-sm text-slate-200">{stage}</p>
            </div>
            <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

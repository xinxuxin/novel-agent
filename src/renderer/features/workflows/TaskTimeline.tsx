import { motion, useReducedMotion } from "framer-motion";
import type { JSX } from "react";
import React from "react";

const STAGES = [
  ["读取大纲", "上下文"],
  ["拆场景", "场景卡"],
  ["起草正文", "正文"],
  ["节奏审稿", "爽点/钩子"],
  ["连贯性审稿", "设定/时间线"],
  ["改写成终稿", "终稿候选"],
  ["人工确认", "保存/设为正文"]
] as const;

export function TaskTimeline({ activeTab }: { activeTab: string }): JSX.Element {
  const reduceMotion = useReducedMotion();

  return (
    <section className="border-t border-white/10 bg-black/20 px-5 py-3">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
          实时工作流
        </p>
        <span className="text-xs text-slate-500">人工确认后才写入正文</span>
      </div>
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-7">
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

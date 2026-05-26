import type { JSX } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";

import type { BookRecord, ChapterRecord, ProjectRecord } from "@contracts/data";
import type {
  ChapterPlanRecord,
  OutlineSourceRecord,
  OutlineVersionRecord,
  PlanEditProposalRecord
} from "@contracts/planning";

interface PlanningLabProps {
  project: ProjectRecord | null;
  book: BookRecord | null;
  chapters: ChapterRecord[];
  selectedChapter: ChapterRecord | null;
  onSelectChapter: (chapter: ChapterRecord) => void;
}

const emptyPlanDraft = {
  title: "",
  targetWords: "3000",
  minWords: "",
  maxWords: "",
  chapterPromise: "",
  openingHook: "",
  mainConflict: "",
  emotionalTurn: "",
  payoff: "",
  endingHook: "",
  userNotes: ""
};

export function PlanningLab({
  project,
  book,
  chapters,
  selectedChapter,
  onSelectChapter
}: PlanningLabProps): JSX.Element {
  const [sources, setSources] = useState<OutlineSourceRecord[]>([]);
  const [versions, setVersions] = useState<OutlineVersionRecord[]>([]);
  const [plans, setPlans] = useState<ChapterPlanRecord[]>([]);
  const [proposals, setProposals] = useState<PlanEditProposalRecord[]>([]);
  const [outlineText, setOutlineText] = useState("");
  const [outlineTitle, setOutlineTitle] = useState("详细大纲");
  const [draft, setDraft] = useState(emptyPlanDraft);
  const [instruction, setInstruction] = useState("");
  const [busy, setBusy] = useState(false);

  const activePlan = useMemo(
    () => plans.find((plan) => plan.chapterId === selectedChapter?.id && plan.status === "accepted") ?? null,
    [plans, selectedChapter?.id]
  );

  const reload = useCallback(async (bookId: string): Promise<void> => {
    const [nextSources, nextVersions, nextPlans, nextProposals] = await Promise.all([
      window.wenforge.planning.outlineSources.list(bookId),
      window.wenforge.planning.outlineVersions.list(bookId),
      window.wenforge.planning.chapterPlans.list(bookId),
      window.wenforge.planning.proposals.list(bookId)
    ]);
    setSources(nextSources);
    setVersions(nextVersions);
    setPlans(nextPlans);
    setProposals(nextProposals);
  }, []);

  useEffect(() => {
    if (!book) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload(book.id);
  }, [book, reload]);

  useEffect(() => {
    const chapter = selectedChapter;
    const plan = activePlan;
    if (!chapter) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDraft(emptyPlanDraft);
      return;
    }
    setDraft({
      title: plan?.title ?? chapter.title,
      targetWords: String(plan?.targetWords ?? chapter.targetWords),
      minWords: String(plan?.minWords ?? chapter.minWords ?? ""),
      maxWords: String(plan?.maxWords ?? chapter.maxWords ?? ""),
      chapterPromise: plan?.chapterPromise ?? "",
      openingHook: plan?.openingHook ?? "",
      mainConflict: plan?.mainConflict ?? "",
      emotionalTurn: plan?.emotionalTurn ?? "",
      payoff: plan?.payoff ?? "",
      endingHook: plan?.endingHook ?? "",
      userNotes: plan?.userNotes ?? ""
    });
  }, [activePlan, selectedChapter]);

  const importOutline = async (sourceType: "paste" | "file", title: string, text: string) => {
    if (!project || !book || text.trim().length === 0) return;
    setBusy(true);
    try {
      const source = await window.wenforge.planning.outlineSources.create({
        projectId: project.id,
        bookId: book.id,
        sourceType,
        title,
        originalText: text
      });
      await window.wenforge.planning.outlineVersions.create({
        bookId: book.id,
        title: `${title} · 可编辑解析`,
        contentJson: JSON.stringify(parseOutlinePreview(text), null, 2),
        contentMarkdown: text,
        sourceId: source.id,
        isActive: true
      });
      setOutlineText("");
      await reload(book.id);
    } finally {
      setBusy(false);
    }
  };

  const saveChapterPlan = async (status: "draft" | "accepted" = "accepted") => {
    if (!book || !selectedChapter) return;
    setBusy(true);
    try {
      await window.wenforge.planning.chapterPlans.upsert({
        ...(activePlan?.id ? { id: activePlan.id } : {}),
        bookId: book.id,
        volumeId: selectedChapter.volumeId,
        chapterId: selectedChapter.id,
        outlineVersionId: versions.find((version) => version.isActive)?.id ?? null,
        chapterIndex: selectedChapter.chapterIndex,
        title: draft.title || selectedChapter.title,
        targetWords: positiveNumber(draft.targetWords) ?? selectedChapter.targetWords,
        minWords: positiveNumber(draft.minWords),
        maxWords: positiveNumber(draft.maxWords),
        chapterPromise: draft.chapterPromise,
        openingHook: draft.openingHook,
        mainConflict: draft.mainConflict,
        emotionalTurn: draft.emotionalTurn,
        payoff: draft.payoff,
        endingHook: draft.endingHook,
        continuityDependenciesJson: "[]",
        userNotes: draft.userNotes,
        status
      });
      await window.wenforge.chapters.update(selectedChapter.id, {
        targetWords: positiveNumber(draft.targetWords) ?? selectedChapter.targetWords,
        minWords: positiveNumber(draft.minWords),
        maxWords: positiveNumber(draft.maxWords),
        lockWordCount: selectedChapter.lockWordCount,
        wordCountPriority: selectedChapter.wordCountPriority
      });
      await reload(book.id);
    } finally {
      setBusy(false);
    }
  };

  const createPlanProposal = async () => {
    if (!book || !activePlan || instruction.trim().length === 0) return;
    const before = {
      openingHook: activePlan.openingHook,
      mainConflict: activePlan.mainConflict,
      endingHook: activePlan.endingHook,
      userNotes: activePlan.userNotes
    };
    const after = {
      ...before,
      userNotes: `${before.userNotes ?? ""}\n${instruction}`.trim(),
      endingHook: instruction.includes("钩子")
        ? "让章末落到一个具体动作、物件或危险信号上。"
        : before.endingHook
    };
    await window.wenforge.planning.proposals.create({
      bookId: book.id,
      targetType: "chapter",
      targetId: activePlan.id,
      instruction,
      beforeJson: JSON.stringify(before, null, 2),
      afterJson: JSON.stringify(after, null, 2),
      rationale: "计划聊天只生成变更提案；需要手动接受后才会进入正式计划。"
    });
    setInstruction("");
    await reload(book.id);
  };

  const acceptProposal = async (proposal: PlanEditProposalRecord) => {
    if (!book) return;
    await window.wenforge.planning.proposals.accept(proposal.id);
    await reload(book.id);
  };

  const rejectProposal = async (proposal: PlanEditProposalRecord) => {
    if (!book) return;
    await window.wenforge.planning.proposals.reject(proposal.id);
    await reload(book.id);
  };

  if (!project || !book) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-slate-400">
        先创建或选择项目和书籍。
      </div>
    );
  }

  return (
    <div className="grid h-full min-h-0 grid-cols-[280px_minmax(0,1fr)_320px] gap-0">
      <aside className="min-h-0 overflow-auto border-r border-white/10 bg-black/15 p-4">
        <h2 className="text-sm font-semibold text-white">规划实验室</h2>
        <div className="mt-4 space-y-2">
          {chapters.map((chapter) => (
            <button
              className={`w-full rounded-lg border px-3 py-2 text-left text-sm ${
                chapter.id === selectedChapter?.id
                  ? "border-forge-blue/40 bg-forge-blue/10 text-white"
                  : "border-white/10 bg-white/[0.03] text-slate-300 hover:border-white/20"
              }`}
              key={chapter.id}
              onClick={() => onSelectChapter(chapter)}
              type="button"
            >
              <span className="block font-medium">第{chapter.chapterIndex}章 · {chapter.title}</span>
              <span className="mt-1 block text-xs text-slate-500">
                {chapter.targetWords}字 · {chapter.wordCountPriority}
              </span>
            </button>
          ))}
        </div>
      </aside>

      <section className="min-h-0 overflow-auto p-5">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <section className="rounded-xl border border-white/10 bg-graphite-900/50 p-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-white">大纲源</h3>
              <label className="cursor-pointer rounded-lg border border-white/10 px-3 py-1.5 text-xs text-slate-300 hover:border-forge-blue/40">
                多文件
                <input
                  accept=".txt,.md,.doc,.docx"
                  className="hidden"
                  multiple
                  onChange={(event) => {
                    const files = Array.from(event.currentTarget.files ?? []);
                    void Promise.all(files.map(async (file) => importOutline("file", file.name, await file.text())));
                    event.currentTarget.value = "";
                  }}
                  type="file"
                />
              </label>
            </div>
            <input
              className="mt-3 w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none focus:border-forge-blue/50"
              onChange={(event) => setOutlineTitle(event.target.value)}
              value={outlineTitle}
            />
            <textarea
              className="mt-3 h-48 w-full resize-none rounded-lg border border-white/10 bg-black/20 p-3 text-sm leading-6 text-slate-100 outline-none focus:border-forge-blue/50"
              onChange={(event) => setOutlineText(event.target.value)}
              placeholder="粘贴详细大纲"
              value={outlineText}
            />
            <button
              className="mt-3 rounded-lg bg-forge-blue px-3 py-2 text-sm font-medium text-black disabled:opacity-40"
              disabled={busy || outlineText.trim().length === 0}
              onClick={() => void importOutline("paste", outlineTitle, outlineText)}
              type="button"
            >
              保存为可编辑大纲
            </button>
            <div className="mt-4 space-y-2">
              {sources.map((source) => (
                <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3" key={source.id}>
                  <p className="text-sm font-medium text-white">{source.title}</p>
                  <p className="mt-1 text-xs text-slate-500">{source.sourceType} · {source.createdAt}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-xl border border-white/10 bg-graphite-900/50 p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">章节计划</h3>
              <button
                className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-slate-300 hover:border-forge-blue/40"
                onClick={() => void saveChapterPlan("draft")}
                type="button"
              >
                存草稿
              </button>
            </div>
            <PlanFields draft={draft} onChange={setDraft} />
            <button
              className="mt-3 rounded-lg bg-forge-blue px-3 py-2 text-sm font-medium text-black disabled:opacity-40"
              disabled={!selectedChapter || busy}
              onClick={() => void saveChapterPlan("accepted")}
              type="button"
            >
              接受为当前计划
            </button>
          </section>
        </div>
      </section>

      <aside className="min-h-0 overflow-auto border-l border-white/10 bg-black/20 p-4">
        <h3 className="text-sm font-semibold text-white">计划聊天</h3>
        <textarea
          className="mt-3 h-28 w-full resize-none rounded-lg border border-white/10 bg-black/20 p-3 text-sm text-white outline-none focus:border-forge-blue/50"
          onChange={(event) => setInstruction(event.target.value)}
          placeholder="例如：第 12 章减少到 3000 字，结尾钩子更强"
          value={instruction}
        />
        <button
          className="mt-3 w-full rounded-lg border border-forge-violet/40 bg-forge-violet/15 px-3 py-2 text-sm text-forge-violet disabled:opacity-40"
          disabled={!activePlan || instruction.trim().length === 0}
          onClick={() => void createPlanProposal()}
          type="button"
        >
          生成提案
        </button>
        <div className="mt-5 space-y-3">
          {proposals.map((proposal) => (
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3" key={proposal.id}>
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-white">{proposal.instruction}</p>
                <span className="rounded border border-white/10 px-2 py-0.5 text-[11px] text-slate-400">
                  {proposal.status}
                </span>
              </div>
              <pre className="mt-2 max-h-36 overflow-auto whitespace-pre-wrap rounded-lg bg-black/25 p-2 text-xs text-slate-300">
                {proposal.afterJson}
              </pre>
              <div className="mt-3 flex gap-2">
                <button className="rounded-md bg-forge-blue px-2 py-1 text-xs text-black" onClick={() => void acceptProposal(proposal)} type="button">
                  接受
                </button>
                <button className="rounded-md border border-white/10 px-2 py-1 text-xs text-slate-300" onClick={() => void rejectProposal(proposal)} type="button">
                  拒绝
                </button>
              </div>
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}

function PlanFields({
  draft,
  onChange
}: {
  draft: typeof emptyPlanDraft;
  onChange: (draft: typeof emptyPlanDraft) => void;
}): JSX.Element {
  const fields: Array<[keyof typeof emptyPlanDraft, string, "input" | "textarea"]> = [
    ["title", "标题", "input"],
    ["targetWords", "目标字数", "input"],
    ["minWords", "最少字数", "input"],
    ["maxWords", "最多字数", "input"],
    ["chapterPromise", "本章承诺", "textarea"],
    ["openingHook", "开场钩子", "textarea"],
    ["mainConflict", "主冲突", "textarea"],
    ["emotionalTurn", "情绪转折", "textarea"],
    ["payoff", "兑现", "textarea"],
    ["endingHook", "章末钩子", "textarea"],
    ["userNotes", "备注", "textarea"]
  ];
  return (
    <div className="mt-3 grid gap-3">
      {fields.map(([key, label, kind]) => (
        <label className="grid gap-1 text-xs text-slate-500" key={key}>
          {label}
          {kind === "input" ? (
            <input
              className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none focus:border-forge-blue/50"
              onChange={(event) => onChange({ ...draft, [key]: event.target.value })}
              value={draft[key]}
            />
          ) : (
            <textarea
              className="min-h-16 resize-y rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm leading-6 text-white outline-none focus:border-forge-blue/50"
              onChange={(event) => onChange({ ...draft, [key]: event.target.value })}
              value={draft[key]}
            />
          )}
        </label>
      ))}
    </div>
  );
}

function parseOutlinePreview(text: string): Record<string, unknown> {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 400);
  return {
    parseConfidence: lines.length > 0 ? 0.62 : 0,
    warnings: lines.length > 80 ? ["大纲较长，建议在规划实验室逐卷确认。"] : [],
    lines
  };
}

function positiveNumber(value: string): number | null {
  const numberValue = Number.parseInt(value, 10);
  return Number.isFinite(numberValue) && numberValue > 0 ? numberValue : null;
}

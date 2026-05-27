import type { JSX } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";

import type { BookRecord, ChapterRecord, ProjectRecord } from "@contracts/data";
import type {
  ChapterPlanRecord,
  MaterialDigestRecord,
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
  onOpenGenerate?: () => void;
  onOpenIntake?: () => void;
}

const emptyPlanDraft = {
  title: "",
  targetWords: "3000",
  minWords: "",
  maxWords: "",
  wordCountPriority: "normal",
  chapterSummary: "",
  chapterPromise: "",
  openingHook: "",
  mainConflict: "",
  conflictEscalation: "",
  keyEvents: "",
  sceneCards: "",
  emotionalTurn: "",
  payoff: "",
  endingHook: "",
  continuityDependencies: "",
  charactersInvolved: "",
  storyBibleFactsUsed: "",
  foreshadowingSeeded: "",
  foreshadowingResolved: "",
  unresolvedHooksCarriedForward: "",
  userNotes: "",
  riskNotes: ""
};

type PlanDraft = typeof emptyPlanDraft;

const MICRO_EDIT_ACTIONS = [
  "强化本章钩子",
  "让冲突更尖锐",
  "调整目标字数",
  "增加悬念",
  "减少说明",
  "提高原创性",
  "更像连载网文",
  "拆成更多场景",
  "合并场景",
  "只重生成本章细纲"
] as const;

export function PlanningLab({
  project,
  book,
  chapters,
  selectedChapter,
  onSelectChapter,
  onOpenGenerate,
  onOpenIntake
}: PlanningLabProps): JSX.Element {
  const [sources, setSources] = useState<OutlineSourceRecord[]>([]);
  const [versions, setVersions] = useState<OutlineVersionRecord[]>([]);
  const [digests, setDigests] = useState<MaterialDigestRecord[]>([]);
  const [plans, setPlans] = useState<ChapterPlanRecord[]>([]);
  const [proposals, setProposals] = useState<PlanEditProposalRecord[]>([]);
  const [outlineText, setOutlineText] = useState("");
  const [outlineTitle, setOutlineTitle] = useState("详细大纲");
  const [draft, setDraft] = useState<PlanDraft>(emptyPlanDraft);
  const [instruction, setInstruction] = useState("");
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [checkedPlanIds, setCheckedPlanIds] = useState<Set<string>>(() => new Set());
  const [busy, setBusy] = useState(false);

  const latestDigest = digests[0] ?? null;
  const digestView = useMemo(() => parseDigest(latestDigest), [latestDigest]);
  const planForSelectedChapter = useMemo(
    () =>
      plans.find((plan) => plan.id === selectedPlanId) ??
      plans.find((plan) => plan.chapterId === selectedChapter?.id && plan.status !== "archived") ??
      null,
    [plans, selectedChapter?.id, selectedPlanId]
  );
  const acceptedPlan =
    planForSelectedChapter?.status === "accepted" ? planForSelectedChapter : null;

  const reload = useCallback(async (bookId: string): Promise<void> => {
    const [nextSources, nextVersions, nextDigests, nextPlans, nextProposals] = await Promise.all([
      window.wenforge.planning.outlineSources.list(bookId),
      window.wenforge.planning.outlineVersions.list(bookId),
      window.wenforge.planning.materialDigests.list(bookId),
      window.wenforge.planning.chapterPlans.list(bookId),
      window.wenforge.planning.proposals.list(bookId)
    ]);
    setSources(nextSources);
    setVersions(nextVersions);
    setDigests(nextDigests);
    setPlans(nextPlans);
    setProposals(nextProposals);
  }, []);

  useEffect(() => {
    if (!book) return;
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) void reload(book.id);
    });
    return () => {
      cancelled = true;
    };
  }, [book, reload]);

  useEffect(() => {
    let cancelled = false;
    const nextDraft = planForSelectedChapter
      ? draftFromPlan(planForSelectedChapter)
      : selectedChapter
        ? draftFromChapter(selectedChapter)
        : emptyPlanDraft;
    const nextPlanId = planForSelectedChapter?.id ?? null;
    queueMicrotask(() => {
      if (cancelled) return;
      setDraft(nextDraft);
      if (nextPlanId) {
        setSelectedPlanId(nextPlanId);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [planForSelectedChapter, selectedChapter]);
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

  const buildDigest = async (): Promise<MaterialDigestRecord | null> => {
    if (!book) return null;
    setBusy(true);
    try {
      const digest = await window.wenforge.planning.materialDigests.createFromMaterials(book.id);
      await reload(book.id);
      return digest;
    } finally {
      setBusy(false);
    }
  };

  const generateChapterPlans = async (): Promise<void> => {
    if (!book) return;
    setBusy(true);
    try {
      const digest =
        latestDigest ??
        (await window.wenforge.planning.materialDigests.createFromMaterials(book.id));
      const parsedDigest = parseDigest(digest);
      const activeOutlineId =
        versions.find((version) => version.isActive)?.id ?? digest.outlineVersionId;
      for (const chapter of chapters) {
        const existing = plans.find(
          (plan) => plan.chapterId === chapter.id && plan.status !== "archived"
        );
        if (existing?.status === "accepted") continue;
        await window.wenforge.planning.chapterPlans.upsert(
          localPlanFromMaterials({
            bookId: book.id,
            chapter,
            digest: parsedDigest,
            outlineVersionId: activeOutlineId ?? null,
            existing: existing ?? null
          })
        );
      }
      await reload(book.id);
    } finally {
      setBusy(false);
    }
  };

  const saveChapterPlan = async (status: "draft" | "accepted" | "rejected" = "draft") => {
    if (!book || !selectedChapter) return;
    setBusy(true);
    try {
      const plan = await window.wenforge.planning.chapterPlans.upsert({
        ...(planForSelectedChapter?.id ? { id: planForSelectedChapter.id } : {}),
        bookId: book.id,
        volumeId: selectedChapter.volumeId,
        chapterId: selectedChapter.id,
        outlineVersionId: versions.find((version) => version.isActive)?.id ?? null,
        chapterIndex: selectedChapter.chapterIndex,
        title: draft.title || selectedChapter.title,
        targetWords: positiveNumber(draft.targetWords) ?? selectedChapter.targetWords,
        minWords: positiveNumber(draft.minWords),
        maxWords: positiveNumber(draft.maxWords),
        wordCountPriority: wordCountPriority(draft.wordCountPriority),
        chapterSummary: draft.chapterSummary,
        chapterPromise: draft.chapterPromise,
        openingHook: draft.openingHook,
        mainConflict: draft.mainConflict,
        conflictEscalation: draft.conflictEscalation,
        keyEventsJson: jsonList(draft.keyEvents),
        sceneCardsJson: jsonList(draft.sceneCards),
        emotionalTurn: draft.emotionalTurn,
        payoff: draft.payoff,
        endingHook: draft.endingHook,
        continuityDependenciesJson: jsonList(draft.continuityDependencies),
        charactersInvolvedJson: jsonList(draft.charactersInvolved),
        storyBibleFactsUsedJson: jsonList(draft.storyBibleFactsUsed),
        foreshadowingSeededJson: jsonList(draft.foreshadowingSeeded),
        foreshadowingResolvedJson: jsonList(draft.foreshadowingResolved),
        unresolvedHooksCarriedForwardJson: jsonList(draft.unresolvedHooksCarriedForward),
        userNotes: draft.userNotes,
        riskNotes: draft.riskNotes,
        status
      });
      setSelectedPlanId(plan.id);
      await window.wenforge.chapters.update(selectedChapter.id, {
        targetWords: positiveNumber(draft.targetWords) ?? selectedChapter.targetWords,
        minWords: positiveNumber(draft.minWords),
        maxWords: positiveNumber(draft.maxWords),
        lockWordCount: selectedChapter.lockWordCount,
        wordCountPriority: wordCountPriority(draft.wordCountPriority)
      });
      await reload(book.id);
    } finally {
      setBusy(false);
    }
  };

  const acceptCheckedPlans = async (): Promise<void> => {
    if (!book) return;
    const selected = plans.filter((plan) => checkedPlanIds.has(plan.id));
    if (selected.length === 0) return;
    setBusy(true);
    try {
      for (const plan of selected) {
        await window.wenforge.planning.chapterPlans.upsert({
          ...plan,
          status: "accepted"
        });
      }
      setCheckedPlanIds(new Set());
      await reload(book.id);
    } finally {
      setBusy(false);
    }
  };

  const regenerateSelectedPlan = async (): Promise<void> => {
    if (!book || !planForSelectedChapter) return;
    const chapter = chapters.find((item) => item.id === planForSelectedChapter.chapterId);
    if (!chapter) return;
    setBusy(true);
    try {
      const digest =
        latestDigest ??
        (await window.wenforge.planning.materialDigests.createFromMaterials(book.id));
      const regenerated = localPlanFromMaterials({
        bookId: book.id,
        chapter,
        digest: parseDigest(digest),
        outlineVersionId:
          versions.find((version) => version.isActive)?.id ?? digest.outlineVersionId,
        existing: planForSelectedChapter,
        forceStatus: "proposed"
      });
      await window.wenforge.planning.chapterPlans.upsert(regenerated);
      await reload(book.id);
    } finally {
      setBusy(false);
    }
  };

  const createPlanProposal = async (actionLabel = instruction): Promise<void> => {
    if (!book || !planForSelectedChapter || actionLabel.trim().length === 0) return;
    const before = planProposalSnapshot(planForSelectedChapter);
    const after = microEditAfter(before, actionLabel.trim());
    await window.wenforge.planning.proposals.create({
      bookId: book.id,
      targetType: "chapter",
      targetId: planForSelectedChapter.id,
      instruction: actionLabel.trim(),
      beforeJson: JSON.stringify(before, null, 2),
      afterJson: JSON.stringify(after, null, 2),
      rationale: "细纲微调只生成提案；接受后才会写回章节计划。"
    });
    setInstruction("");
    await reload(book.id);
  };

  const acceptProposal = async (proposal: PlanEditProposalRecord): Promise<void> => {
    if (!book || proposal.status !== "proposed") return;
    await window.wenforge.planning.proposals.accept(proposal.id);
    const plan = plans.find((item) => item.id === proposal.targetId);
    const after = parseJsonObject(proposal.afterJson);
    if (plan && after) {
      await window.wenforge.planning.chapterPlans.upsert({
        ...plan,
        ...proposalPatchToPlan(after),
        status: plan.status
      });
    }
    await reload(book.id);
  };

  const rejectProposal = async (proposal: PlanEditProposalRecord): Promise<void> => {
    if (!book) return;
    await window.wenforge.planning.proposals.reject(proposal.id);
    await reload(book.id);
  };

  const openGenerationForSelected = (): void => {
    const chapter = chapters.find((item) => item.id === planForSelectedChapter?.chapterId);
    if (!chapter || planForSelectedChapter?.status !== "accepted") return;
    onSelectChapter(chapter);
    onOpenGenerate?.();
  };

  if (!project || !book) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-slate-400">
        先创建或选择项目和书籍。
      </div>
    );
  }

  return (
    <div className="grid h-full min-h-0 grid-cols-[280px_minmax(0,1fr)_360px] gap-0">
      <aside className="min-h-0 overflow-auto border-r border-white/10 bg-black/15 p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-white">规划实验室</h2>
          <span className="text-[11px] text-slate-500">{plans.length} 个细纲</span>
        </div>
        <button
          className="mt-3 w-full rounded-md border border-forge-blue/30 bg-forge-blue/10 px-3 py-2 text-xs text-forge-blue"
          onClick={onOpenIntake}
          type="button"
        >
          打开整理素材
        </button>
        <div className="mt-4 space-y-2">
          {chapters.map((chapter) => {
            const plan = plans.find(
              (item) => item.chapterId === chapter.id && item.status !== "archived"
            );
            return (
              <button
                className={`w-full rounded-lg border px-3 py-2 text-left text-sm ${
                  chapter.id === selectedChapter?.id
                    ? "border-forge-blue/40 bg-forge-blue/10 text-white"
                    : "border-white/10 bg-white/[0.03] text-slate-300 hover:border-white/20"
                }`}
                key={chapter.id}
                onClick={() => {
                  onSelectChapter(chapter);
                  setSelectedPlanId(plan?.id ?? null);
                }}
                type="button"
              >
                <span className="block font-medium">
                  第{chapter.chapterIndex}章 · {chapter.title}
                </span>
                <span className="mt-1 block text-xs text-slate-500">
                  {chapter.targetWords}字 · {plan?.status ?? "未生成细纲"}
                </span>
              </button>
            );
          })}
        </div>
      </aside>

      <section className="min-h-0 overflow-auto p-5">
        <section className="rounded-xl border border-white/10 bg-graphite-900/50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-white">整理素材并生成章节细纲</h3>
              <p className="mt-1 text-xs text-slate-500">
                只读取已保存、已接受或用户提供的材料；被拒绝的提案不会当作正史。
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                className="rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-200 hover:border-forge-blue/40 disabled:opacity-40"
                disabled={busy}
                onClick={() => void buildDigest()}
                type="button"
              >
                整理素材
              </button>
              <button
                className="rounded-lg bg-forge-blue px-3 py-2 text-xs font-medium text-black disabled:opacity-40"
                disabled={busy || chapters.length === 0}
                onClick={() => void generateChapterPlans()}
                type="button"
              >
                生成章节细纲
              </button>
            </div>
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            <div>
              <input
                className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none focus:border-forge-blue/50"
                onChange={(event) => setOutlineTitle(event.target.value)}
                value={outlineTitle}
              />
              <textarea
                className="mt-3 h-32 w-full resize-none rounded-lg border border-white/10 bg-black/20 p-3 text-sm leading-6 text-slate-100 outline-none focus:border-forge-blue/50"
                onChange={(event) => setOutlineText(event.target.value)}
                placeholder="粘贴原始想法、旧大纲、章节要求或读者定位"
                value={outlineText}
              />
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  className="rounded-lg border border-forge-blue/35 bg-forge-blue/10 px-3 py-2 text-xs text-forge-blue disabled:opacity-40"
                  disabled={busy || outlineText.trim().length === 0}
                  onClick={() => void importOutline("paste", outlineTitle, outlineText)}
                  type="button"
                >
                  保存素材
                </button>
                <label className="cursor-pointer rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-300 hover:border-forge-blue/40">
                  多文件
                  <input
                    accept=".txt,.md,.doc,.docx"
                    className="hidden"
                    multiple
                    onChange={(event) => {
                      const files = Array.from(event.currentTarget.files ?? []);
                      void Promise.all(
                        files.map(async (file) =>
                          importOutline("file", file.name, await file.text())
                        )
                      );
                      event.currentTarget.value = "";
                    }}
                    type="file"
                  />
                </label>
              </div>
              <div className="mt-4 grid gap-2">
                {sources.slice(0, 4).map((source) => (
                  <div
                    className="rounded-lg border border-white/10 bg-white/[0.03] p-3"
                    key={source.id}
                  >
                    <p className="text-sm font-medium text-white">{source.title}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {source.sourceType} · {source.createdAt}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <MaterialDigestPanel digest={digestView} record={latestDigest} />
          </div>
        </section>

        <section className="mt-4 rounded-xl border border-white/10 bg-graphite-900/50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-white">章节细纲表</h3>
            <div className="flex flex-wrap gap-2">
              <button
                className="rounded-lg border border-forge-mint/35 bg-forge-mint/10 px-3 py-2 text-xs text-forge-mint disabled:opacity-40"
                disabled={busy || checkedPlanIds.size === 0}
                onClick={() => void acceptCheckedPlans()}
                type="button"
              >
                确认选中细纲
              </button>
              <button
                className="rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-200 hover:border-forge-blue/40 disabled:opacity-40"
                disabled={busy || !planForSelectedChapter}
                onClick={() => void regenerateSelectedPlan()}
                type="button"
              >
                重生成选中
              </button>
              <button
                className="rounded-lg bg-forge-blue px-3 py-2 text-xs font-medium text-black disabled:opacity-40"
                disabled={planForSelectedChapter?.status !== "accepted"}
                onClick={openGenerationForSelected}
                type="button"
              >
                生成选中章节
              </button>
            </div>
          </div>
          <div className="mt-4 overflow-hidden rounded-lg border border-white/10">
            <table className="w-full table-fixed text-left text-xs">
              <thead className="bg-white/[0.04] text-slate-500">
                <tr>
                  <th className="w-10 px-3 py-2">选</th>
                  <th className="w-16 px-3 py-2">章</th>
                  <th className="px-3 py-2">标题</th>
                  <th className="w-24 px-3 py-2">字数</th>
                  <th className="w-24 px-3 py-2">状态</th>
                  <th className="px-3 py-2">承诺 / 钩子</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {plans.length === 0 ? (
                  <tr>
                    <td className="px-3 py-5 text-center text-slate-500" colSpan={6}>
                      还没有章节细纲。先整理素材，再生成章节细纲。
                    </td>
                  </tr>
                ) : null}
                {plans.map((plan) => (
                  <tr
                    className={`cursor-pointer bg-black/15 hover:bg-white/[0.04] ${
                      plan.id === planForSelectedChapter?.id
                        ? "outline outline-1 outline-forge-blue/40"
                        : ""
                    }`}
                    key={plan.id}
                    onClick={() => {
                      const chapter = chapters.find((item) => item.id === plan.chapterId);
                      if (chapter) onSelectChapter(chapter);
                      setSelectedPlanId(plan.id);
                    }}
                  >
                    <td className="px-3 py-2">
                      <input
                        checked={checkedPlanIds.has(plan.id)}
                        onChange={(event) => {
                          event.stopPropagation();
                          setCheckedPlanIds((current) => {
                            const next = new Set(current);
                            if (next.has(plan.id)) next.delete(plan.id);
                            else next.add(plan.id);
                            return next;
                          });
                        }}
                        onClick={(event) => event.stopPropagation()}
                        type="checkbox"
                      />
                    </td>
                    <td className="px-3 py-2 text-slate-400">第{plan.chapterIndex}章</td>
                    <td className="truncate px-3 py-2 text-slate-100">{plan.title}</td>
                    <td className="px-3 py-2 text-slate-400">{plan.targetWords}</td>
                    <td className="px-3 py-2">
                      <StatusText status={plan.status} />
                    </td>
                    <td className="truncate px-3 py-2 text-slate-400">
                      {plan.chapterPromise || plan.openingHook || plan.endingHook || "待补充"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </section>

      <aside className="min-h-0 overflow-auto border-l border-white/10 bg-black/20 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-white">细纲详情</h3>
            <p className="mt-1 text-xs text-slate-500">
              {acceptedPlan ? "已确认，可用于起草。" : "起草前需要确认细纲。"}
            </p>
          </div>
          {planForSelectedChapter ? <StatusText status={planForSelectedChapter.status} /> : null}
        </div>
        <PlanFields draft={draft} onChange={setDraft} />
        <div className="mt-3 grid grid-cols-3 gap-2">
          <button
            className="rounded-md border border-white/10 bg-black/20 px-2 py-2 text-xs text-slate-200 disabled:opacity-40"
            disabled={!selectedChapter || busy}
            onClick={() => void saveChapterPlan("draft")}
            type="button"
          >
            存草稿
          </button>
          <button
            className="rounded-md border border-forge-mint/35 bg-forge-mint/10 px-2 py-2 text-xs text-forge-mint disabled:opacity-40"
            disabled={!selectedChapter || busy}
            onClick={() => void saveChapterPlan("accepted")}
            type="button"
          >
            接受
          </button>
          <button
            className="rounded-md border border-red-400/25 bg-red-400/10 px-2 py-2 text-xs text-red-200 disabled:opacity-40"
            disabled={!selectedChapter || busy}
            onClick={() => void saveChapterPlan("rejected")}
            type="button"
          >
            拒绝
          </button>
        </div>

        <div className="mt-5">
          <h4 className="text-xs font-semibold text-slate-300">AI 微调提案</h4>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {MICRO_EDIT_ACTIONS.map((action) => (
              <button
                className="rounded-md border border-white/10 bg-white/[0.03] px-2 py-2 text-left text-[11px] text-slate-300 hover:border-forge-violet/40 disabled:opacity-40"
                disabled={!planForSelectedChapter}
                key={action}
                onClick={() => void createPlanProposal(action)}
                type="button"
              >
                {action}
              </button>
            ))}
          </div>
          <textarea
            className="mt-3 h-24 w-full resize-none rounded-lg border border-white/10 bg-black/20 p-3 text-sm text-white outline-none focus:border-forge-blue/50"
            onChange={(event) => setInstruction(event.target.value)}
            placeholder="例如：第 12 章减少到 3000 字，结尾钩子更强"
            value={instruction}
          />
          <button
            className="mt-2 w-full rounded-lg border border-forge-violet/40 bg-forge-violet/15 px-3 py-2 text-sm text-forge-violet disabled:opacity-40"
            disabled={!planForSelectedChapter || instruction.trim().length === 0}
            onClick={() => void createPlanProposal()}
            type="button"
          >
            生成提案
          </button>
        </div>

        <div className="mt-5 space-y-3">
          {proposals
            .filter(
              (proposal) =>
                !planForSelectedChapter || proposal.targetId === planForSelectedChapter.id
            )
            .map((proposal) => (
              <div
                className="rounded-xl border border-white/10 bg-white/[0.03] p-3"
                key={proposal.id}
              >
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
                  <button
                    className="rounded-md bg-forge-blue px-2 py-1 text-xs text-black disabled:opacity-40"
                    disabled={proposal.status !== "proposed"}
                    onClick={() => void acceptProposal(proposal)}
                    type="button"
                  >
                    接受
                  </button>
                  <button
                    className="rounded-md border border-white/10 px-2 py-1 text-xs text-slate-300 disabled:opacity-40"
                    disabled={proposal.status !== "proposed"}
                    onClick={() => void rejectProposal(proposal)}
                    type="button"
                  >
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

function MaterialDigestPanel({
  digest,
  record
}: {
  digest: Record<string, unknown> | null;
  record: MaterialDigestRecord | null;
}): JSX.Element {
  const warnings = parseJsonArray(record?.warningsJson ?? "[]").map(String);
  return (
    <div className="rounded-lg border border-white/10 bg-black/20 p-4">
      <div className="flex items-center justify-between gap-3">
        <h4 className="text-sm font-semibold text-white">素材摘要</h4>
        <span className="text-[11px] text-slate-500">{record?.createdAt ?? "未整理"}</span>
      </div>
      {digest ? (
        <div className="mt-3 grid gap-2 text-xs leading-5">
          <DigestLine label="前提" value={digest.book_premise} />
          <DigestLine label="类型" value={digest.genre} />
          <DigestLine label="读者" value={digest.target_reader} />
          <DigestLine label="当前状态" value={digest.current_story_state} />
          <DigestLine label="未解钩子" value={digest.unresolved_hooks} />
          <DigestLine label="缺失信息" value={digest.missing_information} />
        </div>
      ) : (
        <p className="mt-3 text-sm leading-6 text-slate-500">
          点击“整理素材”后，这里会显示前提、冲突、连续性约束、缺失信息和歧义警告。
        </p>
      )}
      {warnings.length > 0 ? (
        <div className="mt-3 rounded-lg border border-forge-amber/25 bg-forge-amber/10 p-3">
          {warnings.map((warning) => (
            <p className="text-xs text-forge-amber" key={warning}>
              {warning}
            </p>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function DigestLine({ label, value }: { label: string; value: unknown }): JSX.Element {
  return (
    <div className="grid grid-cols-[64px_minmax(0,1fr)] gap-2">
      <span className="text-slate-500">{label}</span>
      <span className="text-slate-300">{formatDigestValue(value)}</span>
    </div>
  );
}

function StatusText({ status }: { status: string }): JSX.Element {
  const tone =
    status === "accepted"
      ? "border-forge-mint/30 bg-forge-mint/10 text-forge-mint"
      : status === "rejected"
        ? "border-red-400/25 bg-red-400/10 text-red-200"
        : "border-forge-amber/25 bg-forge-amber/10 text-forge-amber";
  const label =
    status === "accepted"
      ? "已确认"
      : status === "rejected"
        ? "已拒绝"
        : status === "proposed"
          ? "待确认"
          : "草稿";
  return <span className={`rounded-full border px-2 py-0.5 text-[11px] ${tone}`}>{label}</span>;
}

function PlanFields({
  draft,
  onChange
}: {
  draft: PlanDraft;
  onChange: (draft: PlanDraft) => void;
}): JSX.Element {
  const fields: Array<[keyof PlanDraft, string, "input" | "textarea" | "select"]> = [
    ["title", "标题", "input"],
    ["targetWords", "目标字数", "input"],
    ["minWords", "最少字数", "input"],
    ["maxWords", "最多字数", "input"],
    ["wordCountPriority", "字数优先级", "select"],
    ["chapterSummary", "章节摘要", "textarea"],
    ["chapterPromise", "本章承诺", "textarea"],
    ["openingHook", "开场钩子", "textarea"],
    ["mainConflict", "主冲突", "textarea"],
    ["conflictEscalation", "冲突升级", "textarea"],
    ["keyEvents", "关键事件", "textarea"],
    ["sceneCards", "场景卡", "textarea"],
    ["emotionalTurn", "情绪转折", "textarea"],
    ["payoff", "兑现", "textarea"],
    ["endingHook", "章末钩子", "textarea"],
    ["continuityDependencies", "连续性依赖", "textarea"],
    ["charactersInvolved", "出场角色", "textarea"],
    ["storyBibleFactsUsed", "使用设定", "textarea"],
    ["foreshadowingSeeded", "埋设伏笔", "textarea"],
    ["foreshadowingResolved", "兑现伏笔", "textarea"],
    ["unresolvedHooksCarriedForward", "延续钩子", "textarea"],
    ["userNotes", "备注", "textarea"],
    ["riskNotes", "风险", "textarea"]
  ];
  return (
    <div className="mt-3 grid gap-3">
      {fields.map(([key, label, kind]) => (
        <label className="grid gap-1 text-xs text-slate-500" key={key}>
          {label}
          {kind === "select" ? (
            <select
              className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none focus:border-forge-blue/50"
              onChange={(event) => onChange({ ...draft, [key]: event.target.value })}
              value={draft[key]}
            >
              <option value="loose">宽松</option>
              <option value="normal">普通</option>
              <option value="strict">严格</option>
            </select>
          ) : kind === "input" ? (
            <input
              className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none focus:border-forge-blue/50"
              onChange={(event) => onChange({ ...draft, [key]: event.target.value })}
              value={draft[key]}
            />
          ) : (
            <textarea
              className="min-h-14 resize-y rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm leading-6 text-white outline-none focus:border-forge-blue/50"
              onChange={(event) => onChange({ ...draft, [key]: event.target.value })}
              value={draft[key]}
            />
          )}
        </label>
      ))}
    </div>
  );
}

function draftFromChapter(chapter: ChapterRecord): PlanDraft {
  return {
    ...emptyPlanDraft,
    title: chapter.title,
    targetWords: String(chapter.targetWords),
    minWords: String(chapter.minWords ?? ""),
    maxWords: String(chapter.maxWords ?? ""),
    wordCountPriority: chapter.wordCountPriority,
    chapterSummary: chapter.summary ?? ""
  };
}

function draftFromPlan(plan: ChapterPlanRecord): PlanDraft {
  return {
    title: plan.title,
    targetWords: String(plan.targetWords),
    minWords: String(plan.minWords ?? ""),
    maxWords: String(plan.maxWords ?? ""),
    wordCountPriority: plan.wordCountPriority,
    chapterSummary: plan.chapterSummary ?? "",
    chapterPromise: plan.chapterPromise ?? "",
    openingHook: plan.openingHook ?? "",
    mainConflict: plan.mainConflict ?? "",
    conflictEscalation: plan.conflictEscalation ?? "",
    keyEvents: parseJsonArray(plan.keyEventsJson).join("\n"),
    sceneCards: parseJsonArray(plan.sceneCardsJson).join("\n"),
    emotionalTurn: plan.emotionalTurn ?? "",
    payoff: plan.payoff ?? "",
    endingHook: plan.endingHook ?? "",
    continuityDependencies: parseJsonArray(plan.continuityDependenciesJson).join("\n"),
    charactersInvolved: parseJsonArray(plan.charactersInvolvedJson).join("\n"),
    storyBibleFactsUsed: parseJsonArray(plan.storyBibleFactsUsedJson).join("\n"),
    foreshadowingSeeded: parseJsonArray(plan.foreshadowingSeededJson).join("\n"),
    foreshadowingResolved: parseJsonArray(plan.foreshadowingResolvedJson).join("\n"),
    unresolvedHooksCarriedForward: parseJsonArray(plan.unresolvedHooksCarriedForwardJson).join(
      "\n"
    ),
    userNotes: plan.userNotes ?? "",
    riskNotes: plan.riskNotes ?? ""
  };
}

function localPlanFromMaterials(input: {
  bookId: string;
  chapter: ChapterRecord;
  digest: Record<string, unknown> | null;
  outlineVersionId: string | null;
  existing?: ChapterPlanRecord | null;
  forceStatus?: "draft" | "proposed" | "accepted" | "rejected";
}): Partial<ChapterPlanRecord> & Pick<ChapterPlanRecord, "bookId" | "chapterIndex" | "title"> {
  const hook = firstString(input.digest?.unresolved_hooks) ?? "留下一个具体、可追踪的新问题";
  const conflict = firstString(input.digest?.key_conflicts) ?? "围绕已知目标制造外部阻力";
  const continuity = stringArray(input.digest?.continuity_constraints).slice(0, 6);
  const characters = stringArray(input.digest?.key_characters).slice(0, 6);
  const summary =
    input.chapter.summary ??
    `承接现有素材，完成第${input.chapter.chapterIndex}章的读者承诺，并把冲突推进到下一章。`;
  return {
    ...(input.existing?.id ? { id: input.existing.id } : {}),
    bookId: input.bookId,
    volumeId: input.chapter.volumeId,
    chapterId: input.chapter.id,
    outlineVersionId: input.outlineVersionId,
    chapterIndex: input.chapter.chapterIndex,
    title: input.existing?.title ?? input.chapter.title,
    targetWords: input.chapter.targetWords,
    minWords: input.chapter.minWords,
    maxWords: input.chapter.maxWords,
    wordCountPriority: input.chapter.wordCountPriority,
    chapterSummary: summary,
    chapterPromise: `兑现“${input.chapter.title}”的核心推进：发现、选择、代价或爽点至少落地一个。`,
    openingHook: `开场用一个可见异常或压力切入：${hook}`,
    mainConflict: conflict,
    conflictEscalation: "让阻力从信息不明升级到必须行动，避免只靠解释推进。",
    keyEventsJson: JSON.stringify([summary, conflict, hook], null, 2),
    sceneCardsJson: JSON.stringify(
      [
        "场景一：用具体压力开场，交代目标。",
        "场景二：冲突升级，人物必须做选择。",
        "场景三：兑现本章承诺，并抛出章末钩子。"
      ],
      null,
      2
    ),
    emotionalTurn: "角色从被动应对转为带着代价主动推进。",
    payoff: "兑现一个已承诺的信息、爽点、关系变化或能力限制。",
    endingHook: hook,
    continuityDependenciesJson: JSON.stringify(continuity, null, 2),
    charactersInvolvedJson: JSON.stringify(characters, null, 2),
    storyBibleFactsUsedJson: JSON.stringify(continuity.slice(0, 4), null, 2),
    foreshadowingSeededJson: JSON.stringify([hook], null, 2),
    foreshadowingResolvedJson: JSON.stringify([], null, 2),
    unresolvedHooksCarriedForwardJson: JSON.stringify(
      stringArray(input.digest?.unresolved_hooks).slice(0, 6),
      null,
      2
    ),
    userNotes: input.existing?.userNotes ?? "",
    riskNotes: "本地生成的细纲需要人工确认；不要自动改正史或故事圣经。",
    status: input.forceStatus ?? input.existing?.status ?? "proposed"
  };
}

function planProposalSnapshot(plan: ChapterPlanRecord): Record<string, unknown> {
  return {
    chapterSummary: plan.chapterSummary,
    chapterPromise: plan.chapterPromise,
    openingHook: plan.openingHook,
    mainConflict: plan.mainConflict,
    conflictEscalation: plan.conflictEscalation,
    sceneCards: parseJsonArray(plan.sceneCardsJson),
    endingHook: plan.endingHook,
    targetWords: plan.targetWords,
    userNotes: plan.userNotes,
    riskNotes: plan.riskNotes
  };
}

function microEditAfter(
  before: Record<string, unknown>,
  instruction: string
): Record<string, unknown> {
  const after = { ...before };
  if (instruction.includes("钩子") || instruction.includes("悬念")) {
    after.openingHook = `${before.openingHook ?? ""}\n增加一个开场即可感知的危险信号。`.trim();
    after.endingHook = "章末落到具体动作、物件、倒计时、来信、伤口或目击者反应上。";
  }
  if (instruction.includes("冲突")) {
    after.mainConflict = `${before.mainConflict ?? ""}\n把阻力改成必须立即选择的外部压力。`.trim();
    after.conflictEscalation = "每一场都让代价变得更具体、更近。";
  }
  if (instruction.includes("字数")) {
    after.targetWords = Math.max(1200, Number(before.targetWords ?? 3000) - 300);
  }
  if (instruction.includes("场景") || instruction.includes("拆")) {
    after.sceneCards = [
      ...stringArray(before.sceneCards),
      "新增场景：用行动和反应承接上一场代价。"
    ];
  }
  after.userNotes = `${before.userNotes ?? ""}\n微调：${instruction}`.trim();
  after.riskNotes = "接受提案前检查是否改变已确认正史。";
  return after;
}

function proposalPatchToPlan(after: Record<string, unknown>): Partial<ChapterPlanRecord> {
  const patch: Partial<ChapterPlanRecord> = {
    chapterSummary: stringOrNull(after.chapterSummary),
    chapterPromise: stringOrNull(after.chapterPromise),
    openingHook: stringOrNull(after.openingHook),
    mainConflict: stringOrNull(after.mainConflict),
    conflictEscalation: stringOrNull(after.conflictEscalation),
    sceneCardsJson: JSON.stringify(stringArray(after.sceneCards), null, 2),
    endingHook: stringOrNull(after.endingHook),
    userNotes: stringOrNull(after.userNotes),
    riskNotes: stringOrNull(after.riskNotes)
  };
  const targetWords = positiveNumber(String(after.targetWords ?? ""));
  return targetWords ? { ...patch, targetWords } : patch;
}

function parseOutlinePreview(text: string): Record<string, unknown> {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 400);
  return {
    parseConfidence: lines.length > 0 ? 0.62 : 0,
    warnings: lines.length > 80 ? ["大纲较长，建议分批确认。"] : [],
    lines
  };
}

function parseDigest(record: MaterialDigestRecord | null): Record<string, unknown> | null {
  return parseJsonObject(record?.digestJson ?? "");
}

function parseJsonObject(text: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(text) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function parseJsonArray(text: string): unknown[] {
  try {
    const parsed = JSON.parse(text) as unknown;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function jsonList(value: string): string {
  return JSON.stringify(
    value
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean),
    null,
    2
  );
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item === "string") return item;
      if (item && typeof item === "object") {
        const record = item as Record<string, unknown>;
        return String(record.name ?? record.title ?? record.summary ?? record.hookText ?? "");
      }
      return String(item ?? "");
    })
    .filter(Boolean);
}

function firstString(value: unknown): string | null {
  return stringArray(value)[0] ?? null;
}

function formatDigestValue(value: unknown): string {
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === "string" ? item : JSON.stringify(item)))
      .slice(0, 4)
      .join("；");
  }
  return typeof value === "string" && value.trim().length > 0 ? value : "未填写";
}

function positiveNumber(value: string): number | null {
  const numberValue = Number.parseInt(value, 10);
  return Number.isFinite(numberValue) && numberValue > 0 ? numberValue : null;
}

function wordCountPriority(value: string): "loose" | "normal" | "strict" {
  return value === "loose" || value === "strict" ? value : "normal";
}

function stringOrNull(value: unknown): string | null {
  if (value === null || typeof value === "undefined") return null;
  const text = String(value).trim();
  return text.length > 0 ? text : null;
}

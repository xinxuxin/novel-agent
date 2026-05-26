import { motion, useReducedMotion } from "framer-motion";
import type { DragEvent, JSX } from "react";
import { useEffect, useMemo, useState } from "react";

import type { ChapterWorkflowDetail, WorkflowArtifactRecord } from "@contracts/workflow";
import type { CrossCheckType } from "@contracts/cross-check";
import type {
  BookRecord,
  ChapterRecord,
  ManuscriptVersionRecord,
  ProjectRecord,
  VolumeRecord
} from "@contracts/data";
import type { ModelProfileRecord } from "@contracts/model-routing";
import { QUALITY_MODES } from "@shared/domain/model-routing";
import type { QualityMode, TaskType } from "@shared/domain/model-routing";
import { importOutlineFile } from "./outline-file-import";

interface WorkflowGeneratePanelProps {
  activeBook: BookRecord | null;
  activeChapter: ChapterRecord | null;
  activeProject: ProjectRecord | null;
  activeVolume: VolumeRecord | null;
  onCanonicalChanged: (version: ManuscriptVersionRecord) => void;
  onVersionCreated: (version: ManuscriptVersionRecord) => void;
  onWorkflowCostChange: (label: string, cost: number, warning: string) => void;
}

const WORKFLOW_PREVIEW_TASKS: TaskType[] = [
  "chapter_outline",
  "scene_cards",
  "draft_chapter",
  "continuity_audit",
  "suspense_hook_audit",
  "revise_chapter",
  "state_settlement"
];

const CROSS_CHECK_ACTIONS: Array<{ label: string; type: CrossCheckType }> = [
  { label: "世界观交叉检查", type: "worldbuilding_cross_check" },
  { label: "原创性审稿", type: "originality_audit" },
  { label: "主线逻辑审稿", type: "main_plot_logic_audit" },
  { label: "卷纲交叉检查", type: "volume_outline_cross_check" },
  { label: "关键章预检", type: "key_chapter_preflight_cross_check" }
];

const QUALITY_LABELS: Record<QualityMode, string> = {
  economy: "省钱",
  balanced: "均衡",
  premium: "高质量",
  premium_webnovel: "网文高级"
};

const LIVE_WORKFLOW_STAGES = [
  { label: "读取大纲", nodes: ["prepare_context", "retrieve_memory"] },
  { label: "拆场景", nodes: ["generate_chapter_outline", "generate_scene_cards"] },
  { label: "起草正文", nodes: ["draft_chapter"] },
  { label: "节奏审稿", nodes: ["webnovel_rhythm_audit"] },
  { label: "连贯性审稿", nodes: ["continuity_audit"] },
  { label: "改写成终稿", nodes: ["revise_draft"] },
  { label: "人工确认", nodes: ["human_gate"] }
] as const;

export function WorkflowGeneratePanel({
  activeBook,
  activeChapter,
  activeProject,
  activeVolume,
  onCanonicalChanged,
  onVersionCreated,
  onWorkflowCostChange
}: WorkflowGeneratePanelProps): JSX.Element {
  const reduceMotion = useReducedMotion();
  const [detail, setDetail] = useState<ChapterWorkflowDetail | null>(null);
  const [busy, setBusy] = useState(false);
  const [acceptedVersion, setAcceptedVersion] = useState<ManuscriptVersionRecord | null>(null);
  const [executionMode, setExecutionMode] = useState<"mock" | "provider">("mock");
  const [qualityMode, setQualityMode] = useState<QualityMode>("balanced");
  const [modelProfiles, setModelProfiles] = useState<ModelProfileRecord[]>([]);
  const [routeOverrideModelProfileId, setRouteOverrideModelProfileId] = useState("");
  const [sourceOutline, setSourceOutline] = useState("");
  const [outlineImportStatus, setOutlineImportStatus] = useState("拖入 .docx / .txt / .md");
  const [dragActive, setDragActive] = useState(false);
  const [optimisticStageIndex, setOptimisticStageIndex] = useState(0);
  const [allowStoryChanges, setAllowStoryChanges] = useState(true);
  const [desiredOutput, setDesiredOutput] = useState<
    "outline" | "scene_cards" | "draft" | "final_manuscript"
  >("final_manuscript");
  const latestRevision = useMemo(() => findLatestArtifact(detail, "revision"), [detail]);
  const latestDraft = useMemo(() => findLatestArtifact(detail, "draft"), [detail]);
  const displayArtifact = latestRevision ?? latestDraft;
  const completedNodes = useMemo(
    () =>
      new Set(
        detail?.checkpoints.map((checkpoint) => checkpoint.nodeName) ?? []
      ),
    [detail]
  );

  useEffect(() => {
    let mounted = true;

    async function loadLatestRun(): Promise<void> {
      if (!activeChapter) {
        setDetail(null);
        setAcceptedVersion(null);
        return;
      }
      const runs = await window.wenforge.generation.listRunsByChapter(activeChapter.id);
      const latest = runs[0] ? await window.wenforge.generation.getRun(runs[0].id) : null;
      if (!mounted) return;
      setDetail(latest);
      if (latest) {
        onWorkflowCostChange(
          latest.run.status === "paused" ? "Workflow paused" : `Workflow ${latest.run.status}`,
          latest.costSummary.finalCost || latest.costSummary.estimatedCostLive,
          latest.run.humanGateStatus
        );
      }
    }

    void loadLatestRun();
    return () => {
      mounted = false;
    };
  }, [activeChapter, onWorkflowCostChange]);

  useEffect(() => {
    let mounted = true;
    void window.wenforge.modelProfiles.list().then((profiles) => {
      if (mounted) {
        setModelProfiles(profiles.filter((profile) => profile.enabled));
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!busy) {
      return;
    }
    const timer = window.setInterval(() => {
      setOptimisticStageIndex((current) =>
        Math.min(current + 1, LIVE_WORKFLOW_STAGES.length - 2)
      );
    }, 700);
    return () => window.clearInterval(timer);
  }, [busy]);

  const refreshDetail = async (runId: string): Promise<ChapterWorkflowDetail | null> => {
    const next = await window.wenforge.generation.getRun(runId);
    setDetail(next);
    if (next) {
      onWorkflowCostChange(
        next.run.status === "paused" ? "Workflow paused" : `Workflow ${next.run.status}`,
        next.costSummary.finalCost || next.costSummary.estimatedCostLive,
        next.run.humanGateStatus
      );
    }
    return next;
  };

  const startWorkflow = async (label: string): Promise<void> => {
    if (!activeProject || !activeBook || !activeChapter) return;
    const outline = sourceOutline.trim() || activeChapter.summary?.trim() || "";
    if (!outline) {
      window.alert("请先拖入或粘贴详细大纲。");
      return;
    }
    const confirmed =
      executionMode === "mock"
        ? window.confirm(`${label}？`)
        : await confirmProviderPreflight();
    if (!confirmed) return;
    setBusy(true);
    setOptimisticStageIndex(0);
    try {
      const run = await window.wenforge.generation.chapter.start({
        projectId: activeProject.id,
        bookId: activeBook.id,
        volumeId: activeVolume?.id ?? activeChapter.volumeId,
        chapterId: activeChapter.id,
        qualityMode,
        executionMode,
        routeOverrideModelProfileId: routeOverrideModelProfileId || null,
        sourceOutline: outline,
        allowStoryChanges,
        desiredOutput,
        userInstruction: buildOutlineInstruction(label, allowStoryChanges),
        targetTokenBudget: 4000,
        confirmed: true
      });
      await refreshDetail(run.id);
      setAcceptedVersion(null);
    } finally {
      setBusy(false);
    }
  };

  const importDroppedOutline = async (file: File): Promise<void> => {
    try {
      setOutlineImportStatus("读取中");
      const imported = await importOutlineFile(file);
      setSourceOutline(imported.text);
      setOutlineImportStatus(`已导入：${imported.fileName}`);
    } catch (error) {
      setOutlineImportStatus(error instanceof Error ? error.message : "导入失败");
    } finally {
      setDragActive(false);
    }
  };

  const handleOutlineDrop = (event: DragEvent<HTMLDivElement>): void => {
    event.preventDefault();
    const file = event.dataTransfer.files.item(0);
    if (file) void importDroppedOutline(file);
    else setDragActive(false);
  };

  const confirmProviderPreflight = async (): Promise<boolean> => {
    const previews = await Promise.all(
      WORKFLOW_PREVIEW_TASKS.map((taskType) =>
        window.wenforge.modelRoutes.resolvePreview(taskType, qualityMode, {
          expectedTokens: {
            inputTokens: 4000,
            outputTokens:
              taskType === "draft_chapter" || taskType === "revise_chapter" ? 8000 : 1500
          },
          userOverrideModelProfileId: routeOverrideModelProfileId || null
        })
      )
    );
    const unavailable = previews.filter((preview) => !preview.available);
    if (unavailable.length > 0) {
      window.alert(
        `模型路线未就绪：\n${unavailable
          .map((preview) => `${preview.taskType}: ${preview.errors.join(", ")}`)
          .join("\n")}`
      );
      return false;
    }
    const maxCost = previews.reduce(
      (total, preview) => total + preview.estimatedCostRange.maxCost,
      0
    );
    const routeLines = previews
      .map(
        (preview) =>
          `${preview.taskType}: ${preview.modelProfile?.displayName ?? "unavailable"} · $${preview.estimatedCostRange.maxCost.toFixed(6)}`
      )
      .join("\n");
    const premiumNote =
      qualityMode === "premium_webnovel"
        ? "\n\n网文高级路线可能增加多模型检查成本。"
        : "";
    return window.confirm(
      `运行真实模型？\n\n${routeLines}\n\n最高预估：$${maxCost.toFixed(6)}${premiumNote}\n不会覆盖正文。`
    );
  };

  const runCrossCheck = async (type: CrossCheckType): Promise<void> => {
    if (!activeProject || !activeBook) return;
    const confirmed = window.confirm("将调用多个模型，可能产生成本。继续？");
    if (!confirmed) return;
    setBusy(true);
    try {
      const contextText = [
        `项目：${activeProject.name}`,
        `书：${activeBook.title}`,
        activeVolume ? `卷：${activeVolume.title}` : null,
        activeChapter ? `章节：${activeChapter.title}` : null,
        activeChapter?.summary ? `摘要：${activeChapter.summary}` : null
      ]
        .filter(Boolean)
        .join("\n");
      const result = await window.wenforge.crossCheck.run({
        type,
        projectId: activeProject.id,
        bookId: activeBook.id,
        chapterId: activeChapter?.id ?? null,
        contextText,
        budgetCapUsd: 0.5,
        confirmed: true
      });
      await refreshDetail(result.generationRunId);
      onWorkflowCostChange("交叉检查完成", result.summary.costSummary.estimatedTotal, "");
    } finally {
      setBusy(false);
    }
  };

  const approveWorkflow = async (): Promise<void> => {
    if (!detail) return;
    setBusy(true);
    try {
      const run = await window.wenforge.generation.resume({
        runId: detail.run.id,
        action: "accept"
      });
      await refreshDetail(run.id);
    } finally {
      setBusy(false);
    }
  };

  const requestRevision = async (): Promise<void> => {
    if (!detail) return;
    const userInstruction = window.prompt("改写要求", "结尾钩子再具体一点");
    if (!userInstruction?.trim()) return;
    setBusy(true);
    try {
      const run = await window.wenforge.generation.requestRevision({
        runId: detail.run.id,
        userInstruction: userInstruction.trim()
      });
      await refreshDetail(run.id);
    } finally {
      setBusy(false);
    }
  };

  const acceptRevisionAsVersion = async (): Promise<void> => {
    if (!detail || !latestRevision) return;
    const version = await window.wenforge.generation.acceptArtifactAsVersion({
      runId: detail.run.id,
      artifactId: latestRevision.id,
      title: latestRevision.title ?? "生成终稿"
    });
    setAcceptedVersion(version);
    onVersionCreated(version);
  };

  const setAcceptedCanonical = async (): Promise<void> => {
    if (!activeChapter || !acceptedVersion) return;
    const confirmed = window.confirm("设为正式正文？");
    if (!confirmed) return;
    const canonical = await window.wenforge.generation.setAcceptedVersionCanonical({
      chapterId: activeChapter.id,
      versionId: acceptedVersion.id,
      confirmed
    });
    if (canonical) {
      onCanonicalChanged(canonical);
    }
  };

  const cancelWorkflow = async (): Promise<void> => {
    if (!detail) return;
    const confirmed = window.confirm("取消本次工作流？记录会保留。");
    if (!confirmed) return;
    const run = await window.wenforge.generation.cancel(detail.run.id, true);
    if (run) {
      await refreshDetail(run.id);
    }
  };

  const stageStates = LIVE_WORKFLOW_STAGES.map((stage, index) => {
    const completed =
      stage.nodes.every((node) => completedNodes.has(node)) ||
      (detail?.run.status === "paused" && index === LIVE_WORKFLOW_STAGES.length - 1);
    return {
      ...stage,
      active: busy
        ? index === optimisticStageIndex
        : !completed &&
          index ===
            LIVE_WORKFLOW_STAGES.findIndex(
              (item, itemIndex) =>
                !item.nodes.every((node) => completedNodes.has(node)) &&
                !(detail?.run.status === "paused" && itemIndex === LIVE_WORKFLOW_STAGES.length - 1)
            ),
      completed
    };
  });

  return (
    <div className="h-full overflow-auto px-6 py-4">
      <div className="grid gap-4">
        <section className="space-y-4">
          <div className="rounded-lg border border-forge-blue/25 bg-forge-blue/8 p-4">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
              <div className="min-w-0">
                <p className="text-xs font-medium tracking-[0.16em] text-forge-blue">大纲成稿</p>
                <h3 className="mt-1 text-lg font-semibold text-white">
                  拖入大纲，生成终稿候选。
                </h3>
                <div
                  className={`mt-3 rounded-lg border p-3 transition ${
                    dragActive
                      ? "border-forge-blue/70 bg-forge-blue/15"
                      : "border-white/10 bg-black/18"
                  }`}
                  onDragLeave={() => setDragActive(false)}
                  onDragOver={(event) => {
                    event.preventDefault();
                    setDragActive(true);
                  }}
                  onDrop={handleOutlineDrop}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs font-medium tracking-[0.14em] text-slate-500">
                      详细大纲
                    </span>
                    <span className="truncate text-xs text-slate-500">{outlineImportStatus}</span>
                  </div>
                  <textarea
                    className="mt-2 min-h-40 w-full resize-y rounded-lg border border-white/10 bg-black/35 p-4 text-sm leading-7 text-slate-100 outline-none placeholder:text-slate-600 focus:border-forge-blue/50"
                    placeholder={`例：\n第一场：雨夜公交站，主角听见倒计时。\n第二场：倒计时指向即将出事的女孩。\n第三场：主角救人后能力失控。\n章末：女孩手腕出现同样符号。`}
                    value={sourceOutline}
                    onChange={(event) => setSourceOutline(event.target.value)}
                  />
                </div>
              </div>
              <div className="rounded-lg border border-white/10 bg-black/24 p-3 text-xs text-slate-400">
                <span className="font-medium tracking-[0.14em] text-slate-500">实时工作流</span>
                <WorkflowStageRail stages={stageStates} reduceMotion={Boolean(reduceMotion)} />
                <button
                  className="mt-3 w-full rounded-lg border border-forge-blue/40 bg-forge-blue/18 px-4 py-2.5 text-sm font-semibold text-forge-blue transition hover:bg-forge-blue/25 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={busy || !activeChapter}
                  onClick={() => void startWorkflow("生成终稿")}
                  type="button"
                >
                  生成终稿
                </button>
                <div className="mt-4 space-y-3">
                  <label className="block">
                    <span className="text-[11px] font-medium tracking-[0.14em] text-slate-500">
                      执行
                    </span>
                    <select
                      className="mt-1.5 h-9 w-full rounded-md border border-white/10 bg-black/30 px-3 text-xs text-white outline-none focus:border-forge-blue/50"
                      value={executionMode}
                      onChange={(event) =>
                        setExecutionMode(event.target.value as "mock" | "provider")
                      }
                    >
                      <option value="mock">本地模拟</option>
                      <option value="provider">真实模型</option>
                    </select>
                  </label>
                  <label className="block">
                    <span className="text-[11px] font-medium tracking-[0.14em] text-slate-500">
                      质量
                    </span>
                    <select
                      className="mt-1.5 h-9 w-full rounded-md border border-white/10 bg-black/30 px-3 text-xs text-white outline-none focus:border-forge-blue/50"
                      value={qualityMode}
                      onChange={(event) => setQualityMode(event.target.value as QualityMode)}
                    >
                      {QUALITY_MODES.map((mode) => (
                        <option key={mode} value={mode}>
                          {QUALITY_LABELS[mode]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className="text-[11px] font-medium tracking-[0.14em] text-slate-500">
                      输出
                    </span>
                    <select
                      className="mt-1.5 h-9 w-full rounded-md border border-white/10 bg-black/30 px-3 text-xs text-white outline-none focus:border-forge-blue/50"
                      value={desiredOutput}
                      onChange={(event) =>
                        setDesiredOutput(
                          event.target.value as
                            | "outline"
                            | "scene_cards"
                            | "draft"
                            | "final_manuscript"
                        )
                      }
                    >
                      <option value="final_manuscript">终稿候选</option>
                      <option value="draft">只起草</option>
                      <option value="scene_cards">只拆场景</option>
                      <option value="outline">只细化大纲</option>
                    </select>
                  </label>
                  <label className="flex items-start gap-2 rounded-lg border border-white/10 bg-black/24 px-3 py-2 text-xs text-slate-300">
                    <input
                      checked={allowStoryChanges}
                      className="mt-0.5 accent-forge-blue"
                      onChange={(event) => setAllowStoryChanges(event.target.checked)}
                      type="checkbox"
                    />
                    允许改动情节/设定
                  </label>
                  {executionMode === "provider" ? (
                    <select
                      className="h-9 w-full rounded-md border border-white/10 bg-black/30 px-3 text-xs text-white outline-none focus:border-forge-blue/50"
                      value={routeOverrideModelProfileId}
                      onChange={(event) => setRouteOverrideModelProfileId(event.target.value)}
                    >
                      <option value="">使用路线</option>
                      {modelProfiles.map((profile) => (
                        <option key={profile.id} value={profile.id}>
                          {profile.displayName} · {profile.provider}/{profile.model}
                        </option>
                      ))}
                    </select>
                  ) : null}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-white/10 bg-black/25 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-medium tracking-[0.16em] text-slate-500">终稿候选</p>
                <h3 className="mt-1 text-base font-semibold text-white">
                  {detail ? workflowStatusLabel(detail.run.status) : "未开始"}
                </h3>
              </div>
              <div className="rounded-md border border-white/10 bg-white/[0.03] px-3 py-2 text-right">
                <p className="text-[11px] tracking-[0.14em] text-slate-500">成本</p>
                <p className="text-sm font-semibold text-forge-mint">
                  ${(detail?.costSummary.finalCost ?? 0).toFixed(6)}
                </p>
              </div>
            </div>

            <div className="mt-4 min-h-[220px] rounded-lg border border-white/10 bg-white/[0.025] p-5">
              {displayArtifact ? (
                <pre className="whitespace-pre-wrap text-sm leading-7 text-slate-200">
                  {displayArtifact.contentText}
                </pre>
              ) : (
                <div>
                  <p className="max-w-2xl text-sm leading-7 text-slate-400">等待生成。</p>
                  <div className="mt-6 flex gap-2">
                    {[0, 1, 2].map((item) => (
                      <motion.span
                        className="h-2 w-12 rounded-full bg-forge-blue/50"
                        key={item}
                        {...(reduceMotion
                          ? {}
                          : {
                              animate: { opacity: [0.35, 1, 0.35] },
                              transition: { duration: 1.2, repeat: Infinity, delay: item * 0.16 }
                            })}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <TimelineList detail={detail} />
              <ArtifactList detail={detail} />
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <div className="rounded-lg border border-forge-violet/25 bg-forge-violet/10 p-3">
            <p className="text-xs font-medium tracking-[0.14em] text-forge-violet">多模型检查</p>
            <div className="mt-3 space-y-2">
              {CROSS_CHECK_ACTIONS.map((action) => (
                <button
                  className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-left text-xs text-slate-200 hover:border-forge-violet/40 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={busy || !activeBook}
                  key={action.type}
                  onClick={() => void runCrossCheck(action.type)}
                  type="button"
                >
                  {action.label}
                  <span className="mt-1 block text-[11px] text-slate-500">
                    独立审稿 · 聚合分歧 · 市场适配
                  </span>
                </button>
              ))}
            </div>
          </div>

          <HumanGateControls
            acceptedVersion={acceptedVersion}
            busy={busy}
            detail={detail}
            latestRevision={latestRevision}
            onAcceptRevision={acceptRevisionAsVersion}
            onApproveWorkflow={approveWorkflow}
            onCancel={cancelWorkflow}
            onRequestRevision={requestRevision}
            onSetCanonical={setAcceptedCanonical}
          />
          <RunAttemptDetails detail={detail} />
        </section>
      </div>
    </div>
  );
}

function TimelineList({ detail }: { detail: ChapterWorkflowDetail | null }): JSX.Element {
  const checkpoints = detail?.checkpoints ?? [];
  return (
    <div className="rounded-lg border border-white/10 bg-black/20 p-4">
      <h4 className="text-sm font-semibold text-white">节点记录</h4>
      <div className="mt-3 space-y-2">
        {checkpoints.length === 0 ? (
          <p className="text-sm text-slate-500">暂无记录。</p>
        ) : (
          checkpoints.map((checkpoint) => (
            <div
              className="flex items-center justify-between gap-3 rounded-md border border-white/10 bg-white/[0.03] px-3 py-2 text-xs"
              key={checkpoint.id}
            >
              <span className="text-slate-200">{checkpoint.nodeName}</span>
              <span className="text-slate-500">
                {String(checkpoint.state.status ?? "recorded")}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function ArtifactList({ detail }: { detail: ChapterWorkflowDetail | null }): JSX.Element {
  const artifacts = detail?.artifacts ?? [];
  return (
    <div className="rounded-lg border border-white/10 bg-black/20 p-4">
      <h4 className="text-sm font-semibold text-white">生成记录</h4>
      <div className="mt-3 space-y-2">
        {artifacts.length === 0 ? (
          <p className="text-sm text-slate-500">暂无记录。</p>
        ) : (
          artifacts.map((artifact) => (
            <div
              className="rounded-md border border-white/10 bg-white/[0.03] px-3 py-2"
              key={artifact.id}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-slate-200">{artifact.artifactType}</span>
                <span className="text-[11px] text-slate-500">{artifact.sourceNode}</span>
              </div>
              <p className="mt-1 line-clamp-2 text-xs text-slate-500">{artifact.title}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function WorkflowStageRail({
  stages,
  reduceMotion
}: {
  stages: Array<{ label: string; active: boolean; completed: boolean }>;
  reduceMotion: boolean;
}): JSX.Element {
  return (
    <div className="mt-3 space-y-1.5">
      {stages.map((stage, index) => (
        <div
          className={`flex items-center gap-2 rounded-md border px-2 py-1.5 ${
            stage.completed
              ? "border-forge-mint/25 bg-forge-mint/10 text-forge-mint"
              : stage.active
                ? "border-forge-blue/35 bg-forge-blue/12 text-forge-blue"
                : "border-white/10 bg-black/20 text-slate-500"
          }`}
          key={stage.label}
        >
          <motion.span
            className={`h-2 w-2 rounded-full ${
              stage.completed ? "bg-forge-mint" : stage.active ? "bg-forge-blue" : "bg-slate-600"
            }`}
            {...(stage.active && !reduceMotion
              ? {
                  animate: { opacity: [0.35, 1, 0.35] },
                  transition: { duration: 1, repeat: Infinity }
                }
              : {})}
          />
          <span className="w-5 text-[11px] tabular-nums">{index + 1}</span>
          <span className="text-xs">{stage.label}</span>
        </div>
      ))}
    </div>
  );
}

function workflowStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    queued: "排队中",
    running: "运行中",
    paused: "等待确认",
    completed: "已完成",
    error: "失败",
    cancelled: "已取消"
  };
  return labels[status] ?? status;
}

function HumanGateControls({
  acceptedVersion,
  busy,
  detail,
  latestRevision,
  onAcceptRevision,
  onApproveWorkflow,
  onCancel,
  onRequestRevision,
  onSetCanonical
}: {
  acceptedVersion: ManuscriptVersionRecord | null;
  busy: boolean;
  detail: ChapterWorkflowDetail | null;
  latestRevision: WorkflowArtifactRecord | null;
  onAcceptRevision: () => Promise<void>;
  onApproveWorkflow: () => Promise<void>;
  onCancel: () => Promise<void>;
  onRequestRevision: () => Promise<void>;
  onSetCanonical: () => Promise<void>;
}): JSX.Element {
  const paused = detail?.run.status === "paused";
  return (
    <div className="rounded-lg border border-forge-violet/20 bg-forge-violet/10 p-4">
      <h4 className="text-sm font-semibold text-white">人工确认</h4>
      <div className="mt-4 space-y-2">
        <button
          className="w-full rounded-md border border-forge-mint/30 bg-forge-mint/10 px-3 py-2 text-left text-xs text-forge-mint disabled:cursor-not-allowed disabled:opacity-50"
          disabled={!paused || busy}
          onClick={() => void onApproveWorkflow()}
          type="button"
        >
          进入设定结算
        </button>
        <button
          className="w-full rounded-md border border-white/10 bg-black/20 px-3 py-2 text-left text-xs text-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={!paused || !latestRevision || busy}
          onClick={() => void onAcceptRevision()}
          type="button"
        >
          保存为版本
        </button>
        <button
          className="w-full rounded-md border border-forge-amber/30 bg-forge-amber/10 px-3 py-2 text-left text-xs text-forge-amber disabled:cursor-not-allowed disabled:opacity-50"
          disabled={!acceptedVersion || busy}
          onClick={() => void onSetCanonical()}
          type="button"
        >
          设为正式正文
        </button>
        <button
          className="w-full rounded-md border border-white/10 bg-black/20 px-3 py-2 text-left text-xs text-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={!paused || busy}
          onClick={() => void onRequestRevision()}
          type="button"
        >
          再改一版
        </button>
        <button
          className="w-full rounded-md border border-red-400/25 bg-red-400/10 px-3 py-2 text-left text-xs text-red-200 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={!detail || busy || detail.run.status === "completed"}
          onClick={() => void onCancel()}
          type="button"
        >
          取消工作流
        </button>
      </div>
    </div>
  );
}

function RunAttemptDetails({ detail }: { detail: ChapterWorkflowDetail | null }): JSX.Element {
  const runs = detail?.llmRuns ?? [];
  return (
    <div className="rounded-lg border border-white/10 bg-black/20 p-4">
      <h4 className="text-sm font-semibold text-white">模型调用</h4>
      <div className="mt-3 space-y-2">
        {runs.length === 0 ? (
          <p className="text-xs leading-5 text-slate-500">暂无调用。</p>
        ) : (
          runs.map((run) => (
            <div
              className="rounded-md border border-white/10 bg-white/[0.03] px-3 py-2"
              key={run.id}
            >
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="font-medium text-slate-200">
                  {run.provider}/{run.model}
                </span>
                <span className={run.status === "succeeded" ? "text-forge-mint" : "text-amber-200"}>
                  {run.status}
                </span>
              </div>
              <p className="mt-1 text-[11px] text-slate-500">
                {run.taskType} · {run.latencyMs ?? 0}ms · $
                {(run.finalCost ?? run.estimatedCostLive).toFixed(6)} · {run.usageSource}
              </p>
              {run.errorCode ? (
                <p className="mt-1 text-[11px] text-red-200">{run.errorCode}</p>
              ) : null}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function findLatestArtifact(
  detail: ChapterWorkflowDetail | null,
  artifactType: string
): WorkflowArtifactRecord | null {
  const artifacts = detail?.artifacts.filter((artifact) => artifact.artifactType === artifactType);
  return artifacts?.at(-1) ?? null;
}

function buildOutlineInstruction(label: string, allowStoryChanges: boolean): string {
  const changePolicy = allowStoryChanges
    ? "可以提出并吸收情节或设定强化，但必须保留用户大纲的主线承诺。"
    : "不得改动用户大纲的关键设定、情节顺序和章末钩子。";
  return `${label}\n${changePolicy}\n最终输出必须是可保存的中文正文草稿，不要直接覆盖 canon。`;
}

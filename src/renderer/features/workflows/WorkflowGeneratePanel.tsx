import { motion, useReducedMotion } from "framer-motion";
import type { JSX } from "react";
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
  { label: "Run Worldbuilding Cross-Check", type: "worldbuilding_cross_check" },
  { label: "Run Originality Audit", type: "originality_audit" },
  { label: "Run Plot Logic Audit", type: "main_plot_logic_audit" },
  { label: "Run Volume Outline Cross-Check", type: "volume_outline_cross_check" },
  { label: "Run Key Chapter Preflight", type: "key_chapter_preflight_cross_check" }
];

const QUALITY_LABELS: Record<QualityMode, string> = {
  economy: "Economy",
  balanced: "Balanced",
  premium: "Premium",
  premium_webnovel: "Premium Webnovel"
};

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
  const [allowStoryChanges, setAllowStoryChanges] = useState(true);
  const [desiredOutput, setDesiredOutput] = useState<
    "outline" | "scene_cards" | "draft" | "final_manuscript"
  >("final_manuscript");
  const latestRevision = useMemo(() => findLatestArtifact(detail, "revision"), [detail]);
  const latestDraft = useMemo(() => findLatestArtifact(detail, "draft"), [detail]);
  const displayArtifact = latestRevision ?? latestDraft;

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
      window.alert("Paste a detailed chapter outline before generating.");
      return;
    }
    const confirmed =
      executionMode === "mock"
        ? window.confirm(`${label} with the local mock workflow?`)
        : await confirmProviderPreflight();
    if (!confirmed) return;
    setBusy(true);
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
        `Provider workflow is not ready:\n${unavailable
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
        ? "\n\nPremium Webnovel may add multi-model cross-check cost for book and key-chapter tasks."
        : "";
    return window.confirm(
      `Run provider workflow?\n\n${routeLines}\n\nEstimated max: $${maxCost.toFixed(6)}${premiumNote}\nNo canonical manuscript will be overwritten.`
    );
  };

  const runCrossCheck = async (type: CrossCheckType): Promise<void> => {
    if (!activeProject || !activeBook) return;
    const confirmed = window.confirm(
      "This will call multiple configured providers in parallel and may cost money. Continue?"
    );
    if (!confirmed) return;
    setBusy(true);
    try {
      const contextText = [
        `Project: ${activeProject.name}`,
        `Book: ${activeBook.title}`,
        activeVolume ? `Volume: ${activeVolume.title}` : null,
        activeChapter ? `Chapter: ${activeChapter.title}` : null,
        activeChapter?.summary ? `Summary: ${activeChapter.summary}` : null
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
      onWorkflowCostChange("Cross-check proposed", result.summary.costSummary.estimatedTotal, "");
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
    const userInstruction = window.prompt("Revision instruction", "结尾钩子再具体一点");
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
      title: latestRevision.title ?? "Generated revision"
    });
    setAcceptedVersion(version);
    onVersionCreated(version);
  };

  const setAcceptedCanonical = async (): Promise<void> => {
    if (!activeChapter || !acceptedVersion) return;
    const confirmed = window.confirm("Set the accepted generated version as canonical?");
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
    const confirmed = window.confirm("Cancel this workflow? Artifacts will remain as records.");
    if (!confirmed) return;
    const run = await window.wenforge.generation.cancel(detail.run.id, true);
    if (run) {
      await refreshDetail(run.id);
    }
  };

  return (
    <div className="h-full overflow-auto px-6 py-4">
      <div className="grid gap-4">
        <section className="space-y-4">
          <div className="rounded-lg border border-forge-blue/25 bg-forge-blue/8 p-4">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-forge-blue">
                  Outline to manuscript
                </p>
                <h3 className="mt-1 text-lg font-semibold text-white">
                  Paste your detailed outline. WenForge turns it into a proposed final manuscript.
                </h3>
                <label className="mt-3 block">
                  <span className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">
                    Detailed chapter outline
                  </span>
                  <textarea
                    className="mt-2 min-h-40 w-full resize-y rounded-lg border border-white/10 bg-black/35 p-4 text-sm leading-7 text-slate-100 outline-none placeholder:text-slate-600 focus:border-forge-blue/50"
                    placeholder={`例：\n第一场：雨夜公交站，主角听见倒计时。\n第二场：倒计时指向即将出事的女孩。\n第三场：主角救人后能力失控。\n章末：女孩手腕出现同样符号。`}
                    value={sourceOutline}
                    onChange={(event) => setSourceOutline(event.target.value)}
                  />
                </label>
              </div>
              <div className="rounded-lg border border-white/10 bg-black/24 p-3 text-xs text-slate-400">
                <span className="font-medium uppercase tracking-[0.14em] text-slate-500">
                  Agent path
                </span>
                <span className="mt-2 block text-slate-200">
                  {"Outline -> Scenes -> Draft -> Audit -> Rewrite"}
                </span>
                <button
                  className="mt-3 w-full rounded-lg border border-forge-blue/40 bg-forge-blue/18 px-4 py-2.5 text-sm font-semibold text-forge-blue transition hover:bg-forge-blue/25 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={busy || !activeChapter}
                  onClick={() => void startWorkflow("Generate final manuscript from outline")}
                  type="button"
                >
                  Generate final manuscript
                </button>
                <p className="mt-3 leading-5">
                  Agents may suggest plot or setting edits when allowed, but canon changes still
                  require your approval.
                </p>
                <div className="mt-4 space-y-3">
                  <label className="block">
                    <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-slate-500">
                      Execution
                    </span>
                    <select
                      className="mt-1.5 h-9 w-full rounded-md border border-white/10 bg-black/30 px-3 text-xs text-white outline-none focus:border-forge-blue/50"
                      value={executionMode}
                      onChange={(event) =>
                        setExecutionMode(event.target.value as "mock" | "provider")
                      }
                    >
                      <option value="mock">Mock agents</option>
                      <option value="provider">Configured real providers</option>
                    </select>
                  </label>
                  <label className="block">
                    <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-slate-500">
                      Quality
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
                    <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-slate-500">
                      Output
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
                      <option value="final_manuscript">Final manuscript</option>
                      <option value="draft">Draft only</option>
                      <option value="scene_cards">Scene cards</option>
                      <option value="outline">Refined outline</option>
                    </select>
                  </label>
                  <label className="flex items-start gap-2 rounded-lg border border-white/10 bg-black/24 px-3 py-2 text-xs text-slate-300">
                    <input
                      checked={allowStoryChanges}
                      className="mt-0.5 accent-forge-blue"
                      onChange={(event) => setAllowStoryChanges(event.target.checked)}
                      type="checkbox"
                    />
                    Allow plot or setting improvements
                  </label>
                  {executionMode === "provider" ? (
                    <select
                      className="h-9 w-full rounded-md border border-white/10 bg-black/30 px-3 text-xs text-white outline-none focus:border-forge-blue/50"
                      value={routeOverrideModelProfileId}
                      onChange={(event) => setRouteOverrideModelProfileId(event.target.value)}
                    >
                      <option value="">Use task routes</option>
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
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
                  Final proposed manuscript
                </p>
                <h3 className="mt-1 text-base font-semibold text-white">
                  {detail ? `Run ${detail.run.status}` : "No workflow run yet"}
                </h3>
              </div>
              <div className="rounded-md border border-white/10 bg-white/[0.03] px-3 py-2 text-right">
                <p className="text-[11px] uppercase tracking-[0.14em] text-slate-500">Cost</p>
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
                  <p className="max-w-2xl text-sm leading-7 text-slate-400">
                    Paste an outline above and run the outline-to-manuscript workflow. Generated
                    text stays proposed until you save it as a manuscript version.
                  </p>
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
          <div className="rounded-lg border border-white/10 bg-graphite-900/60 p-4">
            <h4 className="text-sm font-semibold text-white">Agent plan</h4>
            <ol className="mt-3 space-y-2 text-xs leading-5 text-slate-400">
              <li>1. Planner parses your detailed outline.</li>
              <li>2. Setting and continuity agents flag safe changes.</li>
              <li>3. Webnovel rhythm agent strengthens hook and pacing.</li>
              <li>4. Draft/rewrite agents produce the final proposed manuscript.</li>
              <li>5. Human gate decides whether to save or set canon.</li>
            </ol>
          </div>
          <div className="rounded-lg border border-forge-violet/25 bg-forge-violet/10 p-3">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-forge-violet">
              Cross-check workflow
            </p>
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
                    GPT/Claude independent pass, DeepSeek aggregation, Qwen/Kimi market fit.
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
      <h4 className="text-sm font-semibold text-white">Workflow timeline</h4>
      <div className="mt-3 space-y-2">
        {checkpoints.length === 0 ? (
          <p className="text-sm text-slate-500">No checkpoints yet.</p>
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
      <h4 className="text-sm font-semibold text-white">Generated artifacts</h4>
      <div className="mt-3 space-y-2">
        {artifacts.length === 0 ? (
          <p className="text-sm text-slate-500">Artifacts appear after a workflow run.</p>
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
      <h4 className="text-sm font-semibold text-white">Human gate</h4>
      <p className="mt-2 text-xs leading-5 text-slate-400">
        Generated output is a proposal. Accepting creates a manuscript version; canonical status is
        a separate confirmation.
      </p>
      <div className="mt-4 space-y-2">
        <button
          className="w-full rounded-md border border-forge-mint/30 bg-forge-mint/10 px-3 py-2 text-left text-xs text-forge-mint disabled:cursor-not-allowed disabled:opacity-50"
          disabled={!paused || busy}
          onClick={() => void onApproveWorkflow()}
          type="button"
        >
          Approve Workflow And Propose State Updates
        </button>
        <button
          className="w-full rounded-md border border-white/10 bg-black/20 px-3 py-2 text-left text-xs text-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={!paused || !latestRevision || busy}
          onClick={() => void onAcceptRevision()}
          type="button"
        >
          Save as manuscript version
        </button>
        <button
          className="w-full rounded-md border border-forge-amber/30 bg-forge-amber/10 px-3 py-2 text-left text-xs text-forge-amber disabled:cursor-not-allowed disabled:opacity-50"
          disabled={!acceptedVersion || busy}
          onClick={() => void onSetCanonical()}
          type="button"
        >
          Set Accepted Version Canonical
        </button>
        <button
          className="w-full rounded-md border border-white/10 bg-black/20 px-3 py-2 text-left text-xs text-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={!paused || busy}
          onClick={() => void onRequestRevision()}
          type="button"
        >
          Request Another Revision
        </button>
        <button
          className="w-full rounded-md border border-red-400/25 bg-red-400/10 px-3 py-2 text-left text-xs text-red-200 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={!detail || busy || detail.run.status === "completed"}
          onClick={() => void onCancel()}
          type="button"
        >
          Discard / Cancel Workflow
        </button>
      </div>
    </div>
  );
}

function RunAttemptDetails({ detail }: { detail: ChapterWorkflowDetail | null }): JSX.Element {
  const runs = detail?.llmRuns ?? [];
  return (
    <div className="rounded-lg border border-white/10 bg-black/20 p-4">
      <h4 className="text-sm font-semibold text-white">Route attempts</h4>
      <div className="mt-3 space-y-2">
        {runs.length === 0 ? (
          <p className="text-xs leading-5 text-slate-500">
            Provider, fallback, latency, and node cost details appear after model calls.
          </p>
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

import { motion, useReducedMotion } from "framer-motion";
import type { JSX } from "react";
import { useEffect, useMemo, useState } from "react";

import type { ChapterWorkflowDetail, WorkflowArtifactRecord } from "@contracts/workflow";
import type {
  BookRecord,
  ChapterRecord,
  ManuscriptVersionRecord,
  ProjectRecord,
  VolumeRecord
} from "@contracts/data";

interface WorkflowGeneratePanelProps {
  activeBook: BookRecord | null;
  activeChapter: ChapterRecord | null;
  activeProject: ProjectRecord | null;
  activeVolume: VolumeRecord | null;
  onCanonicalChanged: (version: ManuscriptVersionRecord) => void;
  onVersionCreated: (version: ManuscriptVersionRecord) => void;
  onWorkflowCostChange: (label: string, cost: number, warning: string) => void;
}

const WORKFLOW_ACTIONS = [
  "Full Chapter Workflow",
  "Generate Outline",
  "Generate Scene Cards",
  "Draft Chapter",
  "Run Audits",
  "Revise Current Draft"
];

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
    const confirmed = window.confirm(`${label} with the local mock workflow?`);
    if (!confirmed) return;
    setBusy(true);
    try {
      const run = await window.wenforge.generation.chapter.start({
        projectId: activeProject.id,
        bookId: activeBook.id,
        volumeId: activeVolume?.id ?? activeChapter.volumeId,
        chapterId: activeChapter.id,
        qualityMode: "balanced",
        userInstruction: label === "Full Chapter Workflow" ? null : label,
        targetTokenBudget: 4000,
        confirmed: true
      });
      await refreshDetail(run.id);
      setAcceptedVersion(null);
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
    <div className="h-full overflow-auto px-6 py-5">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
        <section className="rounded-lg border border-white/10 bg-black/25 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
                Generation stream
              </p>
              <h3 className="mt-1 text-lg font-semibold text-white">
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

          <div className="mt-5 min-h-[260px] rounded-lg border border-white/10 bg-white/[0.025] p-5">
            {displayArtifact ? (
              <pre className="whitespace-pre-wrap text-sm leading-7 text-slate-200">
                {displayArtifact.contentText}
              </pre>
            ) : (
              <div>
                <p className="max-w-2xl text-sm leading-7 text-slate-400">
                  Run the local mock workflow to generate outline, scene cards, draft, audits,
                  revision, and a human-gated settlement proposal. Generated text remains separate
                  from canon until accepted.
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
        </section>

        <section className="space-y-3">
          {WORKFLOW_ACTIONS.map((label) => (
            <button
              className="w-full rounded-lg border border-white/10 bg-graphite-900/60 px-4 py-3 text-left text-sm text-slate-200 hover:border-forge-blue/35 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={busy || !activeChapter}
              key={label}
              onClick={() => void startWorkflow(label)}
              type="button"
            >
              {label}
              <span className="mt-1 block text-xs text-slate-500">
                Mock workflow, persisted artifacts
              </span>
            </button>
          ))}

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
          Save Revision As Non-Canonical Version
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

function findLatestArtifact(
  detail: ChapterWorkflowDetail | null,
  artifactType: string
): WorkflowArtifactRecord | null {
  const artifacts = detail?.artifacts.filter((artifact) => artifact.artifactType === artifactType);
  return artifacts?.at(-1) ?? null;
}

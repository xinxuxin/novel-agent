import type { JSX } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";

import type { CandidateModelSelection, DraftCandidateGroupDetail } from "@contracts/draft-candidates";
import type { ChapterRecord, ManuscriptVersionRecord } from "@contracts/data";
import type { ModelProfileRecord } from "@contracts/model-routing";

interface CandidateStudioPanelProps {
  activeChapter: ChapterRecord | null;
  onVersionCreated: (version: ManuscriptVersionRecord) => void;
  onCanonicalChanged: (version: ManuscriptVersionRecord) => void;
  onWorkflowCostChange: (label: string, cost: number, warning: string) => void;
}

const ROLE_LABELS: Record<string, string> = {
  "claude-opus-4.7": "Claude: emotion and prose quality",
  "gpt-5.5": "GPT: structure and logic",
  "kimi-k2.6": "Kimi: Chinese prose fluency",
  "deepseek-v4-pro": "DeepSeek: plot structure and event clarity",
  "qwen3.7-max": "Qwen: webnovel hook, pacing, and commercial rhythm"
};

const PRESETS: Record<string, string[]> = {
  "Daily Compare": ["qwen3.7-max", "deepseek-v4-pro"],
  "Balanced Compare": ["qwen3.7-max", "kimi-k2.6", "deepseek-v4-pro"],
  "Premium Compare": ["claude-opus-4.7", "qwen3.7-max", "kimi-k2.6"],
  "Full Key Chapter Compare": [
    "claude-opus-4.7",
    "gpt-5.5",
    "qwen3.7-max",
    "kimi-k2.6",
    "deepseek-v4-pro"
  ]
};

export function CandidateStudioPanel({
  activeChapter,
  onCanonicalChanged,
  onVersionCreated,
  onWorkflowCostChange
}: CandidateStudioPanelProps): JSX.Element {
  const [groups, setGroups] = useState<DraftCandidateGroupDetail[]>([]);
  const [profiles, setProfiles] = useState<ModelProfileRecord[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [selectedPreset, setSelectedPreset] = useState("Balanced Compare");
  const [executionMode, setExecutionMode] = useState<"mock" | "provider">("mock");
  const [userInstruction, setUserInstruction] = useState("");
  const [targetWords, setTargetWords] = useState(activeChapter?.targetWords ?? 1600);
  const [baseCandidateId, setBaseCandidateId] = useState("");
  const [referenceIds, setReferenceIds] = useState<Set<string>>(new Set());
  const [fusionInstruction, setFusionInstruction] = useState("");
  const [fusionAlias, setFusionAlias] = useState("qwen3.7-max");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  const selectedGroup = groups.find((group) => group.group.id === selectedGroupId) ?? groups[0] ?? null;
  const modelByAlias = useMemo(() => {
    const map = new Map<string, ModelProfileRecord>();
    for (const profile of profiles) {
      if (profile.alias) map.set(profile.alias, profile);
      map.set(profile.model, profile);
    }
    return map;
  }, [profiles]);
  const candidateSelections = useMemo(
    () =>
      (PRESETS[selectedPreset] ?? PRESETS["Balanced Compare"] ?? [])
        .slice(0, selectedPreset === "Full Key Chapter Compare" ? 5 : 3)
        .map((alias) => selectionForAlias(alias, modelByAlias, executionMode)),
    [executionMode, modelByAlias, selectedPreset]
  );
  const totalCandidateCost = useMemo(
    () =>
      selectedGroup?.candidates.reduce((total, candidate) => total + (candidate.cost ?? 0), 0) ?? 0,
    [selectedGroup]
  );

  const refresh = useCallback(async (): Promise<void> => {
    if (!activeChapter) {
      setGroups([]);
      setSelectedGroupId(null);
      return;
    }
    const [nextGroups, nextProfiles] = await Promise.all([
      window.wenforge.candidates.listByChapter(activeChapter.id),
      window.wenforge.modelProfiles.list().catch(() => [])
    ]);
    setGroups(nextGroups);
    setProfiles(nextProfiles);
    setSelectedGroupId((current) =>
      current && nextGroups.some((group) => group.group.id === current)
        ? current
        : (nextGroups[0]?.group.id ?? null)
    );
  }, [activeChapter]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void refresh();
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [activeChapter?.id, refresh]);

  useEffect(() => {
    onWorkflowCostChange("Candidates", totalCandidateCost, "candidate drafts");
  }, [onWorkflowCostChange, totalCandidateCost]);

  const runCompare = async (): Promise<void> => {
    if (!activeChapter) return;
    const needsConfirmation =
      executionMode === "provider" ||
      selectedPreset === "Full Key Chapter Compare" ||
      candidateSelections.length > 3;
    if (
      needsConfirmation &&
      !window.confirm("This will generate multiple draft candidates and may cost money. Continue?")
    ) {
      return;
    }
    setBusy(true);
    setNotice("Generating candidate drafts...");
    try {
      const group = await window.wenforge.candidates.createGroup({
        chapterId: activeChapter.id,
        presetName: selectedPreset,
        targetWords,
        userInstruction: userInstruction || null
      });
      const detail = await window.wenforge.candidates.generate({
        groupId: group.id,
        executionMode,
        candidates: candidateSelections,
        budgetCapUsd: executionMode === "provider" ? 1 : 0,
        confirmed: true
      });
      setSelectedGroupId(detail.group.id);
      await refresh();
      setNotice("Candidate drafts are ready for comparison.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Candidate generation failed.");
    } finally {
      setBusy(false);
    }
  };

  const saveCandidate = async (candidateId: string, canonical: boolean): Promise<void> => {
    if (canonical && !window.confirm("Set this candidate as canonical manuscript?")) return;
    const version = canonical
      ? await window.wenforge.candidates.setCandidateCanonical({ candidateId, confirmed: true })
      : await window.wenforge.candidates.saveCandidateAsVersion({ candidateId });
    if (version.isCanonical) onCanonicalChanged(version);
    else onVersionCreated(version);
    await refresh();
  };

  const retryCandidate = async (candidateId: string): Promise<void> => {
    setBusy(true);
    try {
      await window.wenforge.candidates.retryCandidate({ candidateId, confirmed: true });
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const runFusion = async (): Promise<void> => {
    if (!selectedGroup || !baseCandidateId) {
      setNotice("Fusion empty state: Choose a base draft and optional reference drafts first.");
      return;
    }
    const fusionModel = selectionForAlias(fusionAlias, modelByAlias, executionMode);
    if (
      executionMode === "provider" &&
      !window.confirm("This will call a real fusion model and may cost money. Continue?")
    ) {
      return;
    }
    setBusy(true);
    try {
      const fusion = await window.wenforge.candidates.createFusion({
        groupId: selectedGroup.group.id,
        baseCandidateId,
        referenceCandidateIds: [...referenceIds],
        fusionInstruction: fusionInstruction || null,
        fusionProvider: fusionModel.provider,
        fusionModel: fusionModel.model,
        targetWords
      });
      await window.wenforge.candidates.generateFusion({
        fusionId: fusion.id,
        budgetCapUsd: executionMode === "provider" ? 1 : 0,
        confirmed: true
      });
      await refresh();
      setNotice("Fused draft saved as a proposal artifact.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Fusion failed.");
    } finally {
      setBusy(false);
    }
  };

  const saveFusion = async (fusionId: string, canonical: boolean): Promise<void> => {
    if (canonical && !window.confirm("Set this fused draft as canonical manuscript?")) return;
    const version = canonical
      ? await window.wenforge.candidates.setFusionCanonical({ fusionId, confirmed: true })
      : await window.wenforge.candidates.saveFusionAsVersion({ fusionId });
    if (version.isCanonical) onCanonicalChanged(version);
    else onVersionCreated(version);
    await refresh();
  };

  if (!activeChapter) {
    return (
      <div className="h-full overflow-auto px-6 py-5">
        <EmptyCandidates onGenerate={() => undefined} />
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto px-6 py-5">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <section className="min-w-0 space-y-4">
          <div className="rounded-xl border border-white/10 bg-black/24 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
                  Compare Drafts
                </p>
                <h3 className="mt-1 text-lg font-semibold text-white">Same plan, multiple writers</h3>
              </div>
              <button
                className="rounded-lg border border-forge-blue/35 bg-forge-blue/12 px-4 py-2 text-sm font-medium text-forge-blue disabled:cursor-not-allowed disabled:opacity-50"
                disabled={busy}
                onClick={() => void runCompare()}
                type="button"
              >
                Compare Drafts
              </button>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-4">
              <label className="space-y-1 text-xs text-slate-500">
                Writing models
                <select
                  className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-slate-200 outline-none focus:border-forge-blue/45"
                  value={selectedPreset}
                  onChange={(event) => setSelectedPreset(event.target.value)}
                >
                  {Object.keys(PRESETS).map((preset) => (
                    <option key={preset} value={preset}>
                      {preset}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1 text-xs text-slate-500">
                Mode
                <select
                  className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-slate-200 outline-none focus:border-forge-blue/45"
                  value={executionMode}
                  onChange={(event) => setExecutionMode(event.target.value as "mock" | "provider")}
                >
                  <option value="mock">Mock</option>
                  <option value="provider">Configured providers</option>
                </select>
              </label>
              <label className="space-y-1 text-xs text-slate-500">
                Target words
                <input
                  className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-slate-200 outline-none focus:border-forge-blue/45"
                  min={400}
                  type="number"
                  value={targetWords}
                  onChange={(event) => setTargetWords(Number(event.target.value))}
                />
              </label>
              <div className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
                <p className="text-xs text-slate-500">Estimated cost</p>
                <p className="mt-1 font-mono text-sm text-forge-mint">
                  ${totalCandidateCost.toFixed(6)}
                </p>
              </div>
            </div>
            <textarea
              className="mt-3 min-h-20 w-full resize-y rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-slate-200 outline-none placeholder:text-slate-600 focus:border-forge-blue/45"
              onChange={(event) => setUserInstruction(event.target.value)}
              placeholder="Optional instruction for all candidates"
              value={userInstruction}
            />
            <div className="mt-3 flex flex-wrap gap-2">
              {candidateSelections.map((candidate) => (
                <span
                  className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs text-slate-300"
                  key={`${candidate.provider}-${candidate.model}`}
                >
                  {candidate.displayName ?? candidate.model} · {candidate.roleLabel}
                </span>
              ))}
            </div>
            {notice ? <p className="mt-3 text-sm text-slate-400">{notice}</p> : null}
          </div>

          {!selectedGroup || selectedGroup.candidates.length === 0 ? (
            <EmptyCandidates onGenerate={() => void runCompare()} />
          ) : (
            <div className="grid gap-3 lg:grid-cols-2">
              {selectedGroup.candidates.map((candidate) => (
                <article
                  className="rounded-xl border border-white/10 bg-black/24 p-4"
                  key={candidate.id}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h4 className="truncate text-sm font-semibold text-white">
                        {candidate.model}
                      </h4>
                      <p className="mt-1 text-xs text-slate-500">
                        {candidate.provider} · {candidate.roleLabel}
                      </p>
                    </div>
                    <span className={statusClass(candidate.status)}>{candidate.status}</span>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-slate-500">
                    <Metric label="Words" value={String(candidate.wordCount)} />
                    <Metric label="Cost" value={`$${(candidate.cost ?? 0).toFixed(6)}`} />
                    <Metric label="Time" value={candidate.latencyMs ? `${candidate.latencyMs}ms` : "-"} />
                  </div>
                  <div className="mt-3 max-h-52 overflow-auto rounded-lg border border-white/10 bg-black/25 p-3 text-sm leading-7 text-slate-300">
                    {candidate.contentMarkdown || candidate.errorMessage || "Waiting for output."}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button className="rounded-md border border-white/10 px-2 py-1.5 text-xs text-slate-300 hover:border-forge-blue/35 hover:text-white" onClick={() => setBaseCandidateId(candidate.id)} type="button">
                      Use as Base
                    </button>
                    <button
                      className="rounded-md border border-white/10 px-2 py-1.5 text-xs text-slate-300 hover:border-forge-blue/35 hover:text-white"
                      onClick={() =>
                        setReferenceIds((current) => {
                          const next = new Set(current);
                          if (next.has(candidate.id)) next.delete(candidate.id);
                          else next.add(candidate.id);
                          return next;
                        })
                      }
                      type="button"
                    >
                      {referenceIds.has(candidate.id) ? "Remove Ref" : "Add to Fusion"}
                    </button>
                    {candidate.status === "failed" ? (
                      <button className="rounded-md border border-white/10 px-2 py-1.5 text-xs text-slate-300 hover:border-forge-blue/35 hover:text-white" onClick={() => void retryCandidate(candidate.id)} type="button">
                        Retry
                      </button>
                    ) : null}
                    {candidate.status === "succeeded" || candidate.status === "saved" ? (
                      <>
                        <button className="rounded-md border border-white/10 px-2 py-1.5 text-xs text-slate-300 hover:border-forge-blue/35 hover:text-white" onClick={() => void saveCandidate(candidate.id, false)} type="button">
                          Save as Version
                        </button>
                        <button className="rounded-md border border-forge-mint/30 bg-forge-mint/10 px-2 py-1.5 text-xs text-forge-mint hover:border-forge-mint/60" onClick={() => void saveCandidate(candidate.id, true)} type="button">
                          Set Canonical
                        </button>
                      </>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <aside className="space-y-4">
          <section className="rounded-xl border border-white/10 bg-black/24 p-4">
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
              Fuse Drafts
            </p>
            <h3 className="mt-1 text-base font-semibold text-white">Fuse selected drafts</h3>
            <label className="mt-4 block space-y-1 text-xs text-slate-500">
              Base draft
              <select
                className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-slate-200"
                value={baseCandidateId}
                onChange={(event) => setBaseCandidateId(event.target.value)}
              >
                <option value="">Choose base</option>
                {selectedGroup?.candidates.map((candidate) => (
                  <option key={candidate.id} value={candidate.id}>
                    {candidate.model}
                  </option>
                ))}
              </select>
            </label>
            <div className="mt-3 space-y-2">
              <p className="text-xs text-slate-500">Reference drafts</p>
              {selectedGroup?.candidates.map((candidate) => (
                <label className="flex items-center gap-2 text-sm text-slate-300" key={candidate.id}>
                  <input
                    checked={referenceIds.has(candidate.id)}
                    onChange={() =>
                      setReferenceIds((current) => {
                        const next = new Set(current);
                        if (next.has(candidate.id)) next.delete(candidate.id);
                        else next.add(candidate.id);
                        return next;
                      })
                    }
                    type="checkbox"
                  />
                  {candidate.model}
                </label>
              ))}
            </div>
            <label className="mt-3 block space-y-1 text-xs text-slate-500">
              Fusion model
              <select
                className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-slate-200"
                value={fusionAlias}
                onChange={(event) => setFusionAlias(event.target.value)}
              >
                {Object.keys(ROLE_LABELS).map((alias) => (
                  <option key={alias} value={alias}>
                    {modelByAlias.get(alias)?.displayName ?? alias}
                  </option>
                ))}
              </select>
            </label>
            <textarea
              className="mt-3 min-h-28 w-full resize-y rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-slate-200 outline-none placeholder:text-slate-600 focus:border-forge-blue/45"
              onChange={(event) => setFusionInstruction(event.target.value)}
              placeholder="Example: Use Kimi’s prose style as the base, keep DeepSeek’s plot structure, strengthen the ending hook like Qwen, and preserve all canon facts."
              value={fusionInstruction}
            />
            <button
              className="mt-3 w-full rounded-lg border border-forge-violet/35 bg-forge-violet/12 px-4 py-2 text-sm font-medium text-forge-violet disabled:opacity-50"
              disabled={busy || !baseCandidateId}
              onClick={() => void runFusion()}
              type="button"
            >
              Generate fused draft
            </button>
          </section>
          <section className="rounded-xl border border-white/10 bg-black/24 p-4">
            <h3 className="text-sm font-semibold text-white">Fusion results</h3>
            <div className="mt-3 space-y-2">
              {selectedGroup?.fusions.length ? null : (
                <p className="rounded-lg border border-white/10 p-3 text-sm text-slate-500">
                  Choose a base draft and optional reference drafts first.
                </p>
              )}
              {selectedGroup?.fusions.map((fusion) => (
                <div className="rounded-lg border border-white/10 bg-black/25 p-3" key={fusion.id}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm text-slate-200">{fusion.fusionModel}</span>
                    <span className={statusClass(fusion.status)}>{fusion.status}</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    cost ${(fusion.cost ?? 0).toFixed(6)}
                  </p>
                  <div className="mt-2 flex gap-2">
                    {fusion.status === "succeeded" || fusion.status === "saved" ? (
                      <>
                        <button className="rounded-md border border-white/10 px-2 py-1.5 text-xs text-slate-300 hover:border-forge-blue/35 hover:text-white" onClick={() => void saveFusion(fusion.id, false)} type="button">
                          Save
                        </button>
                        <button className="rounded-md border border-forge-mint/30 bg-forge-mint/10 px-2 py-1.5 text-xs text-forge-mint hover:border-forge-mint/60" onClick={() => void saveFusion(fusion.id, true)} type="button">
                          Canonical
                        </button>
                      </>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

function EmptyCandidates({ onGenerate }: { onGenerate: () => void }): JSX.Element {
  return (
    <section className="rounded-xl border border-dashed border-white/15 bg-black/18 p-8 text-center">
      <h3 className="text-lg font-semibold text-white">No candidate drafts yet</h3>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-500">
        Generate 2–3 drafts from the same chapter plan, compare them, then choose or fuse the best one.
      </p>
      <button
        className="mt-5 rounded-lg border border-forge-blue/35 bg-forge-blue/12 px-4 py-2 text-sm font-medium text-forge-blue"
        onClick={onGenerate}
        type="button"
      >
        Compare Drafts
      </button>
    </section>
  );
}

function selectionForAlias(
  alias: string,
  profiles: Map<string, ModelProfileRecord>,
  executionMode: "mock" | "provider"
): CandidateModelSelection {
  const profile = profiles.get(alias);
  return {
    provider: executionMode === "mock" ? "fake" : (profile?.provider ?? "generic_openai_compatible"),
    model: executionMode === "mock" ? alias : (profile?.model ?? alias),
    modelProfileId: profile?.id ?? null,
    displayName: profile?.displayName ?? alias,
    roleLabel: ROLE_LABELS[alias] ?? "Writer"
  };
}

function Metric({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.03] px-2 py-2">
      <p className="text-[11px] text-slate-600">{label}</p>
      <p className="mt-1 truncate text-xs text-slate-300">{value}</p>
    </div>
  );
}

function statusClass(status: string): string {
  if (status === "succeeded" || status === "saved") {
    return "rounded-full border border-forge-mint/25 bg-forge-mint/10 px-2 py-1 text-[11px] text-forge-mint";
  }
  if (status === "failed") {
    return "rounded-full border border-red-400/25 bg-red-400/10 px-2 py-1 text-[11px] text-red-200";
  }
  return "rounded-full border border-forge-amber/25 bg-forge-amber/10 px-2 py-1 text-[11px] text-forge-amber";
}

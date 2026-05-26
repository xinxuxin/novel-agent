import type { JSX } from "react";
import { useCallback, useEffect, useState } from "react";

import type {
  EvalCaseRecord,
  EvalLeaderboardEntry,
  EvalOutputRecord,
  EvalRouteRecommendations,
  EvalRunRecord,
  EvalSuiteRecord,
  LLMTaskType,
  ModelProfileRecord
} from "@contracts/index";
import { ROUTING_EVAL_TASK_TYPES } from "@contracts/index";

interface EvalDashboardProps {
  bookId: string | null;
}

const panelClassName = "rounded-lg border border-white/10 bg-black/25 p-4";
const fieldClassName =
  "rounded-md border border-white/10 bg-black/30 px-2 py-1.5 text-xs text-slate-200 outline-none focus:border-forge-blue/50";

export function EvalDashboard({ bookId }: EvalDashboardProps): JSX.Element {
  const [suites, setSuites] = useState<EvalSuiteRecord[]>([]);
  const [cases, setCases] = useState<EvalCaseRecord[]>([]);
  const [profiles, setProfiles] = useState<ModelProfileRecord[]>([]);
  const [selectedSuiteId, setSelectedSuiteId] = useState("");
  const [selectedProfileIds, setSelectedProfileIds] = useState<Set<string>>(new Set());
  const [activeRun, setActiveRun] = useState<EvalRunRecord | null>(null);
  const [outputs, setOutputs] = useState<EvalOutputRecord[]>([]);
  const [blindMode, setBlindMode] = useState(false);
  const [leaderboard, setLeaderboard] = useState<EvalLeaderboardEntry[]>([]);
  const [recommendations, setRecommendations] = useState<EvalRouteRecommendations | null>(null);
  const [taskType, setTaskType] = useState<LLMTaskType>("draft_chapter");
  const [providerBudget, setProviderBudget] = useState("3");
  const [notice, setNotice] = useState<string | null>(null);

  const selectedSuite = suites.find((suite) => suite.id === selectedSuiteId) ?? null;
  const refreshBase = useCallback(async (): Promise<void> => {
    const [nextSuites, nextProfiles] = await Promise.all([
      window.wenforge.eval.suites.list(),
      window.wenforge.modelProfiles.list()
    ]);
    setSuites(nextSuites);
    setProfiles(nextProfiles.filter((profile) => profile.enabled));
    setSelectedSuiteId((current) => current || nextSuites[0]?.id || "");
    setSelectedProfileIds((current) => {
      if (current.size > 0) return current;
      return new Set(
        nextProfiles
          .filter((profile) => profile.enabled)
          .filter((profile) =>
            [
              "gpt-5.5",
              "claude-opus-4.7",
              "qwen3.7-max",
              "kimi-k2.6",
              "deepseek-v4-pro"
            ].includes(profile.alias ?? profile.model)
          )
          .slice(0, 5)
          .map((p) => p.id)
      );
    });
  }, []);

  const refreshRun = useCallback(async (): Promise<void> => {
    if (!activeRun) return;
    await loadRunResults(activeRun.id, blindMode, setOutputs, setLeaderboard, setRecommendations);
  }, [activeRun, blindMode]);

  const loadCurrentRun = async (run: EvalRunRecord): Promise<void> => {
    const [nextOutputs, nextLeaderboard, nextRecommendations] = await Promise.all([
      window.wenforge.eval.outputs.list(run.id, blindMode),
      window.wenforge.eval.leaderboard(run.id),
      window.wenforge.eval.recommendRoutes(run.id)
    ]);
    setOutputs(nextOutputs);
    setLeaderboard(nextLeaderboard);
    setRecommendations(nextRecommendations);
  };

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void refreshBase().catch(() => setNotice("Evaluation dashboard could not load."));
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [refreshBase]);

  useEffect(() => {
    if (!selectedSuiteId) return;
    void window.wenforge.eval.cases.list(selectedSuiteId).then(setCases);
  }, [selectedSuiteId]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void refreshRun();
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [refreshRun]);

  const runEval = async (): Promise<void> => {
    if (!selectedSuiteId || selectedProfileIds.size === 0) return;
    const run = await window.wenforge.eval.run.start({
      suiteId: selectedSuiteId,
      bookId,
      mode: blindMode ? "blind_comparison" : "human_scoring",
      modelProfileIds: [...selectedProfileIds],
      taskType,
      qualityMode: "balanced",
      executionMode: "mock"
    });
    setActiveRun(run);
    setNotice("Mock evaluation completed locally. Outputs do not affect manuscript canon.");
    await loadCurrentRun(run);
  };

  const runProviderEval = async (): Promise<void> => {
    if (!selectedSuiteId || selectedProfileIds.size === 0) return;
    const confirmed = window.confirm(
      "This will make real API calls and may cost money. Continue?"
    );
    if (!confirmed) return;
    const run = await window.wenforge.eval.run.start({
      suiteId: selectedSuiteId,
      bookId,
      mode: blindMode ? "blind_comparison" : "human_scoring",
      modelProfileIds: [...selectedProfileIds],
      taskType,
      qualityMode: "premium_webnovel",
      executionMode: "provider",
      confirmed: true,
      budgetCapUsd: parseBudget(providerBudget),
      maxOutputTokens: 900
    });
    setActiveRun(run);
    setNotice("Provider evaluation completed. Outputs are eval-only and do not affect canon.");
    await loadCurrentRun(run);
  };

  const scoreOutput = async (output: EvalOutputRecord): Promise<void> => {
    await window.wenforge.eval.score.human({
      outputId: output.id,
      dimensions: {
        opening_hook: 8,
        conflict_density: 8,
        character_voice: 7,
        chinese_naturalness: 8,
        webnovel_pacing: 8,
        emotional_turn: 7,
        originality: 7,
        continuity_respect: 8,
        ending_hook: 8,
        low_ai_smell: 8,
        structural_logic: 8,
        market_fit: 8,
        cost_score: 8,
        latency_score: 8
      },
      notes: "Quick human score from dashboard."
    });
    await refreshRun();
  };

  const llmJudge = async (output: EvalOutputRecord): Promise<void> => {
    await window.wenforge.eval.score.llmJudge({ outputId: output.id, executionMode: "mock" });
    setNotice("Mock LLM judge score added as advisory, not ground truth.");
    await refreshRun();
  };

  const promoteWinner = async (entry: EvalLeaderboardEntry): Promise<void> => {
    if (!activeRun || entry.outputIds.length === 0) return;
    const confirmed = window.confirm("Promote this eval winner to the balanced draft route?");
    if (!confirmed) return;
    await window.wenforge.eval.promoteWinnerToRoute({
      evalRunId: activeRun.id,
      outputId: entry.outputIds[0]!,
      taskType: "draft_chapter",
      qualityMode: "balanced",
      confirmed
    });
    setNotice("Winner promoted to the draft_chapter balanced route.");
  };

  const applyRecommendation = async (
    item: EvalRouteRecommendations["items"][number]
  ): Promise<void> => {
    if (!activeRun) return;
    const confirmed = window.confirm(`Apply ${item.label} to the premium_webnovel route preset?`);
    if (!confirmed) return;
    await window.wenforge.eval.applyRecommendationToRoute({
      runId: activeRun.id,
      recommendationId: item.id,
      qualityMode: "premium_webnovel",
      confirmed
    });
    setNotice(`${item.label} applied after confirmation.`);
  };

  const exportReport = async (): Promise<void> => {
    if (!activeRun) return;
    const report = await window.wenforge.eval.exportReport({
      runId: activeRun.id,
      includeRawOutputs: false
    });
    setNotice(`Redacted eval report saved: ${report.filePath}`);
  };

  return (
    <div className="h-full overflow-auto px-6 py-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
            Model evaluation
          </p>
          <h2 className="mt-1 text-xl font-semibold text-white">
            中文网文路由评测 and route recommendation
          </h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            className={fieldClassName}
            value={taskType}
            onChange={(event) => setTaskType(event.target.value as LLMTaskType)}
          >
            {ROUTING_EVAL_TASK_TYPES.map((task) => (
              <option key={task} value={task}>
                {task}
              </option>
            ))}
          </select>
          <input
            className={`${fieldClassName} w-20`}
            inputMode="decimal"
            onChange={(event) => setProviderBudget(event.target.value)}
            title="Provider eval budget"
            value={providerBudget}
          />
          <label className="flex items-center gap-2 rounded-md border border-white/10 px-3 py-2 text-xs text-slate-300">
            <input
              checked={blindMode}
              className="h-4 w-4 accent-forge-blue"
              onChange={(event) => setBlindMode(event.target.checked)}
              type="checkbox"
            />
            Blind scoring
          </label>
          <button
            className="rounded-md border border-forge-blue/30 bg-forge-blue/10 px-3 py-2 text-xs text-forge-blue disabled:opacity-50"
            disabled={!selectedSuiteId || selectedProfileIds.size === 0}
            onClick={() => void runEval()}
            type="button"
          >
            Run Mock Eval
          </button>
          <button
            className="rounded-md border border-amber-300/30 bg-amber-300/10 px-3 py-2 text-xs text-amber-100 disabled:opacity-50"
            disabled={!selectedSuiteId || selectedProfileIds.size === 0}
            onClick={() => void runProviderEval()}
            type="button"
          >
            Run Provider Eval
          </button>
          <button
            className="rounded-md border border-white/10 px-3 py-2 text-xs text-slate-300 disabled:opacity-50"
            disabled={!activeRun}
            onClick={() => void exportReport()}
            type="button"
          >
            Export Report
          </button>
        </div>
      </div>

      {notice ? (
        <p className="mt-4 rounded-lg border border-forge-blue/25 bg-forge-blue/10 px-3 py-2 text-sm text-forge-blue">
          {notice}
        </p>
      ) : null}

      <div className="mt-5 grid gap-4 xl:grid-cols-[340px_minmax(0,1fr)]">
        <section className={panelClassName}>
          <h3 className="text-sm font-semibold text-white">Suite and models</h3>
          <select
            className={`${fieldClassName} mt-3 w-full`}
            value={selectedSuiteId}
            onChange={(event) => setSelectedSuiteId(event.target.value)}
          >
            {suites.map((suite) => (
              <option key={suite.id} value={suite.id}>
                {suite.name}
              </option>
            ))}
          </select>
          <p className="mt-3 text-xs leading-5 text-slate-500">
            {selectedSuite?.description ??
              "Local model quality checks for Chinese web novel tasks."}
          </p>
          <div className="mt-4 space-y-2">
            {profiles.map((profile) => (
              <label
                className="flex items-center gap-2 rounded-md border border-white/10 bg-white/[0.025] px-3 py-2 text-xs text-slate-300"
                key={profile.id}
              >
                <input
                  checked={selectedProfileIds.has(profile.id)}
                  className="h-4 w-4 accent-forge-blue"
                  onChange={() =>
                    setSelectedProfileIds((current) => {
                      const next = new Set(current);
                      if (next.has(profile.id)) next.delete(profile.id);
                      else next.add(profile.id);
                      return next;
                    })
                  }
                  type="checkbox"
                />
                <span className="truncate">
                  {profile.provider}/{profile.displayName}
                </span>
              </label>
            ))}
          </div>
        </section>

        <section className={panelClassName}>
          <h3 className="text-sm font-semibold text-white">Eval cases</h3>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {cases.map((item) => (
              <article
                className="rounded-md border border-white/10 bg-white/[0.025] p-3"
                key={item.id}
              >
                <div className="flex items-center justify-between gap-3">
                  <h4 className="text-sm font-medium text-white">{item.title}</h4>
                  <span className="text-xs text-slate-500">{item.genre}</span>
                </div>
                <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-500">
                  {item.promptText}
                </p>
              </article>
            ))}
          </div>
        </section>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        <section className={panelClassName}>
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-white">Outputs</h3>
            <span className="text-xs text-slate-500">{outputs.length} outputs</span>
          </div>
          <div className="mt-3 max-h-[560px] space-y-3 overflow-auto">
            {outputs.length === 0 ? (
              <p className="text-sm text-slate-500">Run an eval to stream mock outputs here.</p>
            ) : null}
            {outputs.slice(0, 12).map((output) => (
              <article
                className="rounded-lg border border-white/10 bg-graphite-900/60 p-3"
                key={output.id}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-forge-blue">
                    {blindMode
                      ? `Model ${output.blindLabel}`
                      : `${output.provider}/${output.model}`}
                  </span>
                  <span className="text-xs text-slate-500">
                    {money(output.cost)} · {output.latencyMs ?? 0}ms
                  </span>
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-300">{output.outputText}</p>
                <div className="mt-3 flex gap-2">
                  <button
                    className="rounded-md border border-forge-mint/30 px-2 py-1 text-xs text-forge-mint"
                    onClick={() => void scoreOutput(output)}
                    type="button"
                  >
                    Human score
                  </button>
                  <button
                    className="rounded-md border border-forge-violet/30 px-2 py-1 text-xs text-forge-violet"
                    onClick={() => void llmJudge(output)}
                    type="button"
                  >
                    LLM judge
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className={panelClassName}>
          <h3 className="text-sm font-semibold text-white">Leaderboard</h3>
          <p className="mt-2 text-xs leading-5 text-slate-500">
            LLM judge scores are advisory. Eval outputs never affect manuscript canon.
          </p>
          <div className="mt-4 space-y-3">
            {recommendations?.items.map((item) => (
              <article
                className="rounded-lg border border-forge-blue/20 bg-forge-blue/5 p-3"
                key={item.id}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h4 className="text-sm font-medium text-white">{item.label}</h4>
                    <p className="mt-1 text-xs text-slate-500">
                      {item.provider}/{item.model} · {item.taskType}
                    </p>
                  </div>
                  <button
                    className="rounded-md border border-forge-blue/30 px-2 py-1 text-xs text-forge-blue"
                    onClick={() => void applyRecommendation(item)}
                    type="button"
                  >
                    Apply
                  </button>
                </div>
                <p className="mt-2 text-xs leading-5 text-slate-400">{item.reason}</p>
              </article>
            ))}
            {leaderboard.length === 0 ? (
              <p className="text-sm text-slate-500">Score outputs to build a leaderboard.</p>
            ) : null}
            {leaderboard.map((entry) => (
              <article
                className="rounded-lg border border-white/10 bg-white/[0.025] p-3"
                key={entry.modelProfileId}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h4 className="text-sm font-medium text-white">
                      {entry.provider}/{entry.model}
                    </h4>
                    <p className="mt-1 text-xs text-slate-500">{entry.outputCount} outputs</p>
                  </div>
                  <button
                    className="rounded-md border border-forge-blue/30 px-2 py-1 text-xs text-forge-blue"
                    onClick={() => void promoteWinner(entry)}
                    type="button"
                  >
                    Promote
                  </button>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-300">
                  <span>Quality {entry.qualityScore.toFixed(2)}</span>
                  <span>Cost {money(entry.cost)}</span>
                  <span>Latency {entry.latencyMs.toFixed(0)}ms</span>
                  <span>Adjusted {entry.costAdjustedScore.toFixed(2)}</span>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function money(value: number): string {
  return `$${value.toFixed(6)}`;
}

function parseBudget(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 3;
}

async function loadRunResults(
  runId: string,
  blindMode: boolean,
  setOutputs: (outputs: EvalOutputRecord[]) => void,
  setLeaderboard: (leaderboard: EvalLeaderboardEntry[]) => void,
  setRecommendations: (recommendations: EvalRouteRecommendations) => void
): Promise<void> {
  const [nextOutputs, nextLeaderboard, nextRecommendations] = await Promise.all([
    window.wenforge.eval.outputs.list(runId, blindMode),
    window.wenforge.eval.leaderboard(runId),
    window.wenforge.eval.recommendRoutes(runId)
  ]);
  setOutputs(nextOutputs);
  setLeaderboard(nextLeaderboard);
  setRecommendations(nextRecommendations);
}

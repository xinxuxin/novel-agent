import type { JSX } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";

import type {
  BudgetPolicyRecord,
  CostForecast,
  CostDashboardSummary,
  CostGroup,
  CsvExportResult,
  ModelPriceTierDto,
  ModelPriceRecord,
  ProviderQuotaNoteDto,
  ProviderQuotaSummary,
  QualityModeComparison,
  RoutePriceWarning
} from "@contracts/index";

interface CostDashboardProps {
  projectId: string | null;
  bookId: string | null;
  chapterId: string | null;
  activeRunId?: string | null;
  sessionCost: number;
  activeRunCost: number;
}

const panelClassName = "rounded-lg border border-white/10 bg-black/25 p-4";
const fieldClassName =
  "rounded-md border border-white/10 bg-black/30 px-2 py-1.5 text-xs text-slate-200 outline-none focus:border-forge-blue/50";

export function CostDashboard({
  activeRunCost,
  activeRunId,
  bookId,
  chapterId,
  projectId,
  sessionCost
}: CostDashboardProps): JSX.Element {
  const [summary, setSummary] = useState<CostDashboardSummary | null>(null);
  const [budget, setBudget] = useState<BudgetPolicyRecord | null>(null);
  const [prices, setPrices] = useState<ModelPriceRecord[]>([]);
  const [priceTiers, setPriceTiers] = useState<ModelPriceTierDto[]>([]);
  const [forecast, setForecast] = useState<CostForecast | null>(null);
  const [comparison, setComparison] = useState<QualityModeComparison | null>(null);
  const [quotas, setQuotas] = useState<ProviderQuotaNoteDto[]>([]);
  const [quotaSummary, setQuotaSummary] = useState<ProviderQuotaSummary | null>(null);
  const [routeWarnings, setRouteWarnings] = useState<RoutePriceWarning[]>([]);
  const [csv, setCsv] = useState<CsvExportResult | null>(null);
  const [importJson, setImportJson] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [sessionSince] = useState(() => new Date().toISOString());
  const scope = useMemo(
    () => ({
      projectId: projectId ?? undefined,
      bookId: bookId ?? undefined,
      chapterId: chapterId ?? undefined,
      activeRunId: activeRunId ?? undefined,
      sessionSince
    }),
    [activeRunId, bookId, chapterId, projectId, sessionSince]
  );

  const refresh = useCallback(async (): Promise<void> => {
    const [nextSummary, nextBudget, nextPrices, nextTiers, nextWarnings, nextQuotas] =
      await Promise.all([
      window.wenforge.costs.getSummary(scope),
      window.wenforge.budgets.getPolicies(),
      window.wenforge.modelPrices.list(),
      window.wenforge.modelPrices.listTiers(),
      window.wenforge.pricing.routeWarnings(),
      window.wenforge.pricing.listQuotas()
    ]);
    setSummary(nextSummary);
    setBudget(nextBudget);
    setPrices(nextPrices);
    setPriceTiers(nextTiers);
    setRouteWarnings(nextWarnings);
    setQuotas(nextQuotas);
  }, [scope]);

  useEffect(() => {
    let mounted = true;
    const timeout = window.setTimeout(() => {
      void refresh().catch(() => {
        if (mounted) setNotice("Cost dashboard could not load.");
      });
    }, 0);
    return () => {
      mounted = false;
      window.clearTimeout(timeout);
    };
  }, [refresh]);

  const updateBudget = async (patch: Partial<BudgetPolicyRecord>): Promise<void> => {
    setBudget(await window.wenforge.budgets.updatePolicies(patch));
    await refresh();
  };

  const updatePrice = async (
    price: ModelPriceRecord,
    patch: Partial<ModelPriceRecord>
  ): Promise<void> => {
    await window.wenforge.modelPrices.upsert({ ...price, ...patch });
    await refresh();
  };

  const exportPrices = async (): Promise<void> => {
    setImportJson(await window.wenforge.pricing.exportJson());
    setNotice("Price registry exported into the JSON editor.");
  };

  const importPrices = async (): Promise<void> => {
    const result = await window.wenforge.pricing.importJson(importJson);
    setNotice(`Imported ${result.importedCount} price rows.`);
    await refresh();
  };

  const markAllStale = async (): Promise<void> => {
    await window.wenforge.pricing.markStale(prices.map((price) => price.id));
    setNotice("Marked visible prices stale.");
    await refresh();
  };

  const exportCosts = async (): Promise<void> => {
    setCsv(await window.wenforge.costs.exportCsv(scope));
    setNotice("Cost CSV generated locally with redacted errors.");
  };

  const estimateChapters = async (chapterCount: number): Promise<void> => {
    const nextForecast = await window.wenforge.costs.forecastChapters({
      projectId: projectId ?? undefined,
      bookId: bookId ?? undefined,
      chapterId: chapterId ?? undefined,
      qualityMode: "balanced",
      chapterCount
    });
    setForecast(nextForecast);
    setQuotaSummary(await window.wenforge.costs.quotaSummary(nextForecast));
  };

  const compareRoutes = async (): Promise<void> => {
    setComparison(
      await window.wenforge.costs.compareQualityModes({
        projectId: projectId ?? undefined,
        bookId: bookId ?? undefined,
        chapterId: chapterId ?? undefined,
        chapterCount: 1
      })
    );
  };

  const updateQuota = async (
    quota: ProviderQuotaNoteDto | null,
    provider: ProviderQuotaNoteDto["provider"],
    patch: Partial<ProviderQuotaNoteDto>
  ): Promise<void> => {
    await window.wenforge.pricing.upsertQuota({
      provider,
      creditBalance: quota?.creditBalance ?? null,
      monthlyBudget: quota?.monthlyBudget ?? null,
      freeQuotaRemaining: quota?.freeQuotaRemaining ?? null,
      refreshedAt: quota?.refreshedAt ?? new Date().toISOString().slice(0, 10),
      notes: quota?.notes ?? null,
      ...patch
    });
    await refresh();
  };

  return (
    <div className="h-full overflow-auto px-6 py-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
            Cost dashboard
          </p>
          <h2 className="mt-1 text-xl font-semibold text-white">
            Spend, usage quality, and price readiness
          </h2>
        </div>
        <button
          className="rounded-md border border-forge-blue/30 bg-forge-blue/10 px-3 py-2 text-xs text-forge-blue"
          onClick={() => void exportCosts()}
          type="button"
        >
          Export Cost CSV
        </button>
      </div>

      {notice ? (
        <p className="mt-4 rounded-lg border border-forge-blue/25 bg-forge-blue/10 px-3 py-2 text-sm text-forge-blue">
          {notice}
        </p>
      ) : null}

      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <Metric
          label="Active run"
          value={money(activeRunCost || summary?.activeRunCost.finalCost)}
        />
        <Metric label="Session" value={money(sessionCost || summary?.sessionCost.finalCost)} />
        <Metric label="Today" value={money(summary?.todayCost.finalCost)} />
        <Metric label="Project" value={money(summary?.currentProjectCost.finalCost)} />
        <Metric label="Month to date" value={money(summary?.monthToDateCost.finalCost)} />
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className={panelClassName}>
          <h3 className="text-sm font-semibold text-white">Charts</h3>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <BarChart groups={summary?.spendOverTime ?? []} title="Spend over time" />
            <BarChart groups={summary?.byModel ?? []} title="Spend by model" />
            <BarChart groups={summary?.costPerChapter ?? []} title="Cost per chapter" />
            <BarChart groups={summary?.byTaskType ?? []} title="Cost by task type" />
          </div>
        </section>
        <section className={panelClassName}>
          <h3 className="text-sm font-semibold text-white">Usage quality</h3>
          <div className="mt-3 space-y-2 text-sm text-slate-300">
            <p>
              Provider-reported: {money(summary?.estimatedVsReported.providerReportedCost)} (
              {summary?.estimatedVsReported.providerReportedRuns ?? 0} runs)
            </p>
            <p>
              Estimated only: {money(summary?.estimatedVsReported.estimatedOnlyCost)} (
              {summary?.estimatedVsReported.estimatedRuns ?? 0} runs)
            </p>
            <p>Average per approved chapter: {money(summary?.averageCostPerApprovedChapter)}</p>
            <p>
              Average per 1k Chinese characters: {money(summary?.averageCostPer1kChineseCharacters)}
            </p>
          </div>
          <h4 className="mt-5 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
            Stale prices
          </h4>
          <div className="mt-2 space-y-2">
            {(summary?.stalePriceWarnings ?? []).length === 0 ? (
              <p className="text-xs text-slate-500">No stale price warnings.</p>
            ) : null}
            {summary?.stalePriceWarnings.map((warning) => (
              <p
                className="rounded-md border border-amber-300/20 bg-amber-300/10 px-2 py-1 text-xs text-amber-100"
                key={warning.priceId}
              >
                {warning.provider}/{warning.model} · {warning.effectiveDate}
              </p>
            ))}
          </div>
        </section>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <section className={panelClassName}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-white">Chapter forecasting</h3>
            <div className="flex flex-wrap gap-2">
              <button
                className="rounded-md border border-forge-blue/30 px-2 py-1 text-xs text-forge-blue"
                onClick={() => void estimateChapters(1)}
                type="button"
              >
                Estimate this chapter
              </button>
              <button
                className="rounded-md border border-white/10 px-2 py-1 text-xs text-slate-300"
                onClick={() => void estimateChapters(10)}
                type="button"
              >
                Next 10
              </button>
              <button
                className="rounded-md border border-white/10 px-2 py-1 text-xs text-slate-300"
                onClick={() => void estimateChapters(100)}
                type="button"
              >
                100 chapters
              </button>
              <button
                className="rounded-md border border-forge-mint/30 px-2 py-1 text-xs text-forge-mint"
                onClick={() => void compareRoutes()}
                type="button"
              >
                Compare routes
              </button>
            </div>
          </div>
          {forecast ? (
            <div className="mt-4 grid gap-3 lg:grid-cols-[220px_minmax(0,1fr)]">
              <div className="rounded-lg border border-white/10 bg-white/[0.025] p-3 text-sm">
                <p className="text-slate-400">
                  {forecast.qualityMode} · {forecast.chapterCount} chapter(s)
                </p>
                <p className="mt-2 text-2xl font-semibold text-white">
                  {money(forecast.totalExpectedCost)}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  low {money(forecast.lowCost)} · high {money(forecast.highCost)}
                </p>
                {forecast.remainingProjectBudget !== null ? (
                  <p className="mt-2 text-xs text-slate-400">
                    Project budget remaining: {money(forecast.remainingProjectBudget)}
                  </p>
                ) : null}
              </div>
              <div className="max-h-56 overflow-auto rounded-lg border border-white/10">
                {forecast.nodes.map((node) => (
                  <div
                    className="grid grid-cols-[140px_minmax(0,1fr)_90px] gap-2 border-b border-white/10 px-3 py-2 text-xs last:border-b-0"
                    key={node.taskType}
                  >
                    <span className="text-slate-400">{node.taskType}</span>
                    <span className="truncate text-slate-200">
                      {node.provider ? `${node.provider}/${node.model}` : node.warnings[0]}
                    </span>
                    <span className="text-right text-forge-mint">{money(node.expectedCost)}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="mt-3 text-xs text-slate-500">Run an estimate before generation.</p>
          )}
          {comparison ? (
            <div className="mt-3 grid gap-2 md:grid-cols-3">
              {comparison.forecasts.map((item) => (
                <p
                  className="rounded-md border border-white/10 bg-black/20 px-2 py-1 text-xs text-slate-300"
                  key={item.qualityMode}
                >
                  {item.qualityMode}: {money(item.totalExpectedCost)}
                </p>
              ))}
            </div>
          ) : null}
        </section>
        <section className={panelClassName}>
          <h3 className="text-sm font-semibold text-white">Manual quota notes</h3>
          <div className="mt-3 space-y-2">
            {(["dashscope_qwen", "anthropic", "openai", "deepseek"] as const).map((provider) => {
              const quota = quotas.find((item) => item.provider === provider) ?? null;
              return (
                <div className="rounded-md border border-white/10 p-2" key={provider}>
                  <p className="text-xs font-medium text-slate-300">{provider}</p>
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    <InlineOptionalNumber
                      value={quota?.creditBalance ?? null}
                      onCommit={(value) => void updateQuota(quota, provider, { creditBalance: value })}
                    />
                    <InlineOptionalNumber
                      value={quota?.monthlyBudget ?? null}
                      onCommit={(value) => void updateQuota(quota, provider, { monthlyBudget: value })}
                    />
                    <InlineOptionalNumber
                      value={quota?.freeQuotaRemaining ?? null}
                      onCommit={(value) =>
                        void updateQuota(quota, provider, { freeQuotaRemaining: value })
                      }
                    />
                  </div>
                </div>
              );
            })}
          </div>
          {quotaSummary ? (
            <div className="mt-3 space-y-1 text-xs text-slate-400">
              {quotaSummary.providers.map((item) => (
                <p key={item.provider}>
                  {item.provider}: {item.chaptersRemaining ?? "n/a"} chapter(s) remaining
                </p>
              ))}
              {quotaSummary.warnings.map((warning) => (
                <p className="text-amber-100" key={warning}>
                  {warning}
                </p>
              ))}
            </div>
          ) : null}
        </section>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
        <section className={panelClassName}>
          <h3 className="text-sm font-semibold text-white">Budget policy</h3>
          {budget ? (
            <div className="mt-4 grid gap-3">
              <BudgetInput
                label="Per call"
                value={budget.perCallBudgetCap}
                onCommit={(value) => void updateBudget({ perCallBudgetCap: value })}
              />
              <BudgetInput
                label="Per workflow"
                value={budget.perWorkflowBudgetCap}
                onCommit={(value) => void updateBudget({ perWorkflowBudgetCap: value })}
              />
              <BudgetInput
                label="Daily"
                value={budget.dailyBudgetCap}
                onCommit={(value) => void updateBudget({ dailyBudgetCap: value })}
              />
              <BudgetInput
                label="Project"
                value={budget.projectBudgetCap}
                onCommit={(value) => void updateBudget({ projectBudgetCap: value })}
              />
              <BudgetInput
                label="Warning %"
                value={budget.warningThresholdPercent}
                onCommit={(value) => void updateBudget({ warningThresholdPercent: value ?? 50 })}
              />
              <select
                className={fieldClassName}
                value={budget.onBudgetExceeded}
                onChange={(event) =>
                  void updateBudget({
                    onBudgetExceeded: event.target.value as BudgetPolicyRecord["onBudgetExceeded"]
                  })
                }
              >
                <option value="warn">Warn</option>
                <option value="pause">Pause</option>
                <option value="abort">Abort</option>
              </select>
            </div>
          ) : null}
        </section>
        <section className={panelClassName}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-white">Pricing tools</h3>
            <div className="flex gap-2">
              <button
                className="rounded-md border border-white/10 px-2 py-1 text-xs text-slate-300"
                onClick={() => void exportPrices()}
                type="button"
              >
                Export JSON
              </button>
              <button
                className="rounded-md border border-amber-300/30 px-2 py-1 text-xs text-amber-100"
                onClick={() => void markAllStale()}
                type="button"
              >
                Mark Stale
              </button>
              <button
                className="rounded-md border border-forge-mint/30 px-2 py-1 text-xs text-forge-mint"
                onClick={() => void importPrices()}
                type="button"
              >
                Import JSON
              </button>
            </div>
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Price tiers: {priceTiers.length} editable deployment/token rows.
          </p>
          <textarea
            className="mt-3 h-28 w-full rounded-md border border-white/10 bg-black/30 p-3 font-mono text-xs text-slate-200 outline-none focus:border-forge-blue/50"
            onChange={(event) => setImportJson(event.target.value)}
            placeholder='{"prices":[...]}'
            value={importJson}
          />
          <div className="mt-3 max-h-72 overflow-auto rounded-lg border border-white/10">
            {prices.map((price) => (
              <div
                className="grid grid-cols-[130px_minmax(0,1fr)_90px_90px_120px_80px] items-center gap-2 border-b border-white/10 px-3 py-2 text-xs last:border-b-0"
                key={price.id}
              >
                <span className="text-slate-400">{price.provider}</span>
                <span className="truncate text-white">{price.model}</span>
                <InlineNumber
                  value={price.inputPricePerMillion}
                  onCommit={(value) => void updatePrice(price, { inputPricePerMillion: value })}
                />
                <InlineNumber
                  value={price.outputPricePerMillion}
                  onCommit={(value) => void updatePrice(price, { outputPricePerMillion: value })}
                />
                <input
                  className={fieldClassName}
                  defaultValue={price.effectiveDate}
                  onBlur={(event) => void updatePrice(price, { effectiveDate: event.target.value })}
                  type="date"
                />
                <button
                  className="rounded-md border border-white/10 px-2 py-1 text-slate-300"
                  onClick={() => void updatePrice(price, { enabled: !price.enabled })}
                  type="button"
                >
                  {price.enabled ? "On" : "Off"}
                </button>
              </div>
            ))}
          </div>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {routeWarnings.map((warning) => (
              <p
                className="rounded-md border border-amber-300/20 bg-amber-300/10 px-2 py-1 text-xs text-amber-100"
                key={`${warning.routeId}-${warning.warningType}`}
              >
                {warning.taskType}/{warning.qualityMode}: {warning.warningType}
              </p>
            ))}
          </div>
        </section>
      </div>

      {csv ? (
        <section className={`${panelClassName} mt-4`}>
          <h3 className="text-sm font-semibold text-white">{csv.filename}</h3>
          <pre className="mt-3 max-h-52 overflow-auto rounded-md bg-black/30 p-3 text-xs text-slate-300">
            {csv.content}
          </pre>
        </section>
      ) : null}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <article className={panelClassName}>
      <p className="text-xs uppercase tracking-[0.12em] text-slate-500">{label}</p>
      <p className="mt-2 text-xl font-semibold text-white">{value}</p>
    </article>
  );
}

function BarChart({ groups, title }: { groups: CostGroup[]; title: string }): JSX.Element {
  const max = Math.max(0.000001, ...groups.map((group) => group.finalCost));
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.025] p-3">
      <h4 className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{title}</h4>
      <div className="mt-3 space-y-2">
        {groups.slice(0, 8).map((group) => (
          <div key={group.key}>
            <div className="flex items-center justify-between gap-3 text-xs">
              <span className="truncate text-slate-300">{group.label}</span>
              <span className="text-forge-mint">{money(group.finalCost)}</span>
            </div>
            <div className="mt-1 h-2 rounded-full bg-white/10">
              <div
                className="h-2 rounded-full bg-forge-blue"
                style={{ width: `${Math.max(4, (group.finalCost / max) * 100)}%` }}
              />
            </div>
          </div>
        ))}
        {groups.length === 0 ? <p className="text-xs text-slate-500">No spend yet.</p> : null}
      </div>
    </div>
  );
}

function BudgetInput({
  label,
  onCommit,
  value
}: {
  label: string;
  onCommit: (value: number | null) => void;
  value: number | null;
}): JSX.Element {
  return (
    <label className="grid gap-1 text-xs text-slate-400">
      {label}
      <input
        className={fieldClassName}
        defaultValue={value ?? ""}
        inputMode="decimal"
        onBlur={(event) => onCommit(parseOptionalNumber(event.target.value))}
      />
    </label>
  );
}

function InlineNumber({
  onCommit,
  value
}: {
  onCommit: (value: number) => void;
  value: number;
}): JSX.Element {
  return (
    <input
      className={fieldClassName}
      defaultValue={String(value)}
      inputMode="decimal"
      onBlur={(event) => {
        const parsed = Number(event.target.value);
        if (Number.isFinite(parsed) && parsed >= 0) onCommit(parsed);
      }}
    />
  );
}

function InlineOptionalNumber({
  onCommit,
  value
}: {
  onCommit: (value: number | null) => void;
  value: number | null;
}): JSX.Element {
  return (
    <input
      className={fieldClassName}
      defaultValue={value ?? ""}
      inputMode="decimal"
      onBlur={(event) => onCommit(parseOptionalNumber(event.target.value))}
      placeholder="0.00"
    />
  );
}

function parseOptionalNumber(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function money(value: number | null | undefined): string {
  return `$${(value ?? 0).toFixed(6)}`;
}

import type {
  CostDashboardSummary,
  CostGroup,
  CostScopeRequest,
  CsvExportResult,
  PriceImportResult,
  RoutePriceWarning,
  StalePriceWarning
} from "@contracts/cost-dashboard";
import { priceRegistryImportSchema } from "@contracts/cost-dashboard";
import type { ModelPriceRecord } from "@contracts/model-routing";
import type { WenForgeDatabase } from "@main/db/connection";
import type { RepositoryRegistry } from "@main/db/service";
import type { ProviderId } from "@shared/domain/model-routing";

export interface CostDashboardServiceOptions {
  database: WenForgeDatabase;
  repositories: RepositoryRegistry;
  now?: () => string;
  priceStaleAfterDays?: number;
}

export class CostDashboardService {
  constructor(private readonly options: CostDashboardServiceOptions) {}

  getDashboard(input: CostScopeRequest = {}): CostDashboardSummary {
    const now = this.options.now?.() ?? new Date().toISOString();
    const todayStart = `${now.slice(0, 10)}T00:00:00.000Z`;
    const monthStart = `${now.slice(0, 7)}-01T00:00:00.000Z`;
    const currency = this.detectCurrency();
    const activeRunCost = input.activeRunId
      ? this.summarize({ runId: input.activeRunId }, "active", "Active run")
      : emptyGroup("active", "Active run", currency);
    const sessionCost = input.sessionSince
      ? this.summarize({ ...input, since: input.sessionSince }, "session", "Session")
      : emptyGroup("session", "Session", currency);
    const todayCost = this.summarize({ ...input, since: todayStart }, "today", "Today");
    const monthToDateCost = this.summarize(
      { ...input, since: monthStart },
      "month_to_date",
      "Month to date"
    );
    const currentProjectCost = this.summarize(
      input.projectId ? { projectId: input.projectId } : input,
      "current_project",
      "Current project"
    );
    const projectScope = input.projectId ? { projectId: input.projectId } : input;

    return {
      activeRunCost,
      sessionCost,
      todayCost,
      currentProjectCost,
      monthToDateCost,
      byProvider: this.group(projectScope, "provider", "provider"),
      byModel: this.group(projectScope, "provider || '/' || model", "provider || '/' || model"),
      byTaskType: this.group(projectScope, "task_type", "task_type"),
      byWorkflowNode: this.group(projectScope, "task_type", "task_type"),
      byChapter: this.groupChapters(projectScope),
      spendOverTime: this.group(
        projectScope,
        "substr(request_started_at, 1, 10)",
        "substr(request_started_at, 1, 10)"
      ),
      perProviderBurnDown: this.group(projectScope, "provider", "provider"),
      costPerChapter: this.groupChapters(projectScope),
      modelRouteCostComparison: this.group(projectScope, "task_type || ':' || model", "task_type || ':' || model"),
      expensiveRunOutliers: this.group(projectScope, "id", "id").slice(0, 10),
      estimatedVsReported: this.estimatedVsReported(projectScope),
      averageCostPerApprovedChapter: this.averageCostPerApprovedChapter(projectScope),
      averageCostPer1kChineseCharacters: this.averageCostPer1kChineseCharacters(projectScope),
      stalePriceWarnings: this.stalePriceWarnings(),
      currency
    };
  }

  getByProject(input: CostScopeRequest = {}): CostGroup[] {
    return this.groupProjects(input);
  }

  getByBook(input: CostScopeRequest = {}): CostGroup[] {
    return this.groupBooks(input);
  }

  getByChapter(input: CostScopeRequest = {}): CostGroup[] {
    return this.groupChapters(input);
  }

  getByRun(input: CostScopeRequest = {}): CostGroup[] {
    return this.group(input, "id", "id");
  }

  getByModel(input: CostScopeRequest = {}): CostGroup[] {
    return this.group(input, "provider || '/' || model", "provider || '/' || model");
  }

  exportCsv(input: CostScopeRequest = {}): CsvExportResult {
    const { where, values } = buildWhere(input, "llm_runs");
    const rows = this.options.database.sqlite
      .prepare(
        `select id, provider, model, task_type, project_id, book_id, chapter_id, status,
          usage_source, estimated_cost_live, final_cost, currency, latency_ms, error_code,
          error_message, request_started_at, request_finished_at
        from llm_runs ${where}
        order by request_started_at asc`
      )
      .all(...values) as Array<Record<string, unknown>>;
    const header = [
      "id",
      "provider",
      "model",
      "task_type",
      "project_id",
      "book_id",
      "chapter_id",
      "status",
      "usage_source",
      "estimated_cost_live",
      "final_cost",
      "currency",
      "latency_ms",
      "error_code",
      "error_message",
      "request_started_at",
      "request_finished_at"
    ];
    const content = [
      header.join(","),
      ...rows.map((row) =>
        header
          .map((key) =>
            csvCell(key === "error_message" ? redact(String(row[key] ?? "")) : row[key])
          )
          .join(",")
      )
    ].join("\n");
    return {
      filename: `wenforge-costs-${new Date(this.options.now?.() ?? Date.now()).toISOString().slice(0, 10)}.csv`,
      content,
      rowCount: rows.length
    };
  }

  private summarize(input: CostScopeRequest, key: string, label: string): CostGroup {
    const { where, values } = buildWhere(input, "llm_runs");
    const row = this.options.database.sqlite
      .prepare(
        `select
          count(*) as run_count,
          coalesce(sum(estimated_cost_live), 0) as estimated_cost_live,
          coalesce(sum(coalesce(final_cost, estimated_cost_live)), 0) as final_cost,
          coalesce(max(currency), 'USD') as currency
        from llm_runs ${where}`
      )
      .get(...values) as Record<string, unknown>;
    return mapCostGroup({ ...row, key, label });
  }

  private group(
    input: CostScopeRequest,
    keyExpression: string,
    labelExpression: string
  ): CostGroup[] {
    const { where, values } = buildWhere(input, "llm_runs");
    const rows = this.options.database.sqlite
      .prepare(
        `select ${keyExpression} as key, ${labelExpression} as label,
          count(*) as run_count,
          coalesce(sum(estimated_cost_live), 0) as estimated_cost_live,
          coalesce(sum(coalesce(final_cost, estimated_cost_live)), 0) as final_cost,
          coalesce(max(currency), 'USD') as currency
        from llm_runs ${where}
        group by key, label
        order by final_cost desc, label asc`
      )
      .all(...values) as Array<Record<string, unknown>>;
    return rows.map(mapCostGroup);
  }

  private groupProjects(input: CostScopeRequest): CostGroup[] {
    return this.groupJoined(input, "projects", "project_id", "projects.name");
  }

  private groupBooks(input: CostScopeRequest): CostGroup[] {
    return this.groupJoined(input, "books", "book_id", "books.title");
  }

  private groupChapters(input: CostScopeRequest): CostGroup[] {
    return this.groupJoined(input, "chapters", "chapter_id", "chapters.title");
  }

  private groupJoined(
    input: CostScopeRequest,
    table: "projects" | "books" | "chapters",
    idColumn: string,
    labelColumn: string
  ): CostGroup[] {
    const { where, values } = buildWhere(input, "llm_runs");
    const rows = this.options.database.sqlite
      .prepare(
        `select llm_runs.${idColumn} as key,
          coalesce(${labelColumn}, llm_runs.${idColumn}, 'unknown') as label,
          count(*) as run_count,
          coalesce(sum(llm_runs.estimated_cost_live), 0) as estimated_cost_live,
          coalesce(sum(coalesce(llm_runs.final_cost, llm_runs.estimated_cost_live)), 0) as final_cost,
          coalesce(max(llm_runs.currency), 'USD') as currency
        from llm_runs
        left join ${table} on ${table}.id = llm_runs.${idColumn}
        ${where}
        group by key, label
        order by final_cost desc, label asc`
      )
      .all(...values) as Array<Record<string, unknown>>;
    return rows.map(mapCostGroup);
  }

  private estimatedVsReported(input: CostScopeRequest) {
    const { where, values } = buildWhere(input, "llm_runs");
    const rows = this.options.database.sqlite
      .prepare(
        `select usage_source, count(*) as run_count,
          coalesce(sum(coalesce(final_cost, estimated_cost_live)), 0) as final_cost
        from llm_runs ${where}
        group by usage_source`
      )
      .all(...values) as Array<Record<string, unknown>>;
    const bySource = new Map(rows.map((row) => [String(row.usage_source), row]));
    return {
      providerReportedCost: numberFrom(bySource.get("provider")?.final_cost),
      estimatedOnlyCost: numberFrom(bySource.get("estimated")?.final_cost),
      mixedCost: numberFrom(bySource.get("mixed")?.final_cost),
      providerReportedRuns: numberFrom(bySource.get("provider")?.run_count),
      estimatedRuns: numberFrom(bySource.get("estimated")?.run_count),
      mixedRuns: numberFrom(bySource.get("mixed")?.run_count)
    };
  }

  private averageCostPerApprovedChapter(input: CostScopeRequest): number {
    const projectCost = this.summarize(input, "scope", "Scope").finalCost;
    const filters: string[] = ["chapters.status in ('approved', 'published')"];
    const values: unknown[] = [];
    if (input.projectId) {
      filters.push("books.project_id = ?");
      values.push(input.projectId);
    }
    if (input.bookId) {
      filters.push("chapters.book_id = ?");
      values.push(input.bookId);
    }
    if (input.chapterId) {
      filters.push("chapters.id = ?");
      values.push(input.chapterId);
    }
    const row = this.options.database.sqlite
      .prepare(
        `select count(*) as approved_count
        from chapters
        join books on books.id = chapters.book_id
        where ${filters.join(" and ")}`
      )
      .get(...values) as Record<string, unknown>;
    const approvedCount = numberFrom(row.approved_count);
    return approvedCount > 0 ? roundCost(projectCost / approvedCount) : 0;
  }

  private averageCostPer1kChineseCharacters(input: CostScopeRequest): number {
    const cost = this.summarize(input, "scope", "Scope").finalCost;
    const filters: string[] = ["manuscript_versions.is_canonical = 1"];
    const values: unknown[] = [];
    if (input.projectId) {
      filters.push("books.project_id = ?");
      values.push(input.projectId);
    }
    if (input.bookId) {
      filters.push("chapters.book_id = ?");
      values.push(input.bookId);
    }
    if (input.chapterId) {
      filters.push("chapters.id = ?");
      values.push(input.chapterId);
    }
    const row = this.options.database.sqlite
      .prepare(
        `select coalesce(sum(manuscript_versions.character_count), 0) as character_count
        from manuscript_versions
        join chapters on chapters.id = manuscript_versions.chapter_id
        join books on books.id = chapters.book_id
        where ${filters.join(" and ")}`
      )
      .get(...values) as Record<string, unknown>;
    const characters = numberFrom(row.character_count);
    return characters > 0 ? roundCost(cost / (characters / 1000)) : 0;
  }

  private stalePriceWarnings(): StalePriceWarning[] {
    const staleAfterDays = this.options.priceStaleAfterDays ?? 90;
    return this.options.repositories.modelPrices
      .list()
      .filter((price) => price.enabled && isStale(price.effectiveDate, staleAfterDays, this.now()))
      .map((price) => ({
        priceId: price.id,
        provider: price.provider,
        model: price.model,
        effectiveDate: price.effectiveDate,
        staleAfterDays
      }));
  }

  private detectCurrency(): string {
    const row = this.options.database.sqlite
      .prepare("select coalesce(max(currency), 'USD') as currency from llm_runs")
      .get() as Record<string, unknown>;
    return String(row.currency ?? "USD");
  }

  private now(): string {
    return this.options.now?.() ?? new Date().toISOString();
  }
}

export class PricingRegistryService {
  constructor(private readonly options: CostDashboardServiceOptions) {}

  importJson(json: string): PriceImportResult {
    const parsed = priceRegistryImportSchema.parse(JSON.parse(json) as unknown);
    for (const price of parsed.prices) {
      this.options.repositories.modelPrices.upsert(price);
    }
    for (const tier of parsed.tiers ?? []) {
      const price =
        this.options.repositories.modelPrices.findActive(tier.provider, tier.model) ??
        this.options.repositories.modelPrices.upsert({
          provider: tier.provider,
          model: tier.model,
          inputPricePerMillion: tier.inputPricePerMillion,
          outputPricePerMillion: tier.outputPricePerMillion,
          cachedInputPricePerMillion: tier.cachedInputPricePerMillion,
          currency: tier.currency,
          effectiveDate: tier.effectiveDate,
          sourceNote: tier.sourceNote,
          enabled: tier.enabled
        });
      this.options.repositories.modelPriceTiers.upsert({
        modelPriceId: tier.modelPriceId ?? price.id,
        provider: tier.provider,
        model: tier.model,
        deploymentMode: tier.deploymentMode,
        minInputTokens: tier.minInputTokens,
        maxInputTokens: tier.maxInputTokens,
        inputPricePerMillion: tier.inputPricePerMillion,
        outputPricePerMillion: tier.outputPricePerMillion,
        cachedInputPricePerMillion: tier.cachedInputPricePerMillion,
        cacheWritePricePerMillion: tier.cacheWritePricePerMillion,
        currency: tier.currency,
        effectiveDate: tier.effectiveDate,
        sourceNote: tier.sourceNote,
        enabled: tier.enabled
      });
    }
    return { importedCount: parsed.prices.length + (parsed.tiers?.length ?? 0), skippedCount: 0 };
  }

  exportJson(): string {
    const payload = {
      schemaVersion: 1 as const,
      exportedAt: this.options.now?.() ?? new Date().toISOString(),
      prices: this.options.repositories.modelPrices.list().map((price) => ({
        provider: price.provider,
        model: price.model,
        inputPricePerMillion: price.inputPricePerMillion,
        outputPricePerMillion: price.outputPricePerMillion,
        cachedInputPricePerMillion: price.cachedInputPricePerMillion,
        currency: price.currency,
        contextWindow: price.contextWindow,
        maxOutputTokens: price.maxOutputTokens,
        effectiveDate: price.effectiveDate,
        sourceNote: price.sourceNote,
        enabled: price.enabled
      })),
      tiers: this.options.repositories.modelPriceTiers.list().map((tier) => ({
        modelPriceId: tier.modelPriceId,
        provider: tier.provider,
        model: tier.model,
        deploymentMode: tier.deploymentMode,
        minInputTokens: tier.minInputTokens,
        maxInputTokens: tier.maxInputTokens,
        inputPricePerMillion: tier.inputPricePerMillion,
        outputPricePerMillion: tier.outputPricePerMillion,
        cachedInputPricePerMillion: tier.cachedInputPricePerMillion,
        cacheWritePricePerMillion: tier.cacheWritePricePerMillion,
        currency: tier.currency,
        effectiveDate: tier.effectiveDate,
        sourceNote: tier.sourceNote,
        enabled: tier.enabled
      }))
    };
    return JSON.stringify(payload, null, 2);
  }

  markStalePrices(priceIds: string[], staleEffectiveDate = "2000-01-01"): ModelPriceRecord[] {
    return priceIds
      .map((id) => this.options.repositories.modelPrices.get(id))
      .filter((price): price is ModelPriceRecord => Boolean(price))
      .map((price) =>
        this.options.repositories.modelPrices.upsert({
          ...price,
          provider: price.provider as ProviderId,
          effectiveDate: staleEffectiveDate,
          sourceNote: `${price.sourceNote} Marked stale by user.`
        })
      );
  }

  listRoutePriceWarnings(input: { staleAfterDays?: number | undefined } = {}): RoutePriceWarning[] {
    const staleAfterDays = input.staleAfterDays ?? 90;
    return this.options.repositories.taskRoutes.list().flatMap((route): RoutePriceWarning[] => {
      const profile = this.options.repositories.modelProfiles.get(route.primaryModelProfileId);
      if (!profile) return [];
      const price = this.options.repositories.modelPrices.findActive(
        profile.provider,
        profile.model
      );
      if (!price) {
        return [
          {
            routeId: route.id,
            taskType: route.taskType,
            qualityMode: route.qualityMode,
            provider: profile.provider,
            model: profile.model,
            warningType: "missing_price" as const
          }
        ];
      }
      if (
        isStale(
          price.effectiveDate,
          staleAfterDays,
          this.options.now?.() ?? new Date().toISOString()
        )
      ) {
        return [
          {
            routeId: route.id,
            taskType: route.taskType,
            qualityMode: route.qualityMode,
            provider: profile.provider,
            model: profile.model,
            warningType: "stale_price" as const
          }
        ];
      }
      return [];
    });
  }
}

function buildWhere(
  input: CostScopeRequest,
  tableName: string
): { where: string; values: unknown[] } {
  const filters: string[] = [];
  const values: unknown[] = [];
  const column = (name: string) => `${tableName}.${name}`;
  if (input.projectId) {
    filters.push(`${column("project_id")} = ?`);
    values.push(input.projectId);
  }
  if (input.bookId) {
    filters.push(`${column("book_id")} = ?`);
    values.push(input.bookId);
  }
  if (input.chapterId) {
    filters.push(`${column("chapter_id")} = ?`);
    values.push(input.chapterId);
  }
  if (input.runId) {
    filters.push(`${column("id")} = ?`);
    values.push(input.runId);
  }
  if (input.since) {
    filters.push(`${column("request_started_at")} >= ?`);
    values.push(input.since);
  }
  if (input.until) {
    filters.push(`${column("request_started_at")} <= ?`);
    values.push(input.until);
  }
  return { where: filters.length > 0 ? `where ${filters.join(" and ")}` : "", values };
}

function emptyGroup(key: string, label: string, currency: string): CostGroup {
  return { key, label, runCount: 0, estimatedCostLive: 0, finalCost: 0, currency };
}

function mapCostGroup(row: Record<string, unknown>): CostGroup {
  return {
    key: row.key === null ? "unknown" : String(row.key),
    label: row.label === null ? "unknown" : String(row.label),
    runCount: numberFrom(row.run_count),
    estimatedCostLive: roundCost(numberFrom(row.estimated_cost_live)),
    finalCost: roundCost(numberFrom(row.final_cost)),
    currency: String(row.currency ?? "USD")
  };
}

function isStale(effectiveDate: string, staleAfterDays: number, now: string): boolean {
  const effective = Date.parse(effectiveDate);
  const current = Date.parse(now);
  if (!Number.isFinite(effective) || !Number.isFinite(current)) return true;
  return current - effective > staleAfterDays * 24 * 60 * 60 * 1000;
}

function numberFrom(value: unknown): number {
  return typeof value === "number" ? value : Number(value ?? 0);
}

function roundCost(value: number): number {
  return Math.round(value * 1_000_000_000) / 1_000_000_000;
}

function redact(value: string): string {
  return value
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "[redacted]")
    .replace(/sk-[A-Za-z0-9._-]+/gi, "sk-[redacted]")
    .replace(/[A-Za-z0-9_-]{24,}/g, "[redacted]");
}

function csvCell(value: unknown): string {
  const text = value === null || typeof value === "undefined" ? "" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

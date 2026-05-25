import type { BudgetPolicyRecord, UpdateBudgetPolicyInput } from "@contracts/budgets";
import { DEFAULT_BUDGET_POLICY } from "@contracts/budgets";
import type { WenForgeDatabase } from "@main/db/connection";
import { createId } from "@main/db/id";
import { nowIso } from "./types";

function nullableNumber(value: unknown): number | null {
  return value === null || typeof value === "undefined" ? null : Number(value);
}

function mapPolicy(row: Record<string, unknown>): BudgetPolicyRecord {
  return {
    id: String(row.id),
    name: String(row.name),
    perCallBudgetCap: nullableNumber(row.per_call_budget_cap),
    perWorkflowBudgetCap: nullableNumber(row.per_workflow_budget_cap),
    dailyBudgetCap: nullableNumber(row.daily_budget_cap),
    projectBudgetCap: nullableNumber(row.project_budget_cap),
    warningThresholdPercent: Number(row.warning_threshold_percent),
    onBudgetExceeded: String(row.on_budget_exceeded) as BudgetPolicyRecord["onBudgetExceeded"],
    currency: String(row.currency),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

export class BudgetPolicyRepository {
  constructor(private readonly db: WenForgeDatabase) {}

  getDefault(): BudgetPolicyRecord {
    const row = this.db.sqlite
      .prepare("select * from budget_policies order by created_at asc limit 1")
      .get();
    if (row) {
      return mapPolicy(row as Record<string, unknown>);
    }
    return this.createDefault();
  }

  update(input: UpdateBudgetPolicyInput): BudgetPolicyRecord {
    const current = input.id ? this.get(input.id) : this.getDefault();
    if (!current) {
      throw new Error("Budget policy not found");
    }
    const now = nowIso();
    this.db.sqlite
      .prepare(
        `insert into budget_policies
        (id, name, per_call_budget_cap, per_workflow_budget_cap, daily_budget_cap,
          project_budget_cap, warning_threshold_percent, on_budget_exceeded, currency,
          created_at, updated_at)
        values (@id, @name, @perCallBudgetCap, @perWorkflowBudgetCap, @dailyBudgetCap,
          @projectBudgetCap, @warningThresholdPercent, @onBudgetExceeded, @currency,
          @createdAt, @updatedAt)
        on conflict(id) do update set
          name = excluded.name,
          per_call_budget_cap = excluded.per_call_budget_cap,
          per_workflow_budget_cap = excluded.per_workflow_budget_cap,
          daily_budget_cap = excluded.daily_budget_cap,
          project_budget_cap = excluded.project_budget_cap,
          warning_threshold_percent = excluded.warning_threshold_percent,
          on_budget_exceeded = excluded.on_budget_exceeded,
          currency = excluded.currency,
          updated_at = excluded.updated_at`
      )
      .run({
        id: current.id,
        name: input.name ?? current.name,
        perCallBudgetCap:
          typeof input.perCallBudgetCap === "undefined"
            ? current.perCallBudgetCap
            : input.perCallBudgetCap,
        perWorkflowBudgetCap:
          typeof input.perWorkflowBudgetCap === "undefined"
            ? current.perWorkflowBudgetCap
            : input.perWorkflowBudgetCap,
        dailyBudgetCap:
          typeof input.dailyBudgetCap === "undefined"
            ? current.dailyBudgetCap
            : input.dailyBudgetCap,
        projectBudgetCap:
          typeof input.projectBudgetCap === "undefined"
            ? current.projectBudgetCap
            : input.projectBudgetCap,
        warningThresholdPercent: input.warningThresholdPercent ?? current.warningThresholdPercent,
        onBudgetExceeded: input.onBudgetExceeded ?? current.onBudgetExceeded,
        currency: input.currency ?? current.currency,
        createdAt: current.createdAt,
        updatedAt: now
      });
    return this.get(current.id) as BudgetPolicyRecord;
  }

  get(id: string): BudgetPolicyRecord | null {
    const row = this.db.sqlite.prepare("select * from budget_policies where id = ?").get(id);
    return row ? mapPolicy(row as Record<string, unknown>) : null;
  }

  private createDefault(): BudgetPolicyRecord {
    const now = nowIso();
    const id = createId("budget");
    this.db.sqlite
      .prepare(
        `insert into budget_policies
        (id, name, per_call_budget_cap, per_workflow_budget_cap, daily_budget_cap,
          project_budget_cap, warning_threshold_percent, on_budget_exceeded, currency,
          created_at, updated_at)
        values (@id, @name, @perCallBudgetCap, @perWorkflowBudgetCap, @dailyBudgetCap,
          @projectBudgetCap, @warningThresholdPercent, @onBudgetExceeded, @currency,
          @createdAt, @updatedAt)`
      )
      .run({
        id,
        name: DEFAULT_BUDGET_POLICY.name,
        perCallBudgetCap: DEFAULT_BUDGET_POLICY.perCallBudgetCap,
        perWorkflowBudgetCap: DEFAULT_BUDGET_POLICY.perWorkflowBudgetCap,
        dailyBudgetCap: DEFAULT_BUDGET_POLICY.dailyBudgetCap,
        projectBudgetCap: DEFAULT_BUDGET_POLICY.projectBudgetCap,
        warningThresholdPercent: DEFAULT_BUDGET_POLICY.warningThresholdPercent,
        onBudgetExceeded: DEFAULT_BUDGET_POLICY.onBudgetExceeded,
        currency: DEFAULT_BUDGET_POLICY.currency,
        createdAt: now,
        updatedAt: now
      });
    return this.get(id) as BudgetPolicyRecord;
  }
}

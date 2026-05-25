export type BudgetExceededAction = "warn" | "pause" | "abort";

export interface BudgetPolicyRecord {
  id: string;
  name: string;
  perCallBudgetCap: number | null;
  perWorkflowBudgetCap: number | null;
  dailyBudgetCap: number | null;
  projectBudgetCap: number | null;
  warningThresholdPercent: number;
  onBudgetExceeded: BudgetExceededAction;
  currency: string;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateBudgetPolicyInput {
  id?: string;
  name?: string;
  perCallBudgetCap?: number | null;
  perWorkflowBudgetCap?: number | null;
  dailyBudgetCap?: number | null;
  projectBudgetCap?: number | null;
  warningThresholdPercent?: number;
  onBudgetExceeded?: BudgetExceededAction;
  currency?: string;
}

export const DEFAULT_BUDGET_POLICY: Omit<BudgetPolicyRecord, "id" | "createdAt" | "updatedAt"> = {
  name: "Default",
  perCallBudgetCap: null,
  perWorkflowBudgetCap: null,
  dailyBudgetCap: null,
  projectBudgetCap: null,
  warningThresholdPercent: 50,
  onBudgetExceeded: "warn",
  currency: "USD"
};

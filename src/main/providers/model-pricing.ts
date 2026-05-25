export interface CostFormulaInput {
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens?: number;
  inputPricePerMillion: number;
  outputPricePerMillion: number;
  cachedInputPricePerMillion?: number | null;
}

export function calculateModelCost(input: CostFormulaInput): number {
  const cachedInputTokens = input.cachedInputTokens ?? 0;
  const nonCachedInputTokens = Math.max(input.inputTokens - cachedInputTokens, 0);
  const cachedInputPrice = input.cachedInputPricePerMillion ?? input.inputPricePerMillion;
  const cost =
    (nonCachedInputTokens / 1_000_000) * input.inputPricePerMillion +
    (cachedInputTokens / 1_000_000) * cachedInputPrice +
    (input.outputTokens / 1_000_000) * input.outputPricePerMillion;

  return Math.round(cost * 1_000_000) / 1_000_000;
}

export function isPriceStale(input: {
  effectiveDate: string;
  staleAfterDays: number;
  now?: Date;
}): boolean {
  const now = input.now ?? new Date();
  const effective = new Date(`${input.effectiveDate}T00:00:00.000Z`);
  const ageMs = now.getTime() - effective.getTime();
  return ageMs > input.staleAfterDays * 24 * 60 * 60 * 1000;
}

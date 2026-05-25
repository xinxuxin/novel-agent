import type { CostBreakdown, TokenUsage } from "@contracts/ai";

export interface CostCalculatorPrice {
  inputPricePerMillion: number;
  outputPricePerMillion: number;
  cachedInputPricePerMillion?: number | null;
  currency: string;
}

export class CostCalculator {
  calculate(input: {
    usage: TokenUsage;
    price: CostCalculatorPrice;
    estimated: boolean;
  }): CostBreakdown {
    const cachedInputTokens = input.usage.cachedInputTokens ?? 0;
    const nonCachedInputTokens = Math.max(input.usage.inputTokens - cachedInputTokens, 0);
    const cachedInputPrice =
      input.price.cachedInputPricePerMillion ?? input.price.inputPricePerMillion;
    const inputCost = roundCost(
      (nonCachedInputTokens / 1_000_000) * input.price.inputPricePerMillion
    );
    const cachedInputCost = roundCost((cachedInputTokens / 1_000_000) * cachedInputPrice);
    const outputCost = roundCost(
      (input.usage.outputTokens / 1_000_000) * input.price.outputPricePerMillion
    );

    return {
      inputCost,
      outputCost,
      cachedInputCost,
      totalCost: roundCost(inputCost + outputCost + cachedInputCost),
      currency: input.price.currency,
      estimated: input.estimated
    };
  }
}

export function roundCost(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

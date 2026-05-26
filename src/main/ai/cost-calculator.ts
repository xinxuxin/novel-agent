import type { CostBreakdown, TokenUsage } from "@contracts/ai";

export interface CostCalculatorPrice {
  inputPricePerMillion: number;
  outputPricePerMillion: number;
  cachedInputPricePerMillion?: number | null | undefined;
  cacheWritePricePerMillion?: number | null | undefined;
  currency: string;
}

export interface CostCalculatorPriceTier extends CostCalculatorPrice {
  id?: string | undefined;
  deploymentMode?: string | null | undefined;
  minInputTokens: number;
  maxInputTokens?: number | null | undefined;
  enabled?: boolean | undefined;
}

export interface CostSelectionResult {
  cost: CostBreakdown;
  selectedTier: CostCalculatorPriceTier | null;
  warnings: string[];
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

  calculateWithPriceSelection(input: {
    usage: TokenUsage;
    basePrice: CostCalculatorPrice;
    tiers?: CostCalculatorPriceTier[] | undefined;
    deploymentMode?: string | null | undefined;
    estimated: boolean;
  }): CostSelectionResult {
    const selection = this.selectPrice({
      basePrice: input.basePrice,
      tiers: input.tiers ?? [],
      inputTokens: input.usage.inputTokens,
      deploymentMode: input.deploymentMode
    });
    return {
      cost: this.calculate({
        usage: input.usage,
        price: selection.price,
        estimated: input.estimated
      }),
      selectedTier: selection.selectedTier,
      warnings: selection.warnings
    };
  }

  selectPrice(input: {
    basePrice: CostCalculatorPrice;
    tiers: CostCalculatorPriceTier[];
    inputTokens: number;
    deploymentMode?: string | null | undefined;
  }): {
    price: CostCalculatorPrice;
    selectedTier: CostCalculatorPriceTier | null;
    warnings: string[];
  } {
    const enabledTiers = input.tiers.filter((tier) => tier.enabled !== false);
    if (enabledTiers.length === 0) {
      return { price: input.basePrice, selectedTier: null, warnings: [] };
    }
    const deploymentCandidates = enabledTiers.filter((tier) =>
      input.deploymentMode
        ? tier.deploymentMode === input.deploymentMode
        : tier.deploymentMode === null || tier.deploymentMode === "global"
    );
    const selected =
      deploymentCandidates
        .filter((tier) => matchesInputRange(tier, input.inputTokens))
        .sort((left, right) => right.minInputTokens - left.minInputTokens)[0] ?? null;

    if (!selected) {
      return {
        price: input.basePrice,
        selectedTier: null,
        warnings: ["no_matching_price_tier"]
      };
    }
    return {
      price: {
        inputPricePerMillion: selected.inputPricePerMillion,
        outputPricePerMillion: selected.outputPricePerMillion,
        cachedInputPricePerMillion: selected.cachedInputPricePerMillion,
        cacheWritePricePerMillion: selected.cacheWritePricePerMillion,
        currency: selected.currency
      },
      selectedTier: selected,
      warnings: []
    };
  }
}

export function roundCost(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function matchesInputRange(tier: CostCalculatorPriceTier, inputTokens: number): boolean {
  return (
    tier.minInputTokens <= inputTokens &&
    (tier.maxInputTokens === null ||
      typeof tier.maxInputTokens === "undefined" ||
      tier.maxInputTokens >= inputTokens)
  );
}

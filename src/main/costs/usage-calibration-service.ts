import type { UsageCalibrationRecord } from "@contracts/model-routing";
import type { RepositoryRegistry } from "@main/db/service";
import type { ProviderId } from "@shared/domain/model-routing";

export interface UsageCalibrationServiceOptions {
  repositories: RepositoryRegistry;
  now?: () => string;
}

export interface UsageCalibrationSample {
  provider: ProviderId;
  model: string;
  inputTokensEstimated: number;
  outputTokensEstimated: number;
  inputTokensReported: number | null;
  outputTokensReported: number | null;
}

export class UsageCalibrationService {
  constructor(private readonly options: UsageCalibrationServiceOptions) {}

  get(provider: ProviderId, model: string): UsageCalibrationRecord | null {
    return this.options.repositories.usageCalibration.get(provider, model);
  }

  recordSample(input: UsageCalibrationSample): UsageCalibrationRecord | null {
    if (
      !input.inputTokensReported ||
      !input.outputTokensReported ||
      input.inputTokensEstimated <= 0 ||
      input.outputTokensEstimated <= 0
    ) {
      return this.get(input.provider, input.model);
    }

    const existing = this.get(input.provider, input.model);
    const oldSamples = existing?.samples ?? 0;
    const samples = oldSamples + 1;
    const inputFactor = input.inputTokensReported / input.inputTokensEstimated;
    const outputFactor = input.outputTokensReported / input.outputTokensEstimated;
    const sampleError =
      (Math.abs(input.inputTokensEstimated - input.inputTokensReported) /
        Math.max(1, input.inputTokensReported) +
        Math.abs(input.outputTokensEstimated - input.outputTokensReported) /
          Math.max(1, input.outputTokensReported)) /
      2;

    return this.options.repositories.usageCalibration.upsert({
      provider: input.provider,
      model: input.model,
      samples,
      inputEstimateFactor: weighted(existing?.inputEstimateFactor ?? 1, oldSamples, inputFactor),
      outputEstimateFactor: weighted(
        existing?.outputEstimateFactor ?? 1,
        oldSamples,
        outputFactor
      ),
      meanAbsoluteError: weighted(existing?.meanAbsoluteError ?? 0, oldSamples, sampleError),
      lastSampleAt: this.now(),
      createdAt: existing?.createdAt
    });
  }

  applyToEstimate(
    provider: ProviderId,
    model: string,
    estimate: { inputTokens: number; outputTokens: number }
  ): { inputTokens: number; outputTokens: number; calibrated: boolean } {
    const calibration = this.get(provider, model);
    if (!calibration || calibration.samples <= 0) {
      return { ...estimate, calibrated: false };
    }
    return {
      inputTokens: Math.round(estimate.inputTokens * calibration.inputEstimateFactor),
      outputTokens: Math.round(estimate.outputTokens * calibration.outputEstimateFactor),
      calibrated: true
    };
  }

  private now(): string {
    return this.options.now?.() ?? new Date().toISOString();
  }
}

function weighted(previous: number, oldSamples: number, next: number): number {
  return (previous * oldSamples + next) / (oldSamples + 1);
}

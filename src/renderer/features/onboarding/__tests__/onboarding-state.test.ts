import { describe, expect, it } from "vitest";

import {
  ONBOARDING_STEPS,
  buildOnboardingSettingsPatch,
  completeOnboardingStep,
  createDefaultOnboardingState,
  isOnboardingComplete
} from "@features/onboarding/onboarding-state";

describe("onboarding state", () => {
  it("starts with Simplified Chinese, balanced quality, and private logging defaults", () => {
    const state = createDefaultOnboardingState();

    expect(state.language).toBe("zh-Hans");
    expect(state.qualityMode).toBe("balanced");
    expect(state.privacy.storeFullPrompts).toBe(false);
    expect(state.privacy.storeFullResponses).toBe(false);
    expect(state.privacy.storeManuscriptsInLogs).toBe(false);
    expect(state.privacy.allowSendingFullRecentChapters).toBe(false);
    expect(state.currentStep).toBe("language");
    expect(isOnboardingComplete(state)).toBe(false);
  });

  it("moves through all required first-launch steps and produces settings patches", () => {
    const state = ONBOARDING_STEPS.reduce(
      (current, step) =>
        completeOnboardingStep(current, step, {
          projectMode: "create",
          providerMode: "mock",
          bookMode: "demo",
          qualityMode: "premium"
        }),
      createDefaultOnboardingState()
    );

    expect(isOnboardingComplete(state)).toBe(true);
    expect(state.completed).toBe(true);
    expect(buildOnboardingSettingsPatch(state)).toEqual({
      onboardingCompleted: true,
      language: "zh-Hans",
      defaultQualityMode: "premium",
      mockModeEnabled: true,
      privacy: {
        ...state.privacy,
        storeFullPrompts: false,
        storeFullResponses: false,
        storeManuscriptsInLogs: false,
        allowSendingFullRecentChapters: false
      }
    });
  });
});

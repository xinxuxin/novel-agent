import type { PrivacySettings } from "@contracts/settings";
import { DEFAULT_PRIVACY_SETTINGS } from "@contracts/settings";
import type { QualityMode } from "@shared/domain/model-routing";

export const ONBOARDING_STEPS = [
  "language",
  "project",
  "provider",
  "quality",
  "privacy",
  "book"
] as const;

export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];
export type OnboardingLanguage = "zh-Hans" | "en-US";
export type OnboardingProjectMode = "create" | "open";
export type OnboardingProviderMode = "provider" | "mock";
export type OnboardingBookMode = "demo" | "blank";

export interface OnboardingState {
  completed: boolean;
  currentStep: OnboardingStep;
  language: OnboardingLanguage;
  projectMode: OnboardingProjectMode | null;
  providerMode: OnboardingProviderMode | null;
  qualityMode: QualityMode;
  privacy: PrivacySettings;
  bookMode: OnboardingBookMode | null;
}

export interface OnboardingChoicePatch {
  language?: OnboardingLanguage;
  projectMode?: OnboardingProjectMode;
  providerMode?: OnboardingProviderMode;
  qualityMode?: QualityMode;
  privacy?: Partial<PrivacySettings>;
  bookMode?: OnboardingBookMode;
}

export interface OnboardingSettingsPatch {
  onboardingCompleted: boolean;
  language: OnboardingLanguage;
  defaultQualityMode: QualityMode;
  mockModeEnabled: boolean;
  privacy: PrivacySettings;
}

export function createDefaultOnboardingState(): OnboardingState {
  return {
    completed: false,
    currentStep: "language",
    language: "zh-Hans",
    projectMode: null,
    providerMode: null,
    qualityMode: "balanced",
    privacy: {
      ...DEFAULT_PRIVACY_SETTINGS,
      storeFullPrompts: false,
      storeFullResponses: false,
      storeManuscriptsInLogs: false,
      allowSendingFullRecentChapters: false
    },
    bookMode: null
  };
}

export function completeOnboardingStep(
  state: OnboardingState,
  step: OnboardingStep,
  patch: OnboardingChoicePatch = {}
): OnboardingState {
  const next = applyPatch(state, patch);
  const stepIndex = ONBOARDING_STEPS.indexOf(step);
  const currentStep =
    ONBOARDING_STEPS[Math.min(stepIndex + 1, ONBOARDING_STEPS.length - 1)] ?? "book";
  const completed =
    step === "book" && isOnboardingComplete({ ...next, bookMode: next.bookMode ?? "demo" });
  return {
    ...next,
    completed,
    currentStep: completed ? "book" : currentStep
  };
}

export function isOnboardingComplete(state: OnboardingState): boolean {
  return Boolean(
    state.language &&
    state.projectMode &&
    state.providerMode &&
    state.qualityMode &&
    state.bookMode &&
    !state.privacy.storeFullPrompts &&
    !state.privacy.storeFullResponses &&
    !state.privacy.storeManuscriptsInLogs &&
    !state.privacy.allowSendingFullRecentChapters
  );
}

export function buildOnboardingSettingsPatch(state: OnboardingState): OnboardingSettingsPatch {
  return {
    onboardingCompleted: isOnboardingComplete(state),
    language: state.language,
    defaultQualityMode: state.qualityMode,
    mockModeEnabled: state.providerMode === "mock",
    privacy: {
      ...state.privacy,
      storeFullPrompts: false,
      storeFullResponses: false,
      storeManuscriptsInLogs: false,
      allowSendingFullRecentChapters: false
    }
  };
}

function applyPatch(state: OnboardingState, patch: OnboardingChoicePatch): OnboardingState {
  return {
    ...state,
    ...patch,
    privacy: { ...state.privacy, ...patch.privacy }
  };
}

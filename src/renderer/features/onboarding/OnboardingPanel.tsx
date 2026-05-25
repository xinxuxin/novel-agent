import React, { useMemo, useState } from "react";
import type { JSX } from "react";

import type { QualityMode } from "@shared/domain/model-routing";
import {
  ONBOARDING_STEPS,
  buildOnboardingSettingsPatch,
  completeOnboardingStep,
  createDefaultOnboardingState,
  type OnboardingBookMode,
  type OnboardingProviderMode,
  type OnboardingState,
  type OnboardingStep
} from "./onboarding-state";

interface OnboardingPanelProps {
  hasProject: boolean;
  hasProvider: boolean;
  onCreateOrUseProject: () => Promise<void>;
  onCreateBook: (mode: OnboardingBookMode) => Promise<void>;
  onFinish: (settings: ReturnType<typeof buildOnboardingSettingsPatch>) => Promise<void>;
  onOpenSettings: () => void;
}

export function OnboardingPanel({
  hasProject,
  hasProvider,
  onCreateOrUseProject,
  onCreateBook,
  onFinish,
  onOpenSettings
}: OnboardingPanelProps): JSX.Element {
  const [state, setState] = useState<OnboardingState>(() => createDefaultOnboardingState());
  const [busy, setBusy] = useState(false);
  const currentIndex = ONBOARDING_STEPS.indexOf(state.currentStep);
  const progress = useMemo(
    () => Math.round(((currentIndex + (state.completed ? 1 : 0)) / ONBOARDING_STEPS.length) * 100),
    [currentIndex, state.completed]
  );

  async function complete(step: OnboardingStep, patch = {}): Promise<void> {
    const next = completeOnboardingStep(state, step, patch);
    setState(next);
  }

  async function finishWithBook(mode: OnboardingBookMode): Promise<void> {
    setBusy(true);
    try {
      await onCreateBook(mode);
      const next = completeOnboardingStep(state, "book", { bookMode: mode });
      setState(next);
      await onFinish(buildOnboardingSettingsPatch(next));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/55 p-6 backdrop-blur-md">
      <section className="w-full max-w-3xl rounded-2xl border border-white/10 bg-graphite-950/95 p-6 shadow-soft-glow">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-forge-cyan">
              First launch
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-white">Set up WenForge Studio</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
              Choose private defaults, a project path, and whether to start with mock generation or
              provider setup.
            </p>
          </div>
          <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-400">
            {progress}%
          </span>
        </div>
        <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-forge-blue" style={{ width: `${progress}%` }} />
        </div>

        <div className="mt-6">
          {state.currentStep === "language" ? (
            <Step title="Language" body="WenForge defaults to Simplified Chinese output.">
              <ChoiceButton onClick={() => void complete("language", { language: "zh-Hans" })}>
                简体中文
              </ChoiceButton>
            </Step>
          ) : null}

          {state.currentStep === "project" ? (
            <Step title="Project" body="Use the current project or create a starter project.">
              <ChoiceButton
                onClick={() => {
                  setBusy(true);
                  void onCreateOrUseProject().finally(() => {
                    setBusy(false);
                    void complete("project", { projectMode: hasProject ? "open" : "create" });
                  });
                }}
              >
                {hasProject ? "Use Current Project" : "Create Starter Project"}
              </ChoiceButton>
            </Step>
          ) : null}

          {state.currentStep === "provider" ? (
            <Step
              title="Provider"
              body="Start safely with mock mode or open Settings to add an encrypted credential."
            >
              <ChoiceButton onClick={() => void complete("provider", { providerMode: "mock" })}>
                Use Mock Mode
              </ChoiceButton>
              <ChoiceButton
                onClick={() => {
                  onOpenSettings();
                  void complete("provider", {
                    providerMode: (hasProvider ? "provider" : "mock") as OnboardingProviderMode
                  });
                }}
              >
                Open Provider Settings
              </ChoiceButton>
            </Step>
          ) : null}

          {state.currentStep === "quality" ? (
            <Step title="Quality Mode" body="Balanced is the default route for routine chapters.">
              {(["economy", "balanced", "premium"] as QualityMode[]).map((mode) => (
                <ChoiceButton
                  active={state.qualityMode === mode}
                  key={mode}
                  onClick={() => void complete("quality", { qualityMode: mode })}
                >
                  {mode[0]?.toUpperCase()}
                  {mode.slice(1)}
                </ChoiceButton>
              ))}
            </Step>
          ) : null}

          {state.currentStep === "privacy" ? (
            <Step
              title="Privacy"
              body="Verbose prompt, response, manuscript, and recent-chapter logging stay off."
            >
              <ul className="grid gap-2 text-sm text-slate-300 sm:grid-cols-2">
                {[
                  "Full prompt logging off",
                  "Full response logging off",
                  "Manuscript logging off",
                  "Full recent chapters off"
                ].map((label) => (
                  <li
                    className="rounded-lg border border-forge-mint/20 bg-forge-mint/8 p-3"
                    key={label}
                  >
                    {label}
                  </li>
                ))}
              </ul>
              <ChoiceButton onClick={() => void complete("privacy")}>
                Keep Private Defaults
              </ChoiceButton>
            </Step>
          ) : null}

          {state.currentStep === "book" ? (
            <Step title="Book" body="Create a demo book or a blank book shell.">
              <ChoiceButton disabled={busy} onClick={() => void finishWithBook("demo")}>
                Create Demo Book
              </ChoiceButton>
              <ChoiceButton disabled={busy} onClick={() => void finishWithBook("blank")}>
                Create Blank Book
              </ChoiceButton>
            </Step>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function Step({
  body,
  children,
  title
}: {
  body: string;
  children: React.ReactNode;
  title: string;
}): JSX.Element {
  return (
    <div>
      <h3 className="text-lg font-semibold text-white">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-400">{body}</p>
      <div className="mt-5 flex flex-wrap gap-3">{children}</div>
    </div>
  );
}

function ChoiceButton({
  active,
  children,
  disabled,
  onClick
}: {
  active?: boolean;
  children: React.ReactNode;
  disabled?: boolean;
  onClick: () => void;
}): JSX.Element {
  return (
    <button
      className={`rounded-lg border px-4 py-3 text-sm transition focus:border-forge-blue/60 focus:outline-none disabled:cursor-not-allowed disabled:opacity-45 ${
        active
          ? "border-forge-blue/35 bg-forge-blue/12 text-forge-blue"
          : "border-white/10 bg-black/20 text-slate-200 hover:border-forge-blue/35 hover:text-white"
      }`}
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
}

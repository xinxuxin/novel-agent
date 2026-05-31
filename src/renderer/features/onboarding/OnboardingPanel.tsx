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
              首次启动
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-white">配置文炉写作台</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
              选择隐私默认值、项目入口，以及先用本地模拟还是添加模型密钥。
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
            <Step title="语言" body="默认生成简体中文正文。">
              <ChoiceButton onClick={() => void complete("language", { language: "zh-Hans" })}>
                简体中文
              </ChoiceButton>
            </Step>
          ) : null}

          {state.currentStep === "project" ? (
            <Step title="项目" body="使用当前项目，或创建一个起步项目。">
              <ChoiceButton
                onClick={() => {
                  setBusy(true);
                  void onCreateOrUseProject().finally(() => {
                    setBusy(false);
                    void complete("project", { projectMode: hasProject ? "open" : "create" });
                  });
                }}
              >
                {hasProject ? "使用当前项目" : "创建起步项目"}
              </ChoiceButton>
            </Step>
          ) : null}

          {state.currentStep === "provider" ? (
            <Step
              title="模型"
              body="先用本地模拟，或打开设置添加加密保存的模型密钥。"
            >
              <ChoiceButton onClick={() => void complete("provider", { providerMode: "mock" })}>
                使用本地模拟
              </ChoiceButton>
              <ChoiceButton
                onClick={() => {
                  onOpenSettings();
                  void complete("provider", {
                    providerMode: (hasProvider ? "provider" : "mock") as OnboardingProviderMode
                  });
                }}
              >
                打开模型密钥设置
              </ChoiceButton>
            </Step>
          ) : null}

          {state.currentStep === "quality" ? (
            <Step title="质量模式" body="日常章节默认使用均衡路线。">
              {(["economy", "balanced", "premium"] as QualityMode[]).map((mode) => (
                <ChoiceButton
                  active={state.qualityMode === mode}
                  key={mode}
                  onClick={() => void complete("quality", { qualityMode: mode })}
                >
                  {mode === "economy" ? "经济" : mode === "balanced" ? "均衡" : "高级"}
                </ChoiceButton>
              ))}
            </Step>
          ) : null}

          {state.currentStep === "privacy" ? (
            <Step
              title="隐私"
              body="默认关闭完整提示词、响应、正文和近期章节日志。"
            >
              <ul className="grid gap-2 text-sm text-slate-300 sm:grid-cols-2">
                {[
                  "完整提示词日志关闭",
                  "完整响应日志关闭",
                  "正文日志关闭",
                  "完整近期章节关闭"
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
                保持隐私默认值
              </ChoiceButton>
            </Step>
          ) : null}

          {state.currentStep === "book" ? (
            <Step title="书籍" body="创建演示书，或创建空白书籍。">
              <ChoiceButton disabled={busy} onClick={() => void finishWithBook("demo")}>
                创建演示书
              </ChoiceButton>
              <ChoiceButton disabled={busy} onClick={() => void finishWithBook("blank")}>
                创建空白书
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

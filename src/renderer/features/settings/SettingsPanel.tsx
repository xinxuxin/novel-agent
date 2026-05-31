import { motion } from "framer-motion";
import type { JSX } from "react";
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";

import type {
  AIProviderId,
  AIStreamEvent,
  ModelPriceRecord,
  ModelProfileRecord,
  BudgetPolicyRecord,
  ProviderHealthRecord,
  ProviderModelListResult,
  ProviderSmokeResult,
  ProviderCredentialDto,
  TaskRouteRecord
} from "@contracts/index";
import type { DiagnosticBundle } from "@contracts/diagnostics";
import type { PrivacySettings, RoutingSettings } from "@contracts/settings";
import { PROVIDERS, QUALITY_MODES, TASK_TYPES } from "@shared/domain/model-routing";
import type { ProviderId, QualityMode, TaskType } from "@shared/domain/model-routing";

type SettingsTab = "providers" | "models" | "costs" | "routing" | "privacy" | "advanced";

interface SettingsData {
  credentials: ProviderCredentialDto[];
  profiles: ModelProfileRecord[];
  prices: ModelPriceRecord[];
  routes: TaskRouteRecord[];
  budget: BudgetPolicyRecord | null;
  providerHealth: ProviderHealthRecord[];
  providerSmoke: ProviderSmokeResult[];
  privacy: PrivacySettings | null;
  routing: RoutingSettings | null;
}

const PROVIDER_LABELS: Record<ProviderId, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  gemini: "Google Gemini",
  deepseek: "DeepSeek",
  dashscope_qwen: "DashScope / Qwen",
  moonshot_kimi: "Moonshot / Kimi",
  xai: "xAI",
  openrouter: "OpenRouter",
  generic_openai_compatible: "通用 OpenAI 兼容"
};

const AI_PROVIDER_LABELS: Record<AIProviderId, string> = {
  ...PROVIDER_LABELS,
  fake: "本地假流"
};

const TASK_LABELS: Record<TaskType, string> = {
  brainstorm: "脑暴",
  story_bible: "故事圣经",
  volume_outline: "卷纲",
  chapter_outline: "章纲",
  scene_cards: "场景卡",
  draft_chapter: "起草正文",
  webnovel_style_rewrite: "网文改写",
  originality_audit: "原创性检查",
  plot_logic_audit: "主线逻辑检查",
  continuity_audit: "连贯性审稿",
  suspense_hook_audit: "钩子审稿",
  revise_chapter: "改写终稿",
  state_settlement: "设定结算",
  summarize_chapter: "章节总结",
  embedding_or_memory_indexing: "记忆索引"
};

const QUALITY_LABELS: Record<QualityMode, string> = {
  economy: "经济",
  balanced: "均衡",
  premium: "高级",
  premium_webnovel: "网文高级"
};

const SETTINGS_TABS: Array<{ id: SettingsTab; label: string }> = [
  { id: "providers", label: "模型密钥" },
  { id: "models", label: "模型" },
  { id: "routing", label: "路线" },
  { id: "costs", label: "成本" },
  { id: "privacy", label: "隐私" },
  { id: "advanced", label: "高级" }
];

const today = new Date().toISOString().slice(0, 10);

const initialData: SettingsData = {
  credentials: [],
  profiles: [],
  prices: [],
  routes: [],
  budget: null,
  providerHealth: [],
  providerSmoke: [],
  privacy: null,
  routing: null
};

async function loadSettingsData(): Promise<SettingsData> {
  const [
    credentials,
    profiles,
    prices,
    routes,
    budget,
    providerHealth,
    providerSmoke,
    privacy,
    routing
  ] = await Promise.all([
    window.wenforge.credentials.list(),
    window.wenforge.modelProfiles.list(),
    window.wenforge.modelPrices.list(),
    window.wenforge.taskRoutes.list(),
    window.wenforge.budgets.getPolicies(),
    window.wenforge.providerHealth.list(),
    window.wenforge.providerSmoke.report(),
    window.wenforge.privacy.get(),
    window.wenforge.routingSettings.get()
  ]);
  return {
    credentials,
    profiles,
    prices,
    routes,
    budget,
    providerHealth,
    providerSmoke,
    privacy,
    routing
  };
}

export function SettingsPanel(): JSX.Element {
  const [activeTab, setActiveTab] = useState<SettingsTab>("providers");
  const [data, setData] = useState<SettingsData>(initialData);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [providerCheckBudget, setProviderCheckBudget] = useState("0.05");
  const [checkingProviders, setCheckingProviders] = useState<Set<ProviderId>>(() => new Set());
  const [providerModels, setProviderModels] = useState<ProviderModelListResult[]>([]);
  const [credentialDraft, setCredentialDraft] = useState({
    provider: "openai" as ProviderId,
    displayName: PROVIDER_LABELS.openai,
    baseUrl: "",
    apiKey: ""
  });
  const [modelDraft, setModelDraft] = useState({
    provider: "generic_openai_compatible" as ProviderId,
    model: "custom-model",
    alias: "",
    displayName: "自定义模型",
    contextWindow: "",
    maxOutputTokens: "",
    defaultTemperature: "0.7"
  });
  const [priceDraft, setPriceDraft] = useState({
    provider: "generic_openai_compatible" as ProviderId,
    model: "custom-model",
    inputPricePerMillion: "0",
    outputPricePerMillion: "0",
    cachedInputPricePerMillion: "",
    effectiveDate: today,
    sourceNote: "用户确认价格。",
    enabled: true
  });

  const refresh = useCallback(async (): Promise<void> => {
    setError(null);
    setData(await loadSettingsData());
    setLoading(false);
  }, []);

  useEffect(() => {
    let mounted = true;
    void loadSettingsData()
      .then((nextData) => {
        if (!mounted) {
          return;
        }
        setData(nextData);
        setLoading(false);
      })
      .catch((nextError: unknown) => {
        if (!mounted) {
          return;
        }
        setError(readError(nextError));
        setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const configuredProviders = useMemo(
    () =>
      new Set(
        data.credentials
          .filter((credential) => credential.isConfigured)
          .map((credential) => credential.provider)
      ),
    [data.credentials]
  );
  const priceKeys = useMemo(
    () => new Set(data.prices.filter((price) => price.enabled).map(priceKey)),
    [data.prices]
  );
  const stalePriceIds = useMemo(() => {
    const staleAfterDays = data.routing?.priceStaleAfterDays ?? 90;
    return new Set(
      data.prices
        .filter((price) => isStaleDate(price.effectiveDate, staleAfterDays))
        .map((price) => price.id)
    );
  }, [data.prices, data.routing?.priceStaleAfterDays]);
  const profileById = useMemo(
    () => new Map(data.profiles.map((profile) => [profile.id, profile])),
    [data.profiles]
  );
  const smokeByProvider = useMemo(
    () => new Map(data.providerSmoke.map((result) => [result.provider, result])),
    [data.providerSmoke]
  );
  const modelsByProvider = useMemo(
    () => new Map(providerModels.map((result) => [result.provider, result])),
    [providerModels]
  );

  const runAction = async (action: () => Promise<void>, success: string): Promise<void> => {
    try {
      setError(null);
      await action();
      await refresh();
      setNotice(success);
    } catch (nextError) {
      setError(readError(nextError));
    }
  };

  const saveCredential = async (): Promise<void> => {
    await runAction(async () => {
      const saved = await window.wenforge.credentials.save({
        provider: credentialDraft.provider,
        displayName: credentialDraft.displayName,
        apiKey: credentialDraft.apiKey,
        baseUrl: normalizeNullableText(credentialDraft.baseUrl)
      });
      setCredentialDraft((current) => ({ ...current, apiKey: "" }));
      await refreshProviderModels(saved.provider, false);
    }, "密钥已加密保存。");
  };

  const refreshProviderModels = async (provider: ProviderId, showNotice = true): Promise<void> => {
    const result = await window.wenforge.providerModels.list(provider);
    setProviderModels((current) => upsertProviderModels(current, result));
    if (showNotice) {
      setNotice(
        result.status === "passed"
          ? `已刷新 ${PROVIDER_LABELS[provider]} 可用模型。`
          : `模型列表刷新失败：${result.error ?? "未知错误"}`
      );
    }
  };

  const confirmSmokeCost = (): boolean =>
    window.confirm("这会发起真实模型调用，可能产生少量费用。继续吗？");

  const runProviderSmoke = async (provider: ProviderId): Promise<void> => {
    if (!confirmSmokeCost()) {
      return;
    }
    setCheckingProviders(new Set([provider]));
    try {
      setError(null);
      const result = await window.wenforge.providerSmoke.run({
        provider,
        confirmed: true,
        budgetCapUsd: Number(providerCheckBudget || "0.05")
      });
      await refresh();
      setData((current) => ({
        ...current,
        providerSmoke: upsertSmokeResult(current.providerSmoke, result)
      }));
      setNotice("模型连接检查已完成。");
    } catch (nextError) {
      setError(readError(nextError));
    } finally {
      setCheckingProviders(new Set());
    }
  };

  const runAllProviderSmoke = async (): Promise<void> => {
    if (!confirmSmokeCost()) {
      return;
    }
    setCheckingProviders(new Set(PROVIDERS));
    try {
      setError(null);
      const results = await window.wenforge.providerSmoke.runAll({
        confirmed: true,
        budgetCapUsd: Number(providerCheckBudget || "0.05")
      });
      await refresh();
      setData((current) => ({
        ...current,
        providerSmoke: mergeSmokeResults(current.providerSmoke, results)
      }));
      setNotice(`批量检查完成：${summarizeSmokeResults(results)}`);
    } catch (nextError) {
      setError(readError(nextError));
    } finally {
      setCheckingProviders(new Set());
    }
  };

  const saveModel = async (): Promise<void> => {
    await runAction(async () => {
      await window.wenforge.modelProfiles.upsert({
        provider: modelDraft.provider,
        model: modelDraft.model,
        alias: normalizeNullableText(modelDraft.alias),
        displayName: modelDraft.displayName,
        contextWindow: parseOptionalInteger(modelDraft.contextWindow),
        maxOutputTokens: parseOptionalInteger(modelDraft.maxOutputTokens),
        defaultTemperature: Number(modelDraft.defaultTemperature || "0.7"),
        supportsStreaming: true,
        enabled: true
      });
    }, "模型配置已保存。");
  };

  const savePrice = async (): Promise<void> => {
    await runAction(async () => {
      await window.wenforge.modelPrices.upsert({
        provider: priceDraft.provider,
        model: priceDraft.model,
        inputPricePerMillion: Number(priceDraft.inputPricePerMillion || "0"),
        outputPricePerMillion: Number(priceDraft.outputPricePerMillion || "0"),
        cachedInputPricePerMillion: parseOptionalNumber(priceDraft.cachedInputPricePerMillion),
        effectiveDate: priceDraft.effectiveDate,
        sourceNote: priceDraft.sourceNote,
        enabled: priceDraft.enabled
      });
    }, "价格已保存。");
  };

  const updateProfile = async (
    profile: ModelProfileRecord,
    patch: Partial<ModelProfileRecord>
  ): Promise<void> => {
    await runAction(async () => {
      await window.wenforge.modelProfiles.upsert({
        ...profile,
        ...patch
      });
    }, "模型配置已更新。");
  };

  const updatePrice = async (
    price: ModelPriceRecord,
    patch: Partial<ModelPriceRecord>
  ): Promise<void> => {
    await runAction(async () => {
      await window.wenforge.modelPrices.upsert({
        ...price,
        ...patch
      });
    }, "价格已更新。");
  };

  const updateRoute = async (
    route: TaskRouteRecord,
    patch: Partial<TaskRouteRecord>
  ): Promise<void> => {
    await runAction(async () => {
      await window.wenforge.taskRoutes.upsert({
        ...route,
        ...patch
      });
    }, "路线已更新。");
  };

  const updatePrivacy = async (patch: Partial<PrivacySettings>): Promise<void> => {
    await runAction(async () => {
      await window.wenforge.privacy.update(patch);
    }, "隐私设置已更新。");
  };

  const updateRoutingSettings = async (patch: Partial<RoutingSettings>): Promise<void> => {
    await runAction(async () => {
      await window.wenforge.routingSettings.update(patch);
    }, "路线设置已更新。");
  };

  const updateBudgetPolicy = async (patch: Partial<BudgetPolicyRecord>): Promise<void> => {
    await runAction(async () => {
      await window.wenforge.budgets.updatePolicies(patch);
    }, "预算策略已更新。");
  };

  const applyPremiumPreset = async (): Promise<void> => {
    if (
      !window.confirm(
        "应用高级网文路线预设？已有预设路线会被更新。"
      )
    ) {
      return;
    }
    await runAction(async () => {
      await window.wenforge.modelRoutes.applyPremiumWebnovelPreset(true);
    }, "高级网文预设已应用。");
  };

  const exportPremiumPreset = async (): Promise<void> => {
    await runAction(async () => {
      const preset = await window.wenforge.modelRoutes.exportPreset("premium_webnovel");
      await navigator.clipboard?.writeText(JSON.stringify(preset, null, 2));
    }, "预设已复制到剪贴板。");
  };

  const importPremiumPreset = async (): Promise<void> => {
    const presetJson = window.prompt("导入预设 JSON");
    if (!presetJson?.trim()) return;
    if (!window.confirm("导入预设并更新高级网文路线？")) return;
    await runAction(async () => {
      await window.wenforge.modelRoutes.importPreset(presetJson, true);
    }, "预设导入完成。");
  };

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-6 py-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium tracking-[0.16em] text-slate-500">设置</p>
          <h2 className="mt-1 text-xl font-semibold text-white">模型密钥 / 路线 / 预算</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
            API 密钥在「模型密钥」添加。密钥进入加密凭据库，界面只显示脱敏状态和可用模型。
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {data.credentials.length === 0 ? (
            <StatusPill tone="warning">未配置密钥</StatusPill>
          ) : null}
          {data.prices.some((price) => stalePriceIds.has(price.id)) ? (
            <StatusPill tone="warning">价格过期</StatusPill>
          ) : null}
          <StatusPill tone="neutral">{data.routes.length} 条路线</StatusPill>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {SETTINGS_TABS.map((tab) => (
          <button
            className={`rounded-lg border px-3 py-2 text-sm transition ${
              activeTab === tab.id
                ? "border-forge-blue/45 bg-forge-blue/15 text-forge-blue"
                : "border-white/10 bg-white/[0.035] text-slate-400 hover:border-white/20 hover:text-white"
            }`}
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            type="button"
          >
            {tab.label}
          </button>
        ))}
      </div>

      {notice ? (
        <div className="rounded-lg border border-forge-mint/25 bg-forge-mint/10 px-3 py-2 text-sm text-forge-mint">
          {notice}
        </div>
      ) : null}
      {error ? (
        <div className="rounded-lg border border-red-400/25 bg-red-400/10 px-3 py-2 text-sm text-red-200">
          {error}
        </div>
      ) : null}

      <motion.section
        animate={{ opacity: 1, y: 0 }}
        className="min-h-[520px] rounded-xl border border-white/10 bg-black/24 p-4"
        initial={{ opacity: 0, y: 8 }}
        key={activeTab}
        transition={{ duration: 0.16 }}
      >
        {loading ? <EmptyState text="正在加载设置..." /> : null}
        {!loading && activeTab === "providers" ? (
          <ProvidersTab
            credentialDraft={credentialDraft}
            credentials={data.credentials}
            profiles={data.profiles}
            providerHealth={data.providerHealth}
            providerModelsByProvider={modelsByProvider}
            smokeByProvider={smokeByProvider}
            providerCheckBudget={providerCheckBudget}
            checkingProviders={checkingProviders}
            onCredentialDraftChange={setCredentialDraft}
            onDeleteCredential={(credential) =>
              runAction(async () => {
                if (!window.confirm(`删除 ${credential.displayName}？`)) {
                  return;
                }
                await window.wenforge.credentials.delete(credential.id, true);
              }, "密钥已删除。")
            }
            onSaveCredential={saveCredential}
            onTestCredential={(credential) =>
              runAction(async () => {
                const result = await window.wenforge.credentials.testConnection(credential.id);
                setNotice(result.message);
              }, "密钥状态已刷新。")
            }
            onRunAllProviderSmoke={() => {
              void runAllProviderSmoke();
            }}
            onRunProviderSmoke={(provider) => {
              void runProviderSmoke(provider);
            }}
            onRefreshProviderModels={(provider) => {
              void refreshProviderModels(provider);
            }}
            onProviderCheckBudgetChange={setProviderCheckBudget}
          />
        ) : null}
        {!loading && activeTab === "models" ? (
          <ModelsTab
            modelDraft={modelDraft}
            profiles={data.profiles}
            onModelDraftChange={setModelDraft}
            onSaveModel={saveModel}
            onUpdateProfile={updateProfile}
          />
        ) : null}
        {!loading && activeTab === "routing" ? (
          <RoutingTab
            configuredProviders={configuredProviders}
            priceKeys={priceKeys}
            profileById={profileById}
            profiles={data.profiles}
            routes={data.routes}
            stalePriceIds={stalePriceIds}
            prices={data.prices}
            onApplyPremiumPreset={() => void applyPremiumPreset()}
            onExportPreset={() => void exportPremiumPreset()}
            onImportPreset={() => void importPremiumPreset()}
            onUpdateRoute={updateRoute}
          />
        ) : null}
        {!loading && activeTab === "costs" && data.budget ? (
          <CostsTab
            budget={data.budget}
            priceDraft={priceDraft}
            prices={data.prices}
            profiles={data.profiles}
            providerHealth={data.providerHealth}
            routing={data.routing}
            stalePriceIds={stalePriceIds}
            onPriceDraftChange={setPriceDraft}
            onResetProviderHealth={() =>
              runAction(async () => {
                await window.wenforge.providerHealth.reset();
              }, "模型健康状态已重置。")
            }
            onSavePrice={savePrice}
            onUpdateBudget={updateBudgetPolicy}
            onUpdatePrice={updatePrice}
          />
        ) : null}
        {!loading && activeTab === "privacy" && data.privacy ? (
          <PrivacyTab privacy={data.privacy} onUpdatePrivacy={updatePrivacy} />
        ) : null}
        {!loading && activeTab === "advanced" && data.routing ? (
          <AdvancedTab
            providerHealth={data.providerHealth}
            profiles={data.profiles}
            routing={data.routing}
            onUpdateRoutingSettings={updateRoutingSettings}
          />
        ) : null}
      </motion.section>
    </div>
  );
}

function ProvidersTab({
  credentialDraft,
  credentials,
  profiles,
  providerHealth,
  providerModelsByProvider,
  smokeByProvider,
  providerCheckBudget,
  checkingProviders,
  onCredentialDraftChange,
  onDeleteCredential,
  onSaveCredential,
  onTestCredential,
  onRunAllProviderSmoke,
  onRunProviderSmoke,
  onRefreshProviderModels,
  onProviderCheckBudgetChange
}: {
  credentialDraft: {
    provider: ProviderId;
    displayName: string;
    baseUrl: string;
    apiKey: string;
  };
  credentials: ProviderCredentialDto[];
  profiles: ModelProfileRecord[];
  providerHealth: ProviderHealthRecord[];
  providerModelsByProvider: Map<ProviderId, ProviderModelListResult>;
  smokeByProvider: Map<ProviderId, ProviderSmokeResult>;
  providerCheckBudget: string;
  checkingProviders: Set<ProviderId>;
  onCredentialDraftChange: (draft: typeof credentialDraft) => void;
  onDeleteCredential: (credential: ProviderCredentialDto) => void;
  onSaveCredential: () => Promise<void>;
  onTestCredential: (credential: ProviderCredentialDto) => void;
  onRunAllProviderSmoke: () => void;
  onRunProviderSmoke: (provider: ProviderId) => void;
  onRefreshProviderModels: (provider: ProviderId) => void;
  onProviderCheckBudgetChange: (value: string) => void;
}): JSX.Element {
  return (
    <div className="grid gap-4 xl:grid-cols-[320px_1fr]">
      <section className="rounded-xl border border-white/10 bg-graphite-900/55 p-4">
        <SectionTitle title="添加 API 密钥" />
        <div className="mt-4 space-y-3">
          <FieldLabel label="提供商">
            <select
              className={fieldClassName}
              value={credentialDraft.provider}
              onChange={(event) => {
                const provider = event.target.value as ProviderId;
                onCredentialDraftChange({
                  ...credentialDraft,
                  provider,
                  displayName: PROVIDER_LABELS[provider]
                });
              }}
            >
              {PROVIDERS.map((provider) => (
                <option key={provider} value={provider}>
                  {PROVIDER_LABELS[provider]}
                </option>
              ))}
            </select>
          </FieldLabel>
          <FieldLabel label="显示名称">
            <input
              className={fieldClassName}
              value={credentialDraft.displayName}
              onChange={(event) =>
                onCredentialDraftChange({ ...credentialDraft, displayName: event.target.value })
              }
            />
          </FieldLabel>
          <FieldLabel label="接口地址">
            <input
              className={fieldClassName}
              placeholder="https://api.example.com/v1"
              value={credentialDraft.baseUrl}
              onChange={(event) =>
                onCredentialDraftChange({ ...credentialDraft, baseUrl: event.target.value })
              }
            />
          </FieldLabel>
          <FieldLabel label="API 密钥">
            <input
              className={fieldClassName}
              type="password"
              value={credentialDraft.apiKey}
              onChange={(event) =>
                onCredentialDraftChange({ ...credentialDraft, apiKey: event.target.value })
              }
            />
          </FieldLabel>
          <button
            className="w-full rounded-lg border border-forge-blue/40 bg-forge-blue/15 px-3 py-2 text-sm font-medium text-forge-blue transition hover:bg-forge-blue/20 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!credentialDraft.apiKey.trim() || !credentialDraft.displayName.trim()}
            onClick={() => void onSaveCredential()}
            type="button"
          >
            加密保存
          </button>
        </div>
      </section>
      <section className="rounded-xl border border-white/10 bg-graphite-900/55 p-4">
        <div className="flex items-center justify-between gap-3">
          <SectionTitle title="已保存密钥" />
          <div className="flex flex-wrap items-center gap-2">
            <input
              aria-label="模型检查预算上限"
              className={`${fieldClassName} w-28`}
              inputMode="decimal"
              value={providerCheckBudget}
              onChange={(event) => onProviderCheckBudgetChange(event.target.value)}
            />
            <button
              className={secondaryButtonClassName}
              disabled={checkingProviders.size > 0}
              onClick={onRunAllProviderSmoke}
              type="button"
            >
              {checkingProviders.size > 0 ? "检查中" : "全部检查"}
            </button>
          </div>
        </div>
        <div className="mt-4 grid gap-3">
          {credentials.length === 0 ? <EmptyState text="还没有保存模型密钥。" /> : null}
          {credentials.map((credential) => {
            const smoke = smokeByProvider.get(credential.provider);
            const health = providerHealth.find((item) => item.provider === credential.provider);
            const modelList = providerModelsByProvider.get(credential.provider);
            const isChecking = checkingProviders.has(credential.provider);
            const status = isChecking
              ? "checking"
              : smoke?.tested
                ? smoke.status
                : (health?.status ?? credential.lastStatus);
            const localProfiles = profiles
              .filter((profile) => profile.provider === credential.provider && profile.enabled)
              .sort(compareModelProfilesForDisplay);
            const statusHint = credentialStatusHint(credential, health);
            return (
              <article
                className="rounded-lg border border-white/10 bg-black/20 p-3"
                key={credential.id}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium text-white">{credential.displayName}</p>
                      <StatusPill tone={providerStatusTone(status)}>
                        {formatProviderStatus(status)}
                      </StatusPill>
                    </div>
                    <p className="mt-1 truncate text-xs text-slate-500">
                      {PROVIDER_LABELS[credential.provider]} · {credential.redactedKeyLabel} ·{" "}
                      {credential.baseUrl ? "自定义端点" : "默认端点"}
                    </p>
                    {statusHint ? (
                      <p className="mt-1 text-xs text-forge-amber">{statusHint}</p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      className={secondaryButtonClassName}
                      onClick={() => onRefreshProviderModels(credential.provider)}
                      type="button"
                    >
                      刷新模型
                    </button>
                    <button
                      className={secondaryButtonClassName}
                      disabled={checkingProviders.size > 0}
                      onClick={() => onRunProviderSmoke(credential.provider)}
                      type="button"
                    >
                      {isChecking ? "检查中" : "检查连接"}
                    </button>
                    <button
                      className="rounded-lg border border-red-400/25 px-3 py-2 text-xs text-red-200 transition hover:bg-red-400/10"
                      onClick={() => onDeleteCredential(credential)}
                      type="button"
                    >
                      删除
                    </button>
                  </div>
                </div>

                {modelList ? (
                  <div className="mt-3 rounded-lg border border-white/10 bg-white/[0.025] p-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs text-slate-400">
                        API 可用模型：{modelList.models.length} 个
                      </p>
                      <span className="text-xs text-slate-500">
                        {modelList.fetchedAt ? new Date(modelList.fetchedAt).toLocaleString() : ""}
                      </span>
                    </div>
                    {modelList.error ? (
                      <p className="mt-2 text-xs text-red-200">{modelList.error}</p>
                    ) : (
                      <div className="mt-2 flex max-h-20 flex-wrap gap-1 overflow-auto">
                        {modelList.models.slice(0, 40).map((model) => (
                          <span
                            className="rounded-full border border-forge-blue/20 bg-forge-blue/8 px-2 py-0.5 text-[11px] text-forge-blue"
                            key={model.id}
                          >
                            {model.id}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ) : null}
                {localProfiles.length > 0 ? (
                  <div className="mt-2 rounded-lg border border-white/10 bg-white/[0.02] p-2">
                    <p className="text-xs text-slate-400">WenForge 模型别名</p>
                    <div className="mt-2 flex max-h-20 flex-wrap gap-1 overflow-auto">
                      {localProfiles.slice(0, 24).map((profile) => (
                        <span
                          className="rounded-full border border-white/10 bg-black/20 px-2 py-0.5 text-[11px] text-slate-300"
                          key={profile.id}
                          title={`${profile.model} · ${profile.endpointFamily} · ${profile.maxOutputParamName}`}
                        >
                          {profile.alias ?? profile.displayName}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}

                <details className="mt-2">
                  <summary className="cursor-pointer text-xs text-slate-500">详细状态</summary>
                  <div className="mt-2 grid gap-1 text-xs text-slate-500 sm:grid-cols-2">
                    <span>上次检查：{smoke?.testedAt ?? credential.lastTestedAt ?? "未检查"}</span>
                    <span>流式：{smoke ? yesNo(smoke.streamingSupported) : "未知"}</span>
                    <span>用量解析：{smoke ? yesNo(smoke.usageParsed) : "未知"}</span>
                    <span>延迟：{formatLatency(smoke?.latencyMs ?? null)}</span>
                    <span>预估成本：{formatUsd(smoke?.estimatedCost ?? null)}</span>
                    <span>最终成本：{formatUsd(smoke?.finalCost ?? null)}</span>
                  </div>
                  {(smoke?.error ?? health?.errorMessage) ? (
                    <p className="mt-2 rounded-md border border-red-400/20 bg-red-400/5 px-2 py-1 text-xs text-red-200">
                      {smoke?.error ?? health?.errorMessage}
                    </p>
                  ) : null}
                  <button
                    className={`${secondaryButtonClassName} mt-2`}
                    onClick={() => onTestCredential(credential)}
                    type="button"
                  >
                    本地状态
                  </button>
                </details>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function ModelsTab({
  modelDraft,
  profiles,
  onModelDraftChange,
  onSaveModel,
  onUpdateProfile
}: {
  modelDraft: {
    provider: ProviderId;
    model: string;
    alias: string;
    displayName: string;
    contextWindow: string;
    maxOutputTokens: string;
    defaultTemperature: string;
  };
  profiles: ModelProfileRecord[];
  onModelDraftChange: (draft: typeof modelDraft) => void;
  onSaveModel: () => Promise<void>;
  onUpdateProfile: (
    profile: ModelProfileRecord,
    patch: Partial<ModelProfileRecord>
  ) => Promise<void>;
}): JSX.Element {
  const sortedProfiles = useMemo(
    () => [...profiles].sort(compareModelProfilesForDisplay),
    [profiles]
  );
  return (
    <div className="space-y-4">
      <section className="grid gap-3 rounded-xl border border-white/10 bg-graphite-900/55 p-4 xl:grid-cols-[180px_1fr_1fr_1fr_130px_130px_110px_auto]">
        <select
          className={fieldClassName}
          value={modelDraft.provider}
          onChange={(event) =>
            onModelDraftChange({ ...modelDraft, provider: event.target.value as ProviderId })
          }
        >
          {PROVIDERS.map((provider) => (
            <option key={provider} value={provider}>
              {PROVIDER_LABELS[provider]}
            </option>
          ))}
        </select>
        <input
          className={fieldClassName}
          value={modelDraft.model}
          placeholder="服务商模型 ID"
          onChange={(event) => onModelDraftChange({ ...modelDraft, model: event.target.value })}
        />
        <input
          className={fieldClassName}
          placeholder="别名"
          value={modelDraft.alias}
          onChange={(event) => onModelDraftChange({ ...modelDraft, alias: event.target.value })}
        />
        <input
          className={fieldClassName}
          value={modelDraft.displayName}
          onChange={(event) =>
            onModelDraftChange({ ...modelDraft, displayName: event.target.value })
          }
        />
        <input
          className={fieldClassName}
          inputMode="numeric"
          placeholder="上下文"
          value={modelDraft.contextWindow}
          onChange={(event) =>
            onModelDraftChange({ ...modelDraft, contextWindow: event.target.value })
          }
        />
        <input
          className={fieldClassName}
          inputMode="numeric"
          placeholder="最大输出"
          value={modelDraft.maxOutputTokens}
          onChange={(event) =>
            onModelDraftChange({ ...modelDraft, maxOutputTokens: event.target.value })
          }
        />
        <input
          className={fieldClassName}
          inputMode="decimal"
          value={modelDraft.defaultTemperature}
          onChange={(event) =>
            onModelDraftChange({ ...modelDraft, defaultTemperature: event.target.value })
          }
        />
        <button className={primaryButtonClassName} onClick={() => void onSaveModel()} type="button">
          保存
        </button>
      </section>
      <div className="overflow-hidden rounded-xl border border-white/10">
        <TableHeader columns="grid-cols-[130px_1fr_170px_150px_180px_90px]" />
        {sortedProfiles.map((profile) => (
          <div
            className="grid grid-cols-[130px_1fr_170px_150px_180px_90px] items-center gap-3 border-t border-white/10 px-3 py-3 text-sm"
            key={profile.id}
          >
            <span className="text-slate-300">{PROVIDER_LABELS[profile.provider]}</span>
            <span>
              <span className="font-medium text-white">{profile.displayName}</span>
              <span className="ml-2 text-xs text-slate-500">{profile.model}</span>
            </span>
            <span className="text-xs text-forge-violet">{profile.alias ?? "无别名"}</span>
            <span className="text-xs text-slate-400">
              {profile.endpointFamily}
              <br />
              {profile.maxOutputParamName}
            </span>
            <span className="text-xs text-slate-500">
              {[
                profile.supportsStreaming ? "流式" : null,
                profile.supportsJson ? "json" : null,
                profile.supportsTools ? "工具" : null,
                profile.supportsVision ? "视觉" : null,
                profile.supportsTemperature ? "温度" : null,
                profile.supportsReasoningEffort ? "推理强度" : null,
                profile.supportsAdaptiveThinking ? "自适应思考" : null
              ]
                .filter(Boolean)
                .join(" · ") || "基础"}
            </span>
            <ToggleButton
              active={profile.enabled}
              label={profile.enabled ? "启用" : "停用"}
              onClick={() => void onUpdateProfile(profile, { enabled: !profile.enabled })}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function PricingTab({
  priceDraft,
  prices,
  profiles,
  routing,
  stalePriceIds,
  onPriceDraftChange,
  onSavePrice,
  onUpdatePrice
}: {
  priceDraft: {
    provider: ProviderId;
    model: string;
    inputPricePerMillion: string;
    outputPricePerMillion: string;
    cachedInputPricePerMillion: string;
    effectiveDate: string;
    sourceNote: string;
    enabled: boolean;
  };
  prices: ModelPriceRecord[];
  profiles: ModelProfileRecord[];
  routing: RoutingSettings | null;
  stalePriceIds: Set<string>;
  onPriceDraftChange: (draft: typeof priceDraft) => void;
  onSavePrice: () => Promise<void>;
  onUpdatePrice: (price: ModelPriceRecord, patch: Partial<ModelPriceRecord>) => Promise<void>;
}): JSX.Element {
  const profileModels = profiles.filter((profile) => profile.provider === priceDraft.provider);
  return (
    <div className="space-y-4">
      <section className="grid gap-3 rounded-xl border border-white/10 bg-graphite-900/55 p-4 xl:grid-cols-[180px_1fr_110px_110px_110px_145px_1fr_auto]">
        <select
          className={fieldClassName}
          value={priceDraft.provider}
          onChange={(event) => {
            const provider = event.target.value as ProviderId;
            const firstProfile = profiles.find((profile) => profile.provider === provider);
            onPriceDraftChange({
              ...priceDraft,
              provider,
              model: firstProfile?.model ?? priceDraft.model
            });
          }}
        >
          {PROVIDERS.map((provider) => (
            <option key={provider} value={provider}>
              {PROVIDER_LABELS[provider]}
            </option>
          ))}
        </select>
        <select
          className={fieldClassName}
          value={priceDraft.model}
          onChange={(event) => onPriceDraftChange({ ...priceDraft, model: event.target.value })}
        >
          {profileModels.length === 0 ? (
            <option value={priceDraft.model}>{priceDraft.model}</option>
          ) : null}
          {profileModels.map((profile) => (
            <option key={profile.id} value={profile.model}>
              {profile.displayName}
            </option>
          ))}
        </select>
        <input
          className={fieldClassName}
          inputMode="decimal"
          value={priceDraft.inputPricePerMillion}
          onChange={(event) =>
            onPriceDraftChange({ ...priceDraft, inputPricePerMillion: event.target.value })
          }
        />
        <input
          className={fieldClassName}
          inputMode="decimal"
          value={priceDraft.outputPricePerMillion}
          onChange={(event) =>
            onPriceDraftChange({ ...priceDraft, outputPricePerMillion: event.target.value })
          }
        />
        <input
          className={fieldClassName}
          inputMode="decimal"
          placeholder="缓存输入"
          value={priceDraft.cachedInputPricePerMillion}
          onChange={(event) =>
            onPriceDraftChange({ ...priceDraft, cachedInputPricePerMillion: event.target.value })
          }
        />
        <input
          className={fieldClassName}
          type="date"
          value={priceDraft.effectiveDate}
          onChange={(event) =>
            onPriceDraftChange({ ...priceDraft, effectiveDate: event.target.value })
          }
        />
        <input
          className={fieldClassName}
          value={priceDraft.sourceNote}
          onChange={(event) =>
            onPriceDraftChange({ ...priceDraft, sourceNote: event.target.value })
          }
        />
        <button className={primaryButtonClassName} onClick={() => void onSavePrice()} type="button">
          保存
        </button>
      </section>
      <div className="rounded-lg border border-forge-violet/25 bg-forge-violet/10 px-3 py-2 text-sm text-forge-violet">
        价格过期阈值：{routing?.priceStaleAfterDays ?? 90} 天。内置价格只是可编辑占位，
        以用户确认的服务商价格为准。
      </div>
      <div className="overflow-hidden rounded-xl border border-white/10">
        {prices.map((price) => (
          <div
            className="grid grid-cols-[150px_1fr_120px_120px_120px_90px] items-center gap-3 border-b border-white/10 px-3 py-3 text-sm last:border-b-0"
            key={price.id}
          >
            <span className="text-slate-300">{PROVIDER_LABELS[price.provider]}</span>
            <span>
              <span className="font-medium text-white">{price.model}</span>
              <span className="ml-2 text-xs text-slate-500">{price.currency}</span>
            </span>
            <span className="text-slate-400">${price.inputPricePerMillion}/百万输入</span>
            <span className="text-slate-400">${price.outputPricePerMillion}/百万输出</span>
            <span className={stalePriceIds.has(price.id) ? "text-amber-200" : "text-slate-400"}>
              {price.effectiveDate}
            </span>
            <ToggleButton
              active={price.enabled}
              label={price.enabled ? "启用" : "停用"}
              onClick={() => void onUpdatePrice(price, { enabled: !price.enabled })}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function CostsTab({
  budget,
  priceDraft,
  prices,
  profiles,
  providerHealth,
  routing,
  stalePriceIds,
  onPriceDraftChange,
  onResetProviderHealth,
  onSavePrice,
  onUpdateBudget,
  onUpdatePrice
}: {
  budget: BudgetPolicyRecord;
  priceDraft: {
    provider: ProviderId;
    model: string;
    inputPricePerMillion: string;
    outputPricePerMillion: string;
    cachedInputPricePerMillion: string;
    effectiveDate: string;
    sourceNote: string;
    enabled: boolean;
  };
  prices: ModelPriceRecord[];
  profiles: ModelProfileRecord[];
  providerHealth: ProviderHealthRecord[];
  routing: RoutingSettings | null;
  stalePriceIds: Set<string>;
  onPriceDraftChange: (draft: typeof priceDraft) => void;
  onResetProviderHealth: () => void;
  onSavePrice: () => Promise<void>;
  onUpdateBudget: (patch: Partial<BudgetPolicyRecord>) => Promise<void>;
  onUpdatePrice: (price: ModelPriceRecord, patch: Partial<ModelPriceRecord>) => Promise<void>;
}): JSX.Element {
  return (
    <div className="space-y-5">
      <PricingTab
        priceDraft={priceDraft}
        prices={prices}
        profiles={profiles}
        routing={routing}
        stalePriceIds={stalePriceIds}
        onPriceDraftChange={onPriceDraftChange}
        onSavePrice={onSavePrice}
        onUpdatePrice={onUpdatePrice}
      />
      <BudgetsTab
        budget={budget}
        providerHealth={providerHealth}
        onResetProviderHealth={onResetProviderHealth}
        onUpdateBudget={onUpdateBudget}
      />
    </div>
  );
}

function RoutingTab({
  configuredProviders,
  priceKeys,
  profileById,
  profiles,
  routes,
  stalePriceIds,
  prices,
  onApplyPremiumPreset,
  onExportPreset,
  onImportPreset,
  onUpdateRoute
}: {
  configuredProviders: Set<ProviderId>;
  priceKeys: Set<string>;
  profileById: Map<string, ModelProfileRecord>;
  profiles: ModelProfileRecord[];
  routes: TaskRouteRecord[];
  stalePriceIds: Set<string>;
  prices: ModelPriceRecord[];
  onApplyPremiumPreset: () => void;
  onExportPreset: () => void;
  onImportPreset: () => void;
  onUpdateRoute: (route: TaskRouteRecord, patch: Partial<TaskRouteRecord>) => Promise<void>;
}): JSX.Element {
  const staleKeys = new Set(
    prices.filter((price) => stalePriceIds.has(price.id)).map((price) => priceKey(price))
  );
  const sortedRoutes = [...routes].sort(
    (left, right) =>
      TASK_TYPES.indexOf(left.taskType) - TASK_TYPES.indexOf(right.taskType) ||
      QUALITY_MODES.indexOf(left.qualityMode) - QUALITY_MODES.indexOf(right.qualityMode)
  );
  const primaryRoutes = sortedRoutes.filter((route) => route.qualityMode === "premium_webnovel");
  const advancedRoutes = sortedRoutes.filter((route) => route.qualityMode !== "premium_webnovel");
  const renderRoute = (route: TaskRouteRecord): JSX.Element => {
    const profile = profileById.get(route.primaryModelProfileId) ?? null;
    const fallbackModels = [route.fallbackModelProfileId1, route.fallbackModelProfileId2]
      .map((id) => (id ? (profileById.get(id) ?? null) : null))
      .filter((item): item is ModelProfileRecord => Boolean(item));
    const multiModel = route.qualityMode === "premium_webnovel" && fallbackModels.length > 0;
    const warnings = getRouteWarnings({
      configuredProviders,
      priceKeys,
      profile,
      staleKeys
    });
    return (
      <div
        className="grid gap-3 border-b border-white/10 px-3 py-3 text-sm last:border-b-0 lg:grid-cols-[150px_1fr_130px_120px_auto]"
        key={route.id}
      >
        <div>
          <p className="font-medium text-white">{TASK_LABELS[route.taskType]}</p>
          <p className="mt-1 text-xs text-slate-500">{QUALITY_LABELS[route.qualityMode]}</p>
        </div>
        <select
          className={fieldClassName}
          value={route.primaryModelProfileId}
          onChange={(event) =>
            void onUpdateRoute(route, { primaryModelProfileId: event.target.value })
          }
        >
          {profiles.map((modelProfile) => (
            <option key={modelProfile.id} value={modelProfile.id}>
              {PROVIDER_LABELS[modelProfile.provider]} · {modelProfile.displayName}
            </option>
          ))}
        </select>
        <select
          className={fieldClassName}
          value={route.creativityIntent}
          onChange={(event) => {
            void onUpdateRoute(route, {
              creativityIntent: event.target.value as TaskRouteRecord["creativityIntent"]
            });
          }}
        >
          <option value="deterministic">稳定</option>
          <option value="balanced">均衡</option>
          <option value="creative">创作</option>
          <option value="wild">大胆</option>
        </select>
        <input
          className={fieldClassName}
          defaultValue={String(route.maxOutputTokens)}
          inputMode="numeric"
          onBlur={(event) => {
            const maxOutputTokens = Number.parseInt(event.target.value, 10);
            if (Number.isFinite(maxOutputTokens) && maxOutputTokens > 0) {
              void onUpdateRoute(route, { maxOutputTokens });
            }
          }}
        />
        <div className="flex flex-wrap items-center gap-1">
          {warnings.length === 0 ? <StatusPill tone="success">就绪</StatusPill> : null}
          {warnings.map((warning) => (
            <StatusPill key={warning} tone="warning">
              {warning}
            </StatusPill>
          ))}
          {multiModel ? <StatusPill tone="neutral">多模型</StatusPill> : null}
          <ToggleButton
            active={route.enabled}
            label={route.enabled ? "启用" : "停用"}
            onClick={() => void onUpdateRoute(route, { enabled: !route.enabled })}
          />
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-forge-violet/25 bg-forge-violet/10 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <SectionTitle title="网文高级路线" />
            <p className="mt-1 text-sm text-slate-400">
              默认只显示生成正文会用到的高级路线。其他经济/均衡路线收进下方高级区。
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className={primaryButtonClassName} onClick={onApplyPremiumPreset} type="button">
              应用高级预设
            </button>
            <button className={secondaryButtonClassName} onClick={onExportPreset} type="button">
              导出
            </button>
            <button className={secondaryButtonClassName} onClick={onImportPreset} type="button">
              导入
            </button>
          </div>
        </div>
      </section>
      <div className="overflow-hidden rounded-xl border border-white/10">
        {primaryRoutes.map(renderRoute)}
      </div>
      <details className="rounded-xl border border-white/10 bg-black/20 p-3">
        <summary className="cursor-pointer text-sm text-slate-300">
          高级路线配置（{advancedRoutes.length}）
        </summary>
        <div className="mt-3 overflow-hidden rounded-lg border border-white/10">
          {advancedRoutes.map(renderRoute)}
        </div>
      </details>
    </div>
  );
}

function BudgetsTab({
  budget,
  providerHealth,
  onResetProviderHealth,
  onUpdateBudget
}: {
  budget: BudgetPolicyRecord;
  providerHealth: ProviderHealthRecord[];
  onResetProviderHealth: () => void;
  onUpdateBudget: (patch: Partial<BudgetPolicyRecord>) => Promise<void>;
}): JSX.Element {
  const commitNullable = (key: keyof BudgetPolicyRecord, value: string): void => {
    void onUpdateBudget({
      [key]: parseOptionalNumber(value)
    } as Partial<BudgetPolicyRecord>);
  };
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
      <section className="rounded-xl border border-white/10 bg-graphite-900/55 p-4">
        <SectionTitle title="预算策略" />
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <NullableNumberSetting
            label="单次调用上限"
            value={budget.perCallBudgetCap}
            onCommit={(value) => commitNullable("perCallBudgetCap", value)}
          />
          <NullableNumberSetting
            label="单次工作流上限"
            value={budget.perWorkflowBudgetCap}
            onCommit={(value) => commitNullable("perWorkflowBudgetCap", value)}
          />
          <NullableNumberSetting
            label="每日上限"
            value={budget.dailyBudgetCap}
            onCommit={(value) => commitNullable("dailyBudgetCap", value)}
          />
          <NullableNumberSetting
            label="项目上限"
            value={budget.projectBudgetCap}
            onCommit={(value) => commitNullable("projectBudgetCap", value)}
          />
          <NumberSetting
            label="预警百分比"
            value={budget.warningThresholdPercent}
            onCommit={(value) => onUpdateBudget({ warningThresholdPercent: value })}
          />
          <FieldLabel label="超出预算时">
            <select
              className={fieldClassName}
              value={budget.onBudgetExceeded}
              onChange={(event) =>
                void onUpdateBudget({
                  onBudgetExceeded: event.target.value as BudgetPolicyRecord["onBudgetExceeded"]
                })
              }
            >
              <option value="warn">提醒</option>
              <option value="pause">暂停工作流</option>
              <option value="abort">中止工作流</option>
            </select>
          </FieldLabel>
          <FieldLabel label="币种">
            <input
              className={fieldClassName}
              defaultValue={budget.currency}
              onBlur={(event) =>
                void onUpdateBudget({ currency: event.target.value.trim() || "USD" })
              }
            />
          </FieldLabel>
        </div>
      </section>
      <section className="rounded-xl border border-white/10 bg-graphite-900/55 p-4">
        <div className="flex items-center justify-between gap-3">
          <SectionTitle title="模型健康状态" />
          <button
            className={secondaryButtonClassName}
            onClick={onResetProviderHealth}
            type="button"
          >
            重置
          </button>
        </div>
        <div className="mt-4 space-y-2">
          {providerHealth.length === 0 ? (
            <EmptyState text="还没有模型健康记录。" />
          ) : null}
          {providerHealth.map((item) => (
            <div
              className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2"
              key={item.id}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium text-white">
                  {PROVIDER_LABELS[item.provider]} · {item.model ?? "全部模型"}
                </span>
                <StatusPill tone={item.status === "healthy" ? "success" : "warning"}>
                  {item.status}
                </StatusPill>
              </div>
              {item.errorMessage ? (
                <p className="mt-1 text-xs text-slate-500">{item.errorMessage}</p>
              ) : null}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function PrivacyTab({
  privacy,
  onUpdatePrivacy
}: {
  privacy: PrivacySettings;
  onUpdatePrivacy: (patch: Partial<PrivacySettings>) => Promise<void>;
}): JSX.Element {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {(
        [
          ["storeFullPrompts", "保存完整提示词"],
          ["storeFullResponses", "保存完整回复"],
          ["storeManuscriptsInLogs", "日志保存正文"],
          ["allowPromptPreview", "允许预览提示词"],
          ["allowSendingFullRecentChapters", "允许发送完整近期章节"],
          ["enableDebugLogging", "启用调试日志"]
        ] as Array<[keyof PrivacySettings, string]>
      ).map(([key, label]) => (
        <label
          className="flex items-center justify-between rounded-xl border border-white/10 bg-graphite-900/55 px-4 py-3"
          key={key}
        >
          <span className="text-sm text-slate-200">{label}</span>
          <input
            checked={Boolean(privacy[key])}
            className="h-4 w-4 accent-forge-blue"
            onChange={(event) => void onUpdatePrivacy({ [key]: event.target.checked })}
            type="checkbox"
          />
        </label>
      ))}
      <NumberSetting
        label="近期章节数量"
        value={privacy.recentChapterCount}
        onCommit={(value) => onUpdatePrivacy({ recentChapterCount: value })}
      />
      <NumberSetting
        label="最大上下文 token 预算"
        value={privacy.maxContextTokenBudget}
        onCommit={(value) => onUpdatePrivacy({ maxContextTokenBudget: value })}
      />
    </div>
  );
}

function AdvancedTab({
  providerHealth,
  profiles,
  routing,
  onUpdateRoutingSettings
}: {
  providerHealth: ProviderHealthRecord[];
  profiles: ModelProfileRecord[];
  routing: RoutingSettings;
  onUpdateRoutingSettings: (patch: Partial<RoutingSettings>) => Promise<void>;
}): JSX.Element {
  const [ping, setPing] = useState<string>("尚未检查");
  const [bundle, setBundle] = useState<DiagnosticBundle | null>(null);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);
  const [latestReport, setLatestReport] = useState<string | null>(null);
  const [chapterCheckStatus, setChapterCheckStatus] = useState("空闲");
  const [chapterCheckBudget, setChapterCheckBudget] = useState("0.25");
  const [chapterCheckConfirmation, setChapterCheckConfirmation] = useState("");
  const [chapterCheckReport, setChapterCheckReport] = useState<string | null>(null);
  const loadBundle = async (): Promise<DiagnosticBundle> => {
    const nextBundle = await window.wenforge.diagnostics.exportBundle();
    setBundle(nextBundle);
    return nextBundle;
  };
  const copyBundle = async (): Promise<void> => {
    const nextBundle = bundle ?? (await loadBundle());
    await navigator.clipboard?.writeText(JSON.stringify(nextBundle, null, 2));
    setCopyStatus("已复制脱敏诊断包。");
  };
  const loadLatestProviderReport = async (): Promise<void> => {
    const report = await window.wenforge.providerSmoke.latestReport();
    setLatestReport(
      report ? `${report.path}\n\n${report.content}` : "没有找到模型检查报告。"
    );
  };
  const runProviderChapterCheck = async (): Promise<void> => {
    if (chapterCheckConfirmation !== "RUN REAL SMOKE") {
      setChapterCheckStatus("请输入 RUN REAL SMOKE 确认。");
      return;
    }
    if (!window.confirm("这会发起真实模型调用，可能产生少量费用。继续吗？")) {
      return;
    }
    setChapterCheckStatus("正在运行模型章节检查...");
    const result = await window.wenforge.providerChapterCheck.run({
      confirmed: true,
      budgetCapUsd: Number(chapterCheckBudget || "0.25"),
      qualityMode: "balanced"
    });
    setChapterCheckStatus(`${result.status} · ${formatUsd(result.finalCost)}`);
    setChapterCheckReport(result.reportMarkdown);
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="rounded-xl border border-white/10 bg-graphite-900/55 p-4">
        <SectionTitle title="路线策略" />
        <div className="mt-4 space-y-3">
          <NumberSetting
            label="价格过期天数"
            value={routing.priceStaleAfterDays}
            onCommit={(value) => onUpdateRoutingSettings({ priceStaleAfterDays: value })}
          />
          <FieldLabel label="缺失价格时">
            <select
              className={fieldClassName}
              value={routing.missingPriceBehavior}
              onChange={(event) =>
                void onUpdateRoutingSettings({
                  missingPriceBehavior: event.target
                    .value as RoutingSettings["missingPriceBehavior"]
                })
              }
            >
              <option value="warn">提醒</option>
              <option value="block">阻止</option>
            </select>
          </FieldLabel>
        </div>
      </section>
      <section className="rounded-xl border border-white/10 bg-graphite-900/55 p-4">
        <SectionTitle title="诊断" />
        <div className="mt-4 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-slate-400">{ping}</span>
            <button
              className={secondaryButtonClassName}
              onClick={() => {
                void window.wenforge.diagnostics.ping().then((result) => setPing(result.at));
              }}
              type="button"
            >
              检查
            </button>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3 text-sm text-slate-300">
            <p>版本：{bundle?.appVersion ?? "未加载"}</p>
            <p>平台：{bundle?.platform ?? "未加载"}</p>
            <p>迁移版本：{bundle?.dbMigrationVersion ?? "未加载"}</p>
            <p>安全存储：{bundle ? String(bundle.safeStorageAvailable) : "未加载"}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              className={secondaryButtonClassName}
              onClick={() => void loadBundle()}
              type="button"
            >
              加载诊断
            </button>
            <button
              className={secondaryButtonClassName}
              onClick={() => void copyBundle()}
              type="button"
            >
              复制脱敏诊断信息
            </button>
            <button
              className={secondaryButtonClassName}
              onClick={() => void loadLatestProviderReport()}
              type="button"
            >
              打开最近模型检查报告
            </button>
          </div>
          {copyStatus ? <p className="text-xs text-forge-mint">{copyStatus}</p> : null}
          {latestReport ? (
            <pre className="max-h-48 overflow-auto rounded-lg border border-white/10 bg-black/30 p-3 text-xs text-slate-400">
              {latestReport}
            </pre>
          ) : null}
        </div>
      </section>
      <section className="rounded-xl border border-white/10 bg-graphite-900/55 p-4">
        <SectionTitle title="模型章节检查" />
        <div className="mt-4 space-y-3">
          <p className="text-sm text-slate-400">
            使用已配置路线运行短章节工作流，生成稿只保存为非正式版本，故事圣经更新仍保持为提案。
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <FieldLabel label="最大预算（美元）">
              <input
                className={fieldClassName}
                inputMode="decimal"
                value={chapterCheckBudget}
                onChange={(event) => setChapterCheckBudget(event.target.value)}
              />
            </FieldLabel>
            <FieldLabel label="输入确认语">
              <input
                className={fieldClassName}
                placeholder="RUN REAL SMOKE"
                value={chapterCheckConfirmation}
                onChange={(event) => setChapterCheckConfirmation(event.target.value)}
              />
            </FieldLabel>
          </div>
          <button
            className={primaryButtonClassName}
            onClick={() =>
              void runProviderChapterCheck().catch((nextError: unknown) => {
                setChapterCheckStatus(readError(nextError));
              })
            }
            type="button"
          >
            运行模型章节连通检查
          </button>
          <StatusTile label="状态" value={chapterCheckStatus} />
          {chapterCheckReport ? (
            <pre className="max-h-56 overflow-auto rounded-lg border border-white/10 bg-black/30 p-3 text-xs text-slate-400">
              {chapterCheckReport}
            </pre>
          ) : null}
        </div>
      </section>
      <section className="rounded-xl border border-white/10 bg-graphite-900/55 p-4">
        <SectionTitle title="模型健康状态" />
        <div className="mt-4 space-y-2">
          {providerHealth.length === 0 ? (
            <EmptyState text="还没有模型健康记录。" />
          ) : null}
          {providerHealth.map((item) => (
            <div
              className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2"
              key={item.id}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium text-white">
                  {PROVIDER_LABELS[item.provider]} · {item.model ?? "全部模型"}
                </span>
                <StatusPill tone={item.status === "healthy" ? "success" : "warning"}>
                  {item.status}
                </StatusPill>
              </div>
              {item.errorMessage ? (
                <p className="mt-1 text-xs text-slate-500">{item.errorMessage}</p>
              ) : null}
            </div>
          ))}
        </div>
      </section>
      <DeveloperGenerationPanel profiles={profiles} />
    </div>
  );
}

function DeveloperGenerationPanel({ profiles }: { profiles: ModelProfileRecord[] }): JSX.Element {
  const [provider, setProvider] = useState<AIProviderId>("fake");
  const [model, setModel] = useState("fake-story-model");
  const [taskType, setTaskType] = useState<TaskType>("brainstorm");
  const [prompt, setPrompt] = useState("写一段都市异能小说的雨夜开场。");
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [streamText, setStreamText] = useState("");
  const [status, setStatus] = useState("空闲");
  const [liveCost, setLiveCost] = useState(0);
  const [usageText, setUsageText] = useState("0 输入 / 0 输出");

  const selectableProfiles = profiles.filter((profile) => profile.provider === provider);

  useEffect(() => {
    return window.wenforge.ai.stream.onEvent((event: AIStreamEvent) => {
      if (!activeRunId || event.runId !== activeRunId) {
        return;
      }
      if (event.type === "delta") {
        setStreamText((current) => `${current}${event.text}`);
      }
      if (event.type === "cost") {
        setLiveCost(event.estimatedCostLive);
        setUsageText(
          `${event.inputTokensEstimated} 输入 / ${event.outputTokensEstimatedLive} 输出`
        );
      }
      if (event.type === "complete") {
        setStatus(`完成 · ${event.usageSource}`);
        setLiveCost(event.cost.totalCost);
        setUsageText(`${event.usage.inputTokens} 输入 / ${event.usage.outputTokens} 输出`);
      }
      if (event.type === "error") {
        setStatus(`${event.code}: ${event.message}`);
      }
    });
  }, [activeRunId]);

  const start = async (): Promise<void> => {
    setStreamText("");
    setStatus("正在启动");
    setLiveCost(0);
    const result = await window.wenforge.ai.stream.start({
      provider,
      model,
      taskType,
      messages: [{ role: "user", content: prompt }],
      qualityMode: "balanced"
    });
    setActiveRunId(result.runId);
    setStatus(`运行中 · ${result.runId}`);
  };

  const abort = async (): Promise<void> => {
    if (!activeRunId) {
      return;
    }
    await window.wenforge.ai.stream.abort(activeRunId);
  };

  return (
    <section className="rounded-xl border border-white/10 bg-graphite-900/55 p-4 lg:col-span-2">
      <SectionTitle title="开发测试生成" />
      <div className="mt-4 grid gap-3 lg:grid-cols-[180px_1fr_180px_auto_auto]">
        <select
          className={fieldClassName}
          value={provider}
          onChange={(event) => {
            const nextProvider = event.target.value as AIProviderId;
            const firstProfile = profiles.find((profile) => profile.provider === nextProvider);
            setProvider(nextProvider);
            setModel(nextProvider === "fake" ? "fake-story-model" : (firstProfile?.model ?? ""));
          }}
        >
          {(["fake", ...PROVIDERS] as AIProviderId[]).map((providerId) => (
            <option key={providerId} value={providerId}>
              {AI_PROVIDER_LABELS[providerId]}
            </option>
          ))}
        </select>
        {provider === "fake" ? (
          <input
            className={fieldClassName}
            value={model}
            onChange={(event) => setModel(event.target.value)}
          />
        ) : (
          <select
            className={fieldClassName}
            value={model}
            onChange={(event) => setModel(event.target.value)}
          >
            {selectableProfiles.map((profile) => (
              <option key={profile.id} value={profile.model}>
                {profile.displayName}
              </option>
            ))}
          </select>
        )}
        <select
          className={fieldClassName}
          value={taskType}
          onChange={(event) => setTaskType(event.target.value as TaskType)}
        >
          {TASK_TYPES.map((task) => (
            <option key={task} value={task}>
              {TASK_LABELS[task]}
            </option>
          ))}
        </select>
        <button className={primaryButtonClassName} onClick={() => void start()} type="button">
          开始
        </button>
        <button className={secondaryButtonClassName} onClick={() => void abort()} type="button">
          停止
        </button>
      </div>
      <textarea
        className={`${fieldClassName} mt-3 h-24 resize-none py-3`}
        value={prompt}
        onChange={(event) => setPrompt(event.target.value)}
      />
      <div className="mt-3 grid gap-3 md:grid-cols-3">
        <StatusTile label="状态" value={status} />
        <StatusTile label="用量" value={usageText} />
        <StatusTile label="实时成本" value={`$${liveCost.toFixed(6)}`} />
      </div>
      <div className="mt-3 min-h-28 whitespace-pre-wrap rounded-lg border border-white/10 bg-black/30 p-3 text-sm leading-7 text-slate-300">
        {streamText || "流式输出会显示在这里。"}
      </div>
    </section>
  );
}

function StatusTile({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="rounded-lg border border-white/10 bg-black/24 p-3">
      <p className="text-xs font-medium uppercase tracking-[0.12em] text-slate-500">{label}</p>
      <p className="mt-1 text-sm text-slate-200">{value}</p>
    </div>
  );
}

function NumberSetting({
  label,
  value,
  onCommit
}: {
  label: string;
  value: number;
  onCommit: (value: number) => Promise<void>;
}): JSX.Element {
  return (
    <FieldLabel label={label}>
      <input
        className={fieldClassName}
        defaultValue={String(value)}
        inputMode="numeric"
        onBlur={(event) => {
          const nextValue = Number.parseInt(event.target.value, 10);
          if (Number.isFinite(nextValue) && nextValue >= 0 && nextValue !== value) {
            void onCommit(nextValue);
          }
        }}
      />
    </FieldLabel>
  );
}

function NullableNumberSetting({
  label,
  value,
  onCommit
}: {
  label: string;
  value: number | null;
  onCommit: (value: string) => void;
}): JSX.Element {
  return (
    <FieldLabel label={label}>
      <input
        className={fieldClassName}
        defaultValue={value === null ? "" : String(value)}
        inputMode="decimal"
        onBlur={(event) => onCommit(event.target.value)}
        placeholder="不设上限"
      />
    </FieldLabel>
  );
}

function FieldLabel({ children, label }: { children: ReactNode; label: string }): JSX.Element {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium uppercase tracking-[0.12em] text-slate-500">
        {label}
      </span>
      {children}
    </label>
  );
}

function SectionTitle({ title }: { title: string }): JSX.Element {
  return <h3 className="text-sm font-semibold text-white">{title}</h3>;
}

function EmptyState({ text }: { text: string }): JSX.Element {
  return <div className="rounded-lg border border-white/10 p-4 text-sm text-slate-500">{text}</div>;
}

function StatusPill({
  children,
  tone
}: {
  children: ReactNode;
  tone: "neutral" | "success" | "warning";
}): JSX.Element {
  const className =
    tone === "success"
      ? "border-forge-mint/25 bg-forge-mint/10 text-forge-mint"
      : tone === "warning"
        ? "border-amber-300/25 bg-amber-300/10 text-amber-200"
        : "border-white/10 bg-white/5 text-slate-400";
  return <span className={`rounded-full border px-2 py-1 text-xs ${className}`}>{children}</span>;
}

function ToggleButton({
  active,
  label,
  onClick
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}): JSX.Element {
  return (
    <button
      className={`rounded-lg border px-2 py-1.5 text-xs transition ${
        active
          ? "border-forge-mint/30 bg-forge-mint/10 text-forge-mint"
          : "border-white/10 bg-white/5 text-slate-400"
      }`}
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  );
}

function TableHeader({ columns }: { columns: string }): JSX.Element {
  return (
    <div
      className={`grid ${columns} gap-3 bg-white/[0.035] px-3 py-2 text-xs font-medium uppercase tracking-[0.12em] text-slate-500`}
    >
      <span>服务商</span>
      <span>模型</span>
      <span>上下文</span>
      <span>输出</span>
      <span>能力</span>
      <span>状态</span>
    </div>
  );
}

function getRouteWarnings({
  configuredProviders,
  priceKeys,
  profile,
  staleKeys
}: {
  configuredProviders: Set<ProviderId>;
  priceKeys: Set<string>;
  profile: ModelProfileRecord | null;
  staleKeys: Set<string>;
}): string[] {
  if (!profile) {
    return ["缺模型"];
  }
  const key = priceKey(profile);
  const warnings: string[] = [];
  if (!configuredProviders.has(profile.provider)) {
    warnings.push("缺密钥");
  }
  if (!priceKeys.has(key)) {
    warnings.push("缺价格");
  }
  if (staleKeys.has(key)) {
    warnings.push("价格旧");
  }
  return warnings;
}

function priceKey(value: { provider: ProviderId; model: string }): string {
  return `${value.provider}:${value.model}`;
}

const PRIORITY_MODEL_ALIASES = [
  "gpt-5.5",
  "claude-opus-4.7",
  "qwen3.7-max",
  "kimi-k2.6",
  "deepseek-v4-pro"
];

function compareModelProfilesForDisplay(a: ModelProfileRecord, b: ModelProfileRecord): number {
  const aPriority = PRIORITY_MODEL_ALIASES.indexOf(a.alias ?? a.model);
  const bPriority = PRIORITY_MODEL_ALIASES.indexOf(b.alias ?? b.model);
  if (aPriority !== bPriority) {
    if (aPriority === -1) return 1;
    if (bPriority === -1) return -1;
    return aPriority - bPriority;
  }
  return `${a.provider}:${a.displayName}`.localeCompare(`${b.provider}:${b.displayName}`);
}

function upsertSmokeResult(
  current: ProviderSmokeResult[],
  result: ProviderSmokeResult
): ProviderSmokeResult[] {
  return mergeSmokeResults(current, [result]);
}

function mergeSmokeResults(
  current: ProviderSmokeResult[],
  results: ProviderSmokeResult[]
): ProviderSmokeResult[] {
  const byProvider = new Map(current.map((result) => [result.provider, result]));
  for (const result of results) {
    byProvider.set(result.provider, result);
  }
  return [...byProvider.values()];
}

function upsertProviderModels(
  current: ProviderModelListResult[],
  result: ProviderModelListResult
): ProviderModelListResult[] {
  const byProvider = new Map(current.map((item) => [item.provider, item]));
  byProvider.set(result.provider, result);
  return [...byProvider.values()];
}

function yesNo(value: boolean): string {
  return value ? "是" : "否";
}

function formatLatency(value: number | null): string {
  return typeof value === "number" ? `${value} ms` : "未知";
}

function formatUsd(value: number | null): string {
  return typeof value === "number" ? `$${value.toFixed(6)}` : "未知";
}

function formatProviderStatus(status: string): string {
  switch (status) {
    case "checking":
      return "检查中";
    case "passed":
    case "test_passed":
    case "healthy":
      return "可用";
    case "failed":
    case "test_failed":
    case "down":
      return "失败";
    case "configured":
      return "已保存";
    case "degraded":
      return "不稳定";
    case "skipped":
      return "未检查";
    default:
      return "未知";
  }
}

function providerStatusTone(status: string): "success" | "warning" | "neutral" {
  if (["passed", "test_passed", "healthy"].includes(status)) return "success";
  if (["failed", "test_failed", "degraded", "down", "blocked"].includes(status)) return "warning";
  return "neutral";
}

function summarizeSmokeResults(results: ProviderSmokeResult[]): string {
  const passed = results.filter((result) => result.status === "passed").length;
  const failed = results.filter((result) => result.status === "failed").length;
  const skipped = results.filter((result) => result.status === "skipped").length;
  const blocked = results.filter((result) => result.status === "blocked").length;
  const totalCost = results.reduce(
    (sum, result) => sum + (result.finalCost ?? result.estimatedCost ?? 0),
    0
  );
  return `通过 ${passed}，失败 ${failed}，跳过 ${skipped}，阻止 ${blocked}，成本约 $${totalCost.toFixed(6)}`;
}

function credentialStatusHint(
  credential: ProviderCredentialDto,
  health?: ProviderHealthRecord
): string | null {
  const errorText = `${health?.errorCode ?? ""} ${health?.errorMessage ?? ""}`.toLowerCase();
  const authFailed =
    credential.lastStatus === "test_failed" ||
    health?.status === "down" ||
    errorText.includes("401") ||
    errorText.includes("authentication") ||
    errorText.includes("api key");
  if (!authFailed) return null;
  if (
    ["deepseek", "dashscope_qwen"].includes(credential.provider) &&
    credential.redactedKeyLabel.startsWith("Sk-")
  ) {
    return "认证失败。密钥标签显示为 Sk- 开头，请确认控制台复制的是小写 sk-，没有被输入法或自动更正改写。";
  }
  return "认证失败。请重新保存该服务控制台里的有效 API 密钥，并确认账号权限、余额和接口地址。";
}

function isStaleDate(effectiveDate: string, staleAfterDays: number): boolean {
  const effective = new Date(`${effectiveDate}T00:00:00.000Z`).getTime();
  if (Number.isNaN(effective)) {
    return true;
  }
  const ageMs = Date.now() - effective;
  return ageMs > staleAfterDays * 24 * 60 * 60 * 1000;
}

function parseOptionalInteger(value: string): number | null {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function parseOptionalNumber(value: string): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) && value.trim() !== "" ? parsed : null;
}

function normalizeNullableText(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function readError(error: unknown): string {
  return error instanceof Error ? error.message : "设置操作失败。";
}

const fieldClassName =
  "h-10 w-full rounded-lg border border-white/10 bg-black/30 px-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-forge-blue/45";
const primaryButtonClassName =
  "rounded-lg border border-forge-blue/40 bg-forge-blue/15 px-3 py-2 text-sm font-medium text-forge-blue transition hover:bg-forge-blue/20";
const secondaryButtonClassName =
  "rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-300 transition hover:border-forge-blue/35 hover:text-white";

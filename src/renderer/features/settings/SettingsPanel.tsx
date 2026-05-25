import { motion } from "framer-motion";
import type { JSX } from "react";
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";

import type {
  AIProviderId,
  AIStreamEvent,
  ModelPriceRecord,
  ModelProfileRecord,
  ProviderCredentialDto,
  TaskRouteRecord
} from "@contracts/index";
import type { PrivacySettings, RoutingSettings } from "@contracts/settings";
import { PROVIDERS, QUALITY_MODES, TASK_TYPES } from "@shared/domain/model-routing";
import type { ProviderId, QualityMode, TaskType } from "@shared/domain/model-routing";

type SettingsTab = "providers" | "models" | "pricing" | "routing" | "privacy" | "advanced";

interface SettingsData {
  credentials: ProviderCredentialDto[];
  profiles: ModelProfileRecord[];
  prices: ModelPriceRecord[];
  routes: TaskRouteRecord[];
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
  generic_openai_compatible: "Generic OpenAI-compatible"
};

const AI_PROVIDER_LABELS: Record<AIProviderId, string> = {
  ...PROVIDER_LABELS,
  fake: "Fake local stream"
};

const TASK_LABELS: Record<TaskType, string> = {
  brainstorm: "Brainstorm",
  story_bible: "Story bible",
  volume_outline: "Volume outline",
  chapter_outline: "Chapter outline",
  scene_cards: "Scene cards",
  draft_chapter: "Draft chapter",
  webnovel_style_rewrite: "Style rewrite",
  continuity_audit: "Continuity audit",
  suspense_hook_audit: "Suspense audit",
  revise_chapter: "Revise chapter",
  state_settlement: "State settlement",
  summarize_chapter: "Summarize chapter",
  embedding_or_memory_indexing: "Memory indexing"
};

const QUALITY_LABELS: Record<QualityMode, string> = {
  economy: "Economy",
  balanced: "Balanced",
  premium: "Premium"
};

const SETTINGS_TABS: Array<{ id: SettingsTab; label: string }> = [
  { id: "providers", label: "Providers" },
  { id: "models", label: "Models" },
  { id: "pricing", label: "Pricing" },
  { id: "routing", label: "Routing" },
  { id: "privacy", label: "Privacy" },
  { id: "advanced", label: "Advanced" }
];

const today = new Date().toISOString().slice(0, 10);

const initialData: SettingsData = {
  credentials: [],
  profiles: [],
  prices: [],
  routes: [],
  privacy: null,
  routing: null
};

async function loadSettingsData(): Promise<SettingsData> {
  const [credentials, profiles, prices, routes, privacy, routing] = await Promise.all([
    window.wenforge.credentials.list(),
    window.wenforge.modelProfiles.list(),
    window.wenforge.modelPrices.list(),
    window.wenforge.taskRoutes.list(),
    window.wenforge.privacy.get(),
    window.wenforge.routingSettings.get()
  ]);
  return { credentials, profiles, prices, routes, privacy, routing };
}

export function SettingsPanel(): JSX.Element {
  const [activeTab, setActiveTab] = useState<SettingsTab>("providers");
  const [data, setData] = useState<SettingsData>(initialData);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [credentialDraft, setCredentialDraft] = useState({
    provider: "openai" as ProviderId,
    displayName: PROVIDER_LABELS.openai,
    baseUrl: "",
    apiKey: ""
  });
  const [modelDraft, setModelDraft] = useState({
    provider: "generic_openai_compatible" as ProviderId,
    model: "custom-model",
    displayName: "Custom model",
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
    sourceNote: "User verified pricing.",
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
      await window.wenforge.credentials.save({
        provider: credentialDraft.provider,
        displayName: credentialDraft.displayName,
        apiKey: credentialDraft.apiKey,
        baseUrl: normalizeNullableText(credentialDraft.baseUrl)
      });
      setCredentialDraft((current) => ({ ...current, apiKey: "" }));
    }, "Credential saved.");
  };

  const saveModel = async (): Promise<void> => {
    await runAction(async () => {
      await window.wenforge.modelProfiles.upsert({
        provider: modelDraft.provider,
        model: modelDraft.model,
        displayName: modelDraft.displayName,
        contextWindow: parseOptionalInteger(modelDraft.contextWindow),
        maxOutputTokens: parseOptionalInteger(modelDraft.maxOutputTokens),
        defaultTemperature: Number(modelDraft.defaultTemperature || "0.7"),
        supportsStreaming: true,
        enabled: true
      });
    }, "Model profile saved.");
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
    }, "Pricing row saved.");
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
    }, "Model profile updated.");
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
    }, "Pricing row updated.");
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
    }, "Route updated.");
  };

  const updatePrivacy = async (patch: Partial<PrivacySettings>): Promise<void> => {
    await runAction(async () => {
      await window.wenforge.privacy.update(patch);
    }, "Privacy settings updated.");
  };

  const updateRoutingSettings = async (patch: Partial<RoutingSettings>): Promise<void> => {
    await runAction(async () => {
      await window.wenforge.routingSettings.update(patch);
    }, "Routing settings updated.");
  };

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-6 py-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">Settings</p>
          <h2 className="mt-1 text-xl font-semibold text-white">Providers, Models, Routing</h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {data.credentials.length === 0 ? (
            <StatusPill tone="warning">No credentials</StatusPill>
          ) : null}
          {data.prices.some((price) => stalePriceIds.has(price.id)) ? (
            <StatusPill tone="warning">Stale prices</StatusPill>
          ) : null}
          <StatusPill tone="neutral">{data.routes.length} routes</StatusPill>
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
        {loading ? <EmptyState text="Loading settings..." /> : null}
        {!loading && activeTab === "providers" ? (
          <ProvidersTab
            credentialDraft={credentialDraft}
            credentials={data.credentials}
            onCredentialDraftChange={setCredentialDraft}
            onDeleteCredential={(credential) =>
              runAction(async () => {
                if (!window.confirm(`Delete ${credential.displayName}?`)) {
                  return;
                }
                await window.wenforge.credentials.delete(credential.id, true);
              }, "Credential deleted.")
            }
            onSaveCredential={saveCredential}
            onTestCredential={(credential) =>
              runAction(async () => {
                const result = await window.wenforge.credentials.testConnection(credential.id);
                setNotice(result.message);
              }, "Credential status refreshed.")
            }
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
        {!loading && activeTab === "pricing" ? (
          <PricingTab
            priceDraft={priceDraft}
            prices={data.prices}
            profiles={data.profiles}
            routing={data.routing}
            stalePriceIds={stalePriceIds}
            onPriceDraftChange={setPriceDraft}
            onSavePrice={savePrice}
            onUpdatePrice={updatePrice}
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
            onUpdateRoute={updateRoute}
          />
        ) : null}
        {!loading && activeTab === "privacy" && data.privacy ? (
          <PrivacyTab privacy={data.privacy} onUpdatePrivacy={updatePrivacy} />
        ) : null}
        {!loading && activeTab === "advanced" && data.routing ? (
          <AdvancedTab
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
  onCredentialDraftChange,
  onDeleteCredential,
  onSaveCredential,
  onTestCredential
}: {
  credentialDraft: {
    provider: ProviderId;
    displayName: string;
    baseUrl: string;
    apiKey: string;
  };
  credentials: ProviderCredentialDto[];
  onCredentialDraftChange: (draft: typeof credentialDraft) => void;
  onDeleteCredential: (credential: ProviderCredentialDto) => void;
  onSaveCredential: () => Promise<void>;
  onTestCredential: (credential: ProviderCredentialDto) => void;
}): JSX.Element {
  return (
    <div className="grid gap-4 xl:grid-cols-[360px_1fr]">
      <section className="rounded-xl border border-white/10 bg-graphite-900/55 p-4">
        <SectionTitle title="Save Credential" />
        <div className="mt-4 space-y-3">
          <FieldLabel label="Provider">
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
          <FieldLabel label="Display name">
            <input
              className={fieldClassName}
              value={credentialDraft.displayName}
              onChange={(event) =>
                onCredentialDraftChange({ ...credentialDraft, displayName: event.target.value })
              }
            />
          </FieldLabel>
          <FieldLabel label="Base URL">
            <input
              className={fieldClassName}
              placeholder="https://api.example.com/v1"
              value={credentialDraft.baseUrl}
              onChange={(event) =>
                onCredentialDraftChange({ ...credentialDraft, baseUrl: event.target.value })
              }
            />
          </FieldLabel>
          <FieldLabel label="API key">
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
            Save encrypted credential
          </button>
        </div>
      </section>
      <section className="rounded-xl border border-white/10 bg-graphite-900/55 p-4">
        <SectionTitle title="Configured Providers" />
        <div className="mt-4 overflow-hidden rounded-lg border border-white/10">
          {credentials.length === 0 ? <EmptyState text="No provider credentials saved." /> : null}
          {credentials.map((credential) => (
            <div
              className="grid gap-3 border-b border-white/10 px-3 py-3 last:border-b-0 md:grid-cols-[1fr_auto]"
              key={credential.id}
            >
              <div>
                <p className="text-sm font-medium text-white">{credential.displayName}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {PROVIDER_LABELS[credential.provider]} · {credential.redactedKeyLabel}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {credential.baseUrl ?? "Default provider endpoint"} · {credential.lastStatus}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  className={secondaryButtonClassName}
                  onClick={() => onTestCredential(credential)}
                  type="button"
                >
                  Test status
                </button>
                <button
                  className="rounded-lg border border-red-400/25 px-3 py-2 text-xs text-red-200 transition hover:bg-red-400/10"
                  onClick={() => onDeleteCredential(credential)}
                  type="button"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
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
  return (
    <div className="space-y-4">
      <section className="grid gap-3 rounded-xl border border-white/10 bg-graphite-900/55 p-4 xl:grid-cols-[180px_1fr_1fr_130px_130px_110px_auto]">
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
          onChange={(event) => onModelDraftChange({ ...modelDraft, model: event.target.value })}
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
          placeholder="Context"
          value={modelDraft.contextWindow}
          onChange={(event) =>
            onModelDraftChange({ ...modelDraft, contextWindow: event.target.value })
          }
        />
        <input
          className={fieldClassName}
          inputMode="numeric"
          placeholder="Max output"
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
          Save
        </button>
      </section>
      <div className="overflow-hidden rounded-xl border border-white/10">
        <TableHeader columns="grid-cols-[160px_1fr_100px_110px_130px_90px]" />
        {profiles.map((profile) => (
          <div
            className="grid grid-cols-[160px_1fr_100px_110px_130px_90px] items-center gap-3 border-t border-white/10 px-3 py-3 text-sm"
            key={profile.id}
          >
            <span className="text-slate-300">{PROVIDER_LABELS[profile.provider]}</span>
            <span>
              <span className="font-medium text-white">{profile.displayName}</span>
              <span className="ml-2 text-xs text-slate-500">{profile.model}</span>
            </span>
            <span className="text-slate-400">{profile.contextWindow ?? "Unset"}</span>
            <span className="text-slate-400">{profile.maxOutputTokens ?? "Unset"}</span>
            <span className="text-xs text-slate-500">
              {[
                profile.supportsStreaming ? "stream" : null,
                profile.supportsJson ? "json" : null,
                profile.supportsTools ? "tools" : null,
                profile.supportsVision ? "vision" : null
              ]
                .filter(Boolean)
                .join(" · ") || "base"}
            </span>
            <ToggleButton
              active={profile.enabled}
              label={profile.enabled ? "Enabled" : "Disabled"}
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
          placeholder="Cached"
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
          Save
        </button>
      </section>
      <div className="rounded-lg border border-forge-violet/25 bg-forge-violet/10 px-3 py-2 text-sm text-forge-violet">
        Stale threshold: {routing?.priceStaleAfterDays ?? 90} days. Seeded prices are editable
        placeholders until the user verifies current provider pricing.
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
            <span className="text-slate-400">${price.inputPricePerMillion}/M in</span>
            <span className="text-slate-400">${price.outputPricePerMillion}/M out</span>
            <span className={stalePriceIds.has(price.id) ? "text-amber-200" : "text-slate-400"}>
              {price.effectiveDate}
            </span>
            <ToggleButton
              active={price.enabled}
              label={price.enabled ? "Enabled" : "Disabled"}
              onClick={() => void onUpdatePrice(price, { enabled: !price.enabled })}
            />
          </div>
        ))}
      </div>
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
  onUpdateRoute
}: {
  configuredProviders: Set<ProviderId>;
  priceKeys: Set<string>;
  profileById: Map<string, ModelProfileRecord>;
  profiles: ModelProfileRecord[];
  routes: TaskRouteRecord[];
  stalePriceIds: Set<string>;
  prices: ModelPriceRecord[];
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

  return (
    <div className="overflow-hidden rounded-xl border border-white/10">
      {sortedRoutes.map((route) => {
        const profile = profileById.get(route.primaryModelProfileId) ?? null;
        const warnings = getRouteWarnings({
          configuredProviders,
          priceKeys,
          profile,
          staleKeys
        });
        return (
          <div
            className="grid grid-cols-[170px_92px_1fr_94px_116px_170px_90px] items-center gap-3 border-b border-white/10 px-3 py-3 text-sm last:border-b-0"
            key={route.id}
          >
            <span className="font-medium text-white">{TASK_LABELS[route.taskType]}</span>
            <span className="text-slate-400">{QUALITY_LABELS[route.qualityMode]}</span>
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
            <input
              className={fieldClassName}
              defaultValue={String(route.temperature)}
              inputMode="decimal"
              onBlur={(event) => {
                const temperature = Number(event.target.value);
                if (!Number.isNaN(temperature)) {
                  void onUpdateRoute(route, { temperature });
                }
              }}
            />
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
            <div className="flex flex-wrap gap-1">
              {warnings.length === 0 ? <StatusPill tone="success">Ready</StatusPill> : null}
              {warnings.map((warning) => (
                <StatusPill key={warning} tone="warning">
                  {warning}
                </StatusPill>
              ))}
            </div>
            <ToggleButton
              active={route.enabled}
              label={route.enabled ? "Enabled" : "Disabled"}
              onClick={() => void onUpdateRoute(route, { enabled: !route.enabled })}
            />
          </div>
        );
      })}
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
          ["storeFullPrompts", "Store full prompts"],
          ["storeFullResponses", "Store full responses"],
          ["storeManuscriptsInLogs", "Store manuscripts in logs"],
          ["allowPromptPreview", "Allow prompt preview"],
          ["allowSendingFullRecentChapters", "Allow full recent chapters"],
          ["enableDebugLogging", "Enable debug logging"]
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
        label="Recent chapter count"
        value={privacy.recentChapterCount}
        onCommit={(value) => onUpdatePrivacy({ recentChapterCount: value })}
      />
      <NumberSetting
        label="Max context token budget"
        value={privacy.maxContextTokenBudget}
        onCommit={(value) => onUpdatePrivacy({ maxContextTokenBudget: value })}
      />
    </div>
  );
}

function AdvancedTab({
  profiles,
  routing,
  onUpdateRoutingSettings
}: {
  profiles: ModelProfileRecord[];
  routing: RoutingSettings;
  onUpdateRoutingSettings: (patch: Partial<RoutingSettings>) => Promise<void>;
}): JSX.Element {
  const [ping, setPing] = useState<string>("Not checked");
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="rounded-xl border border-white/10 bg-graphite-900/55 p-4">
        <SectionTitle title="Routing Policy" />
        <div className="mt-4 space-y-3">
          <NumberSetting
            label="Price stale after days"
            value={routing.priceStaleAfterDays}
            onCommit={(value) => onUpdateRoutingSettings({ priceStaleAfterDays: value })}
          />
          <FieldLabel label="Missing price behavior">
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
              <option value="warn">Warn</option>
              <option value="block">Block</option>
            </select>
          </FieldLabel>
        </div>
      </section>
      <section className="rounded-xl border border-white/10 bg-graphite-900/55 p-4">
        <SectionTitle title="Diagnostics" />
        <div className="mt-4 flex items-center justify-between gap-3">
          <span className="text-sm text-slate-400">{ping}</span>
          <button
            className={secondaryButtonClassName}
            onClick={() => {
              void window.wenforge.diagnostics.ping().then((result) => setPing(result.at));
            }}
            type="button"
          >
            Ping
          </button>
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
  const [status, setStatus] = useState("Idle");
  const [liveCost, setLiveCost] = useState(0);
  const [usageText, setUsageText] = useState("0 input / 0 output");

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
          `${event.inputTokensEstimated} input / ${event.outputTokensEstimatedLive} output`
        );
      }
      if (event.type === "complete") {
        setStatus(`Complete · ${event.usageSource}`);
        setLiveCost(event.cost.totalCost);
        setUsageText(`${event.usage.inputTokens} input / ${event.usage.outputTokens} output`);
      }
      if (event.type === "error") {
        setStatus(`${event.code}: ${event.message}`);
      }
    });
  }, [activeRunId]);

  const start = async (): Promise<void> => {
    setStreamText("");
    setStatus("Starting");
    setLiveCost(0);
    const result = await window.wenforge.ai.stream.start({
      provider,
      model,
      taskType,
      messages: [{ role: "user", content: prompt }],
      qualityMode: "balanced"
    });
    setActiveRunId(result.runId);
    setStatus(`Running · ${result.runId}`);
  };

  const abort = async (): Promise<void> => {
    if (!activeRunId) {
      return;
    }
    await window.wenforge.ai.stream.abort(activeRunId);
  };

  return (
    <section className="rounded-xl border border-white/10 bg-graphite-900/55 p-4 lg:col-span-2">
      <SectionTitle title="Developer Test Generation" />
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
          Start
        </button>
        <button className={secondaryButtonClassName} onClick={() => void abort()} type="button">
          Abort
        </button>
      </div>
      <textarea
        className={`${fieldClassName} mt-3 h-24 resize-none py-3`}
        value={prompt}
        onChange={(event) => setPrompt(event.target.value)}
      />
      <div className="mt-3 grid gap-3 md:grid-cols-3">
        <StatusTile label="Status" value={status} />
        <StatusTile label="Usage" value={usageText} />
        <StatusTile label="Live cost" value={`$${liveCost.toFixed(6)}`} />
      </div>
      <div className="mt-3 min-h-28 whitespace-pre-wrap rounded-lg border border-white/10 bg-black/30 p-3 text-sm leading-7 text-slate-300">
        {streamText || "Stream output will appear here."}
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
      <span>Provider</span>
      <span>Model</span>
      <span>Context</span>
      <span>Output</span>
      <span>Caps</span>
      <span>Status</span>
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
    return ["missing model"];
  }
  const key = priceKey(profile);
  const warnings: string[] = [];
  if (!configuredProviders.has(profile.provider)) {
    warnings.push("credential");
  }
  if (!priceKeys.has(key)) {
    warnings.push("price");
  }
  if (staleKeys.has(key)) {
    warnings.push("stale");
  }
  return warnings;
}

function priceKey(value: { provider: ProviderId; model: string }): string {
  return `${value.provider}:${value.model}`;
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
  return error instanceof Error ? error.message : "Settings action failed.";
}

const fieldClassName =
  "h-10 w-full rounded-lg border border-white/10 bg-black/30 px-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-forge-blue/45";
const primaryButtonClassName =
  "rounded-lg border border-forge-blue/40 bg-forge-blue/15 px-3 py-2 text-sm font-medium text-forge-blue transition hover:bg-forge-blue/20";
const secondaryButtonClassName =
  "rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-300 transition hover:border-forge-blue/35 hover:text-white";

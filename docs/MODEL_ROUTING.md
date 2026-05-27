# Model Routing

## Phase 3 Scope

Phase 3 adds the model routing configuration layer only. It does not call providers, send test prompts, stream generation, or reconcile provider usage. The goal is to make credentials, profiles, prices, and task routes editable before generation exists.

## Supported Provider Profiles

Configurable providers:

- OpenAI
- Anthropic
- Google Gemini
- DeepSeek
- DashScope/Qwen
- Moonshot/Kimi
- xAI
- OpenRouter
- Generic OpenAI-compatible provider

Each credential record stores metadata and encrypted secret bytes in SQLite. The renderer sees only provider, display name, base URL, configuration status, redacted key label, timestamps, and status.

## Model Profiles

Model profiles are DB-backed and editable. Each row includes:

- provider
- model
- display name
- endpoint family
- maximum output token parameter name
- context window
- max output tokens
- streaming, JSON, tools, vision, and prompt-caching capability flags
- sampling/reasoning capability flags such as temperature, top-p, top-k, stop, reasoning effort, adaptive thinking, and manual thinking budget
- default temperature
- recommended tasks
- enabled status

Seeded model profile names are placeholders requested for planning. WenForge does not claim their metadata, availability, context windows, or pricing are permanently accurate. Users can edit or disable every seeded profile.

## Pricing Registry

`model_prices` is the active cost registry. Each price row includes provider, model, input/output/cached-input prices per million tokens, currency, context window, max output tokens, effective date, source note, and enabled status.

Phase 3 seeds placeholder price rows with explicit source notes. Real pricing must be user-verified or updated by a later curated price-import workflow.

## Task Routes

Routes are stored by:

- task type
- quality mode: `economy`, `balanced`, or `premium`
- primary model profile
- two optional fallback model profiles
- creativity intent: `deterministic`, `balanced`, `creative`, or `wild`
- context budget mode: `conservative`, `balanced`, `max_safe`, or `manual`
- max output tokens
- optional budget cap per call
- enabled status

Supported task types:

- brainstorm
- story_bible
- volume_outline
- chapter_outline
- scene_cards
- draft_chapter
- webnovel_style_rewrite
- continuity_audit
- suspense_hook_audit
- revise_chapter
- state_settlement
- summarize_chapter
- embedding_or_memory_indexing

## Router Resolution

`ModelRouter.resolveRoute(taskType, qualityMode, context)` checks:

1. Route exists and is enabled.
2. Primary model profile exists and is enabled.
3. A configured credential exists for the profile provider.
4. An active price row exists for the provider/model pair.
5. Active price is not stale according to `priceStaleAfterDays`.
6. Provider health is not marked down.

Missing credentials block route availability. Missing prices warn by default and can block when `missingPriceBehavior` is set to `block`. Stale prices warn.

## Phase 9 Provider Routing

Phase 9 connects chapter workflow nodes to the main-process AI gateway. Every provider-backed node now flows through:

`ContextBuilder -> PromptAssembly -> ModelRouter -> WorkflowModelExecutor/CostWrapper -> ProviderAdapter -> llm_runs`

The router now exposes:

- `getPrimaryModel(taskType, qualityMode)`
- `getFallbackModels(taskType, qualityMode)`
- `estimateRouteCost(taskType, expectedTokens, qualityMode)`
- `shouldUseFallback(error, providerStatus)`
- `recordRouteOutcome(runId, provider, model, outcome)`

Route preview accepts chapter importance, budget mode, expected token estimates, provider health, and optional user override model profile. Provider mode will not start when a required route, credential, model profile, or blocking price is missing. Mock mode must be selected explicitly when the user wants a local no-provider run.

Fallback policy:

- rate limits can fall back to configured fallback models
- retryable network/timeout/overload failures can retry or fall back
- auth, invalid-key, and permission errors do not retry or fall back
- structured JSON failure retries once with the WenForge JSON repair prompt

Provider health is updated after successes and failures and can be reset in Settings.

## Settings UI

The renderer exposes a Settings workspace with tabs for:

- Providers: save, list, delete, and status-check credentials without showing stored secrets.
- Models: add custom profiles and enable/disable seeded profiles.
- Pricing: add or edit price rows and see stale price warnings.
- Routing: change primary model profile, temperature, token limit, and enabled status.
- Budgets: set caps, warning threshold, exceeded action, currency, and reset provider health.
- Privacy: configure prompt, response, manuscript, recent-chapter, token-budget, and debug logging settings.
- Advanced: configure stale price threshold and missing price policy.

All changes use typed IPC endpoints. The renderer never imports DB modules and never receives decrypted API keys.

## Phase 11 Evaluation Feedback Loop

Phase 11 adds a local model evaluation suite for routing decisions:

- compare enabled model profiles on Chinese web novel eval cases
- run mock evals without provider calls during tests
- score outputs manually or with advisory mock LLM judge scoring
- mask providers/models in blind-comparison mode
- rank models by quality, cost, latency, and cost-adjusted score
- promote a winning output's model profile into a route preset only after explicit confirmation

Promotion updates `task_model_routes.primary_model_profile_id`; it does not copy eval output text into manuscripts or story memory. Eval outputs still create `llm_runs`, so route choices can be judged against local cost and latency history.

The Costs workspace also reports route price warnings for routes whose primary model is missing an active price row or uses a stale price.

## Phase 15a/15c Provider Connectivity

Provider connectivity checks are not routing benchmarks. They validate whether a configured credential/model pair can complete a tiny request through the adapter and gateway.

The provider check report records:

- configured true/false
- tested true/false
- streaming support
- usage parsing
- final cost computation
- fallback eligibility
- redacted errors

Successful checks update provider health and credential tested status. Route selection still depends on editable model profiles, prices, task routes, and budget policy.

The optional provider chapter check uses the same routes as a normal short workflow and should be treated as QA only. It creates `llm_runs`, generated artifacts, review cards, and settlement proposals, but does not make a generated manuscript canonical and does not apply story bible changes.

## Phase 15b Premium Webnovel Preset

Phase 15b adds `premium_webnovel` as a fourth editable quality mode. It is a high-cost Chinese webnovel routing preset, not a replacement for the existing `premium` mode.

Model aliases are now stored on model profiles so routes can refer to stable user-facing names while the actual provider model id remains editable in Settings:

- `gpt-5.5`
- `claude-opus-4.7`
- `deepseek-v4-pro`
- `qwen3.7-max`
- `kimi-k2.6`

The Premium Webnovel preset seeds Qwen3.7-Max and Kimi K2.6 as editable placeholders. Placeholder price rows are explicitly marked with `User must confirm in provider console.` and should not be treated as authoritative.

Preset routing:

- `story_bible` and `volume_outline`: GPT-5.5 plus Claude Opus 4.7 as parallel director models, DeepSeek V4 Pro as aggregator/fallback.
- `chapter_outline`: DeepSeek V4 Pro, then GPT-5.5, then Qwen3.7-Max.
- `scene_cards`: DeepSeek V4 Pro, then Kimi K2.6.
- `draft_chapter`: Qwen3.7-Max, then Kimi K2.6, then Claude Opus 4.7.
- `webnovel_style_rewrite`: Qwen3.7-Max, then Kimi K2.6.
- `suspense_hook_audit`: Qwen3.7-Max, then DeepSeek V4 Pro.
- `continuity_audit`: DeepSeek V4 Pro, then GPT-5.5, then Claude Opus 4.7.
- `revise_chapter`: Claude Opus 4.7, then Qwen3.7-Max.
- `state_settlement`: DeepSeek V4 Pro, then GPT-5.5.
- `summarize_chapter`: DeepSeek V4 Pro, then Kimi K2.6.

Settings > Routing can apply, export, and import the Premium Webnovel preset. Missing credentials still block provider execution with safe actionable errors, and missing/stale prices follow the routing/budget policy.

## Phase 15d Forecasting Inputs

Route previews and chapter forecasts now use optional price tiers when they are available. The model profile still owns the editable provider/model id, and `model_prices` remains the base price. `model_price_tiers` can refine that base price by deployment mode and input-token range.

Deployment mode is a user/provider-account configuration detail. WenForge does not infer it from physical location. Qwen regional tiers are seeded only as editable placeholders, and the user must confirm their account and endpoint pricing before relying on estimates.

Forecasting is read-only:

- it resolves the task routes for the requested quality mode
- applies provider/model usage calibration factors when enough samples exist
- selects matching price tiers or falls back to base prices
- compares the estimate against the current budget policy
- calculates provider quota warnings from manual quota notes

Forecasting never calls a provider, never reads decrypted credentials, and never mutates manuscripts, story bible entries, routes, or canonical state.

## Phase 15e Eval-Driven Recommendations

The v2 model evaluation suite can compare GPT-5.5, Claude Opus 4.7, Qwen3.7-Max, Kimi K2.6, and DeepSeek V4 Pro on WenForge-specific tasks. It produces route recommendations for daily drafting, key chapters, hook review, continuity review, state settlement, value-first routing, and quality-first routing.

Recommendations are advisory until the user confirms an application. Applying a recommendation updates the selected `task_model_routes` row only; it does not modify manuscripts, story bible facts, memory, or provider credentials.

## Phase 18 Parameter Normalization

Phase 18 replaces ordinary-user temperature tuning with model-aware parameter normalization.

Before every provider request, `ModelParameterPolicy` combines the selected model profile, endpoint family, route intent, and output/context budgets. It returns provider-safe request parameters, omitted unsupported parameters, warnings, and prompt instructions that replace unsupported sampling controls.

Important defaults:

- WenForge routes default to `contextBudgetMode = max_safe`.
- Drafting and webnovel rewrite default to `creative`.
- Continuity audit, state settlement, and summarization default to `deterministic`.
- OpenAI GPT-5.x chat-completions profiles use `max_completion_tokens` instead of `max_tokens`.
- OpenAI Responses API profiles use `max_output_tokens`.
- Claude Opus 4.7 omits `temperature`, `top_p`, and `top_k` and uses `max_tokens`.
- DeepSeek, Qwen, xAI, OpenRouter, and generic OpenAI-compatible profiles use the editable max-output parameter configured on the model profile.
- Kimi/Moonshot uses the official OpenAI-compatible family and omits unsupported temperature
  fields during workflows and provider smoke checks, preventing `invalid temperature` failures.

Known provider parameter errors are classified as `provider_parameter_error`. If no stream output has started, WenForge can retry once with the rejected parameter removed and records both attempts in `llm_runs`.

## Phase 19 Candidate Presets

Multi-draft mode adds user-facing candidate presets. These presets are convenience selections for writer models and do not replace task routes:

- Daily Compare: Qwen3.7-Max and DeepSeek V4 Pro.
- Balanced Compare: Qwen3.7-Max, Kimi K2.6, and DeepSeek V4 Pro.
- Premium Compare: Claude Opus 4.7, Qwen3.7-Max, and Kimi K2.6.
- Full Key Chapter Compare: Claude Opus 4.7, GPT-5.5, Qwen3.7-Max, Kimi K2.6, and DeepSeek V4 Pro.

Each candidate receives a role label that becomes a prompt hint. The actual provider/model IDs still come from editable model profiles. If credentials or prices are missing, provider-backed candidate generation surfaces the same safe route errors as the normal AI gateway.

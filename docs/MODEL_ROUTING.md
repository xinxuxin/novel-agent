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
- context window
- max output tokens
- streaming, JSON, tools, vision, and prompt-caching capability flags
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
- temperature
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

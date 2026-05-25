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

`ModelRouter.resolveRoute(taskType, qualityMode)` checks:

1. Route exists and is enabled.
2. Primary model profile exists and is enabled.
3. A configured credential exists for the profile provider.
4. An active price row exists for the provider/model pair.
5. Active price is not stale according to `priceStaleAfterDays`.

Missing credentials block route availability. Missing prices warn by default and can block when `missingPriceBehavior` is set to `block`. Stale prices warn.

## Settings UI

The renderer exposes a Settings workspace with tabs for:

- Providers: save, list, delete, and status-check credentials without showing stored secrets.
- Models: add custom profiles and enable/disable seeded profiles.
- Pricing: add or edit price rows and see stale price warnings.
- Routing: change primary model profile, temperature, token limit, and enabled status.
- Privacy: configure prompt, response, manuscript, recent-chapter, token-budget, and debug logging settings.
- Advanced: configure stale price threshold and missing price policy.

All changes use typed IPC endpoints. The renderer never imports DB modules and never receives decrypted API keys.

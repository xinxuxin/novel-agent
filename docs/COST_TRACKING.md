# Cost Tracking

## Goals

WenForge Studio should make model spend visible before, during, and after generation. The user should be able to see per-run, chapter, session, project, and monthly cost without relying on provider dashboards.

## Price Registry

The `model_prices` table should include:

- provider
- model
- input_price_per_million
- output_price_per_million
- cached_input_price_per_million
- currency
- context_window
- max_output_tokens
- effective_date
- source_note
- enabled

Prices are editable because provider pricing changes frequently. Phase 3 seeds placeholder price rows for the initial model profile catalog with `source_note` values that explicitly mark them as user-verifiable placeholders, not authoritative price claims.

## Phase 3 Registry Behavior

Phase 3 implements:

- DB-backed model price records in `model_prices`.
- `ModelPriceRepository` for listing, upserting, and finding the active price for a provider/model pair.
- `calculateModelCost` for input, output, and cached-input token estimates.
- `isPriceStale` for stale price warnings.
- Settings UI editing for price rows and stale-threshold policy.
- Route warnings when a selected route has no configured price or has a stale active price.

The default stale threshold is `priceStaleAfterDays: 90`. The user can change it in Settings > Advanced. Missing prices default to warning mode; they can be changed to blocking mode before real model generation is enabled.

## LLM Run Records

Every LLM call creates an `llm_runs` record:

- id
- provider
- model
- task_type
- project_id
- book_id
- chapter_id nullable
- request_started_at
- request_finished_at
- status
- input_tokens_estimated
- output_tokens_estimated_live
- input_tokens_reported
- output_tokens_reported
- cached_input_tokens_reported
- estimated_cost_live
- final_cost
- latency_ms
- error_code
- error_message
- prompt_hash
- response_hash

Do not store complete prompts or responses in `llm_runs` by default.

Phase 3 creates the table and routing/cost services needed for `llm_runs`. Phase 4 creates and updates `llm_runs` through the main-process AI gateway.

Phase 8 also creates `llm_runs` for mock workflow nodes. These rows use `provider = fake`, `model = wenforge-mock-chapter-v1`, hash-only prompt/response storage, estimated usage, and local placeholder pricing so workflow cost accumulation can be tested without real provider calls.

## Estimation Flow

1. Estimate input tokens from assembled prompt before request.
2. Create `llm_runs` with status `running`.
3. During streaming, estimate output tokens from accumulated generated text.
4. Update live cost using the active price record.
5. On completion, reconcile with provider-reported usage when available.
6. If usage is unavailable, mark final cost as estimated.
7. On error or cancellation, record partial output estimate, status, latency, and safe error code.

## Phase 4 Implementation

Phase 4 implements:

- `TokenEstimator` with conservative CJK character counting and a `chars / 4` fallback for non-CJK text.
- `CostCalculator` with input, output, cached-input, currency, and estimated/final flags.
- Live cost events during streaming.
- Final cost reconciliation from provider usage when available.
- `usage_source` values:
  - `provider` when reported usage is available
  - `estimated` when local estimates are used
  - `mixed` reserved for later partial-provider reconciliation
- `ai.costs.summary` for filtered run totals.

The gateway stores prompt and response hashes, not full content, unless future privacy settings explicitly opt into more verbose local logging.

## Phase 8 Workflow Costs

The chapter workflow aggregates costs from all node-level `llm_runs` linked to a `generation_run_id`. The Generate tab shows the latest run cost and session status during mock workflow execution.

Current Phase 8 behavior:

- preflight uses a conservative mock range
- each mock model node records estimated input and output tokens
- final mock costs are marked `usage_source = estimated`
- workflow cancellation preserves partial run records
- settlement proposal generation is costed as its own fake model node

## Phase 9 Provider Workflow Costs

Phase 9 routes workflow model nodes through the main-process AI gateway. Each attempt creates its own `llm_runs` row before the provider adapter is called. Fallback attempts and JSON-repair attempts are visible as separate run records linked to the same `generation_run_id`.

Provider workflow preflight:

- resolves all chapter workflow task routes
- estimates input and output tokens per node
- computes per-node and total cost ranges from active `model_prices`
- blocks missing credentials and blocking missing-price policies
- surfaces stale price warnings
- enforces `per_workflow_budget_cap` before creating a workflow run

Live budget behavior:

- per-call caps are checked before the provider request
- final call cost is compared against preflight max plus `warning_threshold_percent`
- the configured action is returned as `warn`, `pause`, or `abort`
- provider errors are normalized and redacted before being written to `llm_runs`

The Settings budget panel edits the default budget policy. Daily and project caps are stored now and reserved for full spend-window enforcement in a later analytics pass.

## Phase 11 Cost Dashboard

Phase 11 adds `CostDashboardService` and a dedicated Costs workspace. It aggregates `llm_runs` into:

- active run, session, today, project, and month-to-date totals
- provider, model, task type, workflow node, chapter, and date groups
- estimated-only, provider-reported, and mixed usage buckets
- average cost per approved chapter
- average cost per 1k Chinese characters from canonical manuscript character counts
- stale price warnings from `model_prices.effective_date`

The dashboard also exposes budget policy editing, price registry JSON import/export, stale-price marking, inline price edits, route warnings for missing/stale prices, and local CSV export.

`costs.exportCsv` excludes prompts, responses, manuscript text, and secrets. Provider error messages are redacted before export.

Evaluation runs are counted like other local model runs. Phase 11 mock eval outputs create `llm_runs` with estimated usage, so model comparisons include cost and latency without real provider calls in tests.

## UI Surfaces

- Live run meter in the generation stream.
- Chapter total in the right panel.
- Session total in the command bar or task timeline.
- Project monthly total in analytics.
- Route editor warnings when a selected model has no active price record.
- Provider workflow preflight modal showing selected models and estimated max cost.
- Settings budget panel for caps, threshold, action, and provider health.
- Costs workspace with local charts, budget controls, pricing tools, route price warnings, and redacted CSV export.

## Accuracy Notes

Provider tokenizers differ. WenForge should treat local token counts as estimates unless provider usage is returned. Chinese text estimation should be calibrated against provider-reported usage over time per provider/model.

## Phase 15a Smoke Budgets

Real provider smoke tests are intentionally capped:

- CLI smoke uses `REAL_PROVIDER_TEST_BUDGET_USD`, default `$2`.
- Settings -> Providers smoke tests use a tiny per-call budget.
- Each smoke request uses `maxOutputTokens <= 80`.
- If provider usage is unavailable, final cost remains estimated.
- Every smoke call creates an `llm_runs` row, so spend is visible in cost summaries.

Provider reports are redacted and do not include prompts, responses, manuscripts, or secrets.

## Phase 15b Multi-Model Cost Controls

Premium Webnovel cross-checks estimate the full parallel plan before execution:

- independent GPT-5.5 director call
- independent Claude Opus 4.7 director call
- DeepSeek V4 Pro aggregation call
- Qwen3.7-Max or Kimi K2.6 market-fit call

If the estimated total exceeds the user-supplied cross-check budget cap, the run is blocked before provider execution and before any `llm_runs` are created. Successful calls still flow through the AI gateway, so each model attempt creates an `llm_runs` row with hashes, usage estimates/reported usage, and final cost.

Cross-check artifacts store per-model cost metadata in `generated_artifacts.content_json` with `status = proposed`; they are not counted as accepted manuscript cost until the user later accepts a generated manuscript version.

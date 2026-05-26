# AI Gateway

## Phase 4 Scope

Phase 4 adds the main-process AI gateway used by future generation workflows. The renderer still never calls providers directly and never receives decrypted credentials. Real workflow orchestration remains future work; this phase focuses on provider streaming, `llm_runs`, token estimates, live cost events, and safe run records.

## Process Boundary

Renderer requests a stream through typed IPC:

- `ai.stream.start(request) -> { runId }`
- `ai.stream.abort({ runId })`
- `ai.runs.get({ runId })`
- `ai.runs.listByChapter({ chapterId })`
- `ai.costs.summary({ projectId?, bookId?, chapterId?, since?, until? })`

The main process resolves credentials, adapters, prices, and routes. It emits validated stream events back to the renderer on a narrow event channel:

- `delta`: text chunk
- `cost`: live token and cost estimate
- `complete`: final text, usage, cost, and usage source
- `error`: safe code/message only

## Gateway Flow

1. Validate the IPC payload with Zod.
2. Resolve direct provider/model or DB-backed task route.
3. Decrypt the selected credential in the main process only.
4. Estimate input tokens before any provider call.
5. Create an `llm_runs` row with status `running`.
6. Call the provider adapter with an abort signal.
7. Stream text deltas and live cost events to the renderer.
8. Update live output token and cost estimates during streaming.
9. Reconcile reported usage when the provider returns it.
10. Mark usage as `estimated` when usage is unavailable.
11. On error or abort, update `llm_runs` with safe error fields.

## Adapters

Implemented:

- `FakeProviderAdapter`: deterministic local streams for tests and developer UI.
- `GenericOpenAICompatibleAdapter`: `POST /chat/completions`, streaming SSE parsing, delta extraction, and usage normalization.
- OpenAI, DeepSeek, DashScope/Qwen, Moonshot/Kimi, xAI, and OpenRouter use OpenAI-compatible defaults.

Stubbed:

- Anthropic returns `not_implemented`.
- Gemini returns `not_implemented`.

The stubs are deliberate. WenForge should not invent provider endpoints; reliable provider-specific adapters can be added later with tests.

## Accounting

Every gateway run creates an `llm_runs` record before the adapter is called. By default, only hashes are stored:

- `prompt_hash`
- `response_hash`

Full prompts, responses, and manuscripts are not stored in run records by default. Live estimates use `TokenEstimator` and `CostCalculator`. Final costs use provider-reported usage when available.

Phase 15d extends accounting with optional price tiers and usage calibration. The gateway still creates `llm_runs` before provider calls, but cost calculation can now use a matching `model_price_tiers` row when a provider/model has deployment-mode or token-band pricing. When a provider returns usage, WenForge updates per-provider/model calibration factors for future estimates. Calibration never exposes credentials and never rewrites historical provider-reported final costs.

## Tests

Phase 4 unit tests cover:

- Fake provider streaming.
- SSE parser data lines, multi-line events, `[DONE]`, and malformed chunks.
- Abort behavior.
- Cost calculator.
- Token estimator.
- `llm_runs` created before request.
- `llm_runs` updated on success and error.
- No real provider calls.
- Prompt/response text excluded from run records.
- Prompt/response hashes stored.

## Phase 15a/15c Provider Connectivity Validation

Phase 15a adds a provider bring-up layer around the existing gateway. Phase 15c exposes it as privacy-safe provider connectivity checks. Checks still use `AiGateway`, so each model call creates an `llm_runs` row before the adapter runs and stores prompt/response hashes by default.

The check layer adds stricter bring-up limits:

- explicit user confirmation in Settings -> Providers
- no real calls in CI
- opt-in `RUN_REAL_PROVIDER_CHECKS=true` for CLI provider checks
- global CLI budget from `REAL_PROVIDER_CHECK_BUDGET_USD`
- tiny JSON prompt
- `temperature = 0`
- `maxOutputTokens <= 80`
- redacted provider conformance reports

The optional E2E provider chapter check also uses the normal gateway for every model node. It stops before canonical manuscript updates and story bible mutations, and reports only IDs/counts, costs, provider/model metadata, and redacted errors.

Anthropic and Gemini remain safe `provider_not_implemented` adapters until reliable provider-specific support is added.

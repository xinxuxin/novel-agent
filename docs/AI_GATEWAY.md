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

## Phase 15a Smoke Validation

Phase 15a adds a provider smoke layer around the existing gateway. Smoke calls still use `AiGateway`, so each model call creates an `llm_runs` row before the adapter runs and stores prompt/response hashes by default.

The smoke layer adds stricter bring-up limits:

- explicit user confirmation in Settings -> Providers
- no real calls in CI
- opt-in `RUN_REAL_PROVIDER_TESTS=true` for CLI smoke runs
- global CLI budget from `REAL_PROVIDER_TEST_BUDGET_USD`
- tiny JSON prompt
- `temperature = 0`
- `maxOutputTokens <= 80`
- redacted provider conformance reports

Anthropic and Gemini remain safe `provider_not_implemented` adapters until reliable provider-specific support is added.

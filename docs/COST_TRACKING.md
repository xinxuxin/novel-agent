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

Prices are editable because provider pricing changes frequently. Seed prices should include source notes and effective dates.

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

## Estimation Flow

1. Estimate input tokens from assembled prompt before request.
2. Create `llm_runs` with status `running`.
3. During streaming, estimate output tokens from accumulated generated text.
4. Update live cost using the active price record.
5. On completion, reconcile with provider-reported usage when available.
6. If usage is unavailable, mark final cost as estimated.
7. On error or cancellation, record partial output estimate, status, latency, and safe error code.

## UI Surfaces

- Live run meter in the generation stream.
- Chapter total in the right panel.
- Session total in the command bar or task timeline.
- Project monthly total in analytics.
- Route editor warnings when a selected model has no active price record.

## Accuracy Notes

Provider tokenizers differ. WenForge should treat local token counts as estimates unless provider usage is returned. Chinese text estimation should be calibrated against provider-reported usage over time per provider/model.


# Model Parameter Policy

Phase 18 adds `ModelParameterPolicy`, a central request-normalization layer that runs before provider adapters build request bodies.

The policy fixes provider compatibility problems without pushing raw provider knobs into the default UI.

## Goals

- Avoid known provider HTTP 400 errors caused by unsupported parameters.
- Keep ordinary routing configured by intent instead of raw sampling parameters.
- Let model profiles describe endpoint family and supported request fields.
- Record omitted parameters and warnings without leaking prompts or secrets.
- Retry one safe time when a provider rejects a known request parameter before streaming begins.

## Inputs

The policy receives:

- provider id
- endpoint family
- model id
- task type
- output token budget
- context budget mode
- creativity intent
- JSON/stream/tool/reasoning intents
- model profile capability flags
- advanced overrides when developer mode allows them

Endpoint families include:

- `openai_chat_completions`
- `openai_responses`
- `anthropic_messages`
- `gemini_generate_content`
- `openai_compatible`
- `dashscope_openai_compatible`
- `moonshot_openai_compatible`
- `deepseek_openai_compatible`
- `xai_openai_compatible`
- `openrouter_openai_compatible`

## Outputs

The policy returns:

- provider-safe request body parameters
- omitted parameters with reasons
- warnings
- prompt instructions that replace unsupported sampling controls
- effective output token budget
- effective context token budget

Adapters receive this normalized metadata in `ProviderAdapterConfig.normalizedParams` and must not reintroduce omitted parameters.

## OpenAI Rules

For OpenAI chat-completions models that require the newer output field:

- send `max_completion_tokens`
- do not send `max_tokens`
- never send both

For OpenAI Responses API:

- send `max_output_tokens`
- do not send `max_tokens`
- do not send `max_completion_tokens`

GPT-5.x placeholder profiles are seeded to use `max_completion_tokens` for chat-completions fallback. If Responses API support is enabled later, their profile can switch to `openai_responses` and `max_output_tokens`.

## Anthropic Rules

Claude Opus 4.7 is seeded as:

- `endpoint_family = anthropic_messages`
- `max_output_param_name = max_tokens`
- `supports_temperature = false`
- `supports_top_p = false`
- `supports_top_k = false`
- `supports_adaptive_thinking = true`
- `supports_manual_thinking_budget = false`

When sampling parameters are unsupported, WenForge omits `temperature`, `top_p`, and `top_k`. Creative or deterministic intent is expressed through prompt instruction instead.

## Creativity Intent

Default task routes store high-level intent:

- `deterministic`
- `balanced`
- `creative`
- `wild`

The policy maps intent to provider-safe parameters only when supported by the model profile. Unsupported parameters are omitted and represented as prompt instructions.

Default intents:

- outline and scene cards: `balanced`
- drafting and webnovel rewrite: `creative`
- audits, settlement, and summaries: `deterministic`

Ordinary users do not need to tune temperature. Advanced raw overrides should stay behind an explicit warning.

## Context Budget

WenForge defaults to `max_safe` context mode.

`max_safe` means:

- use as much model context as practical
- reserve output tokens
- reserve overhead for tools/JSON/formatting
- respect known context window
- respect privacy settings for recent full chapters
- respect budget policy
- avoid provider hard-limit errors

Preflight should show the context window, reserved output tokens, estimated input tokens, included/omitted sections, and omission reasons.

## Retry Repair

Known compatibility errors are classified as `provider_parameter_error`.

Examples:

- Anthropic: `temperature is deprecated for this model`
- OpenAI: `Unsupported parameter: max_tokens is not supported`

If the request has not streamed output yet and retry budget remains, WenForge removes the rejected parameter, records the failed attempt, creates a new `llm_runs` row for the retry, and shows a safe user-facing message:

`The model rejected a request parameter. WenForge retried with compatible parameters.`

WenForge never retries indefinitely.

# Privacy Model

WenForge Studio is local-first. Project data, manuscript versions, story bible records, workflow history, model routes, and cost logs live in the user's local Electron `userData` directory unless the user explicitly exports a package, backup, or diagnostic bundle.

## Defaults

Privacy defaults are conservative:

- `storeFullPrompts`: false
- `storeFullResponses`: false
- `storeManuscriptsInLogs`: false
- `allowPromptPreview`: false
- `allowSendingFullRecentChapters`: false
- `recentChapterCount`: 3
- `maxContextTokenBudget`: 120000
- `enableDebugLogging`: false

By default, LLM run records store prompt and response hashes, token counts, cost fields, timing, provider/model metadata, and safe error summaries. They do not store complete prompts, complete responses, or full manuscript text.

## Secrets

Provider API keys are encrypted in the Electron main process with `safeStorage`. The renderer can submit a new key and can see redacted credential metadata, but it cannot read decrypted secrets or encrypted secret bytes. If `safeStorage` is unavailable, WenForge refuses plaintext credential storage.

Exports, diagnostic bundles, logs, and renderer error panels must redact:

- API-key-like strings
- Authorization headers
- access tokens
- secret assignment values
- encrypted credential payload fields

## Diagnostics

Diagnostic bundles are meant for debugging app state, not manuscript review. The default diagnostic bundle includes:

- app version
- platform and environment
- DB migration version
- `safeStorage` availability
- provider health records with redacted errors
- recent redacted logs
- settings excluding secret-like fields

Manuscripts are excluded unless a future support flow asks for an explicit, warned opt-in. API keys are never included.

## Provider Data

Real provider calls happen only when the user configures a provider credential and starts a generation, workflow, or evaluation run. Context assembly follows privacy settings:

- Recent summaries can be included by default.
- Full recent chapters are excluded unless enabled.
- Prompt preview is hidden unless enabled.
- Renderer prompt previews are redacted and never include API keys.

## Backups And Exports

Backups and project packages may contain manuscripts and story bible facts. They do not include decrypted API keys, encrypted credential payloads, or provider credential rows. Users should still treat backups as private writing documents because they contain creative work.

## Logs

The structured main-process logger rotates local logs and redacts secrets before writing. Debug logging is opt-in and still goes through redaction. Manuscript logging remains off by default and should be enabled only for short local troubleshooting sessions.

## Real Provider Connectivity Checks

Real provider connectivity checks are local developer/user checks. They use Settings -> Providers for normal app use, or `.env.local` only when explicitly opted in with `RUN_REAL_PROVIDER_CHECKS=true`; `.env.local` is gitignored and should never be shared.

Check prompts are intentionally tiny and ask for a small JSON pong response. They still create `llm_runs`, but default privacy settings store hashes, token/cost fields, status, and safe errors rather than full prompt or response text.

Provider check and E2E chapter check reports are redacted Markdown files under ignored `reports/`. They should not contain API keys, Authorization headers, decrypted credentials, encrypted secret blobs, full prompts, full responses, or full manuscripts.

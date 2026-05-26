# Real Provider Setup

WenForge Studio supports real provider connectivity checks, but they are optional, local, user-confirmed, and cost capped. Keep keys local, encrypted, and out of source control.

## Normal App Use

Use Settings -> Providers to save API keys. The renderer sends the key once through typed IPC, and the Electron main process encrypts it with `safeStorage`. After saving, the renderer sees only provider metadata and a redacted key label.

Do not paste API keys into source files, docs, screenshots, issues, reports, or chat.

## Local Developer Env

`.env.local` is only for local developer convenience. It is gitignored. Start from `.env.example` and fill only the providers you want to check:

```bash
cp .env.example .env.local
```

Real provider checks run only when this flag is set outside CI:

```bash
RUN_REAL_PROVIDER_CHECKS=true pnpm providers:check
```

The provider check runner enforces:

- no execution in CI
- global budget cap from `REAL_PROVIDER_CHECK_BUDGET_USD`, default `$2`
- tiny JSON prompt with no private manuscript data
- `maxOutputTokens <= 80`
- `temperature = 0`
- `llm_runs` creation through the normal main-process gateway
- prompt/response hashes instead of full prompt/response text

Provider model names can be overridden locally with untracked variables such as `OPENAI_SMOKE_MODEL` or `DEEPSEEK_SMOKE_MODEL` if a default check model is unavailable. Do not commit local model overrides containing private data.

## Import Local Env Keys

For developer convenience only:

```bash
pnpm dev:import-env-credentials -- --confirm-import-local-secrets
```

This command:

- reads `.env.local`
- refuses to run in CI
- requires the explicit confirmation flag
- encrypts secrets with Electron `safeStorage`
- writes to the local app SQLite DB under Electron `userData`
- prints only provider names and redacted key labels

Run the app once before importing so the local DB schema exists.

## Provider Check Reports

Run checks and write a redacted local report:

```bash
RUN_REAL_PROVIDER_CHECKS=true pnpm providers:check
```

Reports are written under `reports/provider-checks/YYYY-MM-DD-HH-mm.md`, and `reports/` is gitignored. Each report includes provider/model status, streaming support, usage availability, latency, estimated/final cost, `llm_run_id`, and a confirmation that sensitive values were omitted.

Summarize the latest redacted provider check report:

```bash
pnpm providers:report
```

Reports must not contain raw API keys, Authorization headers, decrypted credential values, full prompts, full responses, full manuscripts, encrypted credential blobs, or sensitive local paths.

## Usage Calibration

Real provider checks and normal generation can improve future estimates when providers return token usage. WenForge stores only provider/model calibration factors, sample counts, error metrics, timestamps, run metadata, and hashes by default.

Calibration does not require additional provider calls. It never changes already reported final costs unless a future explicit recalculation tool is added and confirmed by the user.

Prices and tiers remain editable. Confirm current provider prices in the provider console before relying on forecasts, especially for regional or deployment-mode pricing.

## Real Model Evaluation

Phase 15e adds optional provider-backed model evaluation for WenForge routing. It uses the same opt-in guard as provider checks:

- `RUN_REAL_PROVIDER_CHECKS=true`
- not running in CI
- explicit UI confirmation
- positive budget cap

Eval outputs are evaluation artifacts only. They do not update canonical manuscripts, story bible facts, memory chunks, or route presets unless the user separately confirms applying a recommendation.

## E2E Chapter Connectivity Check

The optional short chapter check validates the provider-backed chapter workflow without changing canon:

```bash
RUN_REAL_PROVIDER_CHECKS=true REAL_E2E_CHECK_BUDGET_USD=3 pnpm e2e:provider-chapter-check
```

It runs a tiny demo chapter workflow, creates normal `llm_runs`, saves generated text as a non-canonical version, creates settlement proposals, and stops before any canonical manuscript or story bible mutation.

Reports are written under `reports/e2e-provider-checks/YYYY-MM-DD-HH-mm.md`.

## Disable Real Checks

Unset `RUN_REAL_PROVIDER_CHECKS` or set it to `false`. Automated tests and CI use fake providers by default and never require real provider keys.

## Rotate Or Remove A Key

1. Revoke the exposed or old key in the provider dashboard.
2. Create a new key.
3. Save the new key in Settings -> Providers.
4. Delete the old credential record.
5. Remove the old key from `.env.local`, shell history, local logs, screenshots, and reports.
6. If a key reached git history or chat, treat it as permanently compromised.

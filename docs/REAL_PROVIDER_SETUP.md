# Real Provider Setup

WenForge Studio supports real provider bring-up, but real calls are opt-in and cost money. Keep keys local, encrypted, and out of source control.

## Normal App Use

Use Settings -> Providers to save API keys. The renderer sends the key once through typed IPC, and the Electron main process encrypts it with `safeStorage`. After saving, the renderer sees only provider metadata and a redacted key label.

Do not paste API keys into source files, docs, screenshots, issue reports, or chat.

## Local Developer Smoke Tests

`.env.local` is only for opt-in local smoke tests. It is gitignored. Start from `.env.example` and fill only the providers you want to test:

```bash
cp .env.example .env.local
```

Real smoke calls run only when this flag is set:

```bash
RUN_REAL_PROVIDER_TESTS=true pnpm providers:smoke
```

The smoke runner enforces:

- no execution in CI
- global budget cap from `REAL_PROVIDER_TEST_BUDGET_USD`, default `$2`
- tiny JSON prompt
- `maxOutputTokens <= 80`
- `temperature = 0`
- `llm_runs` creation through the main-process gateway classes
- prompt/response hashes instead of full prompt/response text

Provider model names can be overridden locally with untracked variables such as `OPENAI_SMOKE_MODEL` or `DEEPSEEK_SMOKE_MODEL` if the default smoke model is unavailable. Do not add local model overrides containing secrets to committed files.

## Import Local Env Keys Into Encrypted App Storage

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

## Provider Conformance Report

Generate a redacted report:

```bash
pnpm providers:report
```

Reports are written under `reports/provider-conformance/YYYY-MM-DD-HH-mm.md`, and `reports/` is gitignored. The command does not run real providers unless `RUN_REAL_PROVIDER_TESTS=true` is present outside CI.

To write a sanitized documentation sample:

```bash
pnpm providers:report -- --write-doc-sample
```

The report contains provider status, configured/tested flags, streaming support, usage parsing, final cost computation, fallback eligibility, and redacted errors.

## If A Key Is Exposed

1. Revoke the exposed key in the provider dashboard immediately.
2. Create a new key.
3. Save the new key in WenForge Settings -> Providers.
4. Delete the old credential record.
5. Remove the exposed key from local shell history, logs, screenshots, and `.env.local`.
6. If the key reached git history, treat it as permanently compromised even after deletion.

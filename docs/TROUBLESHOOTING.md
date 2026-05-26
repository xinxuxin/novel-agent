# Troubleshooting

## Open Diagnostics

Use Settings -> Advanced -> Copy Diagnostics Bundle to copy a redacted JSON snapshot. The bundle includes app version, platform, DB migration version, safeStorage availability, provider health, recent redacted logs, and non-secret settings.

Do not paste manuscripts or API keys into issues. The diagnostic bundle is designed to exclude them by default.

## Common Errors

### Provider Authentication Failed

The saved credential was rejected or is missing required permissions.

- Re-save the provider key in Settings -> Providers.
- Confirm the provider profile and base URL are correct.
- Check that no route is pointing at an unavailable provider.

### Provider Rate Limit

The provider returned a rate-limit response.

- Retry later.
- Use a fallback route.
- Lower concurrent generation/evaluation work.
- Prefer mock mode for local workflow testing.

### Provider Smoke Test Skipped

Real provider smoke tests are opt-in.

- Set `RUN_REAL_PROVIDER_TESTS=true` for CLI smoke tests.
- Do not set it in CI.
- Confirm `.env.local` exists for local CLI tests.
- In the app UI, save an encrypted credential and confirm the smoke-test warning.

### Provider Not Implemented

Some provider-specific adapters are still intentionally stubbed.

- Anthropic and Gemini currently return `provider_not_implemented`.
- Use OpenAI-compatible providers where supported.
- Do not add guessed endpoints; implement provider-specific adapters only with reliable docs/tests.

### Context Length Exceeded

The selected model could not fit the assembled context.

- Lower recent chapter count.
- Disable full recent chapter inclusion.
- Reduce target token budget.
- Pick a longer-context model route.

### Invalid Structured JSON

A workflow node expected JSON and the provider returned malformed content.

- Retry once with JSON repair when offered.
- Use a model with stronger structured-output behavior.
- Inspect prompt preview only if privacy settings allow it.

### Budget Exceeded

The configured budget policy paused or blocked a run.

- Review the preflight estimate.
- Increase the relevant cap.
- Switch to a lower-cost route.
- Resume only if the warning is expected.

### Secret Encryption Unavailable

Electron `safeStorage` is unavailable in the current environment.

- Do not store provider keys in plaintext.
- Use mock mode until OS keychain support is available.
- On packaged builds, confirm the app is running in a normal user session.

### DB Migration Error

The local SQLite schema could not migrate.

- Create a backup before retrying.
- Use the diagnostic bundle to capture the migration version.
- Restore from a known-good backup if local data is damaged.

### Import Or Export Validation Error

An imported file failed schema, extension, path, or package validation.

- Confirm the file is a WenForge package or supported Markdown/TXT/JSON export.
- Avoid editing `.wenforge.zip` internals manually.
- Check that package paths do not contain `..` or absolute paths.

## Development Checks

Run the local verification set before sharing changes:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm providers:report
```

`pnpm test:smoke` launches the built Electron output and should be run after `pnpm build` when checking the desktop shell manually.

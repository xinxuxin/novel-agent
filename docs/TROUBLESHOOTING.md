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

### Provider Connectivity Check Skipped

Real provider connectivity checks are opt-in.

- Set `RUN_REAL_PROVIDER_CHECKS=true` for CLI provider checks.
- Do not set it in CI.
- Confirm `.env.local` exists for local CLI tests.
- In the app UI, save an encrypted credential and confirm the provider-check warning.

### Provider Connectivity Or Model List Fails

Provider checks use the encrypted credential, the configured base URL, and the model IDs returned by the provider model-list endpoint when available.

- Refresh the model list after saving a key.
- Choose a listed generation model instead of an editable placeholder alias.
- For custom endpoints, verify the base URL points to the provider API root.
- Do not add guessed endpoints; provider-specific adapters should follow reliable provider docs and tests.

### Anthropic Temperature Deprecated

Some Claude models reject sampling parameters and may return an error such as `temperature is deprecated for this model`.

WenForge Phase 18 normalizes Anthropic requests through the model profile:

- Claude Opus 4.7 omits `temperature`, `top_p`, and `top_k`.
- Creative or deterministic intent is expressed through prompt instruction.
- The output limit is sent as `max_tokens`.

If the error persists, open Settings -> Models, confirm the model endpoint family is `anthropic_messages`, then reset capabilities to known defaults.

### OpenAI Unsupported max_tokens

Newer OpenAI models may reject `max_tokens` and ask for `max_completion_tokens` or `max_output_tokens`.

WenForge Phase 18 chooses the output field from the editable model profile:

- Chat Completions GPT-5.x profiles send `max_completion_tokens`.
- Responses API profiles send `max_output_tokens`.
- WenForge never sends `max_tokens` and `max_completion_tokens` together.

If a provider rejects a known parameter before streaming starts, WenForge records the failed attempt, removes the rejected parameter, retries once, and shows a safe compatibility message.

### Reset Learned Model Capabilities

If a model profile was edited incorrectly or learned a bad capability from an error:

- open Settings -> Models
- select the affected provider/model profile
- review endpoint family and max output parameter name
- reset capabilities to known defaults
- rerun a tiny provider connectivity check with a budget cap

Do not paste API keys into support tickets or logs.

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
pnpm providers:check
pnpm providers:report
```

`pnpm test:smoke` launches the built Electron output and should be run after `pnpm build` when checking the desktop shell manually.

### Candidate Draft Compare Has Missing Models

The Candidates tab uses editable model aliases such as Qwen3.7-Max, Kimi K2.6, DeepSeek V4 Pro, Claude Opus 4.7, and GPT-5.5.

- Open Settings > Models and confirm each alias points to the provider model ID available in your account.
- Open Settings > Providers and confirm the provider credential is configured.
- Open Settings > Costs and confirm an active price row exists, or allow missing-price warnings according to the budget policy.
- Use Mock mode to test UI behavior without real provider calls.

### Fusion Button Is Disabled

Fusion requires a base candidate.

- Generate or load a candidate group.
- Click Use as Base on one candidate.
- Optionally add reference candidates.
- Enter a fusion instruction or use the default behavior.

# Release Checklist

## Before Packaging

- [ ] Confirm `references/repos/` exists only for local research and is ignored by git.
- [ ] Confirm no reference source code, prompt text, branding, screenshots, or proprietary assets are copied into app source.
- [ ] Run `pnpm lint`.
- [ ] Run `pnpm typecheck`.
- [ ] Run `pnpm test`.
- [ ] Run `pnpm build`.
- [ ] Run `pnpm release:dry-run`.
- [ ] Launch the packaged/unpacked app and verify the studio shell opens.

## Security

- [ ] Confirm `nodeIntegration: false`.
- [ ] Confirm `contextIsolation: true`.
- [ ] Confirm `sandbox: true` where compatible.
- [ ] Confirm `webSecurity: true`.
- [ ] Confirm CSP is applied through headers and renderer HTML.
- [ ] Confirm preload exposes only typed, narrow APIs.
- [ ] Confirm renderer has no direct DB, main-process, security, or provider imports.
- [ ] Confirm renderer has no direct provider `fetch` calls.
- [ ] Confirm exported diagnostic bundles contain no API keys, Authorization headers, encrypted secret payloads, prompts, or manuscripts by default.
- [ ] Confirm `.env.local`, `.env.*.local`, local key files, and `reports/` are ignored.
- [ ] Confirm CI does not run `pnpm providers:smoke` or set `RUN_REAL_PROVIDER_TESTS=true`.

## Data

- [ ] Create a manual backup.
- [ ] Restore a backup in a disposable profile.
- [ ] Export a project package and inspect that credentials are excluded.
- [ ] Import a project package in a disposable profile.
- [ ] Export cost CSV and confirm redaction.

## Product Smoke

- [ ] First-launch onboarding completes with mock mode.
- [ ] Project/book/chapter creation works.
- [ ] Manuscript version save and canonical confirmation work.
- [ ] Story bible CRUD works.
- [ ] Mock chapter workflow pauses at the human gate.
- [ ] Review quality gate blocks canonical approval when blocking findings exist.
- [ ] Cost dashboard opens.
- [ ] Settings Advanced can copy a redacted diagnostics bundle.
- [ ] Settings Providers can run a confirmed tiny smoke test for configured providers.
- [ ] `pnpm providers:report` writes a redacted report under ignored `reports/`.

## Distribution

- [ ] Replace placeholder icons.
- [ ] Review `THIRD_PARTY_NOTICES.md`.
- [ ] Prepare release notes.
- [ ] Generate checksums.
- [ ] Complete platform signing/notarization if distributing publicly.

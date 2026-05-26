# Security Model

## Core Principles

WenForge Studio is local-first, but local-first is not automatically safe. The app stores valuable manuscripts and provider credentials, so the renderer must be treated as untrusted and the main process must be the privileged boundary.

## Electron Defaults

Required `BrowserWindow` defaults:

- `nodeIntegration: false`
- `contextIsolation: true`
- `sandbox: true` where compatible
- `webSecurity: true`
- no remote module
- preload bridge only

Navigation should be locked down. The app should not allow arbitrary external navigation inside privileged windows. External links should open in the system browser after validation.

## Credential Storage

Provider credentials are stored encrypted:

1. Main process receives credential input through typed IPC.
2. Main process validates provider type, display name, and optional base URL.
3. Main process encrypts the secret with Electron `safeStorage` when available.
4. The DB stores only encrypted bytes/base64, provider metadata, and redacted display fragments.
5. Renderer receives only credential status and redacted labels.

If `safeStorage` is unavailable, use an OS keychain adapter only after showing the degraded path in settings. Plaintext fallback is not acceptable for production.

## Provider Calls

The renderer never calls model provider APIs. It sends a generation request by project/chapter/task IDs. The main process resolves:

- task route
- provider profile
- encrypted credential
- cost price record
- logging policy
- prompt assembly

The renderer receives streamed text deltas, status events, safe errors, and cost estimates.

## Logging

Default logs must omit:

- full API keys
- Authorization headers
- full prompts
- full manuscript text
- full provider responses

Store hashes for prompt and response by default. Add a user setting to opt into manuscript logging for debugging; keep it off by default.

## Content Safety

- Do not inject untrusted HTML.
- Sanitize rendered markdown if any third-party markdown renderer is used.
- Treat imported files as untrusted input.
- Validate file paths and keep writes inside user-approved project storage.
- Add path traversal tests for import/export and project file operations.

## IPC Safety

IPC endpoints should be allowlisted, typed, and validated. Avoid generic `invoke(command, payload)` APIs that allow arbitrary privileged actions. Each endpoint should have:

- Zod request schema
- Zod response schema
- permission and existence checks
- safe error mapping
- tests for invalid payloads

Phase 1 implements this pattern with explicit IPC contracts for app metadata, window controls, theme settings, studio mode toggling, and diagnostics. Phase 2 extends the same pattern to local data repositories. Phase 3 extends it again to credentials, model profiles, pricing, routing, privacy, and routing settings. The preload bridge unwraps safe envelopes and does not expose a generic IPC method to the renderer.

## Phase 3 Credential Implementation

Phase 3 adds the first credential path:

- `SecretEncryptionService` wraps Electron `safeStorage`.
- Encryption and decryption are main-process only.
- If `safeStorage.isEncryptionAvailable()` is false, saving a secret fails instead of falling back to plaintext.
- `ProviderCredentialRepository` stores `encrypted_secret_base64`, provider metadata, status fields, and redacted labels only.
- `CredentialService` returns renderer DTOs with no decrypted secret and no encrypted byte payload.
- `credentials.testConnection` performs a configuration/status check only. It does not send a test prompt and does not invent provider-specific probe endpoints.
- `RedactionService` scrubs Authorization headers, bearer tokens, API-key-like strings, and common secret assignment patterns before log output.

The renderer may collect an API key in a password field for save/update, but it never receives the stored secret back from the main process. Deletion still requires an explicit confirmation flag.

## Privacy Defaults

Phase 3 stores privacy settings in SQLite through typed IPC:

- `storeFullPrompts`: false
- `storeFullResponses`: false
- `storeManuscriptsInLogs`: false
- `allowPromptPreview`: false
- `allowSendingFullRecentChapters`: false
- `recentChapterCount`: 3
- `maxContextTokenBudget`: 120000
- `enableDebugLogging`: false

These defaults keep future provider runs from persisting complete prompts, responses, or manuscript text unless the user deliberately opts into a more verbose local logging mode. Prompt preview is also disabled by default; when enabled for local inspection, assembled prompts are redacted before reaching the renderer.

## Phase 4 AI Gateway

Phase 4 adds a main-process-only AI gateway:

- Renderer calls typed IPC endpoints and receives stream events only.
- Provider API calls happen in the main process through provider adapters.
- Decrypted credentials are read from `safeStorage` only inside the main process.
- `llm_runs` are created before the adapter is called.
- Full prompts and responses are not written to `llm_runs`; hashes are stored instead.
- Provider errors are normalized to safe `code` and `message` fields.
- Anthropic and Gemini remain explicit `not_implemented` stubs until reliable provider-specific adapters are added.

The Developer Test Generation panel can use the fake local provider without credentials. Real provider runs still require configured encrypted credentials.

## Phase 12 Import, Export, Backup, And Restore

Phase 12 keeps file portability in the main process:

- Import/export/backup services are exposed only through typed IPC contracts.
- Renderer code does not receive arbitrary filesystem read/write APIs.
- Project JSON and WenForge package imports are validated with Zod before records are created.
- Relative package paths are checked for traversal before import.
- Imported Markdown is sanitized before it becomes an imported manuscript version.
- Exports and backups exclude decrypted API keys, encrypted credential payloads, provider credential rows, and Authorization headers.
- Cost CSV and project cost payloads redact key-like strings before reaching the renderer.
- Restore requires explicit confirmation and creates a pre-restore backup before clearing local project data.

Backup files may contain manuscript text and story bible facts, so they should be protected like user documents even though they do not contain provider secrets.

## Phase 14 Hardening

Phase 14 adds explicit security and support surfaces:

- A response-header Content Security Policy forbids `unsafe-eval`, disallows objects/forms/frames, and documents the temporary `style-src 'unsafe-inline'` allowance needed by the current Vite/Tailwind renderer pipeline. Development builds additionally allow `script-src 'unsafe-inline'` only for the Vite React refresh preamble; production keeps scripts at `'self'`.
- Navigation validation allows HTTPS external links and local development HTTP endpoints only. Arbitrary `http:`, `file:`, and `javascript:` URLs are rejected.
- ESLint blocks renderer imports from main, DB, AI, agent, preload, and privileged security modules. Renderer files are also checked for direct `fetch` calls and unsafe HTML injection patterns.
- Main-process logging is structured, level-based, and redacted before write. Logs rotate locally and default to `info`.
- Operational errors are normalized into safe categories for provider auth, rate limits, context length, invalid JSON, network timeout, user abort, budgets, migrations, secret encryption, import/export validation, and workflow checkpoint recovery.
- The diagnostics bundle exports app version, platform, environment, DB migration version, `safeStorage` availability, provider health, redacted recent errors/logs, and non-secret settings. Manuscripts are excluded by default and API keys are never included.
- The app-wide renderer error boundary presents redacted error details and can copy a redacted diagnostic bundle.
- Electron Builder packaging excludes `references/**`, `references/repos/**`, source files, tests, docs, and test results. Runtime DBs, backups, logs, and secrets stay under Electron `userData` and are not bundled into installers.

Production release still requires platform signing, notarization, final icons, and a dependency notice review before public distribution.

## Phase 15a Real Provider Bring-Up

Real-provider validation is opt-in:

- `.env.local`, `.env.*.local`, credential-like key files, and `reports/` are ignored by git.
- `.env.example` contains empty placeholders only.
- `pnpm providers:smoke` skips real providers unless `RUN_REAL_PROVIDER_TESTS=true` is set outside CI.
- `pnpm dev:import-env-credentials` refuses to run without `--confirm-import-local-secrets` and refuses to run in CI.
- Local env credential import writes encrypted secrets through Electron `safeStorage` and prints only redacted labels.
- Settings -> Providers smoke tests require confirmation before making a real API call.
- Smoke calls use tiny prompts, `temperature = 0`, `maxOutputTokens <= 80`, and a small per-call budget cap.
- Provider conformance reports redact Authorization headers, API-key-like strings, and provider errors before writing under ignored `reports/`.

Automated tests continue to use fake providers only.

## Phase 15c Provider Connectivity Diagnostics

Phase 15c reframes real-provider validation as ordinary desktop-app configuration QA:

- `RUN_REAL_PROVIDER_CHECKS=true` is required for CLI provider checks and E2E chapter checks; CI always skips them.
- `pnpm providers:check` uses tiny prompts, `temperature = 0`, `maxOutputTokens <= 80`, and `REAL_PROVIDER_CHECK_BUDGET_USD` with a default `$2` cap.
- Settings -> Providers requires user confirmation before any real provider connection check.
- Every provider check goes through the main-process AI gateway and creates normal `llm_runs`.
- Reports under `reports/provider-checks/` and `reports/e2e-provider-checks/` are redacted before writing.
- Diagnostics now include provider check summaries and cost summaries, but omit raw keys, decrypted credentials, encrypted credential blobs, full prompts, full responses, and manuscripts by default.
- The short provider chapter check saves generated output as non-canonical and only creates settlement proposals; it does not mutate canonical manuscripts or story bible records.

This phase does not add penetration testing, vulnerability scanning, network exploration, credential collection, or checks against systems not configured by the user.

## Phase 15b Multi-Model Safety

Premium Webnovel cross-checks do not change the provider security boundary:

- renderer requests a cross-check through typed IPC only
- provider credentials are checked and decrypted only in the main process by existing services
- every provider call goes through the AI gateway and creates an `llm_runs` record
- prompts and responses are hash-logged by default, not stored as full text in `llm_runs`
- cross-check artifacts are proposals and cannot overwrite canonical manuscript or story bible data
- budget caps are checked before parallel provider calls begin

Automated coverage uses fake or recording adapters only; real provider calls remain opt-in.

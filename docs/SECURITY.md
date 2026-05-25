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

Phase 1 implements this pattern with explicit IPC contracts for app metadata, window controls, theme settings, studio mode toggling, and diagnostics. The preload bridge unwraps safe envelopes and does not expose a generic IPC method to the renderer.

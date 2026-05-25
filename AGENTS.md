# WenForge Studio Agent Guide

## Product Mission

WenForge Studio is a production-quality, local-first Electron desktop app for Chinese web novel planning, generation, editing, review, and continuity management. The app should feel like a focused command center for fiction work: fast, private, transparent about model behavior, and safe with user manuscripts and API keys.

## Strategy And Phase Boundary

WenForge Studio uses Strategy D: build a fresh Electron + React + TypeScript app from scratch, keep LangGraph.js as a possible future dependency, and extract writing methodology into original WenForge-native skills and prompts.

Reference repositories live under `references/repos/` and must remain ignored by Git. They are reference-only unless a future task explicitly approves permissively licensed reuse and notice updates. Do not copy source code, prompt text, UI components, images, branding, or distinctive interaction copy from reference repositories.

## Technical Direction

- Electron + electron-vite for the desktop shell.
- React + TypeScript for renderer UI.
- Tailwind CSS with shadcn/ui or Radix primitives where useful.
- Motion or Framer Motion for subtle streaming and activity animation.
- Zustand for lightweight UI state.
- TanStack Query only where async local API state benefits from caching and invalidation.
- SQLite via `better-sqlite3`.
- Drizzle ORM for schema and migrations.
- Zod for runtime validation at IPC, settings, provider, and workflow boundaries.
- TipTap or another ProseMirror-based editor for manuscript editing.
- Monaco only for JSON, YAML, and prompt editing panes.
- LangGraph.js for durable, stateful agent workflows.
- SQLite FTS5 first for memory retrieval; vector memory can come later.

## Security Rules

- Never hardcode API keys.
- Never store API keys in plaintext.
- Use Electron `safeStorage` in the main process for local secret encryption when available.
- If `safeStorage` is unavailable, fall back to an explicit OS keychain adapter such as keytar and clearly surface degraded behavior.
- The renderer must never directly call model provider APIs.
- The renderer must never receive decrypted API keys.
- All provider calls must go through a narrow, typed IPC bridge into the main process.
- Electron renderer must run with `nodeIntegration: false`, `contextIsolation: true`, `sandbox: true` where compatible, and a preload `contextBridge`.
- Disable remote module usage.
- Do not expose a generic privileged `invoke(command, payload)` endpoint.
- Every IPC endpoint needs a channel constant, Zod request schema, Zod response schema, and safe error mapping.
- External navigation must be blocked inside the app window; validated external HTTP(S) links open in the system browser.
- Do not inject untrusted HTML. Sanitize any rendered markdown or rich text.
- Do not log full API keys, provider secrets, or complete prompts by default.
- Add and honor a user setting that disables manuscript logging in LLM run records.

## Data And Workflow Rules

- Destructive updates require explicit confirmation.
- Generated chapters, audits, rewrites, and state-settlement updates are drafts until accepted by the user.
- Canonical manuscripts must be versioned and rollbackable.
- Story bible edits must preserve provenance: manual, generated, imported, or settled from a run.
- Every LLM request must create an `llm_run` record with token usage, status, timing, hashes, and cost data.
- Streaming generation should update live output and live cost estimates without exposing secrets to the renderer.

## Coding Conventions

- Prefer small modules with clear ownership boundaries.
- Keep main-process provider, secret, database, and filesystem code out of the renderer.
- Validate all IPC payloads with Zod before use.
- Keep DB access in the Electron main process or a controlled main-side worker; renderer code must not import DB modules.
- Use typed domain objects for workflow state, route presets, prices, and manuscript versions.
- Prefer structured parsing and structured model outputs where possible.
- Avoid broad refactors while implementing focused features.
- Add comments only when they explain non-obvious invariants or security choices.

## Test Requirements

The app should eventually support:

- `pnpm install`
- `pnpm dev`
- `pnpm test`
- `pnpm lint`
- `pnpm typecheck`

Before any feature is called complete, run the narrowest meaningful checks first, then broaden checks when shared contracts, workflows, provider adapters, or persistence are affected. Security-sensitive changes need unit tests around validation, IPC allowlists, secret handling, and logging redaction.

For each implementation phase, verify with the required commands, commit with the phase message, and push `main` to GitHub after the phase commit.

## Reference Repository Policy

- AGPL/GPL code is architecture-only unless the user explicitly accepts the license obligations.
- MIT and Apache-2.0 code can be considered for reuse only with attribution and notices.
- Repos with no clear license are reference-only.
- UI branding, logos, proprietary names, and distinctive assets must not be copied.
- Prompt text should be rewritten into WenForge-native prompts unless license and attribution are explicitly approved.
- No prompt-copying is allowed from reference repositories without explicit license approval and notice updates.

# WenForge Studio Roadmap

## Strategy

WenForge Studio will use Strategy D from the fusion plan:

- Build the Electron + React app from scratch.
- Use LangGraph.js as a normal MIT dependency for workflow orchestration instead of vendoring reference source.
- Reuse only independently rewritten ideas from permissive MIT/Apache-2.0 references unless a future task explicitly approves code adaptation and notice updates.
- Treat AGPL/GPL and no-license repositories as architecture-only/reference-only.
- Extract writing methodology into a WenForge-native skill and prompt package with original text.

## Phase 0: Strategy Lock And License Hygiene

- Keep `references/repos/` ignored and out of shipped app artifacts.
- Record all inspected repositories in `THIRD_PARTY_NOTICES.md`.
- Mark `inkos`, `story-writing`, `chinese-novelist-skill`, and OpenAI/Codex UI identity as non-copyable sources.
- Permit future dependency usage of LangGraph.js and other normal npm packages through package manifests.
- Require a notice update before any MIT/Apache-2.0 source or substantial prompt structure is copied or closely adapted.

## Phase 1: Secure App Skeleton (Complete)

- [x] Scaffold Electron + electron-vite + React + TypeScript from scratch.
- [x] Add Tailwind CSS, Radix Dialog primitives, Framer Motion, Zustand, Zod, Vitest, ESLint, Prettier, strict typecheck, and Playwright Electron smoke test scripts.
- [x] Configure Electron with `nodeIntegration: false`, `contextIsolation: true`, `sandbox: true`, `webSecurity: true`, a narrow preload bridge, frameless popover-style window, and locked navigation defaults.
- [x] Add typed IPC contracts with channel constants, Zod request/response schemas, and safe error mapping.
- [x] Expose only `app.getVersion()`, `app.getPlatform()`, `app.getEnvironment()`, `window.minimize()`, `window.close()`, `window.toggleStudioMode()`, `settings.getTheme()`, `settings.setTheme()`, and `diagnostics.ping()` through preload.
- [x] Add a dark command-center shell with left project sidebar, center chapter workspace, right inspector, command bar, command palette placeholder, and status/cost bar placeholder.
- [x] Add remembered window bounds, internal compact/expanded layout mode, and tray placeholder behavior.
- [x] Establish acceptance commands: `pnpm install`, `pnpm dev`, `pnpm test`, `pnpm lint`, `pnpm typecheck`, `pnpm build`, and `pnpm test:smoke`.

Deferred from the broader product stack: shadcn component generation, TanStack Query, TipTap, Monaco, LangGraph.js, provider adapters, credentials, and persistence features are added only when their phase needs them.

## Phase 2: Local Data Foundation

- Add SQLite with `better-sqlite3`, Drizzle schema definitions, and migrations.
- Implement repositories for projects, books, volumes, chapters, scenes, manuscript versions, app settings, and story bible records.
- Add rollbackable manuscript versioning before any AI overwrite feature exists.
- Add SQLite FTS5 memory chunks for keyword retrieval across summaries, story bible entries, and approved manuscript context.
- Add fixtures and tests for schema creation, migrations, version rollback, and FTS search.

## Phase 3: Credentials, Providers, Router, And Cost

- Store provider credentials encrypted in the Electron main process using `safeStorage`, with no plaintext fallback.
- Build provider adapters in the main process for OpenAI, Anthropic, Gemini, DeepSeek, OpenAI-compatible endpoints, OpenRouter, DashScope/Qwen, Moonshot/Kimi, and xAI.
- Add model profiles, task model routes, provider health checks, and editable route settings.
- Add price registry and `llm_runs` records before enabling real generation.
- Track live estimated cost during streaming and reconcile final cost from provider usage when available.

## Phase 4: Studio UI Shell

- Build the first usable studio screen instead of a marketing page.
- Add top command bar, left project tree, center chapter workspace, and right story/cost/model panel.
- Add popover launcher mode that expands into full studio mode.
- Integrate TipTap for manuscript editing and diff/review surfaces for generated drafts.
- Add model route, credential status, logging settings, and cost meter views without exposing decrypted secrets.

## Phase 5: LangGraph Workflow MVP

- Add LangGraph.js workflow runtime in the main process or a controlled worker.
- Implement a chapter workflow skeleton with mock provider nodes first: prepare context, outline, scene cards, draft, continuity audit, rhythm audit, revise, human gate, and settlement proposal.
- Persist workflow checkpoints, generated artifacts, streamed chunks, and status events.
- Add cancellation and resume from safe checkpoints.
- Connect real provider adapters only after mock workflow tests pass.

## Phase 6: WenForge Skill And Prompt Package

- Create original WenForge prompt templates for project discovery, outline, scene cards, drafting, audit, rewrite, and state settlement.
- Encode progressive questioning, reader positioning, genre expectations, hook checks, and validation/repair as WenForge-native methodology.
- Do not copy prompt text from AGPL or no-license references.
- Add prompt assembly tests that verify required context, logging redaction, task route usage, and structured output expectations.

## Phase 7: Review, Continuity, And Human Gates

- Add review cards for continuity, rhythm, AI-ish phrasing, cliches, and unresolved hooks.
- Add non-destructive rewrite proposals with accept, reject, and selected-diff application.
- Add state-settlement review for chapter summaries, timeline events, character changes, relationship changes, foreshadowing, resolved hooks, unresolved hooks, and continuity risks.
- Require confirmation before destructive deletes, canonical manuscript overwrites, accepted memory changes, or route changes that affect active run cost.

## Phase 8: Import, Export, Backup, And Packaging Prep

- Add Markdown/TXT import with safe path handling and no untrusted HTML injection.
- Add project export, cost report export, backup, restore, and migration safety checks.
- Add first-run onboarding for provider setup, route defaults, and manuscript logging settings.
- Add electron-builder configuration only after local development commands are stable.

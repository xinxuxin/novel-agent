# WenForge Studio Implementation Checklist

## Phase 0: Strategy And License Hygiene

- [ ] Keep Strategy D as the implementation strategy: Electron + React from scratch, LangGraph.js as dependency, WenForge-native prompts.
- [ ] Keep `references/repos/` ignored and out of app packaging.
- [ ] Review `THIRD_PARTY_NOTICES.md` before any third-party source or prompt adaptation.
- [ ] Treat AGPL/GPL and no-license references as non-copyable.

## Phase 1: Secure App Skeleton

- [x] Scaffold Electron + electron-vite + React + TypeScript.
- [x] Add Tailwind CSS, Radix-compatible primitives, Motion, Zustand, Zod, Vitest, ESLint, and typecheck scripts.
- [x] Configure Electron with no Node integration, context isolation, sandbox, preload bridge, and locked navigation.
- [x] Add typed IPC contract pattern with Zod validation and safe error envelopes.
- [x] Make these commands available: `pnpm install`, `pnpm dev`, `pnpm test`, `pnpm lint`, `pnpm typecheck`.

## Phase 2: Local Data Foundation

- [x] Add SQLite, `better-sqlite3`, Drizzle schema, and migrations.
- [x] Implement project, book, volume, chapter, scene, and manuscript version repositories.
- [x] Add story bible and memory tables.
- [x] Add SQLite FTS5 indexing for memory retrieval.
- [x] Test migrations, CRUD, rollback, and FTS search.

## Phase 3: Providers, Credentials, Router, And Cost

- [x] Encrypt provider credentials in the main process with Electron `safeStorage`.
- [x] Ensure renderer never receives decrypted credentials or encrypted secret bytes.
- [x] Add provider configuration profiles for required providers and generic OpenAI-compatible endpoints.
- [x] Add model profiles and DB-backed task routes.
- [x] Add editable model price registry and `llm_runs` schema foundation.
- [x] Add redacted logging helpers and prompt/response hash fields.
- [x] Add Settings tabs for providers, models, pricing, routing, privacy, and advanced routing policy.
- [ ] Add real provider adapters and safe provider-specific health checks.
- [ ] Add live cost estimation and final usage reconciliation once streaming generation exists.

## Phase 4: Main-Process AI Gateway And Cost Accounting

- [x] Add main-process AI gateway with stream start/abort IPC.
- [x] Add fake provider, OpenAI-compatible adapter, and safe stubs where provider-specific implementation is deferred.
- [x] Create `llm_runs` before provider calls and update runs on success, error, and abort.
- [x] Add live token and cost events.
- [x] Store prompt/response hashes rather than full text by default.
- [x] Add developer test generation panel and status/cost bar updates.
- [x] Test parser, estimator, cost calculator, fake streaming, aborts, and run lifecycle.

## Phase 5: Studio UI And Chapter Workspace

- [x] Build full studio layout: command bar, project tree, chapter workspace, right context panel.
- [x] Build popover launcher and expand-to-studio flow.
- [x] Integrate TipTap manuscript editor.
- [x] Add manuscript stats, local draft autosave, save-version, and set-canonical confirmation.
- [x] Add generated draft placeholder, review/diff surfaces, version opening, set-canonical, and rollback-by-new-version controls.
- [x] Add story bible preview/manual entry creation, continuity warning, model route, recent runs, and cost meter panels.
- [x] Keep settings and manuscript logging controls available through the Settings workspace.
- [ ] Replace generation placeholders with workflow events.
- [ ] Add persisted review card accept/reject/apply actions.

## Phase 6: Workflow Runtime

- [ ] Add LangGraph.js workflow runtime without vendoring source.
- [ ] Implement mock chapter workflow nodes: prepare context, retrieve memory, outline, scene cards, draft, audits, revise, human gate, settlement.
- [ ] Persist workflow checkpoints, streamed chunks, generated artifacts, and status events.
- [ ] Add cancellation and resume behavior.
- [ ] Connect real provider calls through the main-process provider and cost layers.

## Phase 7: WenForge Skill And Prompt Package

- [ ] Write original WenForge prompt templates for all task presets.
- [ ] Add progressive project questioning and reader positioning.
- [ ] Add original genre, hook, rhythm, continuity, and rewrite rubrics.
- [ ] Add prompt assembly tests with redaction checks.
- [ ] Keep prompt versions tracked and editable.

## Phase 8: Review And Settlement

- [ ] Add continuity audit cards.
- [ ] Add webnovel rhythm audit cards.
- [ ] Add AI-ish phrasing and cliche review.
- [ ] Add non-destructive rewrite proposals.
- [ ] Add state-settlement proposals with provenance.
- [ ] Require human approval before canonical manuscript or story bible changes.

## Phase 9: Import, Export, Backup, And Packaging Prep

- [ ] Add Markdown/TXT import with path validation.
- [ ] Add project export and cost report export.
- [ ] Add backup and restore.
- [ ] Add first-run provider and route onboarding.
- [ ] Add packaging only after local commands are stable.

## Final MVP Acceptance

- [ ] `pnpm install` succeeds.
- [ ] `pnpm dev` starts the local desktop app.
- [ ] `pnpm test` passes.
- [ ] `pnpm lint` passes.
- [ ] `pnpm typecheck` passes.
- [ ] No reference source code or prompt text is copied without notice updates.

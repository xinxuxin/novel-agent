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

- [ ] Add SQLite, `better-sqlite3`, Drizzle schema, and migrations.
- [ ] Implement project, book, volume, chapter, scene, and manuscript version repositories.
- [ ] Add story bible and memory tables.
- [ ] Add SQLite FTS5 indexing for memory retrieval.
- [ ] Test migrations, CRUD, rollback, and FTS search.

## Phase 3: Providers, Credentials, Router, And Cost

- [ ] Encrypt provider credentials in the main process with Electron `safeStorage`.
- [ ] Ensure renderer never receives decrypted credentials.
- [ ] Add provider adapters for required providers and generic OpenAI-compatible endpoints.
- [ ] Add model profiles and DB-backed task routes.
- [ ] Add model price registry and `llm_runs`.
- [ ] Add live cost estimation and final usage reconciliation.
- [ ] Add redacted logging and prompt/response hashes.

## Phase 4: Studio UI

- [ ] Build full studio layout: command bar, project tree, chapter workspace, right context panel.
- [ ] Build popover launcher and expand-to-studio flow.
- [ ] Integrate TipTap manuscript editor.
- [ ] Add generated draft, review card, diff, accept/reject, and rollback surfaces.
- [ ] Add story bible, continuity warning, model route, and cost meter panels.
- [ ] Add provider settings and manuscript logging setting.

## Phase 5: Workflow Runtime

- [ ] Add LangGraph.js workflow runtime without vendoring source.
- [ ] Implement mock chapter workflow nodes: prepare context, retrieve memory, outline, scene cards, draft, audits, revise, human gate, settlement.
- [ ] Persist workflow checkpoints, streamed chunks, generated artifacts, and status events.
- [ ] Add cancellation and resume behavior.
- [ ] Connect real provider calls through the main-process provider and cost layers.

## Phase 6: WenForge Skill And Prompt Package

- [ ] Write original WenForge prompt templates for all task presets.
- [ ] Add progressive project questioning and reader positioning.
- [ ] Add original genre, hook, rhythm, continuity, and rewrite rubrics.
- [ ] Add prompt assembly tests with redaction checks.
- [ ] Keep prompt versions tracked and editable.

## Phase 7: Review And Settlement

- [ ] Add continuity audit cards.
- [ ] Add webnovel rhythm audit cards.
- [ ] Add AI-ish phrasing and cliche review.
- [ ] Add non-destructive rewrite proposals.
- [ ] Add state-settlement proposals with provenance.
- [ ] Require human approval before canonical manuscript or story bible changes.

## Phase 8: Import, Export, Backup, And Packaging Prep

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

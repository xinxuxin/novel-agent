# Universal Intake Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a chatbot-first Universal Intake workspace that turns arbitrary user material into editable, gated planning proposals.

**Architecture:** Reuse the existing planning repository, typed IPC bridge, and Planning Lab chapter-plan records. Add only minimal intake tables for sessions, messages, and artifacts; keep provider calls out of renderer and make renderer-side guided actions deterministic proposal builders until model-backed intake is wired through main process.

**Tech Stack:** Electron main process, SQLite/better-sqlite3, Zod IPC contracts, preload context bridge, React/TypeScript renderer, Vitest source and repository tests.

---

### Task 1: Intake Persistence And Contracts

**Files:**
- Modify: `src/main/db/migrate.ts`
- Modify: `src/main/db/schema.ts`
- Modify: `src/main/db/repositories/planning-repository.ts`
- Modify: `src/shared/contracts/planning.ts`
- Modify: `src/shared/ipc/contracts.ts`
- Modify: `src/shared/contracts/preload.ts`
- Modify: `src/preload/api.ts`
- Modify: `src/main/ipc/register.ts`
- Test: `tests/unit/phase18-planning-and-parameter-policy.test.ts`

- [ ] Add failing tests that create an intake session, add chat messages, create proposed/accepted/rejected artifacts, and verify accepted material digests can link to an intake session.
- [ ] Add SQLite tables `intake_sessions`, `intake_messages`, `intake_artifacts` and extend `material_digests` with `intake_session_id`, `missing_information_json`, `ambiguity_warnings_json`, `accepted_at`, and `updated_at`.
- [ ] Add repository methods for session creation, message appending, artifact creation, artifact status updates, and listing artifacts by session.
- [ ] Add typed contracts and preload APIs under `planning.intake`.
- [ ] Register main-process IPC handlers that use only local repositories and never expose credentials.

### Task 2: Universal Intake UI

**Files:**
- Create: `src/renderer/features/planning/UniversalIntake.tsx`
- Modify: `src/renderer/app/App.tsx`
- Test: `tests/unit/phase22-universal-intake-ui.test.ts`

- [ ] Add failing source-level UI tests for the `整理素材` workspace, chat history, structured panel artifact sections, proposal badges, and generation-gate copy.
- [ ] Build a two-column Universal Intake workspace: left chat, right structured artifacts.
- [ ] Implement guided action buttons: `整理素材`, `自动补全缺失设定`, `生成章节细纲`, `确认后开始写正文`.
- [ ] Store chat messages and generated structured artifacts via preload APIs.
- [ ] Keep AI-like output as proposals by default; accepting chapter-plan artifacts writes chapter plans only after user action.
- [ ] Add Home/top-nav access and Planning Lab handoff.

### Task 3: Prompts, Context, Docs, And Verification

**Files:**
- Modify: `skills/wenforge-webnovel-writer/skill.json`
- Create prompt templates in `skills/wenforge-webnovel-writer/prompts/`
- Modify: `src/main/context/context-builder.ts`
- Modify docs requested by phase spec
- Test: `tests/unit/skill-prompt-package.test.ts`
- Test: `tests/unit/story-bible-memory-context.test.ts`

- [ ] Add original Universal Intake prompt templates to the WenForge skill manifest.
- [ ] Include accepted material digests in context preview and exclude rejected intake artifacts from canonical context.
- [ ] Update docs for Universal Intake, gated proposals, provider check safety, and Kimi parameter handling.
- [ ] Run narrow tests, then `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build`.
- [ ] Commit with `phase 22: add universal intake chat and structured planning workspace` after all required commands pass.

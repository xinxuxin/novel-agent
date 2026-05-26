# Outline-Driven Multi-Agent Writing UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Make WenForge's main workflow clearly accept a detailed chapter outline and generate a final proposed manuscript through the existing multi-agent chapter graph.

**Architecture:** Add explicit outline fields to the shared workflow contract, thread them through the main-process chapter workflow state, and make mock/provider prompt assembly use that outline. Replace the Generate tab UI with an outline-first command surface and simplify the top-level navigation so the app reads like a writing command center rather than an admin dashboard.

**Tech Stack:** Electron main process, typed IPC/Zod contracts, React/TypeScript renderer, Vitest unit tests.

---

### Task 1: Workflow Contract And Runtime Outline Support

**Files:**
- Modify: `src/shared/contracts/workflow.ts`
- Modify: `src/main/workflows/chapter-workflow-runtime.ts`
- Test: `tests/unit/chapter-workflow-runtime.test.ts`

- [x] Add `sourceOutline`, `allowStoryChanges`, and `desiredOutput` to `chapterGenerationStartRequestSchema`.
- [x] Extend `ChapterWorkflowState` with those fields.
- [x] Use the source outline in mock outline, scene cards, draft, audit, revision, and settlement output so tests can prove the outline drives the generated artifacts.
- [x] Include source outline and permission-to-change instructions in provider prompt variables through `userInstruction`.
- [x] Add/adjust unit tests proving a detailed outline is accepted and appears in generated outline/draft artifacts while canon remains untouched.

### Task 2: Outline-First Generate UI

**Files:**
- Modify: `src/renderer/features/workflows/WorkflowGeneratePanel.tsx`
- Test: `tests/unit/phase16-outline-workflow-ui.test.ts`

- [x] Add a prominent text area labelled for detailed outline input.
- [x] Add controls for target output, story-change permission, execution mode, quality mode, and model override.
- [x] Rename the primary CTA to `Generate final manuscript from outline` and pass outline fields to `generation.chapter.start`.
- [x] Make generated revision/draft visually read as final proposed manuscript with save/set-canon human gate actions.
- [x] Add a static/component-oriented test that verifies the Generate panel source includes the outline-first labels and request fields.

### Task 3: Main Shell Declutter And Settings API-Key Clarity

**Files:**
- Modify: `src/renderer/app/App.tsx`
- Modify: `src/renderer/features/settings/SettingsPanel.tsx`
- Test: `tests/unit/phase16-shell-settings.test.ts`

- [x] Reduce the top nav to Studio, Generate, Settings, and More-style secondary actions.
- [x] Default active chapter tab to Generate so the first screen shows the outline workflow.
- [x] Add a settings intro section that clearly says API keys are entered in Providers and stored encrypted.
- [x] Add a static test checking the API-key copy is present and no plaintext-key wording is introduced.

### Task 4: Docs And Verification

**Files:**
- Modify: `docs/UI_SPEC.md`
- Modify: `docs/AI_WORKFLOWS.md`
- Modify: `docs/ROADMAP.md`

- [x] Document the new outline-driven workflow and expected user input.
- [x] Run `pnpm lint`, `pnpm typecheck`, and targeted tests.
- [x] Restart `pnpm dev` and capture the UI to verify the main workflow is readable and obvious.
- [x] Commit and push to `main`.

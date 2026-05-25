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

## Phase 2: Local Data Foundation (Complete)

- [x] Add SQLite with `better-sqlite3`, Drizzle schema definitions, startup migrations, and development DB scripts.
- [x] Store the runtime DB at `<userData>/data/wenforge.sqlite`.
- [x] Implement repositories for projects, books, volumes, chapters, manuscript versions, app settings, generated artifacts, story bible entries, memory, costs, and generation runs.
- [x] Add rollbackable manuscript versioning before any AI overwrite feature exists.
- [x] Add SQLite FTS5-backed search with fallback keyword retrieval across memory chunks and story bible entries.
- [x] Seed optional demo data for `演示：都市异能爽文`.
- [x] Wire the renderer project tree and canonical manuscript preview through typed IPC.
- [x] Add tests for migrations, CRUD, manuscript canonical switching, rollback, generated artifact non-canonical behavior, search fallback, and invalid IPC payload rejection.

## Phase 3: Credentials, Model Routing, And Pricing Registry (Complete)

- [x] Store provider credentials encrypted in the Electron main process using `safeStorage`, with no plaintext fallback.
- [x] Add `CredentialService`, `SecretEncryptionService`, `ProviderCredentialRepository`, and `RedactionService`.
- [x] Expose credential metadata through typed IPC without returning decrypted secrets or encrypted bytes to the renderer.
- [x] Add configurable provider profiles for OpenAI, Anthropic, Gemini, DeepSeek, DashScope/Qwen, Moonshot/Kimi, xAI, OpenRouter, and generic OpenAI-compatible providers.
- [x] Seed editable model profile placeholders for the requested Phase 3 model catalog without claiming metadata or prices are authoritative.
- [x] Add editable `model_prices`, stale price detection, and route warnings for missing/stale price rows.
- [x] Add task routes for all WenForge task presets across economy, balanced, and premium quality modes.
- [x] Add a model router skeleton that validates route availability, model profile status, credential presence, and price policy without making provider calls.
- [x] Add Settings tabs for Providers, Models, Pricing, Routing, Privacy, and Advanced.
- [x] Add tests for encryption behavior, no plaintext persistence, renderer DTO safety, redaction, cost formula, route resolution, stale price warnings, and invalid IPC payloads.

Deferred from Phase 3: real provider adapters, network health checks, streaming generation, token reconciliation, and live `llm_runs` updates. `credentials.testConnection` only verifies stored configuration unless a later provider adapter adds a safe probe.

## Phase 4: Main-Process AI Gateway And Cost Accounting (Complete)

- [x] Add shared AI contracts and Zod schemas for providers, messages, stream requests, events, usage, costs, run records, and provider errors.
- [x] Add a main-process AI gateway that creates `llm_runs` before provider calls.
- [x] Add deterministic fake provider streaming for tests and local developer checks.
- [x] Add OpenAI-compatible streaming adapter with SSE parsing and usage normalization.
- [x] Add OpenAI, DeepSeek, DashScope/Qwen, Moonshot/Kimi, xAI, OpenRouter, and generic OpenAI-compatible adapter defaults.
- [x] Add explicit `not_implemented` stubs for Anthropic and Gemini until reliable adapters are added.
- [x] Add token estimation for Chinese and non-CJK text.
- [x] Add live cost events and final cost reconciliation from provider-reported usage.
- [x] Keep prompt and response text out of run records by default while storing hashes.
- [x] Add AI IPC endpoints, preload APIs, developer test generation UI, and status/cost bar updates.
- [x] Add tests for streaming, SSE parsing, aborts, cost math, token estimation, run lifecycle, safe errors, and hash-only storage.

## Phase 5: Studio UI And Chapter Workspace (Complete)

- [x] Replace the placeholder first screen with the working studio shell rather than a landing page.
- [x] Add a top command bar with global command trigger, quick studio/settings navigation, active run status, session cost, and route health.
- [x] Add a keyboard-navigable command palette for project, book, volume, chapter, manuscript, generation placeholder, settings, and cost commands.
- [x] Add a DB-backed left sidebar with project switcher, book list, volume/chapter tree, status badges, quick create controls, chapter rename, status change, and reorder controls.
- [x] Add compact popover mode with recent chapters, quick actions, current run status, and expand-to-studio behavior.
- [x] Integrate TipTap for Chinese long-form manuscript editing with autosaved local working drafts, manuscript counts, estimated token counts, save-version flow, and set-canonical confirmation.
- [x] Add chapter workspace tabs for Manuscript, Generate, Review, Timeline, and Versions.
- [x] Add version history, open-version, set-canonical, rollback-by-new-version, and simple diff comparison surfaces.
- [x] Keep generated/proposed content visually distinct from canonical manuscript versions.
- [x] Add right-panel story bible preview/edit entry creation, continuity warning placeholder, cost meter, route card, recent run list, and settlement proposal placeholder.
- [x] Extend preload only for existing typed IPC endpoints needed by the UI; decrypted credentials remain unavailable to the renderer.

Deferred from Phase 5: real chapter workflow execution, accept/reject review-card persistence, state-settlement application, and provider-backed generation remain in later phases.

## Phase 6: Story Bible, Memory, And Context Builder (Complete)

- [x] Add canonical story bible CRUD for characters, factions, locations, artifacts/props, power-system rules, timeline events, foreshadowing, unresolved hooks, style guides, and reader positioning.
- [x] Keep generated facts as proposals by policy; Phase 6 story bible writes are user-saved canonical edits only.
- [x] Add confirmed destructive deletion for story bible records through typed IPC.
- [x] Add main-process `MemoryIndexService` with chunk upsert/delete/search and book rebuild operations.
- [x] Index accepted story bible records, canonical manuscripts, and chapter summaries into local memory.
- [x] Prefer SQLite FTS5 retrieval and fall back to keyword search when FTS is unavailable.
- [x] Add `ContextBuilder` in the main process with token-budget handling, privacy-aware recent chapter inclusion, redaction, omissions, and truncation notes.
- [x] Add a story bible workspace and chapter context preview panel to the renderer without exposing secrets or DB access.
- [x] Add tests for story bible CRUD, memory search/fallback, context budget behavior, privacy behavior, proposal exclusion, redaction, and Chinese token estimation.

Deferred from Phase 6: generated settlement proposal acceptance, workflow-created review cards, provider-backed context assembly, and vector embeddings remain later phases.

## Phase 7: WenForge Skill And Prompt Package (Complete)

- [x] Create original WenForge prompt templates for project discovery, reader positioning, story bible, volume outline, chapter outline, scene cards, drafting, continuity audit, webnovel rhythm audit, revision, state settlement, summary, and JSON repair.
- [x] Add `skills/wenforge-webnovel-writer/SKILL.md`, `README.md`, `skill.json`, versioned prompt files, JSON schemas, rubrics, examples, and a local eval fixture.
- [x] Encode progressive questioning, reader positioning, genre expectations, hook checks, continuity policy, revision, and validation/repair as WenForge-native methodology.
- [x] Keep all prompt and skill text original; no AGPL, GPL, no-license, proprietary, or distinctive reference prompt text is copied or closely translated.
- [x] Add `SkillLoader`, `PromptTemplateService`, and `PromptAssemblyService` for main-process skill loading and prompt assembly.
- [x] Add `allowPromptPreview` privacy setting, defaulted off, so prompt preview is shown only when explicitly allowed.
- [x] Add prompt assembly tests for manifest validation, prompt inventory, schema parsing, required context sections, redaction/privacy, fake-context snapshots, and original-text notice posture.

Deferred from Phase 7: workflow node execution, provider-backed generation, schema validation of model responses, prompt editing UI, and storing prompt metadata on generated artifacts.

## Phase 8: LangGraph Workflow MVP (Complete)

- [x] Add `@langchain/langgraph` as a normal dependency and use it for persisted main-process workflow segments.
- [x] Implement `chapter_generation_v1` with mock nodes for prepare context, memory retrieval, outline, scene cards, draft, continuity audit, rhythm audit, revision, human gate, settlement proposal, persistence, and finalization.
- [x] Persist workflow checkpoints, events, generated artifacts, review cards, settlement proposals, settlement proposal items, and fake-provider `llm_runs`.
- [x] Keep generated output non-canonical until the user accepts an artifact as a manuscript version.
- [x] Require separate confirmation before setting an accepted generated version as canonical.
- [x] Add workflow IPC and preload APIs without exposing DB, provider, or secret access to the renderer.
- [x] Replace the Generate placeholder with a workflow UI for run actions, timeline, artifacts, cost summary, and human-gate controls.
- [x] Add tests for deterministic mock workflow execution, checkpoint persistence, human-gate pause/resume, revision loop, cancellation, non-canonical artifact acceptance, explicit canonical confirmation, fake `llm_runs`, and typed payload validation.

Deferred from Phase 8: real provider-backed workflow nodes, live token streaming per graph node, selected-diff application, settlement proposal approval/application, and long-running worker isolation.

## Phase 9: Provider Routing, Fallback, And Budgets (Complete)

- [x] Connect chapter workflow model nodes to the main-process AI gateway while keeping explicit mock mode for tests and local demos.
- [x] Route provider calls through `ContextBuilder`, prompt assembly, `ModelRouter`, workflow cost wrapper, provider adapters, and `llm_runs`.
- [x] Add route preview with expected token estimates, fallback models, provider health, stale/missing price warnings, and optional run-level model override.
- [x] Add fallback and retry behavior for rate limits, transient provider failures, and one structured JSON repair attempt.
- [x] Stop immediately on auth, invalid-key, and permission errors without retrying or falling back.
- [x] Persist and surface provider health outcomes for route attempts.
- [x] Add `budget_policies` with per-call, per-workflow, daily, and project caps plus warning threshold and exceeded action.
- [x] Enforce per-workflow preflight caps and per-call route caps; return live overrun actions for warn, pause, and abort behavior.
- [x] Add typed IPC and preload APIs for route previews, budget policies, provider health, and budget-warning resume.
- [x] Add renderer controls for mock/provider execution, provider preflight confirmation, route override, budget settings, provider health reset, and run attempt details through existing run records.
- [x] Add tests for route resolution, fallback, auth no-retry, JSON repair retry, budget blocking, live budget action, provider health updates, and mock mode.

Deferred from Phase 9: selected-diff application, settlement proposal approval/application, daily/project spend-window enforcement, and true graph-level pause/resume after live budget warnings.

## Phase 10: Review, Diff, And Settlement Confirmation (Complete)

- [x] Add a main-process `ReviewSettlementService` for review-card status updates, manuscript diffs, quality gates, generated artifact acceptance, settlement preview, and confirmed settlement application.
- [x] Keep generated drafts, revisions, audits, and settlement changes proposed until the user accepts them.
- [x] Block canonical approval when unresolved blocking review cards exist, with an explicit override checkbox for the user to approve despite warnings.
- [x] Add unified manuscript diffs for canonical vs generated artifact and manuscript version vs manuscript version, including word and character deltas.
- [x] Allow generated artifacts to be saved as non-canonical manuscript versions by default.
- [x] Require explicit confirmation before saving a generated artifact and setting it canonical in one action.
- [x] Protect the older workflow canonical endpoint with the same blocking-review quality gate.
- [x] Add rich Review tab surfaces for continuity findings, rhythm scores, revision-plan notes, generated diffs, cost by node, and settlement proposals.
- [x] Add settlement proposal grouping, item edit/reject/apply controls, evidence-based default rejection for unsupported facts, and transactional application of accepted items.
- [x] Add `state_update_applications` audit rows for applied settlement changes with run, entity, update type, before/after JSON, actor, and timestamp.
- [x] Add typed IPC and preload APIs for `reviews.*`, `manuscript.diff*`, `manuscript.saveArtifactAsVersion`, and `settlement.*`.
- [x] Add tests for quality gates, override confirmation, diff creation, non-canonical generated versions, canonical acceptance transactions, settlement reject/apply behavior, audit trails, and unsupported settlement defaults.

Deferred from Phase 10: selected hunk application inside diffs, true provider-backed audit reruns from the Review tab, richer structured editing forms for every settlement entity type, and deeper daily/project spend-window enforcement.

## Phase 11: Cost Dashboard And Model Evaluation Suite (Complete)

- [x] Add `CostDashboardService` for active run, session, today, project, month-to-date, provider, model, task type, workflow node, chapter, and date spend aggregation.
- [x] Distinguish estimated-only, provider-reported, and mixed usage in dashboard summaries.
- [x] Compute average cost per approved chapter and average cost per 1k Chinese characters from canonical manuscript character counts.
- [x] Add stale price warnings and route price warnings for missing/stale active prices.
- [x] Add budget controls for per-call, per-workflow, daily, project, warning threshold, and warn/pause/abort behavior.
- [x] Add price registry JSON import/export, stale marking, inline price edits, and enabled toggles.
- [x] Add redacted local cost CSV export.
- [x] Add eval tables for suites, cases, runs, outputs, and scores.
- [x] Seed `中文网文基础评测 v1` with ten Chinese web novel task cases.
- [x] Add mock eval runs that create `llm_runs` without real provider calls.
- [x] Add human scoring, advisory mock LLM judge scoring, blind output masking, leaderboard aggregation, and confirmed route promotion.
- [x] Add Costs and Eval studio workspaces through typed IPC/preload APIs.
- [x] Add tests for cost aggregation, CSV redaction, budget summaries, eval score aggregation, blind masking, manuscript isolation, and route-promotion confirmation.

Deferred from Phase 11: provider-backed eval execution, full daily/project spend-window enforcement in runtime, richer charting dependencies, project backup/restore, import/export, first-run onboarding, and packaging prep.

## Phase 12: Import, Export, Backup, And Restore (Complete)

- [x] Add main-process `ImportExportService` for book Markdown, book TXT, project JSON, WenForge package, and redacted cost CSV exports.
- [x] Validate relative import paths, reject traversal, sanitize imported Markdown, and validate JSON/WenForge package payloads with Zod.
- [x] Import Markdown/TXT chapters as versioned imported manuscript records without bypassing canonical manuscript history.
- [x] Export project packages without decrypted API keys, encrypted credential blobs, provider credential rows, or Authorization headers.
- [x] Add main-process `BackupService` with manual backups, settings persistence, retention handling, confirmed restore, and pre-restore backup creation.
- [x] Wire typed IPC and preload APIs for `export.*`, `import.*`, and `backup.*` without adding generic privileged renderer access.
- [x] Add a Data workspace with export wizard, import wizard, backup settings, restore confirmation, progress/status copy, and secret-exclusion warnings.
- [x] Add tests for secret-free exports, chapter ordering, import validation, path traversal rejection, Markdown sanitization, conflict skipping, cost redaction, and backup/restore roundtrip.
- [x] Document import/export and backup/restore behavior.

Deferred from Phase 12: native file picker save/open flows, EPUB export, automatic backup scheduling hooks, first-run onboarding, and electron-builder packaging configuration.

## Phase 13: Onboarding, Command Palette, And Popover UX (Complete)

- [x] Add first-launch onboarding for Simplified Chinese default language, project setup, mock/provider choice, quality mode, privacy defaults, and demo/blank book creation.
- [x] Keep onboarding privacy defaults conservative: full prompt logging, full response logging, manuscript logging, and full recent chapters stay off.
- [x] Add typed command registry categories for Project, Chapter, Generation, Review, Story Bible, Cost, and Settings.
- [x] Add fuzzy command search, recent actions, scoped disabled states, and keyboard-friendly palette behavior.
- [x] Polish compact popover mode with active run status, session cost, recent projects/chapters, quick actions, and full-studio expansion while preserving selection.
- [x] Add quality-state panels for empty project, missing provider, missing/stale price, no canonical manuscript, generated draft pending, and settlement proposal pending states.
- [x] Add reduced-motion helpers, progress mini-bars, review-card expansion, and budget warning animation with reduced-motion support.
- [x] Add tests for command registry behavior, onboarding state, reduced motion helpers, setup-state routing, component smoke checks, and secret-safe rendering.
- [x] Document onboarding and update the UI spec.

Deferred from Phase 13: native file picker save/open flows, automatic backup scheduling hooks, optional EPUB export, and electron-builder packaging configuration.

## Phase 14: File Picker Polish And Packaging Prep

- Add safe native file picker flows for saving exports and opening import packages.
- Add automatic backup triggers for daily, app-close, and before-destructive-operation settings.
- Add optional EPUB export if dependency and formatting risk stay low.
- Add first-run migration for moving onboarding completion from renderer storage into main-process settings if needed.
- Add electron-builder configuration after local development commands remain stable.

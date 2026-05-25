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

## Phase 8: LangGraph Workflow MVP

- Add LangGraph.js workflow runtime in the main process or a controlled worker.
- Implement a chapter workflow skeleton with mock provider nodes first: prepare context, outline, scene cards, draft, continuity audit, rhythm audit, revise, human gate, and settlement proposal.
- Persist workflow checkpoints, generated artifacts, streamed chunks, and status events.
- Add cancellation and resume from safe checkpoints.
- Connect real provider adapters only after mock workflow tests pass.

## Phase 9: Review, Continuity, And Human Gates

- Add review cards for continuity, rhythm, AI-ish phrasing, cliches, and unresolved hooks.
- Add non-destructive rewrite proposals with accept, reject, and selected-diff application.
- Add state-settlement review for chapter summaries, timeline events, character changes, relationship changes, foreshadowing, resolved hooks, unresolved hooks, and continuity risks.
- Require confirmation before destructive deletes, canonical manuscript overwrites, accepted memory changes, or route changes that affect active run cost.

## Phase 10: Import, Export, Backup, And Packaging Prep

- Add Markdown/TXT import with safe path handling and no untrusted HTML injection.
- Add project export, cost report export, backup, restore, and migration safety checks.
- Add first-run onboarding for provider setup, route defaults, and manuscript logging settings.
- Add electron-builder configuration only after local development commands are stable.

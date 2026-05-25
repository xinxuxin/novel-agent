# WenForge Studio Architecture

## Strategy D Architecture

WenForge Studio is a fresh local-first Electron + React desktop app. Reference repositories are requirements inputs, not app bases. LangGraph.js may be used as an installed MIT dependency, but no reference repository source, prompt text, UI code, images, or branding is copied during the initial implementation.

The app combines a secure desktop shell, local SQLite persistence, provider adapters in the main process, durable workflow orchestration, and a WenForge-native writing skill package.

## Process Boundaries

- Renderer: React UI, TipTap editor, command palette, project tree, workflow timeline, story bible panels, model route editor, and cost views.
- Preload: small `contextBridge` API exposing only typed WenForge operations.
- Main process: window lifecycle, SQLite access, secret encryption, provider calls, cost accounting, workflow execution, file import/export, logging policy, and path validation.
- Workers: optional isolated work for FTS indexing, token estimation, import parsing, and long workflow execution.

The renderer must never directly call model providers, read decrypted secrets, or perform arbitrary filesystem operations.

## Module Map

- App shell: Electron windows, popover/full studio modes, app lifecycle, and secure navigation defaults.
- Shared contracts: Zod schemas, TypeScript types, task presets, provider enums, run statuses, and workflow event shapes.
- Database: Drizzle schema, migrations, repositories, FTS5 setup, and transaction helpers.
- Security: `safeStorage` credential encryption, redaction, prompt/manuscript logging policy, and path guards.
- Providers: normalized streaming adapters for supported providers and OpenAI-compatible endpoints.
- Cost accounting: token estimation, model price registry, live cost meter updates, and final `llm_runs` reconciliation.
- Model router: DB-backed task routes for brainstorm, outline, drafting, audits, revision, settlement, summary, and memory indexing.
- Workflows: LangGraph.js chapter generation graphs with checkpoints and human gates.
- Memory: SQLite FTS retrieval over approved summaries, story bible records, and memory chunks.
- Skill package: original WenForge writing methodology and prompt templates.
- Renderer features: project tree, editor, generation stream, review cards, story bible, cost meter, settings, and route management.

## IPC Contract

IPC is narrow, versioned, and Zod-validated. Future endpoint families should be task-oriented:

- `projects.*`
- `books.*`
- `chapters.*`
- `manuscripts.*`
- `storyBible.*`
- `generation.*`
- `credentials.*`
- `modelRoutes.*`
- `costs.*`
- `settings.*`

Each endpoint returns safe errors. Credential APIs return only redacted labels and status. Generation APIs stream safe workflow events, text deltas, review artifacts, and cost estimates.

## Persistence

SQLite is the source of truth. Drizzle owns schema definitions, while startup migrations run in the Electron main process against the database stored at `<userData>/data/wenforge.sqlite`.

Core records:

- project hierarchy: `projects`, `books`, `volumes`, `chapters`, `scenes`
- manuscript state: `manuscript_versions`, generated artifacts, diffs, rollback metadata
- workflow state: `generation_runs`, workflow checkpoints, streamed chunks, review cards, settlement proposals
- cost state: `llm_runs`, `model_prices`, task route selections, model profiles
- story memory: story bible entries, characters, factions, locations, artifacts, power-system rules, timeline events, foreshadowing, unresolved hooks, style guides, reader positioning, memory chunks
- app configuration: provider credentials, logging settings, route defaults, UI preferences

Generated outputs are drafts until accepted. Canonical manuscript and story bible updates are versioned.

Phase 2 implements main-process repositories for projects, books, volumes, chapters, manuscripts, story bible entries, memory search, generation artifacts, cost placeholders, and settings. The renderer receives data through typed IPC only and does not import database modules.

## Workflow Runtime

LangGraph.js orchestrates durable local workflows:

1. prepare context
2. retrieve memory
3. outline chapter
4. generate scene cards
5. draft chapter
6. audit continuity
7. audit webnovel rhythm
8. revise draft
9. pause for human approval
10. propose state settlement

Workflow nodes call the provider layer through the cost wrapper. Human gates pause before canonical writes or accepted memory changes. Resume, cancellation, and partial artifact recovery are required workflow behaviors.

## Provider And Cost Layers

Provider adapters run only in the main process. Supported providers are OpenAI, Anthropic, Google Gemini, DeepSeek, DashScope/Qwen, Moonshot/Kimi, xAI, OpenRouter, and generic OpenAI-compatible endpoints.

The cost layer wraps every model call:

- estimate input tokens before request
- create an `llm_runs` row before sending
- update live output token and cost estimates during streaming
- reconcile with provider-reported usage when present
- mark costs as estimated when usage is unavailable
- store hashes rather than full prompts/responses by default

## License Guardrails

- AGPL/GPL references are architecture-only unless explicitly approved by the user.
- No-license references are reference-only until license clarity changes.
- MIT/Apache-2.0 source can be copied or closely adapted only after review and a `THIRD_PARTY_NOTICES.md` update.
- OpenAI/Codex product names, logos, screenshots, branded assets, and distinctive identity are not reusable.
- WenForge prompts and skill text must be original unless a future task explicitly approves permissive source adaptation.

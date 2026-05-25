# Fusion Plan

## Final Recommendation

Use Strategy D: build WenForge Studio as a fresh Electron + React app, and create a WenForge-native skill/workflow package informed by permissively licensed and architecture-only references. This keeps the product secure, local-first, and license-clean while preserving the best ideas from the reconnaissance.

## Concepts To Fuse

From `inkos`:

- Multi-agent chapter pipeline.
- Explicit writer, auditor, reviser, and state-settler roles.
- Hook governance and continuity validation concepts.
- Broad test coverage around prompt assembly, state, providers, and pipeline behavior.
- Do not copy code or prompts because of AGPL.

From `MaliangAINovalWriter`:

- Provider capability abstraction.
- Model pricing management UI.
- LLM trace/observability concepts.
- Token pricing calculators and billing separation.
- Knowledge base extraction and prompt placeholder concepts.
- Apache-2.0 code can be considered later with notices, but direct translation from Java/Flutter is unlikely to be efficient.

From `langgraphjs`:

- Durable workflow graph runtime.
- SQLite checkpoint saver pattern.
- Human-in-the-loop interrupts and resumable graph state.
- Use as a dependency rather than vendoring.

From `story-writing`:

- Branching chapter version graph: edits create siblings, continuations create children.
- Streamed workflow status phases.
- Lineage-based summary for selected chapter branch.
- Do not copy code or prompts because there is no license.

From `chinese-novelist-skill`:

- Progressive questioning.
- Long-term preference memory.
- Planning confirmation before automated writing.
- Validation/repair loop and chapter hook emphasis.
- Do not copy prompt text or scripts unless license clarity improves.

From `LongWriter`:

- Decompose long generation into smaller planned units.
- Resume generation from cached chunks.
- Separate planning from drafting for long outputs.
- Apache-2.0 permits reuse with attribution, but prompts should be rewritten.

From `ai-novel-lab`:

- Outline-as-source-of-truth.
- Progress table concepts.
- Recent summary and chapter context checks.
- Static reader preferences such as theme, font, bookmarks, and progress.

From `openai/codex`:

- Typed app protocol mindset.
- Approval gates for consequential actions.
- Thread/session/event architecture.
- Skill instruction packaging.
- Do not copy branding, UI assets, product names, or distinctive visual identity.

## Target Architecture

WenForge should have these app modules:

- `electron/main`: windows, app lifecycle, DB worker, secure provider calls.
- `electron/preload`: typed bridge only.
- `renderer/app`: route shell, popover/full studio layout, command palette.
- `renderer/features/projects`: project tree and CRUD UI.
- `renderer/features/editor`: TipTap manuscript editor and version controls.
- `renderer/features/workflows`: run timeline, stream viewer, review cards.
- `renderer/features/story-bible`: entities, continuity warnings, accepted/proposed facts.
- `renderer/features/model-router`: task routes and provider/model selection.
- `renderer/features/costs`: live meter and historical reports.
- `main/db`: Drizzle schema, migrations, repositories.
- `main/security`: safeStorage/keychain, secret redaction, path validation.
- `main/providers`: provider adapters and streaming normalization.
- `main/costs`: token estimation, price registry, LLM run accounting.
- `main/workflows`: LangGraph.js chapter graph and human gates.
- `main/memory`: SQLite FTS retrieval and memory chunk indexing.
- `shared/contracts`: Zod schemas and TypeScript types.
- `shared/domain`: task presets, statuses, workflow event types, provider enums.

## Exact Modules To Build First

1. App scaffold and security defaults.
2. Typed IPC with Zod validation.
3. SQLite schema and Drizzle migrations.
4. Provider credential storage with encrypted secrets.
5. Price registry and `llm_runs`.
6. Model router with task presets.
7. Basic project/book/volume/chapter CRUD.
8. Manuscript versioning and rollback.
9. LangGraph chapter workflow skeleton with mock provider nodes.
10. Studio UI shell with left/center/right panels.

## Code Copy Policy

No reference code should be copied in the current phase.

Potential future safe reuse:

- LangGraph.js as an installed dependency.
- Small MIT/Apache-2.0 snippets only after a line-by-line review and attribution.
- No direct prompt copying unless license and attribution are approved.

Must not copy:

- `inkos` source, prompts, UI components, or genre profiles.
- `story-writing` code or prompts.
- `chinese-novelist-skill` prompt text until license clarity improves.
- OpenAI/Codex branding, logos, screenshots, names, or distinctive UI assets.
- Manuscript content from `ai-novel-lab`.

## Required Attribution Updates

If future phases copy or substantially adapt permissive material:

- Update `THIRD_PARTY_NOTICES.md`.
- Include source repo URL and commit SHA.
- Include license name and notice text where required.
- Add comments in copied/adapted files identifying origin.
- Document whether the adaptation is code, prompt text, design, or test fixture.

## Recommended Implementation Strategy

Strategy D is best:

- Electron app from scratch.
- LangGraph.js dependency for orchestration.
- WenForge-native skill/prompt package based on rewritten ideas.
- Optional attribution-backed adaptation from MIT/Apache repos later.

This avoids AGPL/no-license contamination and preserves freedom to build a polished local desktop product.


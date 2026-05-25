# Agent Graph Runtime

Phase 8 adds `chapter_generation_v1`, a local-first chapter workflow runtime in the Electron main process.

## Runtime Choice

WenForge uses `@langchain/langgraph` as a normal npm dependency. The current runtime compiles small LangGraph segments for node sequencing, while WenForge-owned services handle persistence, cost records, human gates, and IPC. LangGraph source is not vendored.

## Graph Segments

The workflow is split into resumable segments:

- start to gate: `prepare_context`, `retrieve_memory`, `generate_chapter_outline`, `generate_scene_cards`, `draft_chapter`, `continuity_audit`, `webnovel_rhythm_audit`, `revise_draft`, `human_gate`
- approval to finish: `state_settlement_proposal`, `persist_results`, `finalize`
- revision loop: `revise_draft`, `human_gate`

The graph pauses at `human_gate`. Approval resumes into settlement proposal generation. Revision requests rerun only the revision segment and return to the gate.

## Persistence

Every workflow creates or updates:

- `generation_runs`
- `workflow_checkpoints`
- `workflow_events`
- `generated_artifacts`
- `review_cards`
- `settlement_proposals`
- `settlement_proposal_items`
- `llm_runs` with `provider = fake` for mock model nodes

Generated artifacts are proposals. Accepting a revision creates a non-canonical manuscript version. Setting that version canonical is a separate confirmed action.

## Mock Provider

Phase 8 uses deterministic main-process mock calls for outline, scene cards, draft, audits, revision, and settlement. Each mock call creates an `llm_runs` row with hashed prompt/response content and estimated cost. Real provider-backed workflow nodes remain deferred until after the graph/human-gate behavior is stable.

## IPC

Renderer access is limited to typed IPC:

- `generation.chapter.start`
- `generation.getRun`
- `generation.listRunsByChapter`
- `generation.streamEvents`
- `generation.abort`
- `generation.resume`
- `generation.requestRevision`
- `generation.acceptArtifactAsVersion`
- `generation.setAcceptedVersionCanonical`
- `generation.cancel`

The renderer does not import workflow, DB, prompt, or provider modules directly.

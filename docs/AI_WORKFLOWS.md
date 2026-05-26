# AI Workflows

## Workflow Strategy

WenForge uses original, WenForge-native writing workflows implemented as local LangGraph.js graphs. Reference repositories inform the shape of the workflow, but prompt text and source implementations are not copied from AGPL, GPL, or no-license projects.

Generated AI output is always proposed work until the user accepts it. Canonical manuscript and story bible changes are versioned and rollbackable.

## Chapter Generation Graph

The chapter workflow runs through these graph nodes:

1. Prepare Context
   - load project, book, volume, chapter, active manuscript version, style guide, reader positioning, task routes, and cost settings
   - build the context pack in the main process rather than in the renderer
   - apply privacy settings before including full recent chapter excerpts
   - record omitted or truncated context sections explicitly
   - estimate planned workflow cost ranges when route data is available

2. Retrieve Memory
   - query SQLite FTS over story bible records, chapter summaries, timeline events, unresolved hooks, and approved memory chunks
   - fall back to keyword search if FTS is unavailable
   - exclude rejected settlement proposals and raw generated artifacts from canonical memory
   - include recent chapter lineage and selected branch context

3. Chapter Outline
   - create or refine the chapter promise, opening hook, major conflict, emotional turn, payoff, end hook, and continuity dependencies

4. Scene Cards
   - produce scene cards with POV, setting, characters, goal, obstacle, conflict beat, new information, emotional turn, and handoff

5. Draft Chapter
   - stream Chinese manuscript text through the main process
   - persist chunks as generated artifacts
   - update live token and cost estimates

6. Continuity Audit
   - identify contradictions, missing setup, timeline issues, relationship drift, power-system violations, and unresolved fact conflicts

7. Webnovel Rhythm Audit
   - evaluate opening hook, conflict density, scene momentum, emotional turn, payoff, chapter-end hook, trope alignment, cliches, and AI-ish phrasing

8. Revise Draft
   - create a revised draft from selected audit findings
   - preserve the previous draft for comparison

9. Human Gate
   - user can accept, reject, request another revision, or apply selected diffs
   - accepting a generated artifact creates a non-canonical manuscript version
   - setting that version canonical requires a separate confirmation

10. State Settlement Proposal
    - propose chapter summary, timeline updates, character state changes, relationship changes, new facts, new foreshadowing, resolved foreshadowing, unresolved hooks, and continuity risks
    - accepted proposals update canonical story memory in a later confirmed settlement step

## Phase 8 Mock Runtime

Phase 8 implements `chapter_generation_v1` in the main process with LangGraph.js segment execution and deterministic mock model calls. It persists checkpoints, workflow events, generated artifacts, review cards, settlement proposals, and fake-provider `llm_runs`.

The runtime pauses at `human_gate`. From that point the user can:

- approve the workflow and continue into settlement proposal generation
- save the latest revision as a non-canonical manuscript version
- explicitly set an accepted version canonical
- request another revision
- cancel the workflow while preserving artifacts

The renderer only talks to the graph through typed `generation.*` IPC endpoints.

## Phase 9 Provider Runtime

Phase 9 keeps mock mode for tests and local demos, then adds explicit provider mode for real configured models.

Provider mode requirements:

- the user must choose provider execution from the Generate tab
- renderer preflight calls `modelRoutes.resolvePreview` and shows model/cost estimates
- the main process resolves every node route again before starting
- missing required routes, credentials, enabled model profiles, or blocking prices stop the workflow
- every model node uses `ContextBuilder`, `PromptAssemblyService`, `ModelRouter`, `WorkflowModelExecutor`, the AI gateway, and provider adapters
- every provider attempt creates an `llm_runs` row before the request
- fallback, retry, JSON repair, provider health, and budget actions are recorded

Provider output remains proposed content. Accepting a revision creates a non-canonical manuscript version, and setting it canonical still requires a separate confirmation.

## Phase 10 Review Gate

Phase 10 adds the confirmation layer after workflow output has been generated. The Review tab is now the place where generated drafts, revisions, audits, and settlement proposals become accepted project state.

Review-gate behavior:

- continuity, rhythm, revision, and settlement findings are displayed as review cards with status
- canonical approval is blocked while open blocking review cards exist
- a user can override blocking cards only through an explicit warning checkbox and confirmation
- generated artifacts save as non-canonical manuscript versions by default
- setting a generated version canonical is transactional and never overwrites an existing canonical row in place
- low ending-hook rhythm scores surface as warnings before approval
- settlement proposal items are previewed, grouped, edited/rejected/applied, and audited separately from manuscript acceptance
- unsupported settlement facts default to rejected until the user edits or confirms them in a later workflow

The same quality gate protects the older generation endpoint for setting an accepted generated version canonical, so canonical writes cannot bypass Review tab policy.

## Review And Rewrite Workflow

- Start from a selected manuscript version or generated draft.
- Run one or more audits.
- Produce review cards with severity, evidence, affected entity, suggested fix, and whether human judgment is required.
- Generate a replacement draft or diff proposal.
- Save accepted changes as a new manuscript version.
- Never overwrite canonical text without confirmation.
- Compare canonical text against generated draft/revision with a unified diff before acceptance.
- If blocking findings remain unresolved, require an explicit approve-despite-warnings override.

## Story Bible Workflow

- Manual story bible edits become canonical after user save.
- Generated facts are proposals with source run, source chapter, evidence summary, and confidence.
- Conflicts create warnings instead of silent replacements.
- Accepted settlement updates keep provenance.
- Phase 10 applies accepted settlement items transactionally and writes `state_update_applications` audit rows.
- Settlement facts unsupported by the accepted manuscript evidence default to rejected in preview.
- Phase 6 supports canonical CRUD for characters, factions, locations, artifacts, power-system rules, timeline events, foreshadowing, unresolved hooks, style guides, and reader positioning.
- Memory indexing can rebuild from accepted story bible records, canonical manuscripts, and chapter summaries.
- Context preview shows estimated tokens, included memory, omissions, truncation notes, and privacy warnings before generation.

## WenForge Skill Package

The skill package should contain original methodology for:

- progressive project questioning
- reader positioning
- genre and trope expectations
- outline and scene-card creation
- Chinese web novel drafting
- continuity auditing
- suspense and rhythm auditing
- rewrite and polish passes
- state settlement

The package may mention conceptual inspiration from references in documentation, but it must not copy restricted prompt text.

## Model Routing

Task routes are DB-backed and editable:

- brainstorm
- story_bible
- volume_outline
- chapter_outline
- scene_cards
- draft_chapter
- webnovel_style_rewrite
- continuity_audit
- suspense_hook_audit
- revise_chapter
- state_settlement
- summarize_chapter
- embedding_or_memory_indexing

Routes resolve in the main process immediately before provider calls. Missing credentials, disabled prices, or unavailable models produce safe user-visible errors before starting expensive work.

Fallback and retry policy:

- rate limits can fall back to configured fallback models
- transient network failures can retry with exponential backoff or fallback
- auth and permission failures stop immediately
- invalid structured JSON retries once through the JSON repair prompt
- provider health is updated after route outcomes

Budgets:

- preflight enforces per-workflow caps
- each routed model node enforces per-call caps
- live/final cost overruns return the configured budget action

## Human Gates

Require explicit confirmation for:

- canonical manuscript overwrite
- story bible proposal acceptance
- foreshadowing resolution
- destructive deletes
- credential deletion
- route changes that affect an active run
- retrying a failed run when the estimated cost changes materially

## Phase 15b Cross-Check Workflows

Phase 15b adds reusable multi-model cross-check runs for planning and audit-heavy tasks:

- `worldbuilding_cross_check`
- `originality_audit`
- `main_plot_logic_audit`
- `volume_outline_cross_check`
- `key_chapter_preflight_cross_check`

Cross-check runs are proposals. They create `generation_runs`, `llm_runs`, and `generated_artifacts`, but they do not mutate canonical manuscripts or accepted story bible records.

Execution shape:

1. GPT-5.5 and Claude Opus 4.7 receive the same context with different original WenForge role instructions.
2. The first two models run independently; neither receives the other model output.
3. DeepSeek V4 Pro receives both outputs plus the original context and aggregates agreements, disagreements, contradictions, originality risks, trope risks, unresolved decisions, recommended final plan, human decision points, and cost summary.
4. Qwen3.7-Max is used for Chinese webnovel market-fit review when configured; Kimi K2.6 can serve as the market-fit fallback.
5. The renderer shows the cross-check summary as reviewable generated artifacts. Human approval is still required before any downstream manuscript or state changes.

Every cross-check requires confirmation because it can call multiple providers in parallel. Preflight blocks missing credentials and budget overages before provider calls or `llm_runs` are created.

## Phase 15c Provider Chapter Check

Phase 15c adds an optional short provider-backed chapter connectivity check for local QA:

- it requires `RUN_REAL_PROVIDER_CHECKS=true` for CLI use and explicit confirmation in the UI
- it uses a small budget cap from `REAL_E2E_CHECK_BUDGET_USD`
- it runs context preview, outline, scene cards, draft, suspense/rhythm audit, continuity audit, revision, non-canonical version save, and settlement proposal creation
- it writes normal `llm_runs`, generated artifacts, review cards, and settlement proposal records
- it stops before canonical manuscript update and before story bible mutation
- reports include IDs, counts, provider/model metadata, token/cost fields, and redacted errors only

## Phase 16 Outline-To-Manuscript Flow

Phase 16 makes the primary chapter workflow outline-driven. The expected user input is a detailed
chapter outline in natural language, not a rigid JSON document. A useful outline can include:

- scene-by-scene beats
- required characters, locations, props, powers, and clues
- the intended emotional turn
- facts that must not change
- places where the user allows agents to strengthen plot, setting, or hooks
- target ending hook

The Generate tab sends this outline through typed IPC as `sourceOutline`, along with
`allowStoryChanges` and `desiredOutput`. The main-process workflow then:

1. Treats the outline as the authoritative brief.
2. Generates a refined chapter outline and scene cards.
3. Drafts Chinese manuscript text from the outline.
4. Audits continuity and webnovel rhythm.
5. Revises into a `Final proposed manuscript`.
6. Pauses at the human gate.

Generated output remains proposed. Saving creates a non-canonical manuscript version, and setting
that version canonical still requires explicit confirmation. Story bible/state updates remain
settlement proposals until separately accepted.

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
   - accepting creates a new canonical manuscript version

10. State Settlement Proposal
    - propose chapter summary, timeline updates, character state changes, relationship changes, new facts, new foreshadowing, resolved foreshadowing, unresolved hooks, and continuity risks
    - accepted proposals update canonical story memory

## Review And Rewrite Workflow

- Start from a selected manuscript version or generated draft.
- Run one or more audits.
- Produce review cards with severity, evidence, affected entity, suggested fix, and whether human judgment is required.
- Generate a replacement draft or diff proposal.
- Save accepted changes as a new manuscript version.
- Never overwrite canonical text without confirmation.

## Story Bible Workflow

- Manual story bible edits become canonical after user save.
- Generated facts are proposals with source run, source chapter, evidence summary, and confidence.
- Conflicts create warnings instead of silent replacements.
- Accepted settlement updates keep provenance.
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

## Human Gates

Require explicit confirmation for:

- canonical manuscript overwrite
- story bible proposal acceptance
- foreshadowing resolution
- destructive deletes
- credential deletion
- route changes that affect an active run
- retrying a failed run when the estimated cost changes materially

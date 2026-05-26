# Planning Lab

Phase 18 adds Planning Lab as a lightweight planning workspace outside the full chapter-generation graph.

Planning Lab exists for writers who already have a detailed outline and want to adjust the book, volume, chapter, scene, or beat plan before spending money on a full generation run.

## Core Principles

- Uploaded or pasted outlines are preserved as immutable `outline_sources`.
- Parsed/normalized outlines are editable `outline_versions`.
- Volume, chapter, and scene planning records are separate from canonical manuscripts.
- AI-assisted edits create proposals, patches, variants, or drafts first.
- Accepted plans can guide the full workflow, but they do not overwrite manuscripts or story bible facts.
- Manual editing stays available at every level.

## Planning Records

Phase 18 introduces:

- `outline_sources`: raw pasted/file/manual outline text, title, source type, and parser metadata.
- `outline_versions`: structured JSON plus Markdown representation, parent version, source link, and active flag.
- `volume_plans`: editable volume summary, goals, turning points, unresolved hooks, and status.
- `chapter_plans`: editable chapter promise, hooks, conflict, emotional turn, payoff, target word counts, continuity dependencies, notes, and status.
- extended `scenes`: target words, beat list, user notes, status, source plan, and variant group.
- `plan_edit_proposals`: scoped AI/user change proposals with before/after JSON, rationale, model metadata, and accept/reject status.

Existing `chapters.target_words` is backfilled into accepted chapter plans where possible. Existing scene records are preserved.

## UI Surfaces

Planning Lab includes:

- outline source panel for paste and multi-file import
- normalized outline/version list
- chapter plan editor
- target/min/max word controls
- Plan Chat panel for scoped edit instructions
- proposal drawer with accept/reject actions

The initial implementation focuses on book/chapter planning and proposal persistence. Volume-level, scene-level, selected-text, and variant editing share the same repository and IPC foundation and can be expanded without changing the security model.

## Workflow Integration

The main chapter workflow now checks for an accepted chapter plan before generating a fresh outline. When a plan exists, it uses the accepted plan values for:

- title
- target words
- chapter promise
- opening hook
- main conflict
- emotional turn
- payoff
- ending hook
- continuity dependencies
- user notes

The full workflow modes remain non-destructive:

- use accepted plans
- regenerate outline only
- regenerate scene cards only
- draft from accepted scene cards
- revise current manuscript only
- run audits only
- settle state only

Generated output is still proposed until the user accepts it as a manuscript version or canonical state.

## Word Count Policy

Chapter plans can now store:

- `target_words`
- `min_words`
- `max_words`
- `lock_word_count`
- `word_count_priority`: `loose`, `normal`, or `strict`

Generation should treat strict word counts as a hard prompt constraint and loose counts as approximately plus/minus 20 percent. If a draft misses range, WenForge should offer compress, expand, rewrite with stricter range, or accept anyway.

## Safety

Planning Lab uses typed IPC only. The renderer can edit planning records and create proposals, but provider calls, prompt assembly, credentials, cost records, and workflow execution remain in the main process.

No Planning Lab action directly mutates canonical manuscript text or accepted story bible facts.

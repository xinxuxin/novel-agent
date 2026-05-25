# Memory System

## Phase 6 Scope

WenForge now has a canonical story bible workspace, a main-process memory index, and a context preview builder. These systems are local-first and proposal-safe: user-created or accepted facts are canonical, while generated facts remain proposals until a later human gate applies them.

## Canonical Story Bible

The story bible is stored in SQLite and accessed only through main-process repositories plus typed IPC. The renderer can create, edit, search, and delete records, but it cannot bypass repository rules or mutate database files directly.

Implemented entity families:

- characters
- factions
- locations
- artifacts and props
- power-system rules
- timeline events
- foreshadowing items
- unresolved hooks
- style guides
- reader positioning

Each family supports tags, importance, related chapters where applicable, query filtering, and confirmed destructive deletion. Generated settlement proposals are not written into these canonical tables in Phase 6.

## Memory Index

`MemoryIndexService` runs in the main process and coordinates the `memory_chunks` table plus SQLite FTS search when available.

Implemented operations:

- `upsertChunk`
- `deleteChunk`
- `searchRelevantChunks`
- `rebuildBookIndex`
- `rebuildFromStoryBible`
- `rebuildFromCanonicalManuscripts`
- `rebuildFromChapterSummaries`

Search uses SQLite FTS5 first. If FTS5 is unavailable or the FTS table has been dropped in a test/degraded database, the repository falls back to keyword search over local memory chunks and approved story bible entries.

Memory filters include:

- `bookId`
- `chapterId`
- `sourceType`
- `tags`
- `minImportance`
- `limit`

Rejected proposal items and raw generated artifacts are not treated as canonical memory sources. The context builder also excludes proposal-like memory source types from preview output.

## Context Builder

`ContextBuilder` runs in the Electron main process. It creates a JSON context pack for a selected chapter without secrets and without renderer-side privileged prompt assembly.

Inputs:

- `projectId`
- `bookId`
- `volumeId`
- `chapterId`
- `taskType`
- `userInstruction`
- `qualityMode`
- `targetTokenBudget`
- recent-chapter inclusion settings
- privacy settings

Output sections:

- project brief
- book premise
- volume goal
- current chapter metadata and outline
- scene cards
- reader positioning
- style guide
- relevant story bible entities
- power-system, timeline, foreshadowing, and unresolved-hook digests
- recent chapter summaries
- recent chapter excerpts only when privacy allows
- retrieved memory chunks
- continuity warnings
- explicit omissions and truncation notes
- estimated token count

The builder always attempts to include reader positioning, active style guide, and current chapter planning data. If the budget is tight, lower-priority retrieved memory and recent full excerpts are truncated before required policy sections are shortened. Any omission is recorded in the context pack.

## Privacy And Redaction

Full recent chapters are included only when `allowSendingFullRecentChapters` is enabled and the token budget allows it. The context preview redacts key-like strings before returning data to the renderer and does not include provider credentials or decrypted secrets.

The renderer can copy the preview JSON for inspection, but provider execution still happens through main-process AI gateway paths.

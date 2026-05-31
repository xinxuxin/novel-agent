# Focused Chapter Writer Design

## Context

Phase 23 resets WenForge Studio's default product direction from a broad AI writing platform into a simple, high-quality, human-controlled Chinese web novel chapter writer.

The default experience should assume the writer already has detailed book settings and chapter-by-chapter outlines. WenForge's job is to organize those inputs, build safe context, generate one selected chapter, audit and polish it, then wait for the user to edit and save. Existing advanced capabilities remain available outside the default path.

## Approved Direction

The new default app mode is:

- English name: Focused Chapter Writer
- Chinese label: 章节成文
- Default after opening a book: yes

Universal Intake, Planning Lab, candidate comparison studio, model evaluation, cross-model worldbuilding, batch generation, raw JSON artifact views, advanced route editing, and complex settlement flows move out of the default chrome for now. They remain available only through a `More` or `Advanced / Legacy` area where the existing app supports it.

The default navigation should be reduced to the focused chapter writer, Settings, and a small advanced access point. The default path must not feel like a multi-agent planning lab.

## Main Layout

Use the approved Option A balanced three-panel layout.

Left sidebar:

- Book selector.
- Import Setting File.
- Import Chapter Outlines.
- Chapter list with chapter index, title, target words, status, canonical/generated indicator, and last updated time.

Center panel:

- Selected chapter title and status.
- Tabs: Outline, Write, Review, Versions.
- Target word controls near the generation action.
- Current chapter outline editor.
- Generate This Chapter button.
- Generation progress.
- Main manuscript editor.

Right panel:

- Collapsible context preview.
- Audit, polish, and final check status.
- Previous chapter summary.
- Cost estimate and actual cost.
- Save/version controls.

Default visible buttons:

- Import Setting File.
- Import Chapter Outlines.
- Generate This Chapter.
- Audit & Polish Again.
- Save Draft.
- Save as Canonical.
- Update Summary.
- Export Book.

## Data Model

### Book Setting Files

Add a first-class `book_setting_files` table even though some information overlaps with Story Bible and style guide records. The user needs one obvious active setting file for a book.

Fields:

- `id`
- `book_id`
- `title`
- `content_markdown`
- `content_plaintext`
- `is_active`
- `source_type`: `paste | file | manual | imported`
- `created_at`
- `updated_at`

Behavior:

- Pasting, importing, or manually creating a setting file creates a versioned record.
- Saving edited setting-file content creates a new record and marks it active, so history is preserved without overwriting prior versions.
- Saving a record as active deactivates other active setting files for the same book.
- Metadata-only title changes may update the current record, but content changes are versioned.
- The setting file is planning/manuscript data, not a secret. It may be returned to the renderer through typed IPC.
- Provider credentials remain main-process only and are never exposed through this feature.

### Chapter Outlines

Adapt the existing `chapter_plans` table as the focused `Chapter Outline / 章节细纲` abstraction instead of creating a duplicate `chapter_outlines` table.

Existing `chapter_plans` fields already cover:

- chapter index and title
- target/min/max words
- word count priority
- chapter summary and promise
- opening hook
- key events
- main conflict and escalation
- emotional turn
- payoff
- ending hook
- continuity dependencies
- user and risk notes
- status and accepted timestamp

Add the focused gaps:

- `outline_text`
- `must_include_json`
- `must_avoid_json`
- `import_source_id` nullable, pointing at the outline source or setting/import artifact that produced the outline

Backfill behavior:

- Existing accepted chapter plans remain authoritative and must not be overwritten.
- Existing `chapters.summary`, `chapters.outline_json`, `chapter_plans`, and scene-card data can populate focused outline fields when no accepted/user-edited focused outline exists.
- Backfill maps old data into the focused view without deleting old records.

### Outline Import

Supported inputs:

- pasted Markdown
- pasted TXT
- imported Markdown/TXT

Parsing stays simple:

- If headings or `第X章`-style markers are obvious, split into chapter outline records.
- If the input is plain or ambiguous text, store the full text as outline text and let the user edit details later.
- The importer does not invent missing fields. Empty optional fields remain empty.

## Focused Workflow

Add a new workflow id:

`focused_chapter_writer_v1`

This is a focused path, not a replacement deletion of `chapter_generation_v1`.

Nodes:

1. `load_chapter_outline`
2. `build_context`
3. `build_writing_brief`
4. `draft_chapter_qwen`
5. `draft_chapter_kimi`
6. `compare_and_audit_drafts`
7. `polish_de_ai`
8. `final_check`
9. `human_edit_gate`
10. `save_version`
11. `update_chapter_summary`

Behavior:

- Runs one chapter at a time.
- Does not batch generate by default.
- Builds one writing brief from the active setting file, current chapter outline, previous confirmed chapters, summaries, character/story state, style guide, and budget/route policy.
- Drafts two raw manuscript versions on every generation run:
  - Qwen draft with Qwen3.7-Max.
  - Kimi draft with Kimi K2.6.
- Saves both raw drafts as generated artifacts with model metadata, cost, word count, and status.
- Uses an audit model to compare both drafts and choose a recommended source draft.
- Polishes the recommended draft by default.
- Lets the user inspect both raw drafts, the recommendation, and the polished draft before saving.
- Stops at a human edit gate after final check.
- Never automatically overwrites canonical manuscript text.
- Never automatically mutates Story Bible from generated output.
- Runs chapter summary update only after the user saves or accepts a version.

## Fixed Model Chain

The focused workflow is fixed in the main UI. Advanced settings may later expose route customization, but the default writer flow does not present multiple modes.

Writing brief:

- Preferred: DeepSeek V4 Pro.
- Fallback: GPT-5.5.

Draft A:

- Qwen3.7-Max.

Draft B:

- Kimi K2.6.

Compare and audit drafts:

- Preferred: DeepSeek V4 Pro.
- Fallback: GPT-5.5.
- Output includes `recommended_draft_id`, per-draft scores, outline adherence, canon consistency, missing events, character/timeline issues, word count fit, ending hook strength, AI-ish phrasing risks, blocking issues, and polish instructions.

Polish / De-AI:

- Preferred: Claude Opus 4.7.
- Fallback: Qwen3.7-Max or Kimi K2.6.
- Polishes the audit-recommended draft while preserving event order, canon, and target word constraints.

Final check:

- Preferred: DeepSeek V4 Pro.
- Fallback: GPT-5.5.

Chapter summary update:

- Preferred: DeepSeek V4 Pro.
- Fallback: Kimi K2.6.

All model calls go through the existing AI Gateway, route/model profile resolution, `ModelParameterPolicy`, budget checks, `llm_runs`, cost accounting, provider error normalization, and privacy settings. Automated tests use fake providers only.

## Context Strategy

Focused context always includes:

- Active setting file.
- Current chapter outline.
- Current target/min/max words and word count priority.
- Style requirements and reader positioning.
- Forbidden tropes and must-avoid constraints when present.
- Active model route and budget policy.

Previous context includes:

- Previous one or two canonical chapters when privacy settings allow full recent chapter inclusion.
- Previous three to ten chapter summaries when available.
- Earlier chapter summaries when short enough for the budget.
- Relevant character/story state.
- Relevant unresolved hooks.
- Continuity notes from previous chapters and accepted outline data.

Focused context excludes:

- Rejected proposals.
- Failed generated artifacts.
- Non-canonical drafts unless the user explicitly selects them.
- Raw debug logs.
- Unrelated old materials.

Context mode defaults to `max_safe`, reserves output tokens, respects model context windows, respects privacy settings, respects budget caps, and shows included/omitted context in a collapsible preview.

## Word Count Behavior

Each chapter outline has:

- `target_words`
- `min_words`
- `max_words`
- `word_count_priority`: `loose | normal | strict`

The UI exposes these controls near `Generate This Chapter`.

Generation passes these constraints into the writing brief, both draft calls, compare/audit, polish, and final check. After generation, WenForge calculates Chinese-aware word/character counts for both raw drafts and the polished draft.

If the final text is outside range, show simple options:

- Accept anyway.
- Expand to target.
- Compress to target.
- Rewrite with stricter target.

## Prompt Assets

Add original WenForge prompt templates:

- `focused-writing-brief.zh.md`
- `focused-draft-chapter.zh.md`
- `focused-draft-compare-audit.zh.md`
- `focused-polish-de-ai.zh.md`
- `focused-final-check.zh.md`
- `focused-chapter-summary.zh.md`
- `focused-expand-to-target.zh.md`
- `focused-compress-to-target.zh.md`

Prompt behavior:

- Draft prompts output manuscript text only.
- Structured prompts output JSON matching named schemas.
- The compare-audit prompt receives both Qwen and Kimi drafts and returns the recommended draft plus reasons.
- Prompts must be original WenForge assets and must not copy reference repository text.
- Prompt previews remain disabled by default and redacted when enabled.

## UI State Flow

Before generation:

- Show active setting file status.
- Show current chapter outline and target words.
- Show context preview.
- Show fixed chain cost estimate.

During generation:

1. Preparing context.
2. Building writing brief.
3. Drafting with Qwen.
4. Drafting with Kimi.
5. Comparing drafts.
6. Polishing recommended draft.
7. Final check.
8. Ready for your edit.

After generation:

- Review tab shows Qwen draft, Kimi draft, audit recommendation, polished draft, final check report, and cost.
- Write tab centers the polished draft in the editor.
- User can switch to either raw draft for review or save-as-version actions.
- Save Draft creates a non-canonical manuscript version.
- Save as Canonical requires explicit confirmation.
- Update Summary is enabled only after a saved/accepted version exists.

## Safety And Privacy

Hard requirements:

- No hardcoded API keys.
- Renderer never receives decrypted credentials.
- Renderer never calls model providers.
- Provider calls stay in the main process.
- No real provider calls in automated tests.
- Real provider calls remain opt-in, budget-capped, and user-confirmed.
- Canonical manuscript is never overwritten automatically.
- Story Bible is never mutated automatically from generated output.
- Generated drafts, audits, polish passes, final checks, and summaries remain proposals until accepted.
- `llm_runs`, cost tracking, provider adapters, diagnostics, privacy settings, safeStorage, IPC validation, versioning, and model parameter normalization remain intact.

## Tests

Add or update tests for:

- Setting file paste/import/edit/active history.
- Chapter outline import from Markdown/TXT/paste.
- Chapter list displays target words, status, generated/canonical indicators, and updated time.
- Focused context includes active setting file, current outline, previous canonical chapters, summaries, relevant state, hooks, style, and reader positioning.
- Focused context excludes rejected proposals, failed artifacts, raw logs, and non-selected non-canonical drafts.
- `focused_chapter_writer_v1` uses fake providers in tests.
- Qwen and Kimi draft artifacts are both persisted.
- Compare-audit recommends one draft and records reasons.
- Polish and final-check artifacts are saved.
- Human edit gate pauses before save.
- Save Draft creates a non-canonical manuscript version.
- Save as Canonical requires confirmation.
- Summary update runs only after save/accept.
- Every model node creates `llm_runs`.
- Budget caps block expensive focused runs before provider calls.
- `ModelParameterPolicy` remains applied to all focused calls.
- Default UI opens on `章节成文`.
- Default tabs are Outline, Write, Review, Versions.
- Generate This Chapter, word count controls, context preview, and cost estimate are visible.
- Universal Intake, Planning Lab, candidate studio, eval, and advanced routing are hidden from default UI.
- Renderer does not receive decrypted credentials.
- Canonical manuscript and Story Bible are not automatically mutated.

## Documentation

Add:

- `docs/FOCUSED_CHAPTER_WRITER.md`
- `docs/FOCUSED_CHAPTER_WRITER_QA.md`

Update:

- `README.md`
- `docs/AI_WORKFLOWS.md`
- `docs/UI_SPEC.md`
- `docs/PROMPTS.md`
- `docs/MODEL_ROUTING.md`
- `docs/COST_TRACKING.md`
- `docs/TROUBLESHOOTING.md`

Docs explain:

- Focused Chapter Writer is the default workflow.
- User provides a setting file and chapter outlines.
- WenForge generates one chapter at a time.
- Both Qwen and Kimi raw drafts are generated and saved.
- Audit AI compares the two drafts and recommends one.
- The recommended draft is polished and final-checked.
- Context construction and privacy behavior.
- Word count controls.
- Draft versus canonical save behavior.
- How old advanced features are accessed.

## Verification

Before Phase 23 implementation is complete, run:

- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm build`

If any command fails, fix the root cause and rerun the failed command before marking the phase complete.

## Acceptance Criteria

Phase 23 is complete when:

- Opening a book defaults to `章节成文`.
- Universal Intake and Planning Lab are removed from default navigation for now.
- A user can create/import/edit an active setting file and view history.
- A user can paste/import chapter outlines and see a clean chapter list.
- A user can select one chapter, edit target word controls, preview context, and generate.
- Each run produces and saves one Qwen draft and one Kimi draft.
- Audit AI compares both drafts and recommends one.
- The recommended draft is polished and final-checked.
- The user edits manually before saving.
- Save Draft and Save as Canonical are separate, explicit actions.
- Chapter summary update is manual and only enabled after save/accept.
- Existing advanced data and workflows are preserved under legacy/advanced access.

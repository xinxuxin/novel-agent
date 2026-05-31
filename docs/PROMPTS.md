# Prompts

## Prompt Policy

WenForge prompts are original project assets. They should default to Simplified Chinese creative output and preserve local-first safety:

- no copied AGPL, GPL, no-license, proprietary, or distinctive prompt text
- no prompt text exposed in manuscript output
- no API keys or provider secrets in previews
- no canonical story bible mutation without a user-approved settlement step
- structured tasks return JSON matching a named schema
- drafting tasks return only manuscript text

## Versioning

Each prompt file has frontmatter:

```yaml
---
id: chapter-outline
version: 1.0.0
language: zh-CN
task_type: chapter_outline
output_schema: chapter-outline
---
```

`PromptAssemblyService` includes the prompt id, prompt file, prompt version, task type, skill id, and skill version in assembly metadata. Later workflow phases can attach this metadata to generated artifacts or run records without storing full prompts by default.

## Template Variables

The prompt package uses stable placeholder variables:

- `{{projectBrief}}`
- `{{bookPremise}}`
- `{{volumeGoal}}`
- `{{currentChapter}}`
- `{{currentChapterOutline}}`
- `{{readerPositioning}}`
- `{{styleGuide}}`
- `{{recentSummaries}}`
- `{{relevantStoryBible}}`
- `{{unresolvedHooks}}`
- `{{sceneCards}}`
- `{{draftText}}`
- `{{auditFindings}}`
- `{{userInstruction}}`
- `{{targetWords}}`
- `{{outputSchema}}`

Prompt assembly builds these from the Phase 6 context pack plus explicit caller variables. Caller variables override context-derived values when provided.

## Output Contracts

Structured prompt outputs are backed by JSON schema files:

- project discovery
- reader positioning
- chapter outline
- scene cards
- continuity audit
- webnovel rhythm audit
- revision plan
- state settlement
- chapter summary

Draft prompts intentionally have no JSON schema because they must output manuscript text only.

## Privacy

Prompt preview is disabled by default through `allowPromptPreview: false`. Enabling preview is a local privacy choice for debugging and inspection. Even when preview is enabled, prompt assembly redacts key-like strings before returning content to the renderer or tests.

Full prompt and response logging remain controlled by separate privacy settings and are still off by default.

## Phase 15b Cross-Check Templates

The skill package now includes original WenForge templates for:

- worldbuilding GPT director pass
- worldbuilding Claude director pass
- worldbuilding aggregation
- originality audit
- plot logic audit
- Chinese webnovel market-fit audit

These prompts are concise, schema-oriented, and written from scratch. Runtime prompts must not mention conceptual reference repositories or expose provider secrets.

## Phase 18 Planning And Micro-Edit Templates

The skill package now includes original WenForge templates for planning and partial rewrite work:

- plan chat edit
- selected outline refinement
- volume plan refinement
- chapter plan refinement
- scene card refinement
- selected text rewrite
- chapter expansion to target length
- chapter compression to target length
- chapter rewrite with constraints
- hook variants
- ending variants

Planning prompts return structured proposals and must preserve canon unless the user explicitly asks for a story change. Selected-text rewrite prompts return replacement text only so the UI can show a clean diff.

Prompt assembly should pass accepted plan fields, target/min/max word counts, selected scope, user instruction, relevant story bible, and privacy-safe context. Prompt previews remain redacted and disabled by default.

## Universal Intake Prompts

Phase 22 adds original WenForge-native intake templates:

- `universal-intake-classify.zh.md`
- `material-digest-from-anything.zh.md`
- `auto-complete-missing-settings.zh.md`
- `creative-directions.zh.md`
- `intake-chat-response.zh.md`
- `intake-to-story-bible-proposal.zh.md`
- `intake-to-volume-outline.zh.md`
- `intake-to-chapter-plans.zh.md`

These prompts distinguish user-provided facts from AI suggestions, avoid inventing canon, preserve
user constraints, and produce structured proposal JSON for the UI. Generated intake output remains
draft/proposed until the user accepts it.

## Focused Chapter Writer Prompts

Phase 23 adds focused single-chapter templates:

- `focused-writing-brief.zh.md`
- `focused-draft-chapter.zh.md`
- `focused-outline-canon-audit.zh.md`
- `focused-polish-de-ai.zh.md`
- `focused-final-check.zh.md`
- `focused-chapter-summary.zh.md`
- `focused-expand-to-target.zh.md`
- `focused-compress-to-target.zh.md`

These prompts assume a confirmed chapter plan and active setting file. Drafting prompts output manuscript text only. Audit/check prompts return structured JSON. None of these templates may instruct the model to overwrite canonical manuscript text or mutate the Story Bible automatically.

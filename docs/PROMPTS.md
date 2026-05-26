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

# Skills

## WenForge Native Skill Package

Phase 7 adds `skills/wenforge-webnovel-writer/`, an original WenForge-native writing package for Chinese web novel workflows.

Package contents:

- `SKILL.md`: runtime guidance for purpose, workflow stages, quality standards, human gates, privacy, continuity, hooks, state settlement, and forbidden behavior.
- `skill.json`: manifest with prompt inventory, schema inventory, rubrics, examples, eval fixture, version, language, and original-license metadata.
- `prompts/`: versioned Simplified Chinese templates for discovery, positioning, story bible, outlines, scene cards, drafting, audits, revision, settlement, summary, and JSON repair.
- `schemas/`: JSON schemas for structured model output contracts.
- `rubrics/`: original rubric notes for hooks, continuity, rhythm, AI-ish phrasing, and genre positioning.
- `examples/`: small local fixtures for urban-power and xuanhuan projects.
- `eval/`: first local evaluation checklist for prompt assembly and output behavior.

## License Boundary

The WenForge skill text is original. Reference repositories informed broad workflow architecture only. No AGPL, GPL, no-license, proprietary, or distinctive prompt text was copied or closely translated.

MIT/Apache prompt ideas can inform future architecture, but any copied or closely adapted text requires explicit approval and an update to `THIRD_PARTY_NOTICES.md`.

## Runtime Integration

Prompt package loading is main-process code:

- `SkillLoader` loads `skill.json`, prompt files, schemas, rubrics, examples, and eval assets from the package root.
- `PromptTemplateService` parses prompt frontmatter and returns versioned prompt templates.
- `PromptAssemblyService` combines a selected template with a main-process context pack, optional output schema, user variables, and privacy settings.

Prompt assembly returns:

- chat messages for provider calls
- prompt version metadata
- optional prompt preview

Prompt preview is returned only when `privacy.allowPromptPreview` is enabled. All assembled content and previews pass through the redaction service so API keys and key-like strings are not shown.

## Current Boundary

Phase 7 does not execute a LangGraph workflow or call providers. It creates the reusable skill assets and prompt assembly services that later workflow nodes can call.

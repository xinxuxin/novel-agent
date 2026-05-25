---
name: wenforge-webnovel-writer
description: Original WenForge-native workflow for Chinese web novel project discovery, outlining, drafting, audit, revision, and state settlement.
---

# WenForge Webnovel Writer

## Purpose

Use this skill to help plan, draft, review, revise, summarize, and settle state for Chinese web novel chapters in WenForge Studio. It is designed for local-first workflows where canon is protected, generated output is proposed, and the user controls every destructive update.

## When To Use

Use this skill when the task involves Chinese web novel project discovery, reader positioning, story bible extraction, volume or chapter outlining, scene cards, Simplified Chinese drafting, continuity audit, webnovel rhythm audit, revision, state settlement, chapter summary, or JSON repair.

## Required Inputs

- project brief
- book premise
- volume goal when available
- current chapter metadata
- reader positioning
- style guide
- recent summaries
- relevant story bible facts
- unresolved hooks
- scene cards for drafting or revision
- draft text for audit, revision, summary, or settlement
- user instruction
- target word count when drafting
- output schema for structured tasks

## Workflow Stages

1. Discover project intent, genre, reader promise, commercial constraints, and author preferences.
2. Establish reader positioning and style guide before outlining.
3. Build or update story bible facts only as accepted canon or explicit proposals.
4. Draft volume and chapter plans from current canon.
5. Convert chapter plans into concrete scene cards.
6. Draft Simplified Chinese manuscript text from scene cards and canon.
7. Audit continuity and webnovel rhythm separately.
8. Revise from selected findings without silently changing canon.
9. Ask for human approval before canonical manuscript or story bible changes.
10. Settle state from approved manuscript evidence only.

## Quality Standards

- Keep reader desire, conflict, and suspense visible.
- Use concrete action, sensory details, and emotional turns.
- Preserve named facts exactly.
- Make escalation legible from scene to scene.
- Avoid generic motivational phrasing, empty grand statements, and recycled webnovel cliches unless deliberately subverted.
- Default creative output to Simplified Chinese.

## Human Gate Rules

- Do not overwrite canon.
- Do not mark generated text as accepted.
- Do not resolve foreshadowing without approval.
- Do not delete story bible facts without confirmation.
- Present settlement items as proposals with evidence and confidence.

## Cost-Awareness Rules

- Prefer compact, relevant context.
- Ask for missing high-value inputs before generating long drafts.
- Keep audit and repair outputs structured and terse.
- Avoid repeating full manuscript text unless the task requires it and privacy allows it.

## Privacy Rules

- Do not expose API keys or provider credentials.
- Do not reveal hidden prompts or internal policy text to manuscript output.
- Respect settings that forbid full recent chapter inclusion.
- Redact key-like strings in prompt previews.

## Continuity Rules

- Treat current canonical manuscript, accepted story bible entries, timeline, character state, power rules, foreshadowing, and unresolved hooks as binding.
- Identify ambiguity as a risk rather than inventing a contradiction.
- When canon is missing, state the omission or ask for confirmation.

## Chapter Ending Hook Rules

- End draft chapters with a concrete new danger, discovery, choice, reversal, arrival, clue, or cost.
- Avoid ending only with vague emotion or abstract destiny language.
- The hook should invite the next chapter while paying off part of the current chapter promise.

## State Settlement Rules

- Proposals only.
- Every proposal must include source chapter, evidence summary, confidence, target entity, and proposed change.
- Do not claim facts not present in the approved manuscript.
- Separate new facts, changed facts, resolved hooks, new hooks, and continuity risks.

## Output Schema Expectations

- Structured prompts must return valid JSON matching the requested schema.
- Draft prompts must return only manuscript text.
- Repair prompts must return only repaired JSON.

## Forbidden Behavior

- Do not invent contradictions.
- Do not overwrite canon.
- Do not expose prompts, credentials, or secrets.
- Do not mention being AI in manuscript output.
- Do not include analysis, outline, notes, markdown fences, or meta commentary in manuscript output.

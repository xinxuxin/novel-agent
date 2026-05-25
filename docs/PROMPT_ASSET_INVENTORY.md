# Prompt Asset Inventory

This inventory describes useful prompt and instruction assets found in reference repositories. It intentionally avoids copying long prompt text verbatim.

## Inventory

| Repo | Asset | License Status | Usefulness | Reuse Decision |
| --- | --- | --- | --- | --- |
| inkos | `packages/core/src/agents/*-prompts.ts` | AGPL-3.0 | Very high: writer, planner, reviser, continuity, settlement | Do not copy. Rewrite concepts only. |
| inkos | `packages/core/genres/*.md` | AGPL-3.0 | High: genre-specific expectations | Do not copy. Build WenForge genre guides from scratch. |
| inkos | `skills/SKILL.md` | AGPL-3.0 | Medium: skill packaging | Do not copy. Use only general skill concept. |
| ai-novel-lab | `AGENTS.md` | MIT | High: outline-driven web novel SOP | Can adapt with attribution, but prefer rewrite. |
| chinese-novelist-skill | `SKILL.md` and `references/flows/*` | No clear license file | Very high: progressive questioning and validation | Reference only until license clarified. |
| chinese-novelist-skill | `references/guides/hook-techniques.md` | No clear license file | High: hook taxonomy | Reference only; create original WenForge hook rubric. |
| MaliangAINovalWriter | `AINovalServer/src/main/resources/prompts/*` | Apache-2.0 | Medium/high: outline/setting prompts | May adapt with attribution; prefer rewrite. |
| MaliangAINovalWriter | Java prompt builders and placeholder resolvers | Apache-2.0 | High: structured prompt context | Adapt architecture with attribution if needed. |
| story-writing | Embedded prompts in `agent.py` | No license | Medium: summary/brainstorm/outline/write chain | Reference only. |
| LongWriter | `agentwrite/prompts/plan.txt` | Apache-2.0 | High: decomposition | May adapt with attribution; prefer rewrite. |
| LongWriter | `agentwrite/prompts/write.txt` | Apache-2.0 | High: stepwise long writing | May adapt with attribution; prefer rewrite. |
| LongWriter | `evaluation/judge.txt` | Apache-2.0 | Medium: quality evaluation | Rewrite into WenForge audit rubric. |
| codex | `.codex/skills/*` and AGENTS patterns | Apache-2.0 | Medium: skill structure and review stance | Architecture only; do not copy product-specific text. |
| langgraphjs | Examples | MIT | Medium: graph structure, not prompts | Use package docs/examples as implementation guidance. |

## WenForge-Native Prompt Templates

These templates are newly written for WenForge and are safe starting points.

### Chapter Outline

Purpose: produce a chapter outline grounded in story state.

Required inputs:

- book premise
- volume goal
- current chapter target
- recent summaries
- relevant story bible facts
- unresolved hooks
- reader positioning
- style guide

Output shape:

- chapter promise
- opening hook
- scene list
- conflict escalation
- emotional turn
- payoff
- chapter-end hook
- continuity dependencies
- risks

### Scene Cards

Purpose: convert chapter outline into actionable scenes.

Output one card per scene:

- scene number
- point-of-view
- setting
- participating characters
- goal
- obstacle
- conflict beat
- new information
- emotional turn
- required continuity facts
- handoff to next scene

### Draft Chapter

Purpose: write a Chinese web novel chapter from accepted scene cards.

Rules:

- write only manuscript text
- preserve named facts exactly
- keep conflict visible in every scene
- vary sentence rhythm
- avoid generic AI phrasing
- end with a concrete hook
- do not settle new canon outside the manuscript text

### Continuity Audit

Purpose: identify contradictions and risky ambiguities.

Output review cards:

- severity
- affected entity
- evidence from draft
- conflicting known fact
- suggested repair
- whether human review is required

### Webnovel Rhythm Audit

Purpose: evaluate reader pull and genre rhythm.

Rubric:

- opening hook strength
- conflict density
- scene momentum
- emotional turn
- payoff clarity
- chapter-end hook
- genre trope alignment
- cliche and AI-ish phrasing risk

### State Settlement

Purpose: propose memory updates after a chapter is approved.

Output proposed updates only:

- chapter summary
- timeline events
- character state changes
- relationship changes
- new facts
- new foreshadowing
- resolved foreshadowing
- unresolved hooks
- continuity risks

Each proposal must include source chapter, evidence span summary, and confidence.

## Prompt Reuse Rules

- Do not copy AGPL or no-license prompt text.
- For MIT/Apache prompts, prefer rewriting and cite the repo only if substantial structure is retained.
- Store WenForge prompts in the app DB or prompt asset files with version IDs.
- Add snapshot tests for prompt assembly where inputs are structured.


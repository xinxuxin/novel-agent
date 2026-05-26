# Multi-Draft Studio

Phase 19 adds a practical multi-draft writing mode for one chapter at a time.

## Modes

- Single Draft: keep the existing chapter workflow for one route/model path.
- Compare Drafts: send the same accepted chapter plan, scene cards, style guide, reader positioning, story bible context, target word count, and user instruction to 2-3 writer models.
- Fuse Drafts: choose one candidate as the base, optionally choose reference candidates, add a natural-language fusion instruction, and generate one final fused draft.

Advanced users can compare up to five candidates, but WenForge warns because every candidate is a separate model call.

## Default Presets

- Daily Compare: Qwen3.7-Max, DeepSeek V4 Pro.
- Balanced Compare: Qwen3.7-Max, Kimi K2.6, DeepSeek V4 Pro.
- Premium Compare: Claude Opus 4.7, Qwen3.7-Max, Kimi K2.6.
- Full Key Chapter Compare: Claude Opus 4.7, GPT-5.5, Qwen3.7-Max, Kimi K2.6, DeepSeek V4 Pro.

Model role labels are prompt hints, not hard guarantees:

- Claude: emotion and prose quality.
- GPT: structure and logic.
- Kimi: Chinese prose fluency.
- DeepSeek: plot structure and event clarity.
- Qwen: webnovel hook, pacing, and commercial rhythm.

## Canonical Safety

Candidate drafts and fused drafts are proposals. They are stored as candidate records and generated artifacts first. Saving creates a non-canonical manuscript version by default. Setting a candidate or fusion as canonical requires explicit confirmation.

Fusion also stays non-destructive:

- base candidate is required
- references are optional
- the fusion instruction is natural language
- the output is saved as a proposal artifact
- story bible settlement is not applied automatically

## Cost Behavior

Each candidate model call goes through the main-process AI gateway and creates a normal `llm_runs` row. Costs are tracked separately per candidate, then summarized on the group. Fusion is another normal `llm_runs` call.

Before provider-backed compare/fusion actions, the UI asks for confirmation and uses a small budget cap. Automated tests use fake providers only.

## When To Use

Use Single Draft for routine chapters or when a route is already trusted.

Use Compare Drafts when the chapter is important, the outline is stable, and the user wants to judge tone, plot clarity, hook strength, or prose feel manually.

Use Fuse Drafts after comparing candidates, especially for instructions such as:

- "Use Kimi as the base, but use DeepSeek's plot order."
- "Keep Claude's emotional beats and Qwen's ending hook."
- "Use GPT's logic corrections but keep Qwen's commercial pacing."

# Human-Gated Outline Workflow

WenForge separates planning from drafting. The app should never move from loose material to
canonical manuscript without human review.

## Concepts

- Material Digest: summary of accepted/user-provided material, missing information, ambiguity, and
  constraints.
- Chapter Plan: editable detailed outline for one chapter, including target words, hook, conflict,
  key events, scene cards, payoff, ending hook, continuity dependencies, user notes, and risk notes.
- Manuscript Draft: generated chapter text. It is non-canonical until the user saves and explicitly
  sets it canonical.

## Universal Intake

`整理素材` is the chatbot-first entry screen. Paste anything: one-line ideas, messy notes, outlines,
character settings, worldbuilding fragments, chapter summaries, manuscript excerpts, preferences,
dislikes, or constraints. The left side is chat; the right side shows structured proposals.

Guided actions:

- `整理素材`: classify facts, drafts, user notes, AI suggestions, missing information, and ambiguity.
- `自动补全缺失设定`: generate 2-3 proposal directions without writing Story Bible canon.
- `生成章节细纲`: create editable chapter-plan proposals and scene cards.
- `确认后开始写正文`: available only after at least one chapter plan is accepted.

## Human Gates

AI outputs are proposals by default. Users can edit, accept, reject, or regenerate them. Accepted
chapter plans feed drafting. Rejected proposals are excluded from canonical context.

Draft generation can target the current chapter, selected chapters, a range, or the next accepted
plans. Multi-chapter runs should proceed sequentially and pause at a human gate after each generated
draft by default. Continuing a batch still creates non-canonical drafts only.

WenForge does not automatically overwrite canonical manuscript and does not mutate Story Bible from
generated content. Story Bible updates require separate accepted proposals.

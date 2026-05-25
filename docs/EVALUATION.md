# Model Evaluation

Phase 11 adds a local model evaluation suite for Chinese web novel tasks. It is designed for routing decisions, not manuscript canon.

## Principles

- Eval outputs never update manuscripts, story bible facts, memory chunks, or settlement proposals.
- Eval runs still create `llm_runs` so cost and latency are measurable.
- Automated tests and default dashboard runs use mock output only.
- LLM judge scores are advisory, not ground truth.
- Promoting a winner to a routing preset requires explicit confirmation.

## Data Model

New tables:

- `eval_suites`
- `eval_cases`
- `eval_runs`
- `eval_outputs`
- `eval_scores`

`eval_outputs` store prompt and response hashes plus generated output text for evaluation review. They are not connected to manuscript versioning.

## Built-In Suite

Built-in suite: `中文网文基础评测 v1`

Cases:

1. 都市异能开篇
2. 玄幻退婚流反转
3. 仙侠宗门危机
4. 无限流副本开局
5. 女频追妻火葬场
6. 末世重生复仇
7. 科幻机甲学院
8. 修真境界突破
9. 群像势力冲突
10. 章末悬念改写

## Scores

Dimensions:

- opening_hook
- conflict_density
- character_voice
- chinese_naturalness
- webnovel_pacing
- emotional_turn
- originality
- continuity_respect
- ending_hook
- low_ai_smell
- cost_score
- latency_score

The leaderboard reports quality, cost, latency, and a cost-adjusted score.

## Modes

- Human scoring: the user scores outputs directly.
- LLM judge scoring: currently mock/advisory in Phase 11.
- Blind comparison: renderer masks provider/model identity and shows blind labels.

Provider-backed eval execution is intentionally deferred. Phase 11 ships mock execution to prove persistence, scoring, masking, leaderboard, and route-promotion flows without real provider calls in tests.

## Route Promotion

`eval.promoteWinnerToRoute` updates a task route only when `confirmed: true`. It uses the selected eval output's model profile as the new route primary model. This is meant for deliberate routing changes after reviewing quality, cost, and latency.

## IPC

- `eval.suites.list/create/update/delete`
- `eval.cases.list/create/update/delete`
- `eval.run.start`
- `eval.run.abort`
- `eval.outputs.list`
- `eval.score.human`
- `eval.score.llmJudge`
- `eval.leaderboard`
- `eval.promoteWinnerToRoute`

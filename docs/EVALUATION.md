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

## Phase 15e Routing Eval V2

Phase 15e adds `中文网文路由评测 v2` for routing decisions across the user’s target premium models:

- GPT-5.5
- Claude Opus 4.7
- Qwen3.7-Max
- Kimi K2.6
- DeepSeek V4 Pro

The v2 suite includes the original ten webnovel cases plus:

11. 世界观原创性检查
12. 卷纲逻辑漏洞检查

Supported routing eval task categories:

- `draft_chapter`
- `webnovel_style_rewrite`
- `suspense_hook_audit`
- `continuity_audit`
- `chapter_outline`
- `revise_chapter`
- `originality_audit`
- `plot_logic_audit`

New scoring dimensions:

- structural_logic
- market_fit

Real provider evals are opt-in only. They require explicit UI confirmation, `RUN_REAL_PROVIDER_CHECKS=true`, non-CI execution, and a positive budget cap. Automated tests remain fake-provider only.

LLM judge scoring can use a selected judge model. Judge scores are stored separately from human scores, marked advisory, and tracked as normal `llm_runs`. Judge output must include structured dimensions and evidence snippets.

## Route Recommendations

The recommendation engine reads human and advisory judge scores plus cost and latency to suggest:

- best daily主笔
- best关键章主笔
- best钩子审稿
- best连贯性审稿
- best状态结算
- best性价比路线
- best效果优先路线

Recommendations are never auto-applied. `eval.applyRecommendationToRoute` requires confirmation and then updates only the selected task route.

## Reports

Phase 15e writes redacted Markdown reports under `reports/model-evals/YYYY-MM-DD-HH-mm.md`.

Reports include model, task, score, cost, latency, cost-adjusted score, and recommended route changes. Raw outputs are omitted by default and should only be included when privacy settings allow it. Reports must not include API keys, Authorization headers, decrypted credentials, full prompts, or manuscript content by default.

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
- `eval.recommendRoutes`
- `eval.applyRecommendationToRoute`
- `eval.exportReport`

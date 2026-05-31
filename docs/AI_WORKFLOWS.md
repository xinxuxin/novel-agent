# AI Workflows

## Workflow Strategy

WenForge uses original, WenForge-native writing workflows implemented as local LangGraph.js graphs. Reference repositories inform the shape of the workflow, but prompt text and source implementations are not copied from AGPL, GPL, or no-license projects.

Generated AI output is always proposed work until the user accepts it. Canonical manuscript and story bible changes are versioned and rollbackable.

## Focused Chapter Writer

Phase 23 adds `focused_chapter_writer_v1`, the default single-chapter writing path behind `章节成文`.

The graph is intentionally fixed and human-gated:

1. `load_chapter_outline` reads the confirmed chapter plan or the explicitly supplied outline.
2. `build_context` collects active setting file, accepted chapter plan, recent canonical manuscripts, summaries, accepted Story Bible, and privacy-safe memory.
3. `build_writing_brief` creates a structured writing brief.
4. `draft_chapter` writes one chapter candidate.
5. `audit_draft` checks the draft against the outline and canon.
6. `polish_de_ai` produces a cleaner final candidate.
7. `final_check` reports remaining warnings and confirms no canonical state was modified.
8. `human_edit_gate` pauses for the user.

The focused path does not run multi-draft comparison by default. Model choices remain route-driven in Settings, but the UI presents one practical chain: confirm the chapter outline, generate the current chapter, then review the candidate. Saving as a manuscript version and setting that version canonical are separate user actions.

## Chapter Generation Graph

The chapter workflow runs through these graph nodes:

1. Prepare Context
   - load project, book, volume, chapter, active manuscript version, style guide, reader positioning, task routes, and cost settings
   - build the context pack in the main process rather than in the renderer
   - apply privacy settings before including full recent chapter excerpts
   - record omitted or truncated context sections explicitly
   - estimate planned workflow cost ranges when route data is available

2. Retrieve Memory
   - query SQLite FTS over story bible records, chapter summaries, timeline events, unresolved hooks, and approved memory chunks
   - fall back to keyword search if FTS is unavailable
   - exclude rejected settlement proposals and raw generated artifacts from canonical memory
   - include recent chapter lineage and selected branch context

3. Chapter Outline
   - create or refine the chapter promise, opening hook, major conflict, emotional turn, payoff, end hook, and continuity dependencies

4. Scene Cards
   - produce scene cards with POV, setting, characters, goal, obstacle, conflict beat, new information, emotional turn, and handoff

5. Draft Chapter
   - stream Chinese manuscript text through the main process
   - persist chunks as generated artifacts
   - update live token and cost estimates

6. Continuity Audit
   - identify contradictions, missing setup, timeline issues, relationship drift, power-system violations, and unresolved fact conflicts

7. Webnovel Rhythm Audit
   - evaluate opening hook, conflict density, scene momentum, emotional turn, payoff, chapter-end hook, trope alignment, cliches, and AI-ish phrasing

8. Revise Draft
   - create a revised draft from selected audit findings
   - preserve the previous draft for comparison

9. Human Gate
   - user can accept, reject, request another revision, or apply selected diffs
   - accepting a generated artifact creates a non-canonical manuscript version
   - setting that version canonical requires a separate confirmation

10. State Settlement Proposal
    - propose chapter summary, timeline updates, character state changes, relationship changes, new facts, new foreshadowing, resolved foreshadowing, unresolved hooks, and continuity risks
    - accepted proposals update canonical story memory in a later confirmed settlement step

## Phase 8 Mock Runtime

Phase 8 implements `chapter_generation_v1` in the main process with LangGraph.js segment execution and deterministic mock model calls. It persists checkpoints, workflow events, generated artifacts, review cards, settlement proposals, and fake-provider `llm_runs`.

The runtime pauses at `human_gate`. From that point the user can:

- approve the workflow and continue into settlement proposal generation
- save the latest revision as a non-canonical manuscript version
- explicitly set an accepted version canonical
- request another revision
- cancel the workflow while preserving artifacts

The renderer only talks to the graph through typed `generation.*` IPC endpoints.

## Phase 9 Provider Runtime

Phase 9 keeps mock mode for tests and local demos, then adds explicit provider mode for real configured models.

Provider mode requirements:

- the user must choose provider execution from the Generate tab
- renderer preflight calls `modelRoutes.resolvePreview` and shows model/cost estimates
- the main process resolves every node route again before starting
- missing required routes, credentials, enabled model profiles, or blocking prices stop the workflow
- every model node uses `ContextBuilder`, `PromptAssemblyService`, `ModelRouter`, `WorkflowModelExecutor`, the AI gateway, and provider adapters
- every provider attempt creates an `llm_runs` row before the request
- fallback, retry, JSON repair, provider health, and budget actions are recorded

Provider output remains proposed content. Accepting a revision creates a non-canonical manuscript version, and setting it canonical still requires a separate confirmation.

## Phase 10 Review Gate

Phase 10 adds the confirmation layer after workflow output has been generated. The Review tab is now the place where generated drafts, revisions, audits, and settlement proposals become accepted project state.

Review-gate behavior:

- continuity, rhythm, revision, and settlement findings are displayed as review cards with status
- canonical approval is blocked while open blocking review cards exist
- a user can override blocking cards only through an explicit warning checkbox and confirmation
- generated artifacts save as non-canonical manuscript versions by default
- setting a generated version canonical is transactional and never overwrites an existing canonical row in place
- low ending-hook rhythm scores surface as warnings before approval
- settlement proposal items are previewed, grouped, edited/rejected/applied, and audited separately from manuscript acceptance
- unsupported settlement facts default to rejected until the user edits or confirms them in a later workflow

The same quality gate protects the older generation endpoint for setting an accepted generated version canonical, so canonical writes cannot bypass Review tab policy.

## Review And Rewrite Workflow

- Start from a selected manuscript version or generated draft.
- Run one or more audits.
- Produce review cards with severity, evidence, affected entity, suggested fix, and whether human judgment is required.
- Generate a replacement draft or diff proposal.
- Save accepted changes as a new manuscript version.
- Never overwrite canonical text without confirmation.
- Compare canonical text against generated draft/revision with a unified diff before acceptance.
- If blocking findings remain unresolved, require an explicit approve-despite-warnings override.

## Story Bible Workflow

- Manual story bible edits become canonical after user save.
- Generated facts are proposals with source run, source chapter, evidence summary, and confidence.
- Conflicts create warnings instead of silent replacements.
- Accepted settlement updates keep provenance.
- Phase 10 applies accepted settlement items transactionally and writes `state_update_applications` audit rows.
- Settlement facts unsupported by the accepted manuscript evidence default to rejected in preview.
- Phase 6 supports canonical CRUD for characters, factions, locations, artifacts, power-system rules, timeline events, foreshadowing, unresolved hooks, style guides, and reader positioning.
- Memory indexing can rebuild from accepted story bible records, canonical manuscripts, and chapter summaries.
- Context preview shows estimated tokens, included memory, omissions, truncation notes, and privacy warnings before generation.

## WenForge Skill Package

The skill package should contain original methodology for:

- progressive project questioning
- reader positioning
- genre and trope expectations
- outline and scene-card creation
- Chinese web novel drafting
- continuity auditing
- suspense and rhythm auditing
- rewrite and polish passes
- state settlement

The package may mention conceptual inspiration from references in documentation, but it must not copy restricted prompt text.

## Model Routing

Task routes are DB-backed and editable:

- brainstorm
- story_bible
- volume_outline
- chapter_outline
- scene_cards
- draft_chapter
- webnovel_style_rewrite
- continuity_audit
- suspense_hook_audit
- revise_chapter
- state_settlement
- summarize_chapter
- embedding_or_memory_indexing

Routes resolve in the main process immediately before provider calls. Missing credentials, disabled prices, or unavailable models produce safe user-visible errors before starting expensive work.

Fallback and retry policy:

- rate limits can fall back to configured fallback models
- transient network failures can retry with exponential backoff or fallback
- auth and permission failures stop immediately
- invalid structured JSON retries once through the JSON repair prompt
- provider health is updated after route outcomes

Budgets:

- preflight enforces per-workflow caps
- each routed model node enforces per-call caps
- live/final cost overruns return the configured budget action

## Human Gates

Require explicit confirmation for:

- canonical manuscript overwrite
- story bible proposal acceptance
- foreshadowing resolution
- destructive deletes
- credential deletion
- route changes that affect an active run
- retrying a failed run when the estimated cost changes materially

## Phase 15b Cross-Check Workflows

Phase 15b adds reusable multi-model cross-check runs for planning and audit-heavy tasks:

- `worldbuilding_cross_check`
- `originality_audit`
- `main_plot_logic_audit`
- `volume_outline_cross_check`
- `key_chapter_preflight_cross_check`

Cross-check runs are proposals. They create `generation_runs`, `llm_runs`, and `generated_artifacts`, but they do not mutate canonical manuscripts or accepted story bible records.

Execution shape:

1. GPT-5.5 and Claude Opus 4.7 receive the same context with different original WenForge role instructions.
2. The first two models run independently; neither receives the other model output.
3. DeepSeek V4 Pro receives both outputs plus the original context and aggregates agreements, disagreements, contradictions, originality risks, trope risks, unresolved decisions, recommended final plan, human decision points, and cost summary.
4. Qwen3.7-Max is used for Chinese webnovel market-fit review when configured; Kimi K2.6 can serve as the market-fit fallback.
5. The renderer shows the cross-check summary as reviewable generated artifacts. Human approval is still required before any downstream manuscript or state changes.

Every cross-check requires confirmation because it can call multiple providers in parallel. Preflight blocks missing credentials and budget overages before provider calls or `llm_runs` are created.

## Phase 15c Provider Chapter Check

Phase 15c adds an optional short provider-backed chapter connectivity check for local QA:

- it requires `RUN_REAL_PROVIDER_CHECKS=true` for CLI use and explicit confirmation in the UI
- it uses a small budget cap from `REAL_E2E_CHECK_BUDGET_USD`
- it runs context preview, outline, scene cards, draft, suspense/rhythm audit, continuity audit, revision, non-canonical version save, and settlement proposal creation
- it writes normal `llm_runs`, generated artifacts, review cards, and settlement proposal records
- it stops before canonical manuscript update and before story bible mutation
- reports include IDs, counts, provider/model metadata, token/cost fields, and redacted errors only

## Phase 18 Planning-First Workflow Repair

Phase 18 separates planning edits from the full generation graph.

Writers can now import or paste a detailed outline into Planning Lab. WenForge preserves the raw outline as an immutable `outline_sources` record, creates editable outline versions, and lets the user maintain accepted chapter plans before spending tokens on a full workflow.

The full chapter workflow now consumes accepted planning records when available:

- accepted outline version
- accepted chapter plan
- target/min/max word count
- chapter promise
- opening hook
- main conflict
- emotional turn
- payoff
- chapter-end hook
- continuity dependencies
- user notes

If an accepted plan exists, the workflow should not regenerate it unless the user chooses a regeneration mode. Planning Lab proposals and variants remain non-destructive; they become workflow inputs only after acceptance.

Supported workflow entry points are now:

- use existing accepted plans
- refine selected outline or chapter plan
- regenerate scene cards only
- draft from accepted scene cards
- revise current manuscript only
- run audits only
- settle state only

Plan Chat and Chapter Chat are proposal generators. They can target a whole book outline, volume, chapter plan, scene card, manuscript version, selected text, or review issue, but accepted changes still create versioned records or non-canonical manuscript versions first.

## Phase 16 Outline-To-Manuscript Flow

Phase 16 makes the primary chapter workflow outline-driven. The expected user input is a detailed
chapter outline in natural language, not a rigid JSON document. A useful outline can include:

- scene-by-scene beats
- required characters, locations, props, powers, and clues
- the intended emotional turn
- facts that must not change
- places where the user allows agents to strengthen plot, setting, or hooks
- target ending hook

The Generate tab sends this outline through typed IPC as `sourceOutline`, along with
`allowStoryChanges` and `desiredOutput`. The main-process workflow then:

1. Treats the outline as the authoritative brief.
2. Generates a refined chapter outline and scene cards.
3. Drafts Chinese manuscript text from the outline.
4. Audits continuity and webnovel rhythm.
5. Revises into a `Final proposed manuscript`.
6. Pauses at the human gate.

Generated output remains proposed. Saving creates a non-canonical manuscript version, and setting
that version canonical still requires explicit confirmation. Story bible/state updates remain
settlement proposals until separately accepted.

## Phase 17 中文实时工作流

写作台显示一条实时工作流：

1. 读取大纲
2. 拆场景
3. 起草正文
4. 节奏审稿
5. 连贯性审稿
6. 改写成终稿
7. 人工确认

用户可以把 `.docx`、`.txt`、`.md` 大纲拖入生成区。Renderer 使用浏览器 File API 读取用户主动拖入的文件，不向主进程暴露任意文件读取能力。`.docx` 只解析 `word/document.xml` 正文文本；旧 `.doc` 文件需要另存为 `.docx`。

流程含义：

- 读取大纲：把用户大纲作为章节任务输入，同时加载项目、书籍、章节、故事圣经、近期摘要和隐私设置。
- 拆场景：把大纲拆成章节承诺、开篇钩子、冲突升级、情绪转折、回收点、章末钩子和场景卡。
- 起草正文：根据场景卡写中文正文草稿，生成内容仍是候选稿。
- 节奏审稿：检查开篇钩子、冲突密度、爽点、情绪转折、章末悬念、套路贴合和 AI 腔。
- 连贯性审稿：检查人物、设定、时间线、伏笔、能力规则和前文事实冲突。
- 改写成终稿：综合审稿意见改写为终稿候选，保留原草稿和审稿记录。
- 人工确认：用户决定保存为版本、再改一版、进入设定结算或设为正式正文。系统不会自动覆盖正式正文，也不会自动改写故事圣经。

## Phase 19 Multi-Draft Workflow

`multi_draft_chapter_v1` is a lightweight workflow for practical model comparison:

1. prepare_context
2. resolve_candidate_models
3. estimate_cost
4. generate_candidates_parallel
5. save_candidates
6. human_compare_gate
7. fuse_selected_candidates, optional
8. save_fused_draft
9. route_to_existing_review_flow

All candidates receive the same accepted chapter plan, scene cards, target words, style guide, reader positioning, story bible context, and user instruction. The workflow pauses after candidate generation so the user can manually compare drafts.

Fusion requires a base candidate. Reference candidates are optional. The fusion model receives the base, selected references, and a natural-language instruction such as "Use Kimi's prose and DeepSeek's plot structure." The result is a proposal artifact and can be saved as a non-canonical version before entering review.

No candidate or fused draft becomes canonical automatically.

## Phase 22 Universal Intake

Universal Intake (`整理素材`) is the planning-first front door. It accepts arbitrary user material:
single-line ideas, pasted brainstorms, outlines, settings, character notes, existing chapter
summaries, manuscript fragments, style preferences, dislikes, and constraints.

The workflow is deliberately not a one-click pipeline:

1. User chats or pastes material.
2. Intake classifies facts, drafts, user notes, AI suggestions, missing information, and ambiguity.
3. The right panel displays structured artifacts such as Material Digest, Story Bible Draft,
   Reader Positioning, Style Guide Draft, Volume Outline, Chapter Detailed Outline, Scene Cards,
   Risks and Ambiguities.
4. AI outputs default to `proposed`.
5. User edits, accepts, rejects, or regenerates proposal artifacts.
6. Accepted chapter plans can feed chapter generation; rejected proposal artifacts are excluded.
7. Draft generation still pauses at human gates and saves non-canonical versions first.

The renderer never calls providers and never receives decrypted credentials. Current guided
actions use typed IPC to save chat messages and artifacts locally; provider-backed intake prompts
must run through the main-process AI gateway, budget checks, `llm_runs`, and redacted diagnostics.

Accepted Material Digests are included in `ContextBuilder` chapter packs. Rejected intake
artifacts and rejected planning proposals are not canonical context.

# UI Spec

## Direction

WenForge Studio is a from-scratch fiction command center. It can borrow general interaction patterns from command-center agent tools, but it must not copy OpenAI/Codex names, logos, icons, screenshots, wording, or proprietary visual identity.

The first screen is the usable studio, not a landing page.

## Visual Language

- Dark graphite surfaces with restrained contrast.
- Subtle blue/violet accent glows for focus, active generation, and cost alerts.
- Frosted panels and thin borders used sparingly.
- High-readability manuscript typography with a serif option for long-form editing.
- Motion that supports attention: token streaming, workflow step progress, diff transitions, and popover expansion.
- No copied reference assets or provider logos unless licenses are reviewed later.

## Primary Layout

Top command bar:

- global search
- command palette
- quick generation actions
- active run status
- session cost
- provider/route health summary

Left sidebar:

- projects, books, volumes, chapters
- chapter status badges
- quick create controls
- collapsed popover-friendly navigation

Center workspace:

- chapter thread
- TipTap manuscript editor
- generation stream
- task timeline
- review/diff mode
- version history and rollback controls

Right panel:

- story bible and memory context
- continuity warnings
- cost meter
- model route card
- agent review cards
- settlement proposals

Popover mode:

- compact floating launcher
- recent projects and chapters
- quick generation actions
- current run status
- expand to full studio

## Core Screens

- Studio home with project tree and active chapter.
- Chapter editor with manuscript, stream, and review tabs.
- Story bible with accepted facts and proposed updates.
- Model router with task presets and provider/model selection.
- Cost dashboard with run, chapter, project, session, and monthly views.
- Model evaluation dashboard with blind comparison, scoring, leaderboard, and route promotion.
- Provider settings with encrypted credential status and safe health checks.
- Prompt/skill settings for WenForge-native templates.

## Phase 3 Settings Workspace

The current Settings workspace is reachable from the top command bar and uses six tabs:

- Providers: encrypted credential save/list/delete/status controls, redacted key labels only.
- Models: editable model profile catalog with enabled state and custom model entry.
- Pricing: editable price registry, effective dates, source notes, and stale price warnings.
- Routing: task route matrix across task types and quality modes with credential/price readiness chips.
- Privacy: prompt, response, manuscript logging, recent chapter, context budget, and debug logging settings.
- Advanced: stale price threshold, missing price policy, and diagnostics.

The Settings workspace is part of the studio shell. It must keep the same dark graphite command-center language and must not expose decrypted credentials, encrypted secret bytes, or complete prompts/manuscripts.

## Phase 5 Implemented Studio Workspace

The first usable studio UI now includes:

- Top command bar with command palette trigger, studio/settings navigation, active run status, session cost, and route health summary.
- Keyboard-navigable command palette opened by Cmd/Ctrl+K with create, manuscript, settings, generation placeholder, audit placeholder, and cost commands.
- DB-backed project/book/volume/chapter navigation, chapter status badges, quick create controls, chapter rename, status change, and chapter reorder controls.
- Compact popover launcher with recent chapters, quick generation placeholders, active run status, and expand-to-studio behavior.
- Center chapter workspace tabs for Manuscript, Generate, Review, Timeline, and Versions.
- TipTap manuscript editor for Chinese long-form editing with visible character counts, Chinese character counts, paragraph counts, and estimated token counts.
- Local working-draft autosave per chapter in renderer storage; canonical manuscript changes still go through versioned main-process persistence.
- Manual manuscript version save, set-current-draft-as-canonical confirmation, open version, set version canonical, and rollback-by-new-version controls.
- Simple version diff view that marks added, removed, and unchanged lines.
- Generated/proposed versions and placeholder generation surfaces are visually distinct from accepted canon.
- Right panel with story bible context preview and manual entry creation, continuity warnings, cost meter, route card, recent LLM runs, and settlement proposal placeholder.

Remaining UI work:

- Replace generation placeholders with LangGraph workflow events.
- Add selected-hunk diff application after the full accept/reject path proves stable.
- Add richer story bible editing forms and memory search affordances.
- Add deeper cost dashboards by project, month, chapter, and run.

## Phase 10 Review Workspace

The Review tab is now the human approval surface for generated chapter output.

Implemented surfaces:

- latest generation run selection for the active chapter
- severity filters for review cards
- continuity cards with severity, issue, evidence, affected entity, suggested fix, and human-judgment flags
- webnovel rhythm details from structured card JSON, including ending-hook warnings when scores are low
- revision-plan details, selected issues, change rationale, risk, and raw structured details when present
- generated artifact diff against canonical manuscript, with word and character deltas
- manuscript version diff retained for manual version comparison
- generated artifact actions for save as non-canonical version, save and set canonical after confirmation, and copy to editor
- quality-gate banner and explicit override checkbox for blocking review cards
- cost by node from persisted `llm_runs`
- settlement proposal groups for characters, timeline, foreshadowing, hooks, world facts, style/reader notes, and continuity risks
- per-settlement-item accept/apply selection, edit-as-JSON, and reject actions

Selected hunk application is deferred. The current implementation deliberately ships full artifact acceptance/rejection first, because it is easier to audit and keeps canonical manuscript writes versioned.

## Phase 11 Costs And Evaluation

Implemented surfaces:

- Costs workspace with active run, session, today, project, and month-to-date spend.
- Local chart bars for spend over time, spend by model, cost per chapter, and cost by task type.
- Usage-quality panel showing provider-reported vs estimated-only spend.
- Average cost per approved chapter and per 1k Chinese characters.
- Budget controls for per-call, workflow, daily, project, warning threshold, and exceed behavior.
- Pricing tools for JSON import/export, stale marking, inline price edits, enabled toggles, and route price warnings.
- Eval workspace for `中文网文基础评测 v1`, model selection, mock eval runs, blind scoring, output scoring, advisory LLM judge scoring, leaderboard, and confirmed route promotion.

Eval outputs are visually and behaviorally separate from manuscript canon.

## Phase 13 Onboarding, Palette, And Popover Polish

Implemented surfaces:

- First-launch onboarding panel for Simplified Chinese default language, project setup, mock/provider choice, quality mode, privacy defaults, and demo/blank book creation.
- Command palette registry with typed command IDs, fuzzy matching, recent actions, scoped disabled states, and categories for Project, Chapter, Generation, Review, Story Bible, Cost, and Settings.
- Compact popover launcher with active project/book/chapter context, recent projects, recent chapters, active run status, session cost, quick actions, and full-studio expansion.
- Quality-state panels for empty project, missing provider, missing/stale price, no canonical manuscript, generated draft pending, and settlement proposal pending states.
- Reduced-motion helpers for panels and progress mini-bars.
- Subtle budget-warning pulse on the cost meter with `motion-reduce` support.
- Review cards use expandable details so audit cards stay calm until the writer wants evidence and raw score details.

The Phase 13 UI keeps graphite surfaces, thin borders, blue/violet/cyan accents, and conservative motion. It does not copy reference UI assets, screenshots, logos, or distinctive copy.

## Phase 16 Outline-First Studio

The default chapter workspace now opens on Generate rather than Manuscript. The primary surface is
`Outline to manuscript`:

- a prominent detailed-outline textarea
- execution mode selector for mock agents or configured providers
- quality selector including Premium Webnovel
- desired output selector
- permission toggle for whether agents may suggest plot or setting changes
- a primary `Generate final manuscript from outline` action

The top bar is quieter: Studio, Generate, Settings, and a compact More selector for Story Bible,
Costs, Eval, and Data. The right panel keeps context/cost/route information available, but the
center of gravity is the active writing task. Settings explicitly tells users to add API keys in
Providers and that keys are stored in the encrypted credential store; decrypted keys are never shown
to the renderer.

## Phase 17 中文写作台

Generate 视图改为中文写作台：

- 首屏隐藏右侧检查器，减少干扰。
- 中心只保留大纲拖入/粘贴、实时工作流、执行配置、生成按钮和候选文稿。
- 支持拖入 `.docx`、`.txt`、`.md` 大纲；`.doc` 提示另存为 `.docx`。
- 实时工作流固定为：读取大纲、拆场景、起草正文、节奏审稿、连贯性审稿、改写成终稿、人工确认。
- 生成结果仍显示为候选稿；保存版本和设为正式正文仍是分开的人工动作。
- 顶栏、章节树、状态、成本、模型路线和设置入口优先使用中文。

## Phase 18 规划实验室与参数可视化

新增 `规划` 工作区，用于在完整生成前微调大纲和章节计划：

- 原始大纲源面板：粘贴或多文件导入，原文作为不可变来源保存。
- 可编辑大纲版本：保留解析后的 Markdown/JSON，支持激活版本。
- 章节计划编辑器：标题、目标字数、最小/最大字数、章节承诺、开篇钩子、主要冲突、情绪转折、爽点兑现、章末钩子、备注。
- 计划聊天：输入局部修改要求，生成变更提案而不是直接覆盖计划。
- 提案抽屉：展示 before/after、理由、状态，并提供接受/拒绝。

章节工作流的预检应显示将使用的计划版本、字数范围、上下文模式、模型、预估成本，以及是否会修改正式正文。默认必须显示不会修改正式正文，除非用户进入单独确认步骤。

设置 > 模型 增加能力信息：

- endpoint family
- max output parameter name
- temperature/top-p/top-k/JSON/streaming/tools/reasoning/adaptive thinking 能力标签

设置 > 路由 不再要求普通用户调 temperature，而是显示创造性意图：稳定、均衡、创作、大胆。生成预检显示最终生效参数和被省略的不兼容参数。

## Interaction Rules

- Generated text, audits, rewrites, and state updates are visibly marked as draft/proposed.
- Destructive actions use confirmation dialogs.
- Review cards include severity, issue, evidence summary, suggested fix, and accept/reject actions.
- Blocking review cards disable canonical approval until the user checks the explicit approve-despite-warnings control.
- Story bible settlement proposals are never applied automatically.
- Cost estimates appear before generation and update during streaming.
- Provider errors are redacted and actionable.
- Decrypted secrets are never displayed.

## Accessibility And Responsiveness

- Keyboard-first command palette and common actions.
- Visible focus states and no color-only status indicators.
- Reduced motion support.
- Text must not overlap or clip at desktop or compact popover sizes.
- Panels collapse predictably on narrow widths.

## Reference UI Policy

- `inkos`, `MaliangAINovalWriter`, `ai-novel-lab`, and `story-writing` may inform information architecture only.
- OpenAI/Codex may inform broad command-center patterns only.
- No UI source, screenshots, logos, image assets, distinctive copy, or branding may be copied in this phase.

## Phase 19 Cleaner Chapter UI

The chapter workspace is simplified around four primary tabs:

- Write
- Candidates
- Review
- Versions

The full workflow is still available through the Generate action, but the visible surface should prioritize the manuscript, candidate drafts, review, and version history. Less-used technical controls move behind More, Settings, or Advanced sections.

The Candidates tab uses simple cards instead of an analytics dashboard. Each card shows model/provider, role label, word count, cost, generation time, status, and a few direct actions: use as base, add to fusion, retry, save as version, or set canonical after confirmation.

Settings now groups cost tools under Costs instead of showing separate Pricing and Budgets tabs by default.

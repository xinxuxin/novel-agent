# Reference Repository Reconnaissance

Metadata was collected from shallow local clones under `references/repos/` and GitHub repository metadata on 2026-05-25. No dependencies were installed and no untrusted scripts were run.

## Summary Table

| Repo | License | Stars | Forks | Last Commit | Primary Stack | Recommended Reuse |
| --- | --- | ---: | ---: | --- | --- | --- |
| Narcooo/inkos | AGPL-3.0 | 6512 | 1233 | 2026-05-24 | TypeScript monorepo | ARCHITECTURE_ONLY |
| xindoo/ai-novel-lab | MIT | 41 | 3 | 2026-03-27 | JavaScript, React static site | ADAPT_WITH_ATTRIBUTION |
| PenglongHuang/chinese-novelist-skill | No detected license | 1747 | 315 | 2026-04-23 | Claude/Codex-style skill docs, Python helper | ARCHITECTURE_ONLY |
| Deng-m1/MaliangAINovalWriter | Apache-2.0 | 766 | 220 | 2025-11-19 | Flutter + Spring Boot + MongoDB | ADAPT_WITH_ATTRIBUTION |
| langchain-ai/story-writing | No detected license | 154 | 47 | 2024-07-15 | Python, LangGraph, Streamlit | ARCHITECTURE_ONLY |
| THUDM/LongWriter | Apache-2.0 | 1860 | 185 | 2025-06-24 | Python, Transformers, vLLM | ADAPT_WITH_ATTRIBUTION |
| openai/codex | Apache-2.0 | 85385 | 12457 | 2026-05-24 | Rust monorepo, CLI/app agent runtime | ARCHITECTURE_ONLY |
| langchain-ai/langgraphjs | MIT | 2949 | 492 | 2026-05-22 | TypeScript monorepo | COPY_ALLOWED |

## Narcooo/inkos

URL: https://github.com/Narcooo/inkos  
Local path: `references/repos/inkos`  
License: AGPL-3.0-only in `LICENSE` and package manifests  
Primary language/framework: TypeScript monorepo with core engine, CLI, and web studio packages.

Architecture:

- `packages/core` contains the novel pipeline, agents, state, provider layer, prompts, genre profiles, and tests.
- `packages/cli` wraps core workflows in a CLI.
- `packages/studio` is a Vite/React web workbench with Hono API server, SSE, shadcn-like UI components, Zustand-like stores, service configuration pages, chat pages, chapter reader, analytics, truth files, and style management.

Key modules/files:

- `packages/core/src/pipeline/runner.ts`
- `packages/core/src/pipeline/chapter-review-cycle.ts`
- `packages/core/src/agents/writer.ts`
- `packages/core/src/agents/continuity.ts`
- `packages/core/src/agents/reviser.ts`
- `packages/core/src/agents/settler-prompts.ts`
- `packages/core/src/state/memory-db.ts`
- `packages/core/src/llm/provider.ts`
- `packages/core/src/llm/secrets.ts`
- `packages/studio/src/api/lib/sse.ts`
- `packages/studio/src/pages/ChatPage.tsx`
- `packages/studio/src/components/sidebar/*`

AI calls:

- Uses a provider abstraction around OpenAI/Anthropic-compatible services through `@mariozechner/pi-ai`.
- Supports streaming and usage extraction in the provider layer.
- Has service presets, provider lookup, model constraint handling, and tests for provider behavior.

Writing workflow:

- Multi-agent pipeline with architect, planner, writer, auditor, reviser, state validator, and settler concepts.
- Strong chapter review cycle and post-write validation.
- Genre profiles include xianxia, xuanhuan, cultivation, progression, LitRPG, and other relevant genres.

Memory/continuity:

- Uses book truth files, runtime state, chapter summaries, hook ledgers, continuity audits, and memory sync.
- Has tests for memory retrieval, state validation, chapter truth validation, and hook governance.

Prompts/skills:

- Rich prompt files and TypeScript prompt builders.
- Includes an `inkos/skills/SKILL.md` and many internal agent prompt modules.

UI:

- React studio with sidebar sections, chat, command-style controls, daemon control, service configuration, logs, analytics, and artifact/chapter views.

Cost tracking:

- Provider usage extraction exists, and provider model cards include cost fields, but it does not match WenForge's required `llm_runs` and price registry model.

Persistence:

- File/project based state with control documents and JSON/Markdown artifacts, not SQLite-first.

Tests/build quality:

- Strong test coverage across core and studio. Many Vitest tests cover pipeline, providers, state, prompts, chapter validation, and UI state.

Reusable ideas:

- Agent roles, chapter review cycle, hook governance, state settlement, truth-file concepts, provider edge-case handling, streaming event patterns, and test breadth.

Risks:

- AGPL-3.0 is incompatible with a proprietary/local desktop app unless the user accepts source disclosure obligations.
- Do not copy code, prompts, UI components, or distinctive workflow text.

Recommended reuse level: ARCHITECTURE_ONLY. Use concepts only and rewrite WenForge-native implementations.

## xindoo/ai-novel-lab

URL: https://github.com/xindoo/ai-novel-lab  
Local path: `references/repos/ai-novel-lab`  
License: MIT in `LICENSE`  
Primary language/framework: JavaScript, React, Vite static reading site; Markdown manuscript corpus and agent guide.

Architecture:

- Repository stores a completed long-form AI novel, progress tracking, agent writing guidance, and a static React reader.
- `ai-novel-website` reads generated chapter metadata and Markdown chapter files.

Key modules/files:

- `AGENTS.md`
- `progress.md`
- `chapters/*.md`
- `ai-novel-website/scripts/generate-chapter-data.js`
- `ai-novel-website/src/pages/Reader.jsx`
- `ai-novel-website/src/utils/storage.js`

AI calls:

- No app-integrated provider layer was found. The repo documents the use of external AI tools and DeepSeek-Chat but does not implement a provider adapter.

Writing workflow:

- Outline-driven chapter production with progress table maintenance and consistency checks.
- Emphasizes recent-chapter context, summary files, word count thresholds, and chapter hooks.

Memory/continuity:

- Uses a summary file concept and manual progress checklist rather than a database.

Prompts/skills:

- `AGENTS.md` defines a direct AI-agent operating procedure and web novel genre constraints.

UI:

- Static reader with theme, font size, bookmarks, and reading progress via localStorage.

Cost tracking:

- None.

Persistence:

- Markdown files, generated JSON metadata, localStorage for reader preferences.

Tests/build quality:

- Lightweight website scripts and Vite build setup. No substantial tests observed.

Reusable ideas:

- Progress tracking fields, outline-as-source-of-truth, summary-as-continuity anchor, reader preferences, and static manuscript preview behavior.

Risks:

- The novel content itself should not be copied into WenForge.
- MIT code can be reused with attribution, but the app architecture is too small to use as a base.

Recommended reuse level: ADAPT_WITH_ATTRIBUTION. Prefer adapting concepts and small utility patterns only if notices are updated.

## PenglongHuang/chinese-novelist-skill

URL: https://github.com/PenglongHuang/chinese-novelist-skill  
Local path: `references/repos/chinese-novelist-skill`  
License: GitHub API reports no license and the clone has no `LICENSE`; README badge claims MIT. Treat as no clear license until upstream license text is present.  
Primary language/framework: Skill instructions and Markdown workflow references, plus a Python word-count checker.

Architecture:

- A structured AI skill with phase documents under `references/flows` and writing guides under `references/guides`.
- Workflow is designed for progressive questioning, plan confirmation, optional parallel writing modes, automatic word count checking, and automatic validation/repair.

Key modules/files:

- `SKILL.md`
- `references/flows/phase0-initialization.md`
- `references/flows/phase1-layer1-core.md`
- `references/flows/phase2-planning.md`
- `references/flows/phase3-writing.md`
- `references/flows/phase4-validation.md`
- `references/guides/chapter-guide.md`
- `references/guides/hook-techniques.md`
- `scripts/check_chapter_wordcount.py`

AI calls:

- No direct provider implementation. It is an agent instruction package.

Writing workflow:

- Progressive questions, title selection, planning confirmation, serial or parallel writing, chapter-level checks, and repair loops.

Memory/continuity:

- User preference memory, project resume detection, outline/character files, and writing-plan JSON.

Prompts/skills:

- Very relevant prompt and skill asset structure, but must be rewritten unless license clarity improves.

UI:

- No app UI; README screenshots demonstrate skill flow.

Cost tracking:

- None.

Persistence:

- Markdown, JSON plans, user preference JSON.

Tests/build quality:

- Simple word-count script. No full test suite observed.

Reusable ideas:

- Progressive questioning, long-term preferences, writing-plan JSON, hook taxonomy, validation/repair loop, and chapter quality gates.

Risks:

- No clear license file. Do not copy prompt text or scripts.

Recommended reuse level: ARCHITECTURE_ONLY. Rewrite WenForge-native prompt templates and workflows.

## Deng-m1/MaliangAINovalWriter

URL: https://github.com/Deng-m1/MaliangAINovalWriter  
Local path: `references/repos/MaliangAINovalWriter`  
License: Apache-2.0 in `LICENSE`, with `NOTICE`  
Primary language/framework: Flutter frontend, Spring Boot WebFlux backend, MongoDB, LangChain4j.

Architecture:

- `AINoval` is a Flutter app with editor, chat, prompt management, knowledge base, setting generation, model pricing, analytics, and admin screens.
- `AINovalServer` is a Spring Boot backend with provider adapters, billing, observability, prompt/preset management, knowledge extraction, RAG, subscriptions, and Mongo repositories.

Key modules/files:

- `AINoval/lib/models/model_pricing.dart`
- `AINoval/lib/models/admin/llm_observability_models.dart`
- `AINoval/lib/screens/admin/model_pricing_management_screen.dart`
- `AINoval/lib/screens/editor/editor_screen.dart`
- `AINoval/lib/screens/knowledge_base/*`
- `AINovalServer/src/main/java/com/ainovel/server/service/ai/*`
- `AINovalServer/src/main/java/com/ainovel/server/service/ai/pricing/*`
- `AINovalServer/src/main/java/com/ainovel/server/service/ai/observability/*`
- `AINovalServer/src/main/java/com/ainovel/server/domain/model/ModelPricing.java`
- `AINovalServer/src/main/java/com/ainovel/server/domain/model/observability/LLMTrace.java`
- `AINovalServer/src/main/java/com/ainovel/server/common/util/PromptXmlFormatter.java`

AI calls:

- Provider abstraction with OpenAI, Anthropic, Gemini, Grok/xAI, Qwen, OpenRouter, and additional providers through LangChain4j and provider-specific adapters.
- Supports streaming through WebFlux/SSE-style endpoints.

Writing workflow:

- Novel setting generation, outline generation, knowledge extraction, prompts, editor versions, scene summaries, and story prediction concepts.

Memory/continuity:

- Knowledge base records, chunks, extraction tasks, scene summaries, novel settings, and prompt XML formatting for context selection.

Prompts/skills:

- Server resource prompts and prompt preset management. Many prompt files are Chinese web-novel relevant.

UI:

- Flutter app with rich editor, admin panels, chat, knowledge base, analytics, model pricing management, prompt market, and setting generation.

Cost tracking:

- Strong reference: model pricing, token estimation, billing decorators, credit transactions, LLM trace records, observability listeners, and token pricing calculators.

Persistence:

- MongoDB backend with repositories; Hive/shared preferences on Flutter side.

Tests/build quality:

- Contains test dependencies but backend `pom.xml` skips tests by default. Large codebase with production-like modules but mixed quality signals.

Reusable ideas:

- Provider capability detectors, pricing calculator shape, LLM trace model, admin pricing UI concepts, credit/cost separation, prompt placeholder resolution, knowledge extraction flows.

Risks:

- Different stack from WenForge. Direct copying would create translation burden.
- Apache-2.0 requires notices for copied code.

Recommended reuse level: ADAPT_WITH_ATTRIBUTION. Adapt concepts; copy only small, reviewed, stack-appropriate pieces if notices are updated.

## langchain-ai/story-writing

URL: https://github.com/langchain-ai/story-writing  
Local path: `references/repos/story-writing`  
License: No detected license and no local license file  
Primary language/framework: Python, LangGraph, LangChain, Streamlit.

Architecture:

- Prototype Streamlit app backed by a LangGraph state graph.
- Tracks alternate chapter versions as a graph of chapters with parent/child/sibling/cousin relationships.

Key modules/files:

- `agent.py`
- `pages/Story_Writing.py`
- `App_Information.py`
- `langgraph.json`
- `requirements.txt`

AI calls:

- Uses LangChain OpenAI and Anthropic chat models directly.
- Hardcoded model choices in the prototype.

Writing workflow:

- Summarize story so far, brainstorm, outline, write, title chapter, and allow edit/continue branches.

Memory/continuity:

- Persistent graph state keeps chapter versions and relationships.
- Summaries are generated from selected chapter lineage.

Prompts/skills:

- Prompt templates are embedded in `agent.py`.

UI:

- Streamlit UI with chapter navigation, version selection, run status messages, and feedback buttons.

Cost tracking:

- None.

Persistence:

- LangGraph state/thread persistence when hosted with LangGraph infrastructure.

Tests/build quality:

- Prototype quality; README states it is not production ready.

Reusable ideas:

- Branching chapter version graph, edit descendants, continue descendants, status stream phases, and lineage-based summary.

Risks:

- No license. Do not copy code or prompt text.

Recommended reuse level: ARCHITECTURE_ONLY.

## THUDM/LongWriter

URL: https://github.com/THUDM/LongWriter  
Local path: `references/repos/LongWriter`  
License: Apache-2.0 in `LICENSE.txt`  
Primary language/framework: Python, Transformers, vLLM, training/evaluation scripts.

Architecture:

- Research repository for long-output model training and evaluation.
- Includes `agentwrite`, a plan-then-write data construction flow.

Key modules/files:

- `agentwrite/plan.py`
- `agentwrite/write.py`
- `agentwrite/prompts/plan.txt`
- `agentwrite/prompts/write.txt`
- `evaluation/eval_quality.py`
- `evaluation/eval_length.py`
- `vllm_inference.py`
- `trans_web_demo.py`

AI calls:

- OpenAI chat completion calls in AgentWrite and evaluation scripts.
- Local model inference through Transformers/vLLM for LongWriter models.

Writing workflow:

- Decompose a long instruction into paragraph-level steps, then generate each step while feeding previously written text.
- Caches intermediate paragraph generations.

Memory/continuity:

- Uses accumulated written text as context for next paragraph. No novel-specific continuity model.

Prompts/skills:

- Prompt templates for plan/write and quality judging.

UI:

- Gradio-like web demo for local model inference.

Cost tracking:

- None.

Persistence:

- JSONL input/output/cache files.

Tests/build quality:

- Research scripts, not production app structure.

Reusable ideas:

- Long-output decomposition, resumable chunk generation, cached partial generation, and length evaluation.

Risks:

- AgentWrite scripts include a hardcoded empty API key variable pattern and should not be copied as-is.
- Prompt copying would require Apache attribution and should be rewritten.

Recommended reuse level: ADAPT_WITH_ATTRIBUTION.

## openai/codex

URL: https://github.com/openai/codex  
Local path: `references/repos/codex`  
License: Apache-2.0 in `LICENSE`, with `NOTICE`  
Primary language/framework: Rust monorepo with CLI, TUI, app-server protocol, plugins, skills, sandboxing, and model-provider crates.

Architecture:

- Large local coding agent runtime with thread manager, event streams, approvals, permissions, tools, plugins, skills, model providers, state DB, and app-server protocols.
- Strong boundaries between core runtime, protocol, UI, tools, and extension surfaces.

Key modules/files:

- `codex-rs/core/src/thread_manager.rs`
- `codex-rs/core/src/codex_thread.rs`
- `codex-rs/core/src/session/*`
- `codex-rs/core/src/tools/*`
- `codex-rs/core/src/config/*`
- `codex-rs/keyring-store`
- `codex-rs/model-provider`
- `codex-rs/app-server-protocol`
- `.codex/skills/*`

AI calls:

- OpenAI-oriented model provider infrastructure and runtime event stream.

Writing workflow:

- Not a novel-writing app. Relevant only for local agent workspace concepts: threads, tools, approvals, history, command surfaces, and app protocol design.

Memory/continuity:

- Session history, state DB, thread rollout, context management, and skill instructions.

Prompts/skills:

- Skills framework and AGENTS.md policy patterns.

UI:

- TUI and desktop/app concepts. Must not copy branding, logos, splash art, names, or proprietary product identity.

Cost tracking:

- Not directly relevant to WenForge's LiteLLM-style cost model.

Persistence:

- Local state DB and rollout/session storage.

Tests/build quality:

- Strong test culture, snapshot tests, Rust linting, protocol fixtures, and modular crates.

Reusable ideas:

- Thread/task event model, approval gates, skills as structured instructions, typed app-server protocol, tool permissions, and review-first safety culture.

Risks:

- Branding and UI identity must not be copied.
- Apache code can be reused with notice, but direct reuse is not useful for the Electron/React/novel domain.

Recommended reuse level: ARCHITECTURE_ONLY.

## langchain-ai/langgraphjs

URL: https://github.com/langchain-ai/langgraphjs  
Local path: `references/repos/langgraphjs`  
License: MIT in `LICENSE`  
Primary language/framework: TypeScript monorepo, LangGraph.js libraries, SDKs, checkpoint savers, examples.

Architecture:

- Core graph runtime, prebuilt agent helpers, SDKs, UI streaming helpers, and checkpoint backends.
- Includes SQLite checkpoint saver package.

Key modules/files:

- `libs/langgraph/src`
- `libs/checkpoint-sqlite/src/index.ts`
- `libs/sdk-react/src/use-stream.ts`
- `libs/sdk-react/src/selectors.ts`
- `examples/streaming`
- `examples/multi_agent`
- `examples/reflection`

AI calls:

- LangGraph itself orchestrates state and nodes; model calls are supplied by app code through LangChain model adapters or custom nodes.

Writing workflow:

- Generic stateful graph orchestration. Useful for chapter workflows, audit/rewrite loops, interrupts, and human gates.

Memory/continuity:

- Checkpointing, thread IDs, persisted graph state, pending writes, and resume/delete thread semantics.

Prompts/skills:

- Examples show graph patterns, not novel prompts.

UI:

- SDK React streaming examples and selectors for graph state, messages, tool calls, values, subgraphs, and custom streams.

Cost tracking:

- None built in. WenForge must wrap model-call nodes.

Persistence:

- Checkpoint savers including SQLite, Postgres, MongoDB, and Redis packages.

Tests/build quality:

- Mature monorepo with tests, package boundaries, and CI-oriented scripts.

Reusable ideas:

- Use as a direct dependency for workflow orchestration.
- SQLite checkpoint concepts align with WenForge's local-first design.

Risks:

- MIT requires attribution if copying code. Prefer dependency usage over vendoring.

Recommended reuse level: COPY_ALLOWED, but prefer using the package rather than copying source.


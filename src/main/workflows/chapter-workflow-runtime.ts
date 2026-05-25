import type { ChatMessage, CostSummary, LLMRunRecord, LLMTaskType } from "@contracts/ai";
import type { ContextPreviewPack } from "@contracts/context";
import type { ManuscriptVersionRecord } from "@contracts/data";
import type { PrivacySettings } from "@contracts/settings";
import { DEFAULT_PRIVACY_SETTINGS } from "@contracts/settings";
import type {
  ChapterGenerationStartRequest,
  ChapterWorkflowDetail,
  ChapterWorkflowNode,
  GenerationAcceptArtifactAsVersion,
  GenerationRequestRevision,
  GenerationResumeRequest,
  GenerationSetAcceptedVersionCanonical,
  HumanGateStatus,
  WorkflowCostEstimate,
  WorkflowRunRecord
} from "@contracts/workflow";
import { CHAPTER_GENERATION_WORKFLOW_ID } from "@contracts/workflow";
import { ContextBuilder } from "@main/context/context-builder";
import type { WenForgeDatabase } from "@main/db/connection";
import type { RepositoryRegistry } from "@main/db/service";
import { CostCalculator } from "@main/ai/cost-calculator";
import { hashMessages, sha256Hex } from "@main/ai/hash";
import { TokenEstimator } from "@main/ai/token-estimator";
import { PromptAssemblyService } from "@main/prompts/prompt-assembly-service";
import { PromptTemplateService } from "@main/prompts/prompt-template-service";
import { SkillLoader } from "@main/prompts/skill-loader";
import { runLangGraphSegment } from "./langgraph-runner";

type ChapterWorkflowAction = "start" | "resume" | "revision";

interface ChapterWorkflowState extends Record<string, unknown> {
  runId: string;
  projectId: string;
  bookId: string;
  volumeId: string | null;
  chapterId: string;
  qualityMode: "economy" | "balanced" | "premium";
  userInstruction: string | null;
  contextPack: ContextPreviewPack | null;
  routePlan: Array<{ node: ChapterWorkflowNode; taskType: LLMTaskType; model: string }>;
  costEstimate: WorkflowCostEstimate;
  chapterOutline: Record<string, unknown> | null;
  sceneCards: Array<Record<string, unknown>>;
  draftMarkdown: string | null;
  continuityAudit: Record<string, unknown> | null;
  webnovelRhythmAudit: Record<string, unknown> | null;
  revisionPlan: Record<string, unknown> | null;
  revisedMarkdown: string | null;
  stateSettlementProposal: Record<string, unknown> | null;
  selectedFindings: string[];
  llmRunIds: string[];
  generatedArtifactIds: string[];
  currentNode: ChapterWorkflowNode | null;
  status: "queued" | "running" | "paused" | "completed" | "error" | "cancelled";
  errors: string[];
  humanGateStatus: HumanGateStatus;
}

interface RuntimeOptions {
  database: WenForgeDatabase;
  repositories: RepositoryRegistry;
  privacy?: PrivacySettings;
}

const START_TO_GATE_NODES: ChapterWorkflowNode[] = [
  "prepare_context",
  "retrieve_memory",
  "generate_chapter_outline",
  "generate_scene_cards",
  "draft_chapter",
  "continuity_audit",
  "webnovel_rhythm_audit",
  "revise_draft",
  "human_gate"
];

const RESUME_TO_FINAL_NODES: ChapterWorkflowNode[] = [
  "state_settlement_proposal",
  "persist_results",
  "finalize"
];

const REVISION_NODES: ChapterWorkflowNode[] = ["revise_draft", "human_gate"];

const TASK_BY_NODE: Partial<Record<ChapterWorkflowNode, LLMTaskType>> = {
  generate_chapter_outline: "chapter_outline",
  generate_scene_cards: "scene_cards",
  draft_chapter: "draft_chapter",
  continuity_audit: "continuity_audit",
  webnovel_rhythm_audit: "suspense_hook_audit",
  revise_draft: "revise_chapter",
  state_settlement_proposal: "state_settlement"
};

const TEMPLATE_BY_TASK: Partial<Record<LLMTaskType, string>> = {
  chapter_outline: "chapter-outline",
  scene_cards: "scene-cards",
  draft_chapter: "draft-chapter",
  continuity_audit: "continuity-audit",
  suspense_hook_audit: "webnovel-rhythm-audit",
  revise_chapter: "revise-chapter",
  state_settlement: "state-settlement"
};

const MOCK_PRICE = {
  inputPricePerMillion: 1,
  outputPricePerMillion: 3,
  cachedInputPricePerMillion: null,
  currency: "USD"
};

export class ChapterWorkflowRuntime {
  private readonly tokenEstimator = new TokenEstimator();
  private readonly costCalculator = new CostCalculator();
  private readonly promptAssembly: PromptAssemblyService;
  private readonly privacy: PrivacySettings;

  constructor(private readonly options: RuntimeOptions) {
    this.privacy = options.privacy ?? DEFAULT_PRIVACY_SETTINGS;
    this.promptAssembly = new PromptAssemblyService(new PromptTemplateService(new SkillLoader()));
  }

  async startChapterWorkflow(input: ChapterGenerationStartRequest): Promise<WorkflowRunRecord> {
    const chapter = this.options.repositories.chapters.get(input.chapterId);
    if (!chapter || chapter.bookId !== input.bookId) {
      throw new Error("Chapter not found for workflow");
    }
    const costEstimate = this.createCostEstimate();
    if (
      typeof input.costWarningThreshold === "number" &&
      costEstimate.maxCost > input.costWarningThreshold &&
      !input.confirmed
    ) {
      throw new Error("Cost estimate exceeds threshold and requires confirmation");
    }

    const run = this.options.repositories.generation.createRun({
      projectId: input.projectId,
      bookId: input.bookId,
      chapterId: input.chapterId,
      status: "queued"
    });
    const initialState: ChapterWorkflowState = {
      runId: run.id,
      projectId: input.projectId,
      bookId: input.bookId,
      volumeId: input.volumeId ?? chapter.volumeId ?? null,
      chapterId: input.chapterId,
      qualityMode: input.qualityMode,
      userInstruction: input.userInstruction ?? null,
      contextPack: null,
      routePlan: this.createRoutePlan(),
      costEstimate,
      chapterOutline: null,
      sceneCards: [],
      draftMarkdown: null,
      continuityAudit: null,
      webnovelRhythmAudit: null,
      revisionPlan: null,
      revisedMarkdown: null,
      stateSettlementProposal: null,
      selectedFindings: [],
      llmRunIds: [],
      generatedArtifactIds: [],
      currentNode: null,
      status: "queued",
      errors: [],
      humanGateStatus: "not_required"
    };

    this.options.repositories.generation.addEvent({
      generationRunId: run.id,
      eventType: "workflow_queued",
      message: "Chapter workflow queued",
      payload: { workflowId: CHAPTER_GENERATION_WORKFLOW_ID }
    });

    const state = await this.runNodes(START_TO_GATE_NODES, initialState, "start");
    return this.toWorkflowRunRecord(state);
  }

  getRun(runId: string): ChapterWorkflowDetail | null {
    const run = this.options.repositories.generation.getRun(runId);
    if (!run) return null;
    const latest = this.options.repositories.generation.getLatestCheckpoint(runId);
    const state = latest?.state as ChapterWorkflowState | undefined;
    const workflowRun: WorkflowRunRecord = state
      ? this.toWorkflowRunRecord(state)
      : {
          id: run.id,
          workflowId: CHAPTER_GENERATION_WORKFLOW_ID,
          projectId: run.projectId,
          bookId: run.bookId,
          chapterId: run.chapterId,
          status: run.status as WorkflowRunRecord["status"],
          currentNode: null,
          humanGateStatus: "not_required" as const,
          costEstimate: null,
          createdAt: run.createdAt,
          updatedAt: run.updatedAt
        };

    const llmRuns = run.chapterId ? this.listWorkflowLlmRuns(runId, run.chapterId) : [];
    return {
      run: workflowRun,
      checkpoints: this.options.repositories.generation.listCheckpoints(runId),
      events: this.options.repositories.generation.listEvents(runId),
      artifacts: this.options.repositories.generation.listArtifacts(runId),
      reviewCards: this.options.repositories.generation.listReviewCards(runId),
      settlementProposal: this.options.repositories.generation.getSettlementProposalByRun(runId),
      llmRuns,
      costSummary: summarizeWorkflowLlmRuns(llmRuns)
    };
  }

  listRunsByChapter(chapterId: string): WorkflowRunRecord[] {
    return this.options.repositories.generation
      .listRunsByChapter(chapterId)
      .map((run) => this.getRun(run.id)?.run)
      .filter((run): run is WorkflowRunRecord => Boolean(run));
  }

  streamEvents(
    runId: string,
    sinceEventId?: string
  ): ReturnType<RepositoryRegistry["generation"]["listEvents"]> {
    const events = this.options.repositories.generation.listEvents(runId);
    if (!sinceEventId) return events;
    const index = events.findIndex((event) => event.id === sinceEventId);
    return index === -1 ? events : events.slice(index + 1);
  }

  async resume(input: GenerationResumeRequest): Promise<WorkflowRunRecord> {
    const state = this.requirePausedState(input.runId);
    if (input.action === "reject") {
      const rejected = {
        ...state,
        status: "cancelled" as const,
        humanGateStatus: "rejected" as const,
        currentNode: "human_gate" as const
      };
      this.options.repositories.generation.updateRunStatus(input.runId, "cancelled");
      this.persistCheckpoint(rejected, "human_gate", "workflow_rejected", "Workflow rejected");
      return this.toWorkflowRunRecord(rejected);
    }
    const nextState = {
      ...state,
      status: "running" as const,
      humanGateStatus: "accepted" as const,
      userInstruction: input.userInstruction ?? state.userInstruction
    };
    const completed = await this.runNodes(RESUME_TO_FINAL_NODES, nextState, "resume");
    return this.toWorkflowRunRecord(completed);
  }

  async requestRevision(input: GenerationRequestRevision): Promise<WorkflowRunRecord> {
    const state = this.requirePausedState(input.runId);
    const nextState: ChapterWorkflowState = {
      ...state,
      status: "running",
      humanGateStatus: "revision_requested",
      userInstruction: input.userInstruction
    };
    const revised = await this.runNodes(REVISION_NODES, nextState, "revision");
    return this.toWorkflowRunRecord(revised);
  }

  acceptArtifactAsVersion(input: GenerationAcceptArtifactAsVersion): ManuscriptVersionRecord {
    const artifact = this.options.repositories.generation.getArtifact(input.artifactId);
    const run = this.options.repositories.generation.getRun(input.runId);
    if (!artifact || artifact.generationRunId !== input.runId || !run?.chapterId) {
      throw new Error("Generated artifact not found for workflow run");
    }
    if (!["draft", "revision"].includes(artifact.artifactType)) {
      throw new Error("Only draft or revision artifacts can become manuscript versions");
    }
    return this.options.repositories.manuscripts.saveVersion({
      chapterId: run.chapterId,
      title: input.title ?? artifact.title ?? "Generated manuscript version",
      contentMarkdown: artifact.contentText,
      sourceType: "generated",
      generationRunId: input.runId,
      isCanonical: false
    }) as ManuscriptVersionRecord;
  }

  setAcceptedVersionCanonical(
    input: GenerationSetAcceptedVersionCanonical
  ): ManuscriptVersionRecord | null {
    if (!input.confirmed) {
      throw new Error("Confirmation is required before setting canonical manuscript");
    }
    return this.options.repositories.manuscripts.setCanonical(
      input.chapterId,
      input.versionId
    ) as ManuscriptVersionRecord | null;
  }

  abort(input: { runId: string }): WorkflowRunRecord | null {
    return this.markCancelled(input.runId, "workflow_aborted", "Workflow aborted");
  }

  cancel(input: { runId: string; confirmed?: boolean | undefined }): WorkflowRunRecord | null {
    if (!input.confirmed) {
      throw new Error("Confirmation is required before cancelling workflow");
    }
    return this.markCancelled(input.runId, "workflow_cancelled", "Workflow cancelled");
  }

  private async runNodes(
    nodes: ChapterWorkflowNode[],
    state: ChapterWorkflowState,
    action: ChapterWorkflowAction
  ): Promise<ChapterWorkflowState> {
    return runLangGraphSegment(nodes, state, async (node, current) =>
      this.executeNode(node, current, action)
    );
  }

  private async executeNode(
    node: ChapterWorkflowNode,
    state: ChapterWorkflowState,
    action: ChapterWorkflowAction
  ): Promise<ChapterWorkflowState> {
    const runningState: ChapterWorkflowState = {
      ...state,
      currentNode: node,
      status: node === "human_gate" ? ("paused" as const) : ("running" as const)
    };
    this.options.repositories.generation.updateRunStatus(runningState.runId, runningState.status);
    this.options.repositories.generation.addEvent({
      generationRunId: runningState.runId,
      eventType: "node_started",
      nodeName: node,
      message: `${node} started`,
      payload: { action }
    });

    let nextState: ChapterWorkflowState = runningState;
    switch (node) {
      case "prepare_context":
        nextState = this.prepareContext(runningState);
        break;
      case "retrieve_memory":
        nextState = this.retrieveMemory(runningState);
        break;
      case "generate_chapter_outline":
        nextState = this.generateChapterOutline(runningState);
        break;
      case "generate_scene_cards":
        nextState = this.generateSceneCards(runningState);
        break;
      case "draft_chapter":
        nextState = this.draftChapter(runningState);
        break;
      case "continuity_audit":
        nextState = this.continuityAudit(runningState);
        break;
      case "webnovel_rhythm_audit":
        nextState = this.webnovelRhythmAudit(runningState);
        break;
      case "revise_draft":
        nextState = this.reviseDraft(runningState);
        break;
      case "human_gate":
        nextState = {
          ...runningState,
          status: "paused",
          humanGateStatus:
            runningState.humanGateStatus === "revision_requested" ? "revision_requested" : "waiting"
        };
        break;
      case "state_settlement_proposal":
        nextState = this.stateSettlementProposal(runningState);
        break;
      case "persist_results":
        nextState = runningState;
        break;
      case "finalize":
        nextState = { ...runningState, status: "completed", humanGateStatus: "accepted" };
        break;
    }

    this.options.repositories.generation.updateRunStatus(nextState.runId, nextState.status);
    this.persistCheckpoint(nextState, node, "node_completed", `${node} completed`);
    return nextState;
  }

  private prepareContext(state: ChapterWorkflowState): ChapterWorkflowState {
    const project = this.options.repositories.projects.get(state.projectId);
    const book = this.options.repositories.books.get(state.bookId);
    const chapter = this.options.repositories.chapters.get(state.chapterId);
    if (!project || !book || !chapter) {
      throw new Error("Workflow source records are missing");
    }
    return {
      ...state,
      routePlan: this.createRoutePlan(),
      costEstimate: this.createCostEstimate()
    };
  }

  private retrieveMemory(state: ChapterWorkflowState): ChapterWorkflowState {
    const contextPack = new ContextBuilder(
      this.options.database,
      this.options.repositories
    ).previewForChapter({
      projectId: state.projectId,
      bookId: state.bookId,
      volumeId: state.volumeId,
      chapterId: state.chapterId,
      taskType: "draft_chapter",
      qualityMode: state.qualityMode,
      userInstruction: state.userInstruction,
      targetTokenBudget: this.privacy.maxContextTokenBudget,
      includeRecentChapters: this.privacy.recentChapterCount,
      includeFullRecentChapters: this.privacy.allowSendingFullRecentChapters,
      privacy: this.privacy
    });
    return { ...state, contextPack };
  }

  private generateChapterOutline(state: ChapterWorkflowState): ChapterWorkflowState {
    const chapter = this.options.repositories.chapters.get(state.chapterId);
    const outline = {
      chapter_promise: `${chapter?.title ?? "本章"}揭开一个具体威胁。`,
      opening_hook: "雨夜钟楼背面出现不合常理的光。",
      major_conflict: "主角必须在能力失控前确认雾灯来源。",
      conflict_escalation: "旧案线索与眼前异象同时逼近。",
      emotional_turn: "主角意识到逃避会让亲近的人暴露在危险中。",
      payoff: "他确认雾灯不是自然现象。",
      chapter_end_hook: "钟楼里传出本不该存在的第二个脚步声。",
      scene_plan: ["雨夜抵达", "调查钟楼", "能力反噬", "发现第二脚步"],
      continuity_dependencies: ["保留雨夜感知规则", "能力不能突然熟练"],
      risks: ["不要让主角过早掌握全部真相"]
    };
    const text = JSON.stringify(outline, null, 2);
    return this.withLlmArtifact(state, {
      node: "generate_chapter_outline",
      taskType: "chapter_outline",
      artifactType: "outline",
      title: "Chapter outline",
      contentText: text,
      contentJson: text,
      extraState: { chapterOutline: outline }
    });
  }

  private generateSceneCards(state: ChapterWorkflowState): ChapterWorkflowState {
    const sceneCards = [
      {
        scene_index: 1,
        pov: "沈照",
        setting: "雨夜钟楼背面",
        participating_characters: ["沈照"],
        goal: "确认雾灯异常来源",
        obstacle: "雨声遮蔽脚步，能力感知不稳定",
        conflict_beat: "雾灯亮起时钟声突然缺失",
        new_information: "钟楼背面有新鲜水痕",
        emotional_turn: "沈照从犹豫转为主动调查",
        required_continuity_facts: ["雨夜增强感知但会消耗体力"],
        handoff: "他听见楼内传来第二个脚步声"
      },
      {
        scene_index: 2,
        pov: "沈照",
        setting: "钟楼内侧楼梯",
        participating_characters: ["沈照"],
        goal: "找到脚步声主人",
        obstacle: "能力反噬让他分不清真实声音",
        conflict_beat: "脚步声模仿他的节奏逼近",
        new_information: "雾灯会回应他的恐惧",
        emotional_turn: "他选择留下证据而不是逃跑",
        required_continuity_facts: ["不能让主角完全掌控能力"],
        handoff: "门后有人喊出他的名字"
      }
    ];
    const text = JSON.stringify(sceneCards, null, 2);
    return this.withLlmArtifact(state, {
      node: "generate_scene_cards",
      taskType: "scene_cards",
      artifactType: "scene_cards",
      title: "Scene cards",
      contentText: text,
      contentJson: text,
      extraState: { sceneCards }
    });
  }

  private draftChapter(state: ChapterWorkflowState): ChapterWorkflowState {
    const draft = [
      "雨从钟楼背面的檐角连成线，落在沈照肩上时，像一只只冰冷的手。",
      "",
      "他停在雾灯照不到的地方，听见缺了一拍的钟声。",
      "",
      "那不是回音。回音不会在他屏住呼吸之后，仍旧贴着楼梯往下走。",
      "",
      "沈照握紧手机，指节因为用力而发白。屏幕里没有信号，录音界面却跳出第二条声纹。",
      "",
      "下一秒，楼里的脚步声停住了。",
      "",
      "有人在门后，用和他一模一样的声音问：“你终于听见我了？”"
    ].join("\n");
    return this.withLlmArtifact(state, {
      node: "draft_chapter",
      taskType: "draft_chapter",
      artifactType: "draft",
      title: "Mock draft",
      contentText: draft,
      extraState: { draftMarkdown: draft }
    });
  }

  private continuityAudit(state: ChapterWorkflowState): ChapterWorkflowState {
    const finding = {
      findings: [
        {
          severity: "medium",
          affected_entity: "沈照能力",
          evidence_from_draft: "录音界面跳出第二条声纹",
          conflicting_known_fact: "能力可以增强感知，但不能提供完整外部证据链",
          suggested_repair: "保留录音异常，但让证据不完整，需要后续验证",
          requires_human_review: true
        }
      ]
    };
    this.options.repositories.generation.createReviewCard({
      generationRunId: state.runId,
      chapterId: state.chapterId,
      reviewType: "continuity",
      severity: "medium",
      title: "录音证据可能过强",
      issue: "草稿让主角过早获得可验证证据，可能削弱悬疑推进。",
      evidence: "录音界面却跳出第二条声纹",
      suggestedFix: "让录音受噪声干扰，只留下部分异常波形。",
      rawJson: JSON.stringify(finding)
    });
    const text = JSON.stringify(finding, null, 2);
    return this.withLlmArtifact(state, {
      node: "continuity_audit",
      taskType: "continuity_audit",
      artifactType: "continuity_audit",
      title: "Continuity audit",
      contentText: text,
      contentJson: text,
      extraState: { continuityAudit: finding }
    });
  }

  private webnovelRhythmAudit(state: ChapterWorkflowState): ChapterWorkflowState {
    const rhythm = {
      opening_hook_score: 8,
      conflict_density_score: 8,
      scene_momentum_score: 8,
      emotional_turn_score: 7,
      payoff_clarity_score: 7,
      ending_hook_score: 9,
      genre_alignment_score: 8,
      cliche_warnings: [],
      aiish_phrasing_warnings: ["减少抽象判断，增加可触摸的危险细节"],
      actionable_suggestions: ["把结尾钩子落到具体声音、动作或物件上"]
    };
    this.options.repositories.generation.createReviewCard({
      generationRunId: state.runId,
      chapterId: state.chapterId,
      reviewType: "webnovel_rhythm",
      severity: "low",
      title: "结尾钩子可以更具体",
      issue: "结尾有悬念，但还可以绑定更强的动作细节。",
      evidence: "你终于听见我了？",
      suggestedFix: "增加门锁转动或同声复诵等具体危险信号。",
      rawJson: JSON.stringify(rhythm)
    });
    const text = JSON.stringify(rhythm, null, 2);
    return this.withLlmArtifact(state, {
      node: "webnovel_rhythm_audit",
      taskType: "suspense_hook_audit",
      artifactType: "rhythm_audit",
      title: "Webnovel rhythm audit",
      contentText: text,
      contentJson: text,
      extraState: { webnovelRhythmAudit: rhythm }
    });
  }

  private reviseDraft(state: ChapterWorkflowState): ChapterWorkflowState {
    const instructionLine = state.userInstruction
      ? `\n\n【修订指令已吸收：${state.userInstruction}】`
      : "";
    const revised = `${state.draftMarkdown ?? ""}`.replace(
      "录音界面却跳出第二条声纹。",
      "录音界面跳了一下，只留下一道被雨声撕裂的异常波形。"
    );
    const finalText = `${revised}${instructionLine}`;
    const revisionPlan = {
      changed: ["削弱录音证据确定性", "保留门后同声钩子"],
      human_review_needed: true
    };
    return this.withLlmArtifact(state, {
      node: "revise_draft",
      taskType: "revise_chapter",
      artifactType: "revision",
      title: "Revised draft",
      contentText: finalText,
      extraState: { revisedMarkdown: finalText, revisionPlan }
    });
  }

  private stateSettlementProposal(state: ChapterWorkflowState): ChapterWorkflowState {
    const settlement = {
      proposals: [
        {
          item_type: "chapter_summary",
          source_chapter: state.chapterId,
          evidence_summary: "沈照在钟楼背面听见门后同声，确认雾灯异常与自身能力有关。",
          confidence: 0.82,
          target_entity: "chapter",
          proposed_change: "更新章节摘要，记录钟楼背面和同声钩子。"
        },
        {
          item_type: "unresolved_hook",
          source_chapter: state.chapterId,
          evidence_summary: "门后有人用沈照的声音回应他。",
          confidence: 0.78,
          target_entity: "hook",
          proposed_change: "新增钩子：门后的同声者是谁。"
        }
      ]
    };
    const proposal = this.options.repositories.generation.createSettlementProposal({
      generationRunId: state.runId,
      chapterId: state.chapterId,
      items: [
        {
          itemType: "chapter_summary",
          targetEntityType: "chapter",
          targetEntityId: state.chapterId,
          actionType: "update",
          evidenceSummary: "沈照在钟楼背面听见门后同声，确认雾灯异常与自身能力有关。",
          confidence: 0.82,
          afterJson: JSON.stringify({
            summary: "沈照调查钟楼背面的雾灯异常，门后传出与他相同的声音。"
          })
        },
        {
          itemType: "unresolved_hook",
          targetEntityType: "hook",
          actionType: "create",
          evidenceSummary: "门后有人用沈照的声音回应他。",
          confidence: 0.78,
          afterJson: JSON.stringify({
            hookText: "门后的同声者是谁？",
            urgency: "high"
          })
        }
      ]
    });
    const text = JSON.stringify(settlement, null, 2);
    return this.withLlmArtifact(state, {
      node: "state_settlement_proposal",
      taskType: "state_settlement",
      artifactType: "settlement_proposal",
      title: "State settlement proposal",
      contentText: text,
      contentJson: text,
      extraState: { stateSettlementProposal: { ...settlement, proposalId: proposal.id } }
    });
  }

  private withLlmArtifact(
    state: ChapterWorkflowState,
    input: {
      node: ChapterWorkflowNode;
      taskType: LLMTaskType;
      artifactType: string;
      title: string;
      contentText: string;
      contentJson?: string;
      extraState: Partial<ChapterWorkflowState>;
    }
  ): ChapterWorkflowState {
    const messages = this.assembleMessages(input.taskType, state, input.contentText);
    const llmRun = this.recordFakeLlmRun(state, input.taskType, messages, input.contentText);
    const artifact = this.options.repositories.generation.createArtifact({
      generationRunId: state.runId,
      chapterId: state.chapterId,
      artifactType: input.artifactType,
      title: input.title,
      contentText: input.contentText,
      contentJson: input.contentJson ?? null,
      sourceNode: input.node
    });
    return {
      ...state,
      ...input.extraState,
      llmRunIds: [...state.llmRunIds, llmRun.id],
      generatedArtifactIds: [...state.generatedArtifactIds, artifact.id]
    };
  }

  private assembleMessages(
    taskType: LLMTaskType,
    state: ChapterWorkflowState,
    fallbackContent: string
  ): ChatMessage[] {
    const templateId = TEMPLATE_BY_TASK[taskType];
    if (!templateId) {
      return [{ role: "user", content: fallbackContent }];
    }
    try {
      const assemblyInput = {
        templateId,
        privacy: { ...this.privacy, allowPromptPreview: false },
        variables: {
          userInstruction: state.userInstruction ?? "",
          targetWords: String(
            this.options.repositories.chapters.get(state.chapterId)?.targetWords ?? ""
          ),
          draftText: state.draftMarkdown ?? "",
          auditFindings: JSON.stringify(
            {
              continuity: state.continuityAudit,
              rhythm: state.webnovelRhythmAudit
            },
            null,
            2
          ),
          sceneCards: JSON.stringify(state.sceneCards, null, 2)
        }
      };
      return this.promptAssembly.assemble(
        state.contextPack ? { ...assemblyInput, context: state.contextPack } : assemblyInput
      ).messages;
    } catch {
      return [{ role: "user", content: fallbackContent }];
    }
  }

  private recordFakeLlmRun(
    state: ChapterWorkflowState,
    taskType: LLMTaskType,
    messages: ChatMessage[],
    responseText: string
  ) {
    const inputTokens = this.tokenEstimator.estimateMessages(messages);
    const outputTokens = this.tokenEstimator.estimateText(responseText);
    const liveCost = this.costCalculator.calculate({
      usage: { inputTokens, outputTokens },
      price: MOCK_PRICE,
      estimated: true
    });
    const run = this.options.repositories.cost.createLlmRun({
      generationRunId: state.runId,
      provider: "fake",
      model: "wenforge-mock-chapter-v1",
      taskType,
      projectId: state.projectId,
      bookId: state.bookId,
      chapterId: state.chapterId,
      inputTokensEstimated: inputTokens,
      estimatedCostLive: liveCost.totalCost,
      currency: liveCost.currency,
      promptHash: hashMessages(messages)
    });
    return (
      this.options.repositories.cost.finishRun(run.id, {
        status: "succeeded",
        outputTokensEstimatedLive: outputTokens,
        inputTokensReported: inputTokens,
        outputTokensReported: outputTokens,
        usageSource: "estimated",
        estimatedCostLive: liveCost.totalCost,
        finalCost: liveCost.totalCost,
        latencyMs: 1,
        responseHash: sha256Hex(responseText)
      }) ?? run
    );
  }

  private createRoutePlan(): ChapterWorkflowState["routePlan"] {
    return Object.entries(TASK_BY_NODE).map(([node, taskType]) => ({
      node: node as ChapterWorkflowNode,
      taskType,
      model: "wenforge-mock-chapter-v1"
    }));
  }

  private createCostEstimate(): WorkflowCostEstimate {
    return {
      minCost: 0.0001,
      maxCost: 0.01,
      currency: "USD",
      nodeCount: Object.keys(TASK_BY_NODE).length,
      notes: ["Mock provider estimate; real routes will use the model price registry."]
    };
  }

  private persistCheckpoint(
    state: ChapterWorkflowState,
    node: ChapterWorkflowNode,
    eventType: string,
    message: string
  ): void {
    this.options.repositories.generation.addCheckpoint(state.runId, node, state);
    this.options.repositories.generation.addEvent({
      generationRunId: state.runId,
      eventType,
      nodeName: node,
      message,
      payload: {
        status: state.status,
        humanGateStatus: state.humanGateStatus,
        generatedArtifactIds: state.generatedArtifactIds,
        llmRunIds: state.llmRunIds
      }
    });
  }

  private requirePausedState(runId: string): ChapterWorkflowState {
    const checkpoint = this.options.repositories.generation.getLatestCheckpoint(runId);
    if (!checkpoint) {
      throw new Error("Workflow checkpoint not found");
    }
    const state = checkpoint.state as ChapterWorkflowState;
    if (state.status !== "paused" || state.currentNode !== "human_gate") {
      throw new Error("Workflow must be paused at the human gate before this action");
    }
    return state;
  }

  private markCancelled(
    runId: string,
    eventType: string,
    message: string
  ): WorkflowRunRecord | null {
    const checkpoint = this.options.repositories.generation.getLatestCheckpoint(runId);
    if (!checkpoint) return null;
    const state = {
      ...(checkpoint.state as ChapterWorkflowState),
      status: "cancelled" as const,
      humanGateStatus: "cancelled" as const
    };
    this.options.repositories.generation.updateRunStatus(runId, "cancelled");
    this.persistCheckpoint(state, state.currentNode ?? "human_gate", eventType, message);
    return this.toWorkflowRunRecord(state);
  }

  private toWorkflowRunRecord(state: ChapterWorkflowState): WorkflowRunRecord {
    const run = this.options.repositories.generation.getRun(state.runId);
    return {
      id: state.runId,
      workflowId: CHAPTER_GENERATION_WORKFLOW_ID,
      projectId: state.projectId,
      bookId: state.bookId,
      chapterId: state.chapterId,
      status: state.status,
      currentNode: state.currentNode,
      humanGateStatus: state.humanGateStatus,
      costEstimate: state.costEstimate,
      createdAt: run?.createdAt ?? new Date().toISOString(),
      updatedAt: run?.updatedAt ?? new Date().toISOString()
    };
  }

  private listWorkflowLlmRuns(runId: string, chapterId: string) {
    return this.options.repositories.cost
      .listRunsByChapter(chapterId)
      .filter((llmRun) => llmRun.generationRunId === runId)
      .reverse();
  }
}

function summarizeWorkflowLlmRuns(llmRuns: LLMRunRecord[]): CostSummary {
  return {
    runCount: llmRuns.length,
    estimatedCostLive: roundSummary(
      llmRuns.reduce((total, run) => total + run.estimatedCostLive, 0)
    ),
    finalCost: roundSummary(llmRuns.reduce((total, run) => total + (run.finalCost ?? 0), 0)),
    currency: llmRuns[0]?.currency ?? "USD"
  };
}

function roundSummary(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

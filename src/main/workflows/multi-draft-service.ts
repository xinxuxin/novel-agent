import type {
  CreateCandidateGroupInput,
  CreateFusionInput,
  DraftCandidateGroupDetail,
  DraftCandidateGroupRecord,
  DraftCandidateRecord,
  DraftFusionRecord,
  GenerateCandidatesInput,
  GenerateFusionInput,
  RetryCandidateInput,
  SaveCandidateAsVersionInput,
  SaveFusionAsVersionInput,
  SetCandidateCanonicalInput,
  SetFusionCanonicalInput
} from "@contracts/draft-candidates";
import type { ManuscriptVersionRecord } from "@main/db/repositories/manuscript-repository";
import type { AiGateway } from "@main/ai/ai-gateway";
import type { RepositoryRegistry } from "@main/db/service";
import { SafeIpcError } from "@main/ipc/safe-ipc-error";

export interface MultiDraftServiceOptions {
  repositories: RepositoryRegistry;
  aiGateway?: AiGateway | undefined;
}

interface ChapterScope {
  projectId: string | null;
  bookId: string;
  chapterId: string;
  chapterTitle: string;
  targetWords: number;
  chapterPlanText: string;
  canonicalText: string;
}

export class MultiDraftService {
  constructor(private readonly options: MultiDraftServiceOptions) {}

  createGroup(input: CreateCandidateGroupInput): DraftCandidateGroupRecord {
    const chapter = this.options.repositories.chapters.get(input.chapterId);
    if (!chapter) {
      throw new SafeIpcError("CHAPTER_NOT_FOUND", "Chapter not found");
    }
    const book = this.options.repositories.books.get(chapter.bookId);
    if (!book) {
      throw new SafeIpcError("BOOK_NOT_FOUND", "Book not found");
    }
    const plan = this.options.repositories.planning.getAcceptedChapterPlan(chapter.id);
    const run = this.options.repositories.generation.createRun({
      projectId: book.projectId,
      bookId: book.id,
      chapterId: chapter.id,
      status: "multi_draft_human_gate"
    });
    return this.options.repositories.draftCandidates.createGroup({
      chapterId: chapter.id,
      generationRunId: run.id,
      chapterPlanId: plan?.id ?? null,
      targetWords: input.targetWords ?? plan?.targetWords ?? chapter.targetWords,
      userInstruction: input.userInstruction ?? null,
      presetName: input.presetName ?? "Balanced Compare",
      status: "draft"
    });
  }

  listByChapter(chapterId: string): DraftCandidateGroupDetail[] {
    return this.options.repositories.draftCandidates
      .listGroupsByChapter(chapterId)
      .map((group) => this.detailForGroup(group.id));
  }

  getGroup(groupId: string): DraftCandidateGroupDetail {
    return this.detailForGroup(groupId);
  }

  getCandidate(candidateId: string): DraftCandidateRecord {
    const candidate = this.options.repositories.draftCandidates.getCandidate(candidateId);
    if (!candidate) {
      throw new SafeIpcError("CANDIDATE_NOT_FOUND", "Draft candidate not found");
    }
    return candidate;
  }

  deleteGroup(groupId: string, confirmed?: boolean): DraftCandidateGroupRecord | null {
    requireConfirmed(confirmed);
    return this.options.repositories.draftCandidates.discardGroup(groupId);
  }

  async generateCandidates(input: GenerateCandidatesInput): Promise<DraftCandidateGroupDetail> {
    requireConfirmed(input.confirmed);
    if (input.candidates.length > 3 && input.budgetCapUsd !== 0) {
      this.ensureBudgetAllows(input.budgetCapUsd, 0.01 * input.candidates.length);
    }
    const group = this.mustGetGroup(input.groupId);
    const scope = this.scopeForGroup(group);
    this.requireGateway();
    this.options.repositories.draftCandidates.updateGroupStatus(group.id, "running");

    const candidates = input.candidates
      .filter((candidate) => candidate.enabled !== false)
      .map((candidate) =>
        this.options.repositories.draftCandidates.createCandidate({
          groupId: group.id,
          provider: input.executionMode === "mock" ? "fake" : candidate.provider,
          model: candidate.model,
          roleLabel: candidate.roleLabel,
          status: "queued"
        })
      );

    await Promise.all(candidates.map((candidate) => this.generateOneCandidate(candidate, scope, input)));
    this.options.repositories.draftCandidates.updateGroupStatus(group.id, "paused");
    this.options.repositories.generation.updateRunStatus(group.generationRunId, "human_compare_gate");
    return this.detailForGroup(group.id);
  }

  async retryCandidate(input: RetryCandidateInput): Promise<DraftCandidateRecord> {
    requireConfirmed(input.confirmed);
    const candidate = this.getCandidate(input.candidateId);
    const group = this.mustGetGroup(candidate.groupId);
    const scope = this.scopeForGroup(group);
    await this.generateOneCandidate(candidate, scope, {
      executionMode: candidate.provider === "fake" ? "mock" : "provider"
    });
    return this.getCandidate(candidate.id);
  }

  saveCandidateAsVersion(input: SaveCandidateAsVersionInput): ManuscriptVersionRecord {
    const candidate = this.getCandidate(input.candidateId);
    if (candidate.status !== "succeeded" && candidate.status !== "saved") {
      throw new SafeIpcError("CANDIDATE_NOT_READY", "Only completed candidates can be saved");
    }
    const group = this.mustGetGroup(candidate.groupId);
    const canonical = this.options.repositories.manuscripts.getCanonical(group.chapterId);
    const version = this.options.repositories.manuscripts.saveVersion({
      chapterId: group.chapterId,
      parentVersionId: canonical?.id ?? null,
      branchLabel: "candidate",
      title: input.title ?? `${candidate.model} candidate`,
      contentMarkdown: candidate.contentMarkdown,
      sourceType: "generated",
      generationRunId: group.generationRunId,
      isCanonical: false
    });
    this.options.repositories.draftCandidates.updateCandidate(candidate.id, { status: "saved" });
    return version;
  }

  setCandidateCanonical(input: SetCandidateCanonicalInput): ManuscriptVersionRecord {
    requireConfirmed(input.confirmed);
    const candidate = this.getCandidate(input.candidateId);
    const group = this.mustGetGroup(candidate.groupId);
    return this.options.repositories.manuscripts.saveVersion({
      chapterId: group.chapterId,
      parentVersionId: this.options.repositories.manuscripts.getCanonical(group.chapterId)?.id ?? null,
      branchLabel: "candidate-canonical",
      title: `${candidate.model} canonical candidate`,
      contentMarkdown: candidate.contentMarkdown,
      sourceType: "generated",
      generationRunId: group.generationRunId,
      isCanonical: true
    });
  }

  createFusion(input: CreateFusionInput): DraftFusionRecord {
    const group = this.mustGetGroup(input.groupId);
    const base = this.options.repositories.draftCandidates.getCandidate(input.baseCandidateId);
    if (!base || base.groupId !== group.id) {
      throw new SafeIpcError("BASE_CANDIDATE_REQUIRED", "A valid base candidate is required");
    }
    for (const referenceId of input.referenceCandidateIds ?? []) {
      const reference = this.options.repositories.draftCandidates.getCandidate(referenceId);
      if (!reference || reference.groupId !== group.id) {
        throw new SafeIpcError("REFERENCE_CANDIDATE_INVALID", "Reference candidate is invalid");
      }
    }
    return this.options.repositories.draftCandidates.createFusion({
      groupId: group.id,
      baseCandidateId: base.id,
      referenceCandidateIds: input.referenceCandidateIds ?? [],
      fusionInstruction: input.fusionInstruction ?? null,
      fusionProvider: input.fusionProvider,
      fusionModel: input.fusionModel
    });
  }

  async generateFusion(input: GenerateFusionInput): Promise<DraftFusionRecord> {
    requireConfirmed(input.confirmed);
    this.requireGateway();
    const fusion = this.mustGetFusion(input.fusionId);
    const group = this.mustGetGroup(fusion.groupId);
    this.ensureBudgetAllows(input.budgetCapUsd, 0.02);
    const scope = this.scopeForGroup(group);
    const base = this.getCandidate(fusion.baseCandidateId);
    const references = this.referenceIds(fusion)
      .map((id) => this.options.repositories.draftCandidates.getCandidate(id))
      .filter((candidate): candidate is DraftCandidateRecord => Boolean(candidate));

    this.options.repositories.draftCandidates.updateFusion(fusion.id, {
      status: "running",
      errorMessage: null
    });
    try {
      const response = await this.options.aiGateway!.generateText({
        provider: fusion.fusionProvider,
        model: fusion.fusionModel,
        taskType: "revise_chapter",
        projectId: scope.projectId,
        bookId: scope.bookId,
        chapterId: scope.chapterId,
        generationRunId: group.generationRunId,
        messages: buildFusionMessages({
          scope,
          base,
          references,
          instruction: fusion.fusionInstruction
        }),
        maxOutputTokens: input.maxOutputTokens ?? Math.max(800, Math.ceil(group.targetWords * 1.2)),
        creativityIntent: "creative",
        contextBudgetMode: "max_safe"
      });
      const artifact = this.options.repositories.generation.createArtifact({
        generationRunId: group.generationRunId,
        chapterId: group.chapterId,
        artifactType: "draft_fusion",
        title: `${fusion.fusionModel} fused draft`,
        contentText: response.response.text,
        contentJson: JSON.stringify({
          status: "proposed",
          baseCandidateId: base.id,
          referenceCandidateIds: references.map((reference) => reference.id),
          llmRunId: response.runId
        }),
        sourceNode: "fuse_selected_candidates"
      });
      return this.options.repositories.draftCandidates.updateFusion(fusion.id, {
        resultArtifactId: artifact.id,
        llmRunId: response.runId,
        cost: response.finalCost.totalCost,
        latencyMs: response.latencyMs,
        status: "succeeded",
        errorMessage: null
      }) as DraftFusionRecord;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Fusion failed";
      const updated = this.options.repositories.draftCandidates.updateFusion(fusion.id, {
        status: "failed",
        errorMessage: message
      });
      if (updated) return updated;
      throw error;
    }
  }

  saveFusionAsVersion(input: SaveFusionAsVersionInput): ManuscriptVersionRecord {
    const fusion = this.mustGetFusion(input.fusionId);
    if (!fusion.resultArtifactId) {
      throw new SafeIpcError("FUSION_NOT_READY", "Fusion result is not ready");
    }
    const artifact = this.options.repositories.generation.getArtifact(fusion.resultArtifactId);
    if (!artifact) {
      throw new SafeIpcError("FUSION_ARTIFACT_NOT_FOUND", "Fusion artifact not found");
    }
    const group = this.mustGetGroup(fusion.groupId);
    const version = this.options.repositories.manuscripts.saveVersion({
      chapterId: group.chapterId,
      parentVersionId: this.options.repositories.manuscripts.getCanonical(group.chapterId)?.id ?? null,
      branchLabel: "fusion",
      title: input.title ?? artifact.title ?? "Fused draft",
      contentMarkdown: artifact.contentText,
      sourceType: "generated",
      generationRunId: group.generationRunId,
      isCanonical: false
    });
    this.options.repositories.draftCandidates.updateFusion(fusion.id, {
      resultManuscriptVersionId: version.id,
      status: "saved"
    });
    return version;
  }

  setFusionCanonical(input: SetFusionCanonicalInput): ManuscriptVersionRecord {
    requireConfirmed(input.confirmed);
    const fusion = this.mustGetFusion(input.fusionId);
    if (!fusion.resultArtifactId) {
      throw new SafeIpcError("FUSION_NOT_READY", "Fusion result is not ready");
    }
    const artifact = this.options.repositories.generation.getArtifact(fusion.resultArtifactId);
    if (!artifact) {
      throw new SafeIpcError("FUSION_ARTIFACT_NOT_FOUND", "Fusion artifact not found");
    }
    const group = this.mustGetGroup(fusion.groupId);
    const version = this.options.repositories.manuscripts.saveVersion({
      chapterId: group.chapterId,
      parentVersionId: this.options.repositories.manuscripts.getCanonical(group.chapterId)?.id ?? null,
      branchLabel: "fusion-canonical",
      title: artifact.title ?? "Fused canonical draft",
      contentMarkdown: artifact.contentText,
      sourceType: "generated",
      generationRunId: group.generationRunId,
      isCanonical: true
    });
    this.options.repositories.draftCandidates.updateFusion(fusion.id, {
      resultManuscriptVersionId: version.id,
      status: "saved"
    });
    return version;
  }

  private async generateOneCandidate(
    candidate: DraftCandidateRecord,
    scope: ChapterScope,
    input: Pick<GenerateCandidatesInput, "executionMode" | "maxOutputTokens" | "budgetCapUsd">
  ): Promise<void> {
    this.requireGateway();
    this.ensureBudgetAllows(input.budgetCapUsd, 0.01);
    this.options.repositories.draftCandidates.updateCandidate(candidate.id, {
      status: "running",
      errorMessage: null
    });
    const group = this.mustGetGroup(candidate.groupId);
    try {
      const response = await this.options.aiGateway!.generateText({
        provider: input.executionMode === "mock" ? "fake" : candidate.provider,
        model: candidate.model,
        taskType: "draft_chapter",
        projectId: scope.projectId,
        bookId: scope.bookId,
        chapterId: scope.chapterId,
        generationRunId: group.generationRunId,
        messages: buildCandidateMessages({ scope, candidate }),
        maxOutputTokens: input.maxOutputTokens ?? Math.max(800, Math.ceil(scope.targetWords * 1.2)),
        creativityIntent: "creative",
        contextBudgetMode: "max_safe"
      });
      this.options.repositories.generation.createArtifact({
        generationRunId: group.generationRunId,
        chapterId: scope.chapterId,
        artifactType: "draft_candidate",
        title: `${candidate.model} candidate`,
        contentText: response.response.text,
        contentJson: JSON.stringify({
          status: "proposed",
          candidateId: candidate.id,
          provider: response.provider,
          model: response.model,
          llmRunId: response.runId
        }),
        sourceNode: "generate_candidates_parallel"
      });
      this.options.repositories.draftCandidates.updateCandidate(candidate.id, {
        contentMarkdown: response.response.text,
        llmRunId: response.runId,
        cost: response.finalCost.totalCost,
        latencyMs: response.latencyMs,
        status: "succeeded",
        errorMessage: null
      });
    } catch (error) {
      this.options.repositories.draftCandidates.updateCandidate(candidate.id, {
        status: "failed",
        errorMessage: error instanceof Error ? error.message : "Candidate generation failed"
      });
    }
  }

  private detailForGroup(groupId: string): DraftCandidateGroupDetail {
    const group = this.mustGetGroup(groupId);
    return {
      group,
      candidates: this.options.repositories.draftCandidates.listCandidates(group.id),
      fusions: this.options.repositories.draftCandidates.listFusions(group.id)
    };
  }

  private mustGetGroup(groupId: string): DraftCandidateGroupRecord {
    const group = this.options.repositories.draftCandidates.getGroup(groupId);
    if (!group) {
      throw new SafeIpcError("CANDIDATE_GROUP_NOT_FOUND", "Candidate group not found");
    }
    return group;
  }

  private mustGetFusion(fusionId: string): DraftFusionRecord {
    const fusion = this.options.repositories.draftCandidates.getFusion(fusionId);
    if (!fusion) {
      throw new SafeIpcError("FUSION_NOT_FOUND", "Fusion not found");
    }
    return fusion;
  }

  private scopeForGroup(group: DraftCandidateGroupRecord): ChapterScope {
    const chapter = this.options.repositories.chapters.get(group.chapterId);
    if (!chapter) {
      throw new SafeIpcError("CHAPTER_NOT_FOUND", "Chapter not found");
    }
    const book = this.options.repositories.books.get(chapter.bookId);
    if (!book) {
      throw new SafeIpcError("BOOK_NOT_FOUND", "Book not found");
    }
    const plan =
      (group.chapterPlanId
        ? this.options.repositories.planning.getChapterPlan(group.chapterPlanId)
        : null) ?? this.options.repositories.planning.getAcceptedChapterPlan(chapter.id);
    const canonical = this.options.repositories.manuscripts.getCanonical(chapter.id);
    return {
      projectId: book.projectId,
      bookId: book.id,
      chapterId: chapter.id,
      chapterTitle: chapter.title,
      targetWords: group.targetWords || plan?.targetWords || chapter.targetWords,
      chapterPlanText: plan
        ? [
            `标题：${plan.title}`,
            `本章承诺：${plan.chapterPromise ?? ""}`,
            `开场钩子：${plan.openingHook ?? ""}`,
            `主要冲突：${plan.mainConflict ?? ""}`,
            `情绪转折：${plan.emotionalTurn ?? ""}`,
            `兑现：${plan.payoff ?? ""}`,
            `章末钩子：${plan.endingHook ?? ""}`,
            `连续性依赖：${plan.continuityDependenciesJson}`,
            `用户备注：${plan.userNotes ?? ""}`
          ].join("\n")
        : chapter.outlineJson ?? chapter.summary ?? "暂无已接受章纲，请按章节标题写作。",
      canonicalText: canonical?.contentPlaintext ?? ""
    };
  }

  private referenceIds(fusion: DraftFusionRecord): string[] {
    try {
      const parsed = JSON.parse(fusion.referenceCandidateIdsJson) as unknown;
      return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
    } catch {
      return [];
    }
  }

  private ensureBudgetAllows(budgetCapUsd: number | null | undefined, expectedTinyCost: number): void {
    if (typeof budgetCapUsd === "number" && budgetCapUsd < expectedTinyCost) {
      throw new SafeIpcError("BUDGET_EXCEEDED", "Budget cap is too low for this multi-draft action");
    }
  }

  private requireGateway(): void {
    if (!this.options.aiGateway) {
      throw new SafeIpcError("AI_GATEWAY_UNAVAILABLE", "AI gateway is not available");
    }
  }
}

function buildCandidateMessages(input: {
  scope: ChapterScope;
  candidate: Pick<DraftCandidateRecord, "model" | "roleLabel">;
}) {
  return [
    {
      role: "system" as const,
      content:
        "你是 WenForge 的中文网文主笔候选。只输出章节正文，不输出分析、标题、注释或解释。保持 canon 事实，遵循同一章纲和场景顺序。"
    },
    {
      role: "user" as const,
      content: [
        `模型角色：${input.candidate.roleLabel}`,
        `章节：${input.scope.chapterTitle}`,
        `目标字数：${input.scope.targetWords}`,
        "已接受章纲：",
        input.scope.chapterPlanText,
        input.scope.canonicalText ? `现有正式正文参考：\n${input.scope.canonicalText}` : "",
        "写作要求：简体中文，冲突清晰，句式有变化，章末必须有具体钩子。"
      ]
        .filter(Boolean)
        .join("\n\n")
    }
  ];
}

function buildFusionMessages(input: {
  scope: ChapterScope;
  base: DraftCandidateRecord;
  references: DraftCandidateRecord[];
  instruction: string | null;
}) {
  const defaultInstruction =
    "Produce the strongest final version using the base draft as the main body and only borrowing clearly better elements from the references.";
  return [
    {
      role: "system" as const,
      content:
        "你是 WenForge 的终稿融合编辑。只输出融合后的中文章节正文。不要机械平均多个稿件，不要重复场景，不要解释融合过程。"
    },
    {
      role: "user" as const,
      content: [
        `章节：${input.scope.chapterTitle}`,
        `目标字数：${input.scope.targetWords}`,
        `融合指令：${input.instruction?.trim() || defaultInstruction}`,
        "已接受章纲：",
        input.scope.chapterPlanText,
        `Base draft (${input.base.model}):\n${input.base.contentMarkdown}`,
        input.references.length
          ? input.references
              .map((reference) => `Reference draft (${reference.model}):\n${reference.contentMarkdown}`)
              .join("\n\n")
          : "Reference drafts: none",
        "融合要求：以 base 为主，借用 reference 的明确优点，保持 canon 事实，避免重复桥段，章末保留具体钩子。"
      ].join("\n\n")
    }
  ];
}

function requireConfirmed(confirmed: boolean | undefined): void {
  if (!confirmed) {
    throw new SafeIpcError("CONFIRMATION_REQUIRED", "Confirmation is required");
  }
}

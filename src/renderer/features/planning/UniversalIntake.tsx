import type { JSX } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";

import type { BookRecord, ChapterRecord, ProjectRecord } from "@contracts/data";
import type {
  ChapterPlanRecord,
  IntakeArtifactRecord,
  IntakeMessageRecord,
  IntakeSessionRecord,
  MaterialDigestRecord
} from "@contracts/planning";

interface UniversalIntakeProps {
  project: ProjectRecord | null;
  book: BookRecord | null;
  chapters: ChapterRecord[];
  onOpenGenerate?: () => void;
}

const ARTIFACT_LABELS: Record<string, string> = {
  material_digest: "Material Digest",
  missing_information: "Missing Information",
  auto_completion_suggestions: "Auto-Completion Suggestions",
  story_bible_draft: "Story Bible Draft",
  reader_positioning: "Reader Positioning",
  style_guide_draft: "Style Guide Draft",
  volume_outline: "Volume Outline",
  chapter_detailed_outline: "Chapter Detailed Outline",
  scene_cards: "Scene Cards",
  risks_and_ambiguities: "Risks and Ambiguities",
  creative_direction: "Auto-Completion Suggestions"
};

const STATUS_LABELS = {
  draft: "草稿",
  proposed: "待确认",
  accepted: "已确认",
  rejected: "已拒绝",
  archived: "已归档"
} as const;

export function UniversalIntake({
  project,
  book,
  chapters,
  onOpenGenerate
}: UniversalIntakeProps): JSX.Element {
  const [sessions, setSessions] = useState<IntakeSessionRecord[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<IntakeMessageRecord[]>([]);
  const [structuredArtifacts, setStructuredArtifacts] = useState<IntakeArtifactRecord[]>([]);
  const [chapterPlans, setChapterPlans] = useState<ChapterPlanRecord[]>([]);
  const [inputText, setInputText] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("AI 产物默认只是提案；确认前不会写入正式设定或正文。");

  const acceptedChapterPlanCount = useMemo(
    () => chapterPlans.filter((plan) => plan.status === "accepted").length,
    [chapterPlans]
  );

  const reloadSession = useCallback(async (sessionId: string): Promise<void> => {
    const [messages, artifacts] = await Promise.all([
      window.wenforge.planning.intake.messages.list(sessionId),
      window.wenforge.planning.intake.artifacts.list(sessionId)
    ]);
    setChatMessages(messages);
    setStructuredArtifacts(artifacts);
  }, []);

  const reload = useCallback(async (): Promise<void> => {
    if (!project) return;
    const nextSessions = await window.wenforge.planning.intake.sessions.list(project.id);
    setSessions(nextSessions);
    const nextSessionId = activeSessionId ?? nextSessions[0]?.id ?? null;
    if (nextSessionId) {
      setActiveSessionId(nextSessionId);
      await reloadSession(nextSessionId);
    }
    if (book) {
      setChapterPlans(await window.wenforge.planning.chapterPlans.list(book.id));
    }
  }, [activeSessionId, book, project, reloadSession]);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) void reload();
    });
    return () => {
      cancelled = true;
    };
  }, [reload]);

  const ensureSession = async (): Promise<IntakeSessionRecord | null> => {
    if (!project) return null;
    if (activeSessionId) {
      return sessions.find((session) => session.id === activeSessionId) ?? null;
    }
    const session = await window.wenforge.planning.intake.sessions.create({
      projectId: project.id,
      bookId: book?.id ?? null,
      title: book ? `${book.title} · 整理素材` : "整理素材"
    });
    setSessions((current) => [session, ...current]);
    setActiveSessionId(session.id);
    return session;
  };

  const addChatTurn = async (content: string, reply: string): Promise<IntakeMessageRecord[]> => {
    const session = await ensureSession();
    if (!session) return [];
    const user = await window.wenforge.planning.intake.messages.add({
      sessionId: session.id,
      role: "user",
      content
    });
    const assistant = await window.wenforge.planning.intake.messages.add({
      sessionId: session.id,
      role: "assistant",
      content: reply
    });
    setChatMessages((current) => [...current, user, assistant]);
    return [user, assistant];
  };

  const createArtifact = async (
    artifactType: string,
    title: string,
    content: unknown,
    sourceMessages: IntakeMessageRecord[],
    contentMarkdown = markdownFromContent(content)
  ): Promise<void> => {
    const session = await ensureSession();
    if (!session) return;
    const artifact = await window.wenforge.planning.intake.artifacts.create({
      sessionId: session.id,
      artifactType,
      title,
      contentJson: JSON.stringify(content, null, 2),
      contentMarkdown,
      status: "proposed",
      sourceMessageIdsJson: JSON.stringify(sourceMessages.map((message) => message.id))
    });
    setStructuredArtifacts((current) => [artifact, ...current]);
  };

  const organizeMaterials = async (): Promise<void> => {
    if (!book || !project) return;
    setBusy(true);
    try {
      const text = inputText.trim() || "请整理当前项目已有素材。";
      const messages = await addChatTurn(
        text,
        "我会先区分用户事实、草稿、AI 建议和缺失信息，并只把结果作为提案展示。"
      );
      const digest = await window.wenforge.planning.materialDigests.createFromMaterials(book.id);
      await createArtifact(
        "material_digest",
        "素材摘要",
        digestToArtifact(digest),
        messages,
        readableDigest(digest)
      );
      await createArtifact(
        "missing_information",
        "缺失信息",
        parseJsonList(digest.missingInformationJson),
        messages
      );
      await createArtifact(
        "risks_and_ambiguities",
        "风险与歧义",
        parseJsonList(digest.ambiguityWarningsJson),
        messages
      );
      setInputText("");
      setNotice("已生成素材摘要、缺失信息和歧义提示。它们仍是提案，确认后才会进入后续上下文。");
    } finally {
      setBusy(false);
    }
  };

  const autoCompleteMissingSettings = async (): Promise<void> => {
    if (!book) return;
    setBusy(true);
    try {
      const messages = await addChatTurn(
        inputText.trim() || "自动补全缺失设定，给我 2-3 个方向。",
        "我会提供可选方向，不会把任何设定写进正式 Story Bible。"
      );
      const directions = [
        {
          name: "冷峻成长线",
          protagonist_motivation: "主角为了查清亲人旧案压住同情心，优先保存证据。",
          conflict: "能力越强，越容易听见不属于自己的记忆。",
          power_cost: "每次使用感知都会丢失一段真实记忆的细节。"
        },
        {
          name: "黑暗城市线",
          world_rule: "灵气复苏被财团封锁，普通人只看到事故与失踪。",
          faction: "地下诊所回收失控觉醒者，既救人也卖情报。",
          first_volume_direction: "主角从一场雨夜事故追到地下诊所。"
        },
        {
          name: "反派压迫线",
          antagonist: "反派能伪造城市低语，引导觉醒者互相怀疑。",
          hook: "主角听见的第一个求救声来自未来的自己。"
        }
      ];
      await createArtifact("creative_direction", "可选创作方向", directions, messages);
      await createArtifact("story_bible_draft", "Story Bible 草案", directions[0], messages);
      setNotice("已补全 3 个方向。请选择、编辑或拒绝；拒绝项不会作为 canon 使用。");
    } finally {
      setBusy(false);
    }
  };

  const generateChapterDetailedOutline = async (): Promise<void> => {
    if (!book) return;
    setBusy(true);
    try {
      const messages = await addChatTurn(
        inputText.trim() || "生成章节细纲，但先不要写正文。",
        "我会把章节细纲作为可编辑提案放在右侧，并等待你确认。"
      );
      const targetChapters = chapters.length > 0 ? chapters.slice(0, 10) : [];
      for (const chapter of targetChapters) {
        const plan = localChapterPlan(book.id, chapter);
        await window.wenforge.planning.chapterPlans.upsert(plan);
      }
      await createArtifact(
        "chapter_detailed_outline",
        "章节细纲提案",
        targetChapters.map((chapter) => localChapterPlan(book.id, chapter)),
        messages
      );
      await createArtifact(
        "scene_cards",
        "场景卡提案",
        targetChapters.map((chapter) => ({
          chapter_index: chapter.chapterIndex,
          scene_cards: ["开场钩子建立异常", "主角被迫做选择", "章末留下更具体的问题"]
        })),
        messages
      );
      setChapterPlans(await window.wenforge.planning.chapterPlans.list(book.id));
      setNotice("章节细纲已生成，但正文按钮会等到至少一个细纲被确认后才可用。");
    } finally {
      setBusy(false);
    }
  };

  const acceptArtifact = async (artifact: IntakeArtifactRecord): Promise<void> => {
    const accepted = await window.wenforge.planning.intake.artifacts.setStatus(
      artifact.id,
      "accepted"
    );
    if (accepted) {
      setStructuredArtifacts((current) =>
        current.map((item) => (item.id === accepted.id ? accepted : item))
      );
    }
    if (artifact.artifactType === "chapter_detailed_outline" && book) {
      const plans = safeJson<Partial<ChapterPlanRecord>[]>(artifact.contentJson, []);
      for (const plan of plans) {
        if (!plan.chapterIndex || !plan.title) continue;
        await window.wenforge.planning.chapterPlans.upsert({
          ...plan,
          bookId: book.id,
          chapterIndex: plan.chapterIndex,
          title: plan.title,
          status: "accepted"
        });
      }
      setChapterPlans(await window.wenforge.planning.chapterPlans.list(book.id));
    }
  };

  const rejectArtifact = async (artifact: IntakeArtifactRecord): Promise<void> => {
    const rejected = await window.wenforge.planning.intake.artifacts.setStatus(
      artifact.id,
      "rejected"
    );
    if (rejected) {
      setStructuredArtifacts((current) =>
        current.map((item) => (item.id === rejected.id ? rejected : item))
      );
    }
  };

  const updateArtifactMarkdown = (
    artifact: IntakeArtifactRecord,
    contentMarkdown: string
  ): void => {
    setStructuredArtifacts((current) =>
      current.map((item) => (item.id === artifact.id ? { ...item, contentMarkdown } : item))
    );
  };

  return (
    <section className="flex h-full flex-col overflow-hidden bg-slate-950/40">
      <header className="border-b border-white/10 px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-forge-blue">Universal Intake</p>
            <h2 className="mt-1 text-xl font-semibold tracking-normal text-white">整理素材</h2>
            <p className="mt-1 text-sm text-slate-400">
              像聊天一样输入任何材料，右侧会沉淀为可编辑、可确认、可拒绝的结构化提案。
            </p>
          </div>
          <button
            className="rounded-md border border-forge-blue/35 bg-forge-blue/10 px-3 py-2 text-sm text-forge-blue disabled:opacity-45"
            disabled={acceptedChapterPlanCount === 0}
            onClick={onOpenGenerate}
            type="button"
          >
            确认后开始写正文
          </button>
        </div>
        <p className="mt-3 text-xs text-slate-500">{notice}</p>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-[minmax(280px,0.9fr)_minmax(360px,1.1fr)] overflow-hidden">
        <aside className="flex min-h-0 flex-col border-r border-white/10">
          <div className="flex-1 space-y-3 overflow-auto p-4">
            {chatMessages.length === 0 ? (
              <div className="rounded-lg border border-dashed border-white/10 p-4 text-sm text-slate-400">
                粘贴一句灵感、混乱设定、角色片段、现有正文或“不要系统面板”之类的限制都可以。
              </div>
            ) : (
              chatMessages.map((message) => (
                <article
                  className={`rounded-lg border p-3 text-sm ${
                    message.role === "user"
                      ? "border-forge-blue/25 bg-forge-blue/10 text-slate-100"
                      : "border-white/10 bg-white/[0.04] text-slate-300"
                  }`}
                  key={message.id}
                >
                  <p className="mb-1 text-[11px] uppercase tracking-[0.12em] text-slate-500">
                    {message.role}
                  </p>
                  <p className="whitespace-pre-wrap leading-6">{message.content}</p>
                </article>
              ))
            )}
          </div>
          <div className="border-t border-white/10 p-4">
            <textarea
              className="h-32 w-full resize-none rounded-lg border border-white/10 bg-black/30 p-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-forge-blue/50"
              onChange={(event) => setInputText(event.target.value)}
              placeholder="例如：这个主角太圣母，改得更冷静一点；第一卷节奏快一点；生成 10 章细纲，但先不要写正文。"
              value={inputText}
            />
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                className="rounded-md border border-forge-blue/35 bg-forge-blue/15 px-3 py-2 text-sm text-forge-blue disabled:opacity-45"
                disabled={busy || !book}
                onClick={organizeMaterials}
                type="button"
              >
                整理素材
              </button>
              <button
                className="rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-slate-200 disabled:opacity-45"
                disabled={busy || !book}
                onClick={autoCompleteMissingSettings}
                type="button"
              >
                自动补全缺失设定
              </button>
              <button
                className="rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-slate-200 disabled:opacity-45"
                disabled={busy || !book}
                onClick={generateChapterDetailedOutline}
                type="button"
              >
                生成章节细纲
              </button>
              <button
                className="rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-slate-200 disabled:opacity-45"
                disabled={acceptedChapterPlanCount === 0}
                onClick={onOpenGenerate}
                type="button"
              >
                确认后开始写正文
              </button>
            </div>
          </div>
        </aside>

        <section className="min-h-0 overflow-auto p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold tracking-normal text-white">结构化规划面板</h3>
            <span className="text-xs text-slate-500">已确认细纲 {acceptedChapterPlanCount}</span>
          </div>
          <div className="space-y-3">
            {structuredArtifacts.length === 0 ? (
              <div className="rounded-lg border border-white/10 bg-white/[0.035] p-4 text-sm text-slate-400">
                Material Digest、Missing Information、Story Bible Draft、Chapter Detailed Outline
                等结果会显示在这里。
              </div>
            ) : (
              structuredArtifacts.map((artifact) => (
                <article
                  className="rounded-lg border border-white/10 bg-white/[0.035] p-4"
                  key={artifact.id}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-xs text-slate-500">
                        {ARTIFACT_LABELS[artifact.artifactType] ?? artifact.artifactType}
                      </p>
                      <h4 className="mt-1 text-sm font-semibold tracking-normal text-white">
                        {artifact.title}
                      </h4>
                    </div>
                    <span
                      className={`rounded-full border px-2 py-1 text-xs ${
                        artifact.status === "accepted"
                          ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-200"
                          : artifact.status === "rejected"
                            ? "border-rose-400/25 bg-rose-400/10 text-rose-200"
                            : "border-amber-400/25 bg-amber-400/10 text-amber-200"
                      }`}
                    >
                      {STATUS_LABELS[artifact.status]}
                    </span>
                  </div>
                  <textarea
                    className="mt-3 h-28 w-full resize-y rounded-md border border-white/10 bg-black/20 p-3 text-sm leading-6 text-slate-200 outline-none focus:border-forge-blue/50"
                    onChange={(event) => updateArtifactMarkdown(artifact, event.target.value)}
                    value={artifact.contentMarkdown}
                  />
                  <details className="mt-2 text-xs text-slate-500">
                    <summary className="cursor-pointer">More</summary>
                    <pre className="mt-2 max-h-40 overflow-auto rounded bg-black/30 p-2">
                      {artifact.contentJson}
                    </pre>
                  </details>
                  <div className="mt-3 flex gap-2">
                    <button
                      className="rounded-md border border-emerald-400/25 bg-emerald-400/10 px-3 py-1.5 text-xs text-emerald-200"
                      onClick={() => void acceptArtifact(artifact)}
                      type="button"
                    >
                      确认提案
                    </button>
                    <button
                      className="rounded-md border border-rose-400/25 bg-rose-400/10 px-3 py-1.5 text-xs text-rose-200"
                      onClick={() => void rejectArtifact(artifact)}
                      type="button"
                    >
                      拒绝提案
                    </button>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>
      </div>
    </section>
  );
}

function digestToArtifact(digest: MaterialDigestRecord): Record<string, unknown> {
  return {
    digest: safeJson<Record<string, unknown>>(digest.digestJson, {}),
    missing_information: parseJsonList(digest.missingInformationJson),
    ambiguity_warnings: parseJsonList(digest.ambiguityWarningsJson),
    source_summary: safeJson<Record<string, unknown>>(digest.sourceSummaryJson, {})
  };
}

function readableDigest(digest: MaterialDigestRecord): string {
  const data = safeJson<Record<string, unknown>>(digest.digestJson, {});
  return Object.entries(data)
    .slice(0, 10)
    .map(([key, value]) => `- ${key}: ${Array.isArray(value) ? value.join("；") : String(value)}`)
    .join("\n");
}

function localChapterPlan(
  bookId: string,
  chapter: ChapterRecord
): Partial<ChapterPlanRecord> & Pick<ChapterPlanRecord, "bookId" | "chapterIndex" | "title"> {
  return {
    bookId,
    volumeId: chapter.volumeId,
    chapterId: chapter.id,
    chapterIndex: chapter.chapterIndex,
    title: chapter.title,
    targetWords: chapter.targetWords,
    minWords: chapter.minWords,
    maxWords: chapter.maxWords,
    wordCountPriority: chapter.wordCountPriority,
    chapterSummary: chapter.summary ?? `${chapter.title} 承接已整理素材推进主线。`,
    openingHook: "用具体异常或强烈情绪开场。",
    mainConflict: "主角必须在保守秘密与主动追查之间选择。",
    keyEventsJson: JSON.stringify(["建立章节问题", "升级冲突", "留下章末钩子"]),
    sceneCardsJson: JSON.stringify(["开场异常", "中段选择", "章末反转"]),
    emotionalTurn: "从被动反应转为主动试探。",
    payoff: "读者获得一个明确线索。",
    endingHook: "更大的危险抵达门口。",
    continuityDependenciesJson: JSON.stringify(["仅使用已确认素材和人工输入"]),
    status: "proposed"
  };
}

function parseJsonList(value: string): string[] {
  return safeJson<string[]>(value, []);
}

function markdownFromContent(content: unknown): string {
  if (Array.isArray(content)) {
    return content
      .map((item) => `- ${typeof item === "string" ? item : JSON.stringify(item)}`)
      .join("\n");
  }
  if (content && typeof content === "object") {
    return Object.entries(content as Record<string, unknown>)
      .map(([key, value]) => `- ${key}: ${Array.isArray(value) ? value.join("；") : String(value)}`)
      .join("\n");
  }
  return String(content ?? "");
}

function safeJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { JSX } from "react";
import React, { useCallback, useEffect, useMemo, useState } from "react";

import { CommandPalette } from "@components/CommandPalette";
import { StatusBadge } from "@components/StatusBadge";
import type { AIStreamEvent, CostSummary, LLMRunRecord } from "@contracts/ai";
import type {
  BookRecord,
  ChapterRecord,
  ManuscriptVersionRecord,
  ProjectRecord,
  StoryBibleEntryRecord,
  VolumeRecord
} from "@contracts/data";
import { CostMeter } from "@features/costs/CostMeter";
import { CostDashboard } from "@features/costs/CostDashboard";
import { ManuscriptEditor } from "@features/editor/ManuscriptEditor";
import { EvalDashboard } from "@features/evaluation/EvalDashboard";
import { createSimpleDiff, manuscriptStats } from "@features/editor/manuscript-utils";
import { ModelRouteCard } from "@features/model-router/ModelRouteCard";
import { ProjectSidebar } from "@features/projects/ProjectSidebar";
import { SettingsPanel } from "@features/settings/SettingsPanel";
import { ContextPreviewPanel } from "@features/story-bible/ContextPreviewPanel";
import { StoryBiblePanel } from "@features/story-bible/StoryBiblePanel";
import { StoryBibleWorkspace } from "@features/story-bible/StoryBibleWorkspace";
import { TaskTimeline } from "@features/workflows/TaskTimeline";
import { WorkflowGeneratePanel } from "@features/workflows/WorkflowGeneratePanel";
import type { StudioCommandId } from "@features/workflows/command-registry";
import { runDestructiveAction } from "@features/workflows/confirmation";
import type { ModelRouteResolution } from "@contracts/model-routing";
import type { ManuscriptDiff, SettlementPreview } from "@contracts/review-settlement";
import type {
  ChapterWorkflowDetail,
  WorkflowArtifactRecord,
  WorkflowReviewCard
} from "@contracts/workflow";
import { useUiStore } from "@renderer/stores/ui-store";

type WorkspaceView = "chapter" | "storyBible" | "costs" | "eval" | "settings";
type WorkspaceTab = "manuscript" | "generate" | "review" | "timeline" | "versions";

const CHAPTER_STATUSES = [
  "planned",
  "outlining",
  "drafting",
  "reviewing",
  "revised",
  "approved",
  "published"
] as const;

function draftStorageKey(chapterId: string): string {
  return `wenforge:draft:${chapterId}`;
}

function promptText(message: string, current = ""): string | null {
  const value = window.prompt(message, current);
  if (value === null) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function sortChapters(chapters: ChapterRecord[]): ChapterRecord[] {
  return [...chapters].sort((a, b) => a.chapterIndex - b.chapterIndex);
}

export function App(): JSX.Element {
  const [version, setVersion] = useState("0.1.0");
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [books, setBooks] = useState<BookRecord[]>([]);
  const [volumes, setVolumes] = useState<VolumeRecord[]>([]);
  const [chapters, setChapters] = useState<ChapterRecord[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedBookId, setSelectedBookId] = useState<string | null>(null);
  const [selectedChapterId, setSelectedChapterId] = useState<string | null>(null);
  const [canonical, setCanonical] = useState<ManuscriptVersionRecord | null>(null);
  const [canonicalChapterIds, setCanonicalChapterIds] = useState<Set<string>>(new Set());
  const [versions, setVersions] = useState<ManuscriptVersionRecord[]>([]);
  const [draft, setDraft] = useState("");
  const [viewingVersionId, setViewingVersionId] = useState<string | null>(null);
  const [compareAId, setCompareAId] = useState<string | null>(null);
  const [compareBId, setCompareBId] = useState<string | null>(null);
  const [storyBibleEntries, setStoryBibleEntries] = useState<StoryBibleEntryRecord[]>([]);
  const [recentRuns, setRecentRuns] = useState<LLMRunRecord[]>([]);
  const [costSummary, setCostSummary] = useState<CostSummary | null>(null);
  const [routeResolution, setRouteResolution] = useState<ModelRouteResolution | null>(null);
  const [workspaceView, setWorkspaceView] = useState<WorkspaceView>("chapter");
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("manuscript");
  const [activeRunLabel, setActiveRunLabel] = useState("No active run");
  const [activeRunCost, setActiveRunCost] = useState(0);
  const [sessionCost, setSessionCost] = useState(0);
  const [costWarning, setCostWarning] = useState("prices local");

  const commandPaletteOpen = useUiStore((state) => state.commandPaletteOpen);
  const studioMode = useUiStore((state) => state.studioMode);
  const openCommandPalette = useUiStore((state) => state.openCommandPalette);
  const closeCommandPalette = useUiStore((state) => state.closeCommandPalette);
  const setStudioMode = useUiStore((state) => state.setStudioMode);
  const reduceMotion = useReducedMotion();
  const compact = studioMode === "popover";

  const activeProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) ?? null,
    [projects, selectedProjectId]
  );
  const activeBook = useMemo(
    () => books.find((book) => book.id === selectedBookId) ?? null,
    [books, selectedBookId]
  );
  const activeChapter = useMemo(
    () => chapters.find((chapter) => chapter.id === selectedChapterId) ?? null,
    [chapters, selectedChapterId]
  );
  const activeVolume = useMemo(
    () => volumes.find((volume) => volume.id === activeChapter?.volumeId) ?? null,
    [activeChapter?.volumeId, volumes]
  );
  const activeVersion = useMemo(
    () => versions.find((item) => item.id === viewingVersionId) ?? null,
    [versions, viewingVersionId]
  );
  const stats = useMemo(() => manuscriptStats(draft), [draft]);
  const compareA = versions.find((item) => item.id === compareAId) ?? versions[1] ?? null;
  const compareB =
    versions.find((item) => item.id === compareBId) ?? versions[0] ?? canonical ?? null;
  const diff = useMemo(
    () => createSimpleDiff(compareA?.contentMarkdown ?? "", compareB?.contentMarkdown ?? ""),
    [compareA, compareB]
  );

  useEffect(() => {
    void window.wenforge.app.getVersion().then(setVersion);
  }, []);

  useEffect(() => {
    let mounted = true;

    async function loadProjects(): Promise<void> {
      const nextProjects = await window.wenforge.projects.list();
      if (!mounted) return;
      setProjects(nextProjects);
      setSelectedProjectId((current) =>
        current && nextProjects.some((project) => project.id === current)
          ? current
          : (nextProjects[0]?.id ?? null)
      );
    }

    void loadProjects();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    async function loadBooks(): Promise<void> {
      if (!selectedProjectId) {
        setBooks([]);
        setSelectedBookId(null);
        return;
      }

      const nextBooks = await window.wenforge.books.listByProject(selectedProjectId);
      if (!mounted) return;
      setBooks(nextBooks);
      setSelectedBookId((current) =>
        current && nextBooks.some((book) => book.id === current)
          ? current
          : (nextBooks[0]?.id ?? null)
      );
    }

    void loadBooks();
    return () => {
      mounted = false;
    };
  }, [selectedProjectId]);

  useEffect(() => {
    let mounted = true;

    async function loadBookWorkspace(): Promise<void> {
      if (!selectedBookId) {
        setVolumes([]);
        setChapters([]);
        setStoryBibleEntries([]);
        setSelectedChapterId(null);
        return;
      }

      const [nextVolumes, nextChapters, nextStoryBible, nextRoute, nextCost] = await Promise.all([
        window.wenforge.volumes.listByBook(selectedBookId),
        window.wenforge.chapters.listByBook(selectedBookId),
        window.wenforge.storyBible.entries.list(selectedBookId),
        window.wenforge.taskRoutes.resolve("draft_chapter", "balanced").catch(() => null),
        window.wenforge.ai.costs.summary({ bookId: selectedBookId }).catch(() => null)
      ]);
      const sorted = sortChapters(nextChapters);
      const canonicalPairs = await Promise.all(
        sorted.map(
          async (chapter) =>
            [chapter.id, await window.wenforge.manuscripts.getCanonical(chapter.id)] as const
        )
      );

      if (!mounted) return;
      setVolumes(nextVolumes);
      setChapters(sorted);
      setStoryBibleEntries(nextStoryBible);
      setRouteResolution(nextRoute);
      setCostSummary(nextCost);
      setCanonicalChapterIds(
        new Set(canonicalPairs.filter(([, item]) => Boolean(item)).map(([chapterId]) => chapterId))
      );
      setSelectedChapterId((current) =>
        current && sorted.some((chapter) => chapter.id === current)
          ? current
          : (sorted[0]?.id ?? null)
      );
    }

    void loadBookWorkspace();
    return () => {
      mounted = false;
    };
  }, [selectedBookId]);

  useEffect(() => {
    let mounted = true;

    async function loadChapterWorkspace(): Promise<void> {
      if (!selectedChapterId) {
        setCanonical(null);
        setVersions([]);
        setRecentRuns([]);
        setDraft("");
        return;
      }

      const [nextCanonical, nextVersions, nextRuns, nextCost] = await Promise.all([
        window.wenforge.manuscripts.getCanonical(selectedChapterId),
        window.wenforge.manuscripts.listVersions(selectedChapterId),
        window.wenforge.ai.runs.listByChapter(selectedChapterId).catch(() => []),
        window.wenforge.ai.costs.summary({ chapterId: selectedChapterId }).catch(() => null)
      ]);

      if (!mounted) return;
      const savedDraft = window.localStorage.getItem(draftStorageKey(selectedChapterId));
      setCanonical(nextCanonical);
      setVersions(nextVersions);
      setRecentRuns(nextRuns);
      setCostSummary(nextCost);
      setDraft(savedDraft ?? nextCanonical?.contentMarkdown ?? "");
      setViewingVersionId(nextCanonical?.id ?? null);
      setCompareAId(nextVersions[1]?.id ?? nextVersions[0]?.id ?? null);
      setCompareBId(nextCanonical?.id ?? nextVersions[0]?.id ?? null);
    }

    void loadChapterWorkspace();
    return () => {
      mounted = false;
    };
  }, [selectedChapterId]);

  useEffect(() => {
    if (selectedChapterId) {
      window.localStorage.setItem(draftStorageKey(selectedChapterId), draft);
    }
  }, [draft, selectedChapterId]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        openCommandPalette();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [openCommandPalette]);

  useEffect(
    () =>
      window.wenforge.ai.stream.onEvent((event: AIStreamEvent) => {
        if (event.type === "cost") {
          setActiveRunLabel(`${event.provider} / ${event.model}`);
          setActiveRunCost(event.estimatedCostLive);
          setCostWarning(event.warnings?.join(", ") || "live estimate");
        }
        if (event.type === "complete") {
          setActiveRunLabel(`${event.provider} / ${event.model}`);
          setActiveRunCost(event.cost.totalCost);
          setSessionCost((current) => current + event.cost.totalCost);
          setCostWarning(event.usageSource);
        }
        if (event.type === "error") {
          setCostWarning(event.code);
        }
      }),
    []
  );

  const toggleStudioMode = async (): Promise<void> => {
    setStudioMode(await window.wenforge.window.toggleStudioMode());
  };

  const refreshProjectsAfterCreate = async (project: ProjectRecord): Promise<void> => {
    setProjects(await window.wenforge.projects.list());
    setSelectedProjectId(project.id);
  };

  const refreshBooksAfterCreate = async (book: BookRecord): Promise<void> => {
    if (selectedProjectId) {
      setBooks(await window.wenforge.books.listByProject(selectedProjectId));
    }
    setSelectedBookId(book.id);
  };

  const refreshBookCollections = async (preferredChapterId?: string | null): Promise<void> => {
    if (!selectedBookId) return;
    const [nextVolumes, nextChapters, nextStoryBible] = await Promise.all([
      window.wenforge.volumes.listByBook(selectedBookId),
      window.wenforge.chapters.listByBook(selectedBookId),
      window.wenforge.storyBible.entries.list(selectedBookId)
    ]);
    setVolumes(nextVolumes);
    setChapters(sortChapters(nextChapters));
    setStoryBibleEntries(nextStoryBible);
    if (preferredChapterId !== undefined) {
      setSelectedChapterId(preferredChapterId);
    }
  };

  const refreshChapterVersions = async (chapterId = selectedChapterId): Promise<void> => {
    if (!chapterId) return;
    const [nextCanonical, nextVersions] = await Promise.all([
      window.wenforge.manuscripts.getCanonical(chapterId),
      window.wenforge.manuscripts.listVersions(chapterId)
    ]);
    setCanonical(nextCanonical);
    setVersions(nextVersions);
    setCanonicalChapterIds((current) => {
      const next = new Set(current);
      if (nextCanonical) next.add(chapterId);
      return next;
    });
  };

  const updateWorkflowCost = useCallback((label: string, cost: number, warning: string): void => {
    setActiveRunLabel(label);
    setActiveRunCost(cost);
    setCostWarning(warning);
    setSessionCost((current) => Math.max(current, cost));
  }, []);

  const createProject = async (): Promise<void> => {
    const name = promptText("Project name");
    if (!name) return;
    const project = await window.wenforge.projects.create({ name });
    await refreshProjectsAfterCreate(project);
  };

  const createBook = async (): Promise<void> => {
    if (!selectedProjectId) return;
    const title = promptText("Book title");
    if (!title) return;
    const book = await window.wenforge.books.create({ projectId: selectedProjectId, title });
    await refreshBooksAfterCreate(book);
  };

  const createVolume = async (): Promise<void> => {
    if (!selectedBookId) return;
    const title = promptText("Volume title", `Volume ${volumes.length + 1}`);
    if (!title) return;
    const volume = await window.wenforge.volumes.create({
      bookId: selectedBookId,
      title,
      volumeIndex: volumes.length + 1
    });
    setVolumes((current) => [...current, volume]);
  };

  const createChapter = async (volumeId: string | null = null): Promise<void> => {
    if (!selectedBookId) return;
    const title = promptText("Chapter title", `第${chapters.length + 1}章`);
    if (!title) return;
    const chapter = await window.wenforge.chapters.create({
      bookId: selectedBookId,
      volumeId,
      chapterIndex: chapters.length + 1,
      title,
      targetWords: 3000
    });
    await refreshBookCollections(chapter.id);
  };

  const renameChapter = async (chapter: ChapterRecord): Promise<void> => {
    const title = promptText("Rename chapter", chapter.title);
    if (!title) return;
    const updated = await window.wenforge.chapters.update(chapter.id, { title });
    if (updated) {
      setChapters((current) =>
        sortChapters(current.map((item) => (item.id === updated.id ? updated : item)))
      );
    }
  };

  const moveChapter = async (chapter: ChapterRecord, direction: "up" | "down"): Promise<void> => {
    if (!selectedBookId) return;
    const ordered = sortChapters(chapters);
    const index = ordered.findIndex((item) => item.id === chapter.id);
    const swapWith = direction === "up" ? index - 1 : index + 1;
    if (index < 0 || swapWith < 0 || swapWith >= ordered.length) return;
    const next = [...ordered];
    const currentChapter = next[index];
    const swapChapter = next[swapWith];
    if (!currentChapter || !swapChapter) return;
    next[index] = swapChapter;
    next[swapWith] = currentChapter;
    await window.wenforge.chapters.reorder(
      selectedBookId,
      next.map((item) => item.id)
    );
    setChapters(sortChapters(await window.wenforge.chapters.listByBook(selectedBookId)));
  };

  const changeChapterStatus = async (chapter: ChapterRecord): Promise<void> => {
    const status = promptText(`Status (${CHAPTER_STATUSES.join(", ")})`, chapter.status);
    if (!status || !CHAPTER_STATUSES.includes(status as (typeof CHAPTER_STATUSES)[number])) return;
    const updated = await window.wenforge.chapters.setStatus(chapter.id, status);
    if (updated) {
      setChapters((current) => current.map((item) => (item.id === updated.id ? updated : item)));
    }
  };

  const editTargetWords = async (): Promise<void> => {
    if (!activeChapter) return;
    const value = promptText("Target words", String(activeChapter.targetWords));
    if (!value) return;
    const targetWords = Number.parseInt(value, 10);
    if (!Number.isFinite(targetWords) || targetWords <= 0) return;
    const updated = await window.wenforge.chapters.update(activeChapter.id, { targetWords });
    if (updated) {
      setChapters((current) => current.map((item) => (item.id === updated.id ? updated : item)));
    }
  };

  const editChapterSummary = async (): Promise<void> => {
    if (!activeChapter) return;
    const summary = promptText("Chapter summary", activeChapter.summary ?? "");
    if (summary === null) return;
    const updated = await window.wenforge.chapters.update(activeChapter.id, { summary });
    if (updated) {
      setChapters((current) => current.map((item) => (item.id === updated.id ? updated : item)));
    }
  };

  const saveManualVersion = async (isCanonical = false): Promise<void> => {
    if (!activeChapter) return;
    if (isCanonical) {
      const result = await runDestructiveAction(
        "Set this working draft as the canonical manuscript?",
        window.confirm.bind(window),
        async () => true
      );
      if (!result) return;
    }
    const saved = await window.wenforge.manuscripts.saveManualVersion({
      chapterId: activeChapter.id,
      parentVersionId: canonical?.id ?? null,
      title: `${activeChapter.title} · manual v${versions.length + 1}`,
      contentMarkdown: draft,
      isCanonical
    });
    setViewingVersionId(saved.id);
    await refreshChapterVersions(activeChapter.id);
  };

  const setVersionCanonical = async (versionToSet: ManuscriptVersionRecord): Promise<void> => {
    if (!activeChapter) return;
    const result = await runDestructiveAction(
      `Set version ${versionToSet.versionIndex} as canonical?`,
      window.confirm.bind(window),
      () => window.wenforge.manuscripts.setCanonical(activeChapter.id, versionToSet.id)
    );
    if (!result) return;
    setCanonical(result);
    setDraft(result.contentMarkdown);
    setViewingVersionId(result.id);
    await refreshChapterVersions(activeChapter.id);
  };

  const rollbackVersion = async (versionToRestore: ManuscriptVersionRecord): Promise<void> => {
    if (!activeChapter) return;
    const restored = await runDestructiveAction(
      `Rollback by creating a new canonical version from v${versionToRestore.versionIndex}?`,
      window.confirm.bind(window),
      () => window.wenforge.manuscripts.rollback(activeChapter.id, versionToRestore.id, true)
    );
    if (!restored) return;
    setCanonical(restored);
    setDraft(restored.contentMarkdown);
    setViewingVersionId(restored.id);
    await refreshChapterVersions(activeChapter.id);
  };

  const openVersion = (versionToOpen: ManuscriptVersionRecord): void => {
    setDraft(versionToOpen.contentMarkdown);
    setViewingVersionId(versionToOpen.id);
    setActiveTab("manuscript");
  };

  const createStoryBibleEntry = async (): Promise<void> => {
    if (!selectedBookId) return;
    const title = promptText("Story bible entry title");
    if (!title) return;
    const content = promptText("Story bible entry content");
    if (!content) return;
    await window.wenforge.storyBible.entries.create({
      bookId: selectedBookId,
      chapterId: selectedChapterId,
      entryType: "note",
      title,
      content
    });
    setStoryBibleEntries(await window.wenforge.storyBible.entries.list(selectedBookId));
  };

  const runCommand = (commandId: StudioCommandId): void => {
    const actions: Record<StudioCommandId, () => void> = {
      "new-project": () => void createProject(),
      "new-book": () => void createBook(),
      "new-volume": () => void createVolume(),
      "new-chapter": () => void createChapter(null),
      "save-manuscript-version": () => void saveManualVersion(false),
      "set-canonical": () => void saveManualVersion(true),
      "open-settings": () => setWorkspaceView("settings"),
      "generate-outline": () => {
        setWorkspaceView("chapter");
        setActiveTab("generate");
      },
      "draft-chapter": () => {
        setWorkspaceView("chapter");
        setActiveTab("generate");
      },
      "run-audit": () => {
        setWorkspaceView("chapter");
        setActiveTab("review");
      },
      "show-cost-dashboard": () => {
        setWorkspaceView("costs");
      }
    };
    actions[commandId]();
  };

  const selectProject = (projectId: string): void => {
    setSelectedProjectId(projectId || null);
    setSelectedBookId(null);
    setSelectedChapterId(null);
  };

  const selectBook = (bookId: string): void => {
    setSelectedBookId(bookId);
    setSelectedChapterId(null);
  };

  const selectChapter = (chapter: ChapterRecord): void => {
    setSelectedChapterId(chapter.id);
    setWorkspaceView("chapter");
  };

  return (
    <main className="min-h-screen overflow-hidden bg-transparent p-3 text-slate-100">
      <motion.section
        animate={{ opacity: 1, scale: 1 }}
        className="grid h-[calc(100vh-1.5rem)] overflow-hidden rounded-2xl border border-white/10 bg-graphite-950/92 shadow-soft-glow backdrop-blur-xl"
        initial={reduceMotion ? false : { opacity: 0, scale: 0.985 }}
        transition={{ duration: 0.22, ease: "easeOut" }}
      >
        <header className="app-drag grid h-14 grid-cols-[auto_1fr_auto] items-center gap-3 border-b border-white/10 bg-white/[0.035] px-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-forge-blue/35 bg-forge-blue/15 text-sm font-semibold text-forge-blue">
              W
            </div>
            <div>
              <h1 className="text-sm font-semibold tracking-normal text-white">WenForge Studio</h1>
              <p className="text-xs text-slate-500">
                {activeProject?.name ?? "Local-first writing studio"}
              </p>
            </div>
          </div>

          <button
            className="app-no-drag mx-auto flex h-9 w-full max-w-xl items-center justify-between rounded-lg border border-white/10 bg-black/20 px-3 text-left text-sm text-slate-400 transition hover:border-forge-blue/40 hover:text-slate-200 focus:border-forge-blue/60 focus:outline-none"
            onClick={openCommandPalette}
            type="button"
          >
            <span>Search projects, chapters, commands</span>
            <kbd className="rounded border border-white/10 bg-white/5 px-1.5 py-0.5 text-[11px] text-slate-500">
              Cmd K
            </kbd>
          </button>

          <div className="app-no-drag flex items-center gap-2">
            <StatusPill label={activeRunLabel} tone="blue" />
            <StatusPill label={`Session $${sessionCost.toFixed(6)}`} tone="mint" />
            <StatusPill
              label={routeResolution?.available ? "Route ready" : "Route needs setup"}
              tone={routeResolution?.available ? "mint" : "amber"}
            />
            <button
              className={`rounded-md border px-3 py-1.5 text-xs transition ${
                workspaceView === "chapter"
                  ? "border-forge-blue/35 bg-forge-blue/10 text-forge-blue"
                  : "border-white/10 text-slate-300 hover:border-forge-violet/40 hover:text-white"
              }`}
              onClick={() => setWorkspaceView("chapter")}
              type="button"
            >
              Studio
            </button>
            <button
              className={`rounded-md border px-3 py-1.5 text-xs transition ${
                workspaceView === "storyBible"
                  ? "border-forge-blue/35 bg-forge-blue/10 text-forge-blue"
                  : "border-white/10 text-slate-300 hover:border-forge-violet/40 hover:text-white"
              }`}
              onClick={() => setWorkspaceView("storyBible")}
              type="button"
            >
              Bible
            </button>
            <button
              className={`rounded-md border px-3 py-1.5 text-xs transition ${
                workspaceView === "costs"
                  ? "border-forge-blue/35 bg-forge-blue/10 text-forge-blue"
                  : "border-white/10 text-slate-300 hover:border-forge-violet/40 hover:text-white"
              }`}
              onClick={() => setWorkspaceView("costs")}
              type="button"
            >
              Costs
            </button>
            <button
              className={`rounded-md border px-3 py-1.5 text-xs transition ${
                workspaceView === "eval"
                  ? "border-forge-blue/35 bg-forge-blue/10 text-forge-blue"
                  : "border-white/10 text-slate-300 hover:border-forge-violet/40 hover:text-white"
              }`}
              onClick={() => setWorkspaceView("eval")}
              type="button"
            >
              Eval
            </button>
            <button
              className={`rounded-md border px-3 py-1.5 text-xs transition ${
                workspaceView === "settings"
                  ? "border-forge-blue/35 bg-forge-blue/10 text-forge-blue"
                  : "border-white/10 text-slate-300 hover:border-forge-violet/40 hover:text-white"
              }`}
              onClick={() => setWorkspaceView("settings")}
              type="button"
            >
              Settings
            </button>
            <button
              className="rounded-md border border-white/10 px-3 py-1.5 text-xs text-slate-300 transition hover:border-forge-violet/40 hover:text-white"
              onClick={() => void toggleStudioMode()}
              type="button"
            >
              {compact ? "Expand" : "Compact"}
            </button>
            <button
              aria-label="Minimize"
              className="h-8 w-8 rounded-md border border-white/10 text-slate-400 transition hover:text-white"
              onClick={() => void window.wenforge.window.minimize()}
              type="button"
            >
              -
            </button>
            <button
              aria-label="Close"
              className="h-8 w-8 rounded-md border border-white/10 text-slate-400 transition hover:border-red-400/40 hover:text-red-200"
              onClick={() => void window.wenforge.window.close()}
              type="button"
            >
              x
            </button>
          </div>
        </header>

        <div
          className={`grid min-h-0 transition-[grid-template-columns] duration-300 ${
            compact ? "grid-cols-[64px_minmax(0,1fr)]" : "grid-cols-[300px_minmax(0,1fr)_340px]"
          }`}
        >
          <ProjectSidebar
            canonicalChapterIds={canonicalChapterIds}
            chapters={chapters}
            compact={compact}
            onChangeStatus={(chapter) => void changeChapterStatus(chapter)}
            onCreateBook={() => void createBook()}
            onCreateChapter={(volumeId) => void createChapter(volumeId ?? null)}
            onCreateProject={() => void createProject()}
            onCreateVolume={() => void createVolume()}
            onMoveChapter={(chapter, direction) => void moveChapter(chapter, direction)}
            onRenameChapter={(chapter) => void renameChapter(chapter)}
            onSelectBook={selectBook}
            onSelectChapter={selectChapter}
            onSelectProject={selectProject}
            projects={projects}
            books={books}
            selectedBookId={selectedBookId}
            selectedChapterId={selectedChapterId}
            selectedProjectId={selectedProjectId}
            volumes={volumes}
          />

          <section className="min-h-0 overflow-hidden bg-[linear-gradient(140deg,rgba(117,167,255,0.08),transparent_35%),linear-gradient(320deg,rgba(178,148,255,0.08),transparent_38%)]">
            {compact ? (
              <CompactLauncher
                activeChapter={activeChapter}
                activeRunLabel={activeRunLabel}
                chapters={chapters}
                onCreateChapter={() => void createChapter(null)}
                onExpand={() => void toggleStudioMode()}
                onOpenChapter={selectChapter}
                onOpenCommandPalette={openCommandPalette}
                onOpenGenerate={() => {
                  setActiveTab("generate");
                  setWorkspaceView("chapter");
                }}
              />
            ) : workspaceView === "settings" ? (
              <div className="h-full overflow-auto">
                <SettingsPanel />
              </div>
            ) : workspaceView === "storyBible" ? (
              <StoryBibleWorkspace bookId={activeBook?.id ?? null} />
            ) : workspaceView === "costs" ? (
              <CostDashboard
                activeRunCost={activeRunCost}
                activeRunId={recentRuns[0]?.id ?? null}
                bookId={activeBook?.id ?? null}
                chapterId={activeChapter?.id ?? null}
                projectId={activeProject?.id ?? null}
                sessionCost={sessionCost}
              />
            ) : workspaceView === "eval" ? (
              <EvalDashboard bookId={activeBook?.id ?? null} />
            ) : (
              <ChapterWorkspace
                activeBook={activeBook}
                activeChapter={activeChapter}
                activeProject={activeProject}
                activeTab={activeTab}
                activeVersion={activeVersion}
                activeVolume={activeVolume}
                canonical={canonical}
                compareA={compareA}
                compareAId={compareAId}
                compareB={compareB}
                compareBId={compareBId}
                diff={diff}
                draft={draft}
                onChangeDraft={setDraft}
                onCompareA={setCompareAId}
                onCompareB={setCompareBId}
                onEditSummary={() => void editChapterSummary()}
                onEditTargetWords={() => void editTargetWords()}
                onOpenVersion={openVersion}
                onRollbackVersion={(item) => void rollbackVersion(item)}
                onSaveVersion={() => void saveManualVersion(false)}
                onSetCanonical={() => void saveManualVersion(true)}
                onSetTab={setActiveTab}
                onSetVersionCanonical={(item) => void setVersionCanonical(item)}
                onWorkflowCanonicalChanged={(item) => {
                  setCanonical(item);
                  setDraft(item.contentMarkdown);
                  setViewingVersionId(item.id);
                  void refreshChapterVersions(item.chapterId);
                }}
                onWorkflowCostChange={updateWorkflowCost}
                onWorkflowVersionCreated={(item) => {
                  setViewingVersionId(item.id);
                  void refreshChapterVersions(item.chapterId);
                }}
                stats={stats}
                versions={versions}
              />
            )}
          </section>

          {compact ? null : (
            <aside className="min-h-0 overflow-auto border-l border-white/10 bg-black/18">
              <div className="space-y-4 p-4">
                <StoryBiblePanel
                  entries={storyBibleEntries}
                  onCreateEntry={() => void createStoryBibleEntry()}
                />
                <ContinuityPanel activeChapter={activeChapter} canonical={canonical} />
                <CostMeter
                  activeRunCost={activeRunCost}
                  activeRunLabel={activeRunLabel}
                  costWarning={costWarning}
                  recentRuns={recentRuns}
                  sessionCost={sessionCost}
                  summary={costSummary}
                />
                <ModelRouteCard routeResolution={routeResolution} />
                <ContextPreviewPanel
                  book={activeBook}
                  chapter={activeChapter}
                  project={activeProject}
                  volume={activeVolume}
                />
                <section className="rounded-lg border border-white/10 bg-graphite-900/60 p-4">
                  <h3 className="text-sm font-semibold text-white">Settlement proposals</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    Proposed state updates will appear here and require approval before touching
                    canon.
                  </p>
                </section>
              </div>
            </aside>
          )}
        </div>

        <footer className="grid h-9 grid-cols-[1fr_auto] items-center border-t border-white/10 bg-black/28 px-4 text-xs text-slate-500">
          <span>WenForge Studio {version}</span>
          <span>
            {activeBook?.title ?? "No book"} · Run ${activeRunCost.toFixed(6)} · Session $
            {sessionCost.toFixed(6)} · {costWarning}
          </span>
        </footer>
      </motion.section>

      <CommandPalette
        onClose={closeCommandPalette}
        onRunCommand={runCommand}
        open={commandPaletteOpen}
      />
    </main>
  );
}

function StatusPill({
  label,
  tone
}: {
  label: string;
  tone: "blue" | "mint" | "amber";
}): JSX.Element {
  const className =
    tone === "blue"
      ? "border-forge-blue/25 bg-forge-blue/10 text-forge-blue"
      : tone === "mint"
        ? "border-forge-mint/25 bg-forge-mint/10 text-forge-mint"
        : "border-forge-amber/25 bg-forge-amber/10 text-forge-amber";
  return (
    <span
      className={`hidden max-w-[170px] truncate rounded-full border px-3 py-1 text-xs xl:block ${className}`}
    >
      {label}
    </span>
  );
}

function CompactLauncher({
  activeChapter,
  activeRunLabel,
  chapters,
  onCreateChapter,
  onExpand,
  onOpenChapter,
  onOpenCommandPalette,
  onOpenGenerate
}: {
  activeChapter: ChapterRecord | null;
  activeRunLabel: string;
  chapters: ChapterRecord[];
  onCreateChapter: () => void;
  onExpand: () => void;
  onOpenChapter: (chapter: ChapterRecord) => void;
  onOpenCommandPalette: () => void;
  onOpenGenerate: () => void;
}): JSX.Element {
  return (
    <div className="flex h-full items-center justify-center p-6">
      <section className="w-full max-w-2xl rounded-xl border border-white/10 bg-graphite-900/70 p-5 shadow-soft-glow">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
              Popover launcher
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-white">
              {activeChapter?.title ?? "Choose a chapter"}
            </h2>
            <p className="mt-2 text-sm text-slate-500">{activeRunLabel}</p>
          </div>
          <button
            className="rounded-lg border border-forge-blue/35 bg-forge-blue/10 px-3 py-2 text-sm text-forge-blue"
            onClick={onExpand}
            type="button"
          >
            Expand Studio
          </button>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
          <button
            className="rounded-lg border border-white/10 bg-black/20 p-3 text-left text-sm text-slate-200"
            onClick={onOpenCommandPalette}
            type="button"
          >
            Commands
          </button>
          <button
            className="rounded-lg border border-white/10 bg-black/20 p-3 text-left text-sm text-slate-200"
            onClick={onCreateChapter}
            type="button"
          >
            New Chapter
          </button>
          <button
            className="rounded-lg border border-white/10 bg-black/20 p-3 text-left text-sm text-slate-200"
            onClick={onOpenGenerate}
            type="button"
          >
            Quick Draft
          </button>
          <button
            className="rounded-lg border border-white/10 bg-black/20 p-3 text-left text-sm text-slate-200"
            onClick={onOpenGenerate}
            type="button"
          >
            Run Audit
          </button>
        </div>
        <div className="mt-5 space-y-2">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
            Recent chapters
          </p>
          {chapters.slice(0, 5).map((chapter) => (
            <button
              className="flex w-full items-center justify-between rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-left text-sm text-slate-300 hover:border-forge-blue/35"
              key={chapter.id}
              onClick={() => onOpenChapter(chapter)}
              type="button"
            >
              <span>{chapter.title}</span>
              <StatusBadge status={chapter.status} />
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

function ChapterWorkspace({
  activeBook,
  activeChapter,
  activeProject,
  activeTab,
  activeVersion,
  activeVolume,
  canonical,
  compareA,
  compareAId,
  compareB,
  compareBId,
  diff,
  draft,
  onChangeDraft,
  onCompareA,
  onCompareB,
  onEditSummary,
  onEditTargetWords,
  onOpenVersion,
  onRollbackVersion,
  onSaveVersion,
  onSetCanonical,
  onSetTab,
  onSetVersionCanonical,
  onWorkflowCanonicalChanged,
  onWorkflowCostChange,
  onWorkflowVersionCreated,
  stats,
  versions
}: {
  activeBook: BookRecord | null;
  activeChapter: ChapterRecord | null;
  activeProject: ProjectRecord | null;
  activeTab: WorkspaceTab;
  activeVersion: ManuscriptVersionRecord | null;
  activeVolume: VolumeRecord | null;
  canonical: ManuscriptVersionRecord | null;
  compareA: ManuscriptVersionRecord | null;
  compareAId: string | null;
  compareB: ManuscriptVersionRecord | null;
  compareBId: string | null;
  diff: ReturnType<typeof createSimpleDiff>;
  draft: string;
  onChangeDraft: (value: string) => void;
  onCompareA: (value: string | null) => void;
  onCompareB: (value: string | null) => void;
  onEditSummary: () => void;
  onEditTargetWords: () => void;
  onOpenVersion: (version: ManuscriptVersionRecord) => void;
  onRollbackVersion: (version: ManuscriptVersionRecord) => void;
  onSaveVersion: () => void;
  onSetCanonical: () => void;
  onSetTab: (tab: WorkspaceTab) => void;
  onSetVersionCanonical: (version: ManuscriptVersionRecord) => void;
  onWorkflowCanonicalChanged: (version: ManuscriptVersionRecord) => void;
  onWorkflowCostChange: (label: string, cost: number, warning: string) => void;
  onWorkflowVersionCreated: (version: ManuscriptVersionRecord) => void;
  stats: ReturnType<typeof manuscriptStats>;
  versions: ManuscriptVersionRecord[];
}): JSX.Element {
  const tabs: { id: WorkspaceTab; label: string }[] = [
    { id: "manuscript", label: "Manuscript" },
    { id: "generate", label: "Generate" },
    { id: "review", label: "Review" },
    { id: "timeline", label: "Timeline" },
    { id: "versions", label: "Versions" }
  ];

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-white/10 px-6 py-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
              Active chapter
            </p>
            <h2 className="mt-1 truncate text-xl font-semibold text-white">
              {activeChapter?.title ?? "No chapter selected"}
            </h2>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {activeChapter ? <StatusBadge status={activeChapter.status} /> : null}
              {canonical ? (
                <span className="rounded-full border border-forge-mint/30 bg-forge-mint/10 px-3 py-1 text-xs text-forge-mint">
                  Canonical v{canonical.versionIndex}
                </span>
              ) : (
                <span className="rounded-full border border-forge-amber/30 bg-forge-amber/10 px-3 py-1 text-xs text-forge-amber">
                  No canonical manuscript
                </span>
              )}
              {activeVersion && !activeVersion.isCanonical ? (
                <span className="rounded-full border border-forge-amber/30 bg-forge-amber/10 px-3 py-1 text-xs text-forge-amber">
                  Viewing draft v{activeVersion.versionIndex}
                </span>
              ) : null}
              {activeVersion?.sourceType === "generated" ? (
                <span className="rounded-full border border-forge-violet/30 bg-forge-violet/10 px-3 py-1 text-xs text-forge-violet">
                  Generated proposal
                </span>
              ) : null}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              className="rounded-md border border-white/10 px-3 py-2 text-xs text-slate-300 hover:border-forge-blue/40 hover:text-white"
              onClick={onEditTargetWords}
              type="button"
            >
              Target {activeChapter?.targetWords ?? 0}
            </button>
            <button
              className="rounded-md border border-white/10 px-3 py-2 text-xs text-slate-300 hover:border-forge-blue/40 hover:text-white"
              onClick={onEditSummary}
              type="button"
            >
              Summary
            </button>
            <button
              className="rounded-md border border-white/10 px-3 py-2 text-xs text-slate-300 hover:border-forge-violet/40 hover:text-white"
              onClick={onSaveVersion}
              type="button"
            >
              Save Version
            </button>
            <button
              className="rounded-md border border-forge-mint/30 bg-forge-mint/10 px-3 py-2 text-xs text-forge-mint hover:border-forge-mint/60"
              onClick={onSetCanonical}
              type="button"
            >
              Set Canonical
            </button>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <button
              className={`rounded-md border px-3 py-1.5 text-xs transition ${
                activeTab === tab.id
                  ? "border-forge-blue/35 bg-forge-blue/10 text-forge-blue"
                  : "border-white/10 text-slate-400 hover:border-white/20 hover:text-white"
              }`}
              key={tab.id}
              onClick={() => onSetTab(tab.id)}
              type="button"
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          animate={{ opacity: 1, y: 0 }}
          className="min-h-0 flex-1 overflow-hidden"
          exit={{ opacity: 0, y: 6 }}
          initial={{ opacity: 0, y: 6 }}
          key={activeTab}
          transition={{ duration: 0.16, ease: "easeOut" }}
        >
          {activeTab === "manuscript" ? (
            <div className="h-full overflow-auto px-6 py-5">
              <ManuscriptEditor onChange={onChangeDraft} stats={stats} value={draft} />
            </div>
          ) : null}

          {activeTab === "generate" ? (
            <WorkflowGeneratePanel
              activeBook={activeBook}
              activeChapter={activeChapter}
              activeProject={activeProject}
              activeVolume={activeVolume}
              onCanonicalChanged={onWorkflowCanonicalChanged}
              onVersionCreated={onWorkflowVersionCreated}
              onWorkflowCostChange={onWorkflowCostChange}
            />
          ) : null}
          {activeTab === "review" ? (
            <ReviewWorkspace
              activeChapter={activeChapter}
              canonical={canonical}
              compareA={compareA}
              compareAId={compareAId}
              compareB={compareB}
              compareBId={compareBId}
              diff={diff}
              onCanonicalChanged={onWorkflowCanonicalChanged}
              onCopyGenerated={onChangeDraft}
              onCompareA={onCompareA}
              onCompareB={onCompareB}
              onVersionCreated={onWorkflowVersionCreated}
              versions={versions}
            />
          ) : null}
          {activeTab === "timeline" ? <TimelineWorkspace activeChapter={activeChapter} /> : null}
          {activeTab === "versions" ? (
            <VersionsWorkspace
              onOpenVersion={onOpenVersion}
              onRollbackVersion={onRollbackVersion}
              onSetVersionCanonical={onSetVersionCanonical}
              versions={versions}
            />
          ) : null}
        </motion.div>
      </AnimatePresence>

      <TaskTimeline activeTab={activeTab} />
    </div>
  );
}

function ReviewWorkspace({
  activeChapter,
  canonical,
  compareA,
  compareAId,
  compareB,
  compareBId,
  diff,
  onCanonicalChanged,
  onCopyGenerated,
  onCompareA,
  onCompareB,
  onVersionCreated,
  versions
}: {
  activeChapter: ChapterRecord | null;
  canonical: ManuscriptVersionRecord | null;
  compareA: ManuscriptVersionRecord | null;
  compareAId: string | null;
  compareB: ManuscriptVersionRecord | null;
  compareBId: string | null;
  diff: ReturnType<typeof createSimpleDiff>;
  onCanonicalChanged: (version: ManuscriptVersionRecord) => void;
  onCopyGenerated: (value: string) => void;
  onCompareA: (value: string | null) => void;
  onCompareB: (value: string | null) => void;
  onVersionCreated: (version: ManuscriptVersionRecord) => void;
  versions: ManuscriptVersionRecord[];
}): JSX.Element {
  const [detail, setDetail] = useState<ChapterWorkflowDetail | null>(null);
  const [runDiff, setRunDiff] = useState<ManuscriptDiff | null>(null);
  const [selectedArtifactId, setSelectedArtifactId] = useState<string>("");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [overrideBlocking, setOverrideBlocking] = useState(false);
  const [settlement, setSettlement] = useState<SettlementPreview | null>(null);
  const [selectedSettlementIds, setSelectedSettlementIds] = useState<Set<string>>(new Set());

  const latestArtifact = useMemo(
    () =>
      detail?.artifacts.find((artifact) => artifact.id === selectedArtifactId) ??
      detail?.artifacts.find((artifact) => artifact.artifactType === "revision") ??
      detail?.artifacts.find((artifact) => artifact.artifactType === "draft") ??
      null,
    [detail, selectedArtifactId]
  );
  const reviewCards = useMemo(() => detail?.reviewCards ?? [], [detail]);
  const blockingCount = reviewCards.filter(
    (card) => card.severity === "blocking" && card.status !== "rejected"
  ).length;
  const visibleCards = reviewCards.filter(
    (card) => severityFilter === "all" || card.severity === severityFilter
  );

  const loadLatest = useCallback(async (): Promise<void> => {
    if (!activeChapter) {
      setDetail(null);
      setSettlement(null);
      setRunDiff(null);
      return;
    }
    const runs = await window.wenforge.generation.listRunsByChapter(activeChapter.id);
    const latest = runs[0] ? await window.wenforge.generation.getRun(runs[0].id) : null;
    setDetail(latest);
    const proposal = latest ? await window.wenforge.settlement.preview(latest.run.id) : null;
    setSettlement(proposal);
    const defaultArtifact =
      latest?.artifacts.find((artifact) => artifact.artifactType === "revision") ??
      latest?.artifacts.find((artifact) => artifact.artifactType === "draft") ??
      null;
    setSelectedArtifactId(defaultArtifact?.id ?? "");
    setSelectedSettlementIds(
      new Set(
        proposal?.items
          .filter((item) => item.recommendedStatus === "accept" && item.status !== "rejected")
          .map((item) => item.id) ?? []
      )
    );
    if (defaultArtifact) {
      setRunDiff(await window.wenforge.manuscript.diffArtifact(defaultArtifact.id));
    } else {
      setRunDiff(null);
    }
  }, [activeChapter]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadLatest();
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [loadLatest]);

  const updateArtifactDiff = async (artifactId: string): Promise<void> => {
    setSelectedArtifactId(artifactId);
    setRunDiff(artifactId ? await window.wenforge.manuscript.diffArtifact(artifactId) : null);
  };

  const updateReviewStatus = async (
    card: WorkflowReviewCard,
    status: "accepted" | "rejected" | "deferred"
  ): Promise<void> => {
    await window.wenforge.reviews.updateStatus(card.id, status);
    await loadLatest();
  };

  const saveArtifact = async (setCanonical: boolean): Promise<void> => {
    if (!detail || !latestArtifact) return;
    if (setCanonical && blockingCount > 0 && !overrideBlocking) return;
    const confirmed = !setCanonical || window.confirm("Save generated text and set it canonical?");
    if (!confirmed) return;
    const version = await window.wenforge.manuscript.saveArtifactAsVersion({
      runId: detail.run.id,
      artifactId: latestArtifact.id,
      title: latestArtifact.title ?? "Generated proposal",
      setCanonical,
      confirmed,
      overrideBlockingWarnings: overrideBlocking
    });
    if (version.isCanonical) {
      onCanonicalChanged(version);
    } else {
      onVersionCreated(version);
    }
  };

  const applySettlement = async (): Promise<void> => {
    if (!settlement || selectedSettlementIds.size === 0) return;
    const confirmed = window.confirm("Apply selected state-settlement updates?");
    if (!confirmed) return;
    await window.wenforge.settlement.applySelected({
      proposalId: settlement.id,
      itemIds: [...selectedSettlementIds],
      confirmed: true,
      appliedBy: "local-user"
    });
    await loadLatest();
  };

  const markVisibleReviews = async (
    status: "accepted" | "rejected" | "deferred"
  ): Promise<void> => {
    await Promise.all(
      visibleCards.map((card) => window.wenforge.reviews.updateStatus(card.id, status))
    );
    await loadLatest();
  };

  const requestRevisionFromIssues = async (): Promise<void> => {
    if (!detail) return;
    const selectedIssues = reviewCards
      .filter((card) => card.status !== "rejected")
      .map((card) => `${card.reviewType}: ${card.issue}`)
      .join("\n");
    if (!selectedIssues.trim()) return;
    await window.wenforge.generation.requestRevision({
      runId: detail.run.id,
      userInstruction: `根据以下审稿意见修订：\n${selectedIssues}`
    });
    await loadLatest();
  };

  return (
    <div className="h-full overflow-auto px-6 py-5">
      <div className="grid gap-4 xl:grid-cols-[1fr_300px]">
        <section className="rounded-lg border border-white/10 bg-black/25 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
                Simple diff
              </p>
              <p className="mt-1 text-sm text-slate-400">
                Comparing {compareA ? `v${compareA.versionIndex}` : "empty"} to{" "}
                {compareB ? `v${compareB.versionIndex}` : canonical ? "canon" : "empty"}.
              </p>
            </div>
            <div className="flex gap-2">
              <VersionSelect onChange={onCompareA} value={compareAId} versions={versions} />
              <VersionSelect onChange={onCompareB} value={compareBId} versions={versions} />
            </div>
          </div>
          <div className="mt-4 max-h-[500px] overflow-auto rounded-lg border border-white/10 bg-black/25">
            {diff.map((line, index) => (
              <p
                className={`border-b border-white/5 px-4 py-2 font-mono text-xs leading-5 ${
                  line.kind === "added"
                    ? "bg-forge-mint/8 text-forge-mint"
                    : line.kind === "removed"
                      ? "bg-red-400/8 text-red-200"
                      : "text-slate-400"
                }`}
                key={`${line.kind}-${index}-${line.text}`}
              >
                <span className="mr-3 text-slate-600">
                  {line.kind === "added" ? "+" : line.kind === "removed" ? "-" : " "}
                </span>
                {line.text}
              </p>
            ))}
          </div>
        </section>
        <section className="space-y-3">
          <ReviewActionsCard
            blockingCount={blockingCount}
            detail={detail}
            latestArtifact={latestArtifact}
            overrideBlocking={overrideBlocking}
            onCopyGenerated={() => latestArtifact && onCopyGenerated(latestArtifact.contentText)}
            onOverrideBlocking={setOverrideBlocking}
            onRerunAudit={async () => {
              if (detail) {
                await window.wenforge.reviews.rerunAudit(detail.run.id);
                await loadLatest();
              }
            }}
            onReviseSelectedIssues={() => void requestRevisionFromIssues()}
            onSaveCanonical={() => void saveArtifact(true)}
            onSaveVersion={() => void saveArtifact(false)}
            selectedArtifactId={selectedArtifactId}
            onSelectArtifact={(artifactId) => void updateArtifactDiff(artifactId)}
          />
          <CostByNodeCard detail={detail} />
        </section>
      </div>
      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        <section className="rounded-lg border border-white/10 bg-black/25 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
                Review cards
              </p>
              <h3 className="mt-1 text-lg font-semibold text-white">
                Audits, rhythm, and revision risks
              </h3>
            </div>
            <select
              className="rounded-md border border-white/10 bg-black/30 px-2 py-1.5 text-xs text-slate-200"
              value={severityFilter}
              onChange={(event) => setSeverityFilter(event.target.value)}
            >
              {["all", "info", "warning", "error", "blocking", "low", "medium"].map((severity) => (
                <option key={severity} value={severity}>
                  {severity}
                </option>
              ))}
            </select>
            <div className="flex gap-2">
              <button
                className="rounded-md border border-forge-mint/25 px-2 py-1.5 text-xs text-forge-mint"
                onClick={() => void markVisibleReviews("accepted")}
                type="button"
              >
                Accept all
              </button>
              <button
                className="rounded-md border border-red-400/25 px-2 py-1.5 text-xs text-red-200"
                onClick={() => void markVisibleReviews("rejected")}
                type="button"
              >
                Reject all
              </button>
            </div>
          </div>
          <div className="mt-4 grid gap-3">
            {visibleCards.length === 0 ? (
              <p className="rounded-lg border border-white/10 p-4 text-sm text-slate-500">
                No review cards for the latest run.
              </p>
            ) : null}
            {visibleCards.map((card) => (
              <ReviewCard
                card={card}
                key={card.id}
                onStatus={(status) => void updateReviewStatus(card, status)}
              />
            ))}
          </div>
        </section>
        <section className="rounded-lg border border-white/10 bg-black/25 p-5">
          <SettlementPanel
            selectedIds={selectedSettlementIds}
            settlement={settlement}
            onApply={applySettlement}
            onEdit={async (itemId, afterJson) => {
              await window.wenforge.settlement.editItem(itemId, afterJson);
              await loadLatest();
            }}
            onReject={async (itemIds) => {
              if (!settlement) return;
              await window.wenforge.settlement.rejectSelected(settlement.id, itemIds);
              await loadLatest();
            }}
            onToggle={(itemId) => {
              setSelectedSettlementIds((current) => {
                const next = new Set(current);
                if (next.has(itemId)) next.delete(itemId);
                else next.add(itemId);
                return next;
              });
            }}
          />
        </section>
      </div>
      {runDiff ? <RunDiffPanel diff={runDiff} /> : null}
    </div>
  );
}

function ReviewActionsCard({
  blockingCount,
  detail,
  latestArtifact,
  overrideBlocking,
  onCopyGenerated,
  onOverrideBlocking,
  onRerunAudit,
  onReviseSelectedIssues,
  onSaveCanonical,
  onSaveVersion,
  onSelectArtifact,
  selectedArtifactId
}: {
  blockingCount: number;
  detail: ChapterWorkflowDetail | null;
  latestArtifact: WorkflowArtifactRecord | null;
  overrideBlocking: boolean;
  onCopyGenerated: () => void;
  onOverrideBlocking: (value: boolean) => void;
  onRerunAudit: () => Promise<void>;
  onReviseSelectedIssues: () => void;
  onSaveCanonical: () => void;
  onSaveVersion: () => void;
  onSelectArtifact: (artifactId: string) => void;
  selectedArtifactId: string;
}): JSX.Element {
  const artifacts =
    detail?.artifacts.filter((artifact) => ["draft", "revision"].includes(artifact.artifactType)) ??
    [];
  return (
    <article className="rounded-lg border border-white/10 bg-graphite-900/60 p-4">
      <h3 className="text-sm font-semibold text-white">Generated manuscript gate</h3>
      <p className="mt-2 text-xs leading-5 text-slate-500">
        Generated text remains proposed until it is saved as a version. Canonical approval is
        blocked while blocking review cards are open.
      </p>
      <select
        className="mt-3 w-full rounded-md border border-white/10 bg-black/30 px-2 py-2 text-xs text-slate-200"
        value={selectedArtifactId}
        onChange={(event) => onSelectArtifact(event.target.value)}
      >
        <option value="">No generated artifact</option>
        {artifacts.map((artifact) => (
          <option key={artifact.id} value={artifact.id}>
            {artifact.artifactType} · {artifact.title ?? artifact.sourceNode}
          </option>
        ))}
      </select>
      {blockingCount > 0 ? (
        <label className="mt-3 flex items-start gap-2 rounded-md border border-red-400/25 bg-red-400/10 p-2 text-xs leading-5 text-red-100">
          <input
            checked={overrideBlocking}
            className="mt-1 h-4 w-4 accent-red-300"
            onChange={(event) => onOverrideBlocking(event.target.checked)}
            type="checkbox"
          />
          I understand the warnings and want to approve anyway.
        </label>
      ) : null}
      <div className="mt-3 grid gap-2">
        <button
          className="rounded-md border border-white/10 bg-black/20 px-3 py-2 text-left text-xs text-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={!latestArtifact}
          onClick={onSaveVersion}
          type="button"
        >
          Save Generated As Non-Canonical Version
        </button>
        <button
          className="rounded-md border border-forge-mint/30 bg-forge-mint/10 px-3 py-2 text-left text-xs text-forge-mint disabled:cursor-not-allowed disabled:opacity-50"
          disabled={!latestArtifact || (blockingCount > 0 && !overrideBlocking)}
          onClick={onSaveCanonical}
          type="button"
        >
          Save Generated And Set Canonical
        </button>
        <button
          className="rounded-md border border-white/10 bg-black/20 px-3 py-2 text-left text-xs text-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={!latestArtifact}
          onClick={onCopyGenerated}
          type="button"
        >
          Copy Generated To Editor
        </button>
        <button
          className="rounded-md border border-forge-blue/30 bg-forge-blue/10 px-3 py-2 text-left text-xs text-forge-blue"
          onClick={() => void onRerunAudit()}
          type="button"
        >
          Rerun Audit
        </button>
        <button
          className="rounded-md border border-forge-violet/30 bg-forge-violet/10 px-3 py-2 text-left text-xs text-forge-violet disabled:cursor-not-allowed disabled:opacity-50"
          disabled={!detail}
          onClick={onReviseSelectedIssues}
          type="button"
        >
          Revise Based On Active Issues
        </button>
      </div>
    </article>
  );
}

function CostByNodeCard({ detail }: { detail: ChapterWorkflowDetail | null }): JSX.Element {
  const runs = detail?.llmRuns ?? [];
  return (
    <article className="rounded-lg border border-white/10 bg-graphite-900/60 p-4">
      <h3 className="text-sm font-semibold text-white">Cost by node</h3>
      <div className="mt-3 space-y-2">
        {runs.length === 0 ? <p className="text-xs text-slate-500">No model runs yet.</p> : null}
        {runs.map((run) => (
          <div
            className="rounded-md border border-white/10 bg-black/20 px-3 py-2 text-xs"
            key={run.id}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-slate-200">{run.taskType}</span>
              <span className="text-forge-mint">
                ${(run.finalCost ?? run.estimatedCostLive).toFixed(6)}
              </span>
            </div>
            <p className="mt-1 text-slate-500">
              {run.provider}/{run.model} · {run.latencyMs ?? 0}ms · {run.usageSource}
            </p>
          </div>
        ))}
      </div>
    </article>
  );
}

function ReviewCard({
  card,
  onStatus
}: {
  card: WorkflowReviewCard;
  onStatus: (status: "accepted" | "rejected" | "deferred") => void;
}): JSX.Element {
  const raw = parseCardJson(card.rawJson);
  const tone =
    card.severity === "blocking"
      ? "border-red-400/30 bg-red-400/10"
      : card.severity === "error"
        ? "border-amber-300/30 bg-amber-300/10"
        : "border-white/10 bg-graphite-900/60";
  return (
    <article className={`rounded-lg border p-4 ${tone}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-white/10 px-2 py-1 text-[11px] uppercase tracking-[0.12em] text-slate-400">
              {card.reviewType}
            </span>
            <span className="rounded-full border border-white/10 px-2 py-1 text-[11px] text-slate-300">
              {card.severity}
            </span>
            <span className="rounded-full border border-white/10 px-2 py-1 text-[11px] text-slate-500">
              {card.status}
            </span>
          </div>
          <h3 className="mt-3 text-sm font-semibold text-white">{card.title}</h3>
        </div>
        <div className="flex gap-2">
          {(["accepted", "deferred", "rejected"] as const).map((status) => (
            <button
              className="rounded-md border border-white/10 px-2 py-1 text-[11px] text-slate-300 hover:border-forge-blue/40"
              key={status}
              onClick={() => onStatus(status)}
              type="button"
            >
              {status}
            </button>
          ))}
        </div>
      </div>
      <p className="mt-3 text-sm leading-6 text-slate-300">{card.issue}</p>
      {card.evidence ? (
        <p className="mt-2 text-xs text-slate-500">Evidence: {card.evidence}</p>
      ) : null}
      {card.suggestedFix ? (
        <p className="mt-2 text-xs text-forge-mint">Suggested fix: {card.suggestedFix}</p>
      ) : null}
      {raw ? <ReviewRawDetails raw={raw} /> : null}
    </article>
  );
}

function ReviewRawDetails({ raw }: { raw: Record<string, unknown> }): JSX.Element {
  const scores = [
    "opening_hook_score",
    "conflict_density_score",
    "scene_momentum_score",
    "emotional_turn_score",
    "payoff_clarity_score",
    "ending_hook_score",
    "genre_alignment_score"
  ].filter((key) => typeof raw[key] !== "undefined");
  return (
    <div className="mt-3 grid gap-2 md:grid-cols-2">
      {scores.map((key) => (
        <p className="rounded-md border border-white/10 bg-black/20 px-2 py-1 text-xs" key={key}>
          <span className="text-slate-500">{key.replaceAll("_", " ")}</span>{" "}
          <span className="text-white">{String(raw[key])}</span>
        </p>
      ))}
    </div>
  );
}

function SettlementPanel({
  selectedIds,
  settlement,
  onApply,
  onEdit,
  onReject,
  onToggle
}: {
  selectedIds: Set<string>;
  settlement: SettlementPreview | null;
  onApply: () => Promise<void>;
  onEdit: (itemId: string, afterJson: string) => Promise<void>;
  onReject: (itemIds: string[]) => Promise<void>;
  onToggle: (itemId: string) => void;
}): JSX.Element {
  const grouped = settlement?.groups ?? {};
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
            State settlement
          </p>
          <h3 className="mt-1 text-lg font-semibold text-white">Proposed memory updates</h3>
        </div>
        <button
          className="rounded-md border border-forge-mint/30 bg-forge-mint/10 px-3 py-2 text-xs text-forge-mint disabled:cursor-not-allowed disabled:opacity-50"
          disabled={!settlement || selectedIds.size === 0}
          onClick={() => void onApply()}
          type="button"
        >
          Apply Selected
        </button>
      </div>
      <div className="mt-4 space-y-4">
        {!settlement ? (
          <p className="rounded-lg border border-white/10 p-4 text-sm text-slate-500">
            No settlement proposal for the latest run.
          </p>
        ) : null}
        {Object.entries(grouped).map(([group, items]) => (
          <div className="space-y-2" key={group}>
            <h4 className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
              {group}
            </h4>
            {items.map((item) => (
              <div
                className="rounded-lg border border-white/10 bg-graphite-900/60 p-3"
                key={item.id}
              >
                <label className="flex items-start gap-2">
                  <input
                    checked={selectedIds.has(item.id)}
                    className="mt-1 h-4 w-4 accent-forge-blue"
                    disabled={item.recommendedStatus === "reject" || item.status === "rejected"}
                    onChange={() => onToggle(item.id)}
                    type="checkbox"
                  />
                  <span>
                    <span className="text-sm font-medium text-white">{item.itemType}</span>
                    <span className="ml-2 text-xs text-slate-500">{item.status}</span>
                  </span>
                </label>
                <p className="mt-2 text-xs leading-5 text-slate-400">{item.evidenceSummary}</p>
                <p
                  className={`mt-2 text-xs ${
                    item.recommendedStatus === "reject" ? "text-amber-200" : "text-forge-mint"
                  }`}
                >
                  {item.recommendedStatus === "reject"
                    ? "Unsupported by accepted manuscript evidence"
                    : "Evidence supported"}
                </p>
                <div className="mt-2 flex gap-2">
                  <button
                    className="rounded-md border border-white/10 px-2 py-1 text-[11px] text-slate-300"
                    onClick={() => {
                      const next = window.prompt("Edit settlement JSON", item.afterJson);
                      if (next) void onEdit(item.id, next);
                    }}
                    type="button"
                  >
                    Edit
                  </button>
                  <button
                    className="rounded-md border border-red-400/25 px-2 py-1 text-[11px] text-red-200"
                    onClick={() => void onReject([item.id])}
                    type="button"
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function RunDiffPanel({ diff }: { diff: ManuscriptDiff }): JSX.Element {
  return (
    <section className="mt-4 rounded-lg border border-white/10 bg-black/25 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
            Canonical vs generated
          </p>
          <h3 className="mt-1 text-sm font-semibold text-white">
            {diff.fromTitle} to {diff.toTitle}
          </h3>
        </div>
        <p className="text-xs text-slate-400">
          Words {diff.wordDelta >= 0 ? "+" : ""}
          {diff.wordDelta} · Characters {diff.characterDelta >= 0 ? "+" : ""}
          {diff.characterDelta}
        </p>
      </div>
      <div className="mt-4 max-h-[420px] overflow-auto rounded-lg border border-white/10 bg-black/25">
        {diff.lines.map((line, index) => (
          <p
            className={`border-b border-white/5 px-4 py-2 font-mono text-xs leading-5 ${
              line.type === "added"
                ? "bg-forge-mint/8 text-forge-mint"
                : line.type === "removed"
                  ? "bg-red-400/8 text-red-200"
                  : "text-slate-400"
            }`}
            key={`${line.type}-${index}-${line.text}`}
          >
            <span className="mr-3 text-slate-600">
              {line.type === "added" ? "+" : line.type === "removed" ? "-" : " "}
            </span>
            {line.text}
          </p>
        ))}
      </div>
    </section>
  );
}

function parseCardJson(value: string | null): Record<string, unknown> | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as unknown;
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function VersionSelect({
  onChange,
  value,
  versions
}: {
  onChange: (value: string | null) => void;
  value: string | null;
  versions: ManuscriptVersionRecord[];
}): JSX.Element {
  return (
    <select
      className="rounded-md border border-white/10 bg-black/30 px-2 py-1.5 text-xs text-slate-200"
      onChange={(event) => onChange(event.target.value || null)}
      value={value ?? ""}
    >
      <option value="">Empty</option>
      {versions.map((version) => (
        <option key={version.id} value={version.id}>
          v{version.versionIndex} {version.isCanonical ? "canon" : version.sourceType}
        </option>
      ))}
    </select>
  );
}

function TimelineWorkspace({
  activeChapter
}: {
  activeChapter: ChapterRecord | null;
}): JSX.Element {
  return (
    <div className="h-full overflow-auto px-6 py-5">
      <section className="rounded-lg border border-white/10 bg-black/25 p-5">
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
          Chapter timeline
        </p>
        <h3 className="mt-2 text-lg font-semibold text-white">
          {activeChapter?.title ?? "No chapter"}
        </h3>
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {[
            ["Loaded state", "Project, book, volume, story bible context"],
            ["Draft state", "Autosaved local working draft"],
            ["Review gate", "Audit and rewrite cards remain proposals"],
            ["Settlement", "State changes will be proposed, versioned, and approved"]
          ].map(([title, body]) => (
            <article className="rounded-lg border border-white/10 bg-white/[0.035] p-4" key={title}>
              <p className="text-sm font-medium text-slate-100">{title}</p>
              <p className="mt-2 text-sm leading-6 text-slate-500">{body}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function VersionsWorkspace({
  onOpenVersion,
  onRollbackVersion,
  onSetVersionCanonical,
  versions
}: {
  onOpenVersion: (version: ManuscriptVersionRecord) => void;
  onRollbackVersion: (version: ManuscriptVersionRecord) => void;
  onSetVersionCanonical: (version: ManuscriptVersionRecord) => void;
  versions: ManuscriptVersionRecord[];
}): JSX.Element {
  return (
    <div className="h-full overflow-auto px-6 py-5">
      <div className="space-y-3">
        {versions.map((version) => (
          <article
            className={`rounded-lg border p-4 ${
              version.isCanonical
                ? "border-forge-mint/30 bg-forge-mint/8"
                : version.sourceType === "generated"
                  ? "border-forge-violet/25 bg-forge-violet/8"
                  : "border-white/10 bg-black/25"
            }`}
            key={version.id}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-semibold text-white">
                    v{version.versionIndex} · {version.title}
                  </h3>
                  {version.isCanonical ? (
                    <span className="rounded-full border border-forge-mint/30 px-2 py-0.5 text-[10px] text-forge-mint">
                      Canon
                    </span>
                  ) : null}
                  <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] text-slate-500">
                    {version.sourceType}
                  </span>
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  {version.wordCount} words · {version.characterCount} chars ·{" "}
                  {new Date(version.createdAt).toLocaleString()}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  className="rounded-md border border-white/10 px-3 py-1.5 text-xs text-slate-300 hover:text-white"
                  onClick={() => onOpenVersion(version)}
                  type="button"
                >
                  Open
                </button>
                <button
                  className="rounded-md border border-white/10 px-3 py-1.5 text-xs text-slate-300 hover:text-white"
                  onClick={() => onRollbackVersion(version)}
                  type="button"
                >
                  Rollback
                </button>
                {!version.isCanonical ? (
                  <button
                    className="rounded-md border border-forge-mint/30 bg-forge-mint/10 px-3 py-1.5 text-xs text-forge-mint"
                    onClick={() => onSetVersionCanonical(version)}
                    type="button"
                  >
                    Set Canon
                  </button>
                ) : null}
              </div>
            </div>
            <p className="mt-3 line-clamp-3 whitespace-pre-wrap text-sm leading-6 text-slate-400">
              {version.contentPlaintext || "Empty version"}
            </p>
          </article>
        ))}
        {versions.length === 0 ? (
          <p className="rounded-lg border border-white/10 bg-black/25 px-4 py-8 text-center text-sm text-slate-500">
            No versions yet. Save the working draft to create the first manuscript version.
          </p>
        ) : null}
      </div>
    </div>
  );
}

function ContinuityPanel({
  activeChapter,
  canonical
}: {
  activeChapter: ChapterRecord | null;
  canonical: ManuscriptVersionRecord | null;
}): JSX.Element {
  const warnings = [
    activeChapter?.summary ? null : "Chapter summary missing",
    canonical ? null : "No accepted canonical manuscript",
    activeChapter && activeChapter.currentWords < activeChapter.targetWords * 0.5
      ? "Draft is below target length"
      : null
  ].filter(Boolean);

  return (
    <section className="rounded-lg border border-white/10 bg-graphite-900/60 p-4">
      <h3 className="text-sm font-semibold text-white">Continuity warnings</h3>
      <div className="mt-3 space-y-2">
        {warnings.length > 0 ? (
          warnings.map((warning) => (
            <p
              className="rounded-lg border border-forge-amber/25 bg-forge-amber/10 px-3 py-2 text-xs text-forge-amber"
              key={warning}
            >
              {warning}
            </p>
          ))
        ) : (
          <p className="rounded-lg border border-forge-mint/25 bg-forge-mint/10 px-3 py-2 text-xs text-forge-mint">
            No continuity warnings in the current local view.
          </p>
        )}
      </div>
    </section>
  );
}

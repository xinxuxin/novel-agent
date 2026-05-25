import { AnimatePresence, motion } from "framer-motion";
import type { JSX } from "react";
import { useEffect, useState } from "react";

import { CommandPalette } from "@components/CommandPalette";
import type {
  BookRecord,
  ChapterRecord,
  ManuscriptVersionRecord,
  ProjectRecord,
  StoryBibleEntryRecord,
  VolumeRecord
} from "@contracts/data";
import { SettingsPanel } from "@features/settings/SettingsPanel";
import { useUiStore } from "@renderer/stores/ui-store";

type WorkspaceView = "chapter" | "settings";

export function App(): JSX.Element {
  const [version, setVersion] = useState("0.1.0");
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [books, setBooks] = useState<BookRecord[]>([]);
  const [volumes, setVolumes] = useState<VolumeRecord[]>([]);
  const [chapters, setChapters] = useState<ChapterRecord[]>([]);
  const [selectedChapter, setSelectedChapter] = useState<ChapterRecord | null>(null);
  const [canonical, setCanonical] = useState<ManuscriptVersionRecord | null>(null);
  const [storyBibleEntries, setStoryBibleEntries] = useState<StoryBibleEntryRecord[]>([]);
  const [workspaceView, setWorkspaceView] = useState<WorkspaceView>("chapter");
  const commandPaletteOpen = useUiStore((state) => state.commandPaletteOpen);
  const studioMode = useUiStore((state) => state.studioMode);
  const openCommandPalette = useUiStore((state) => state.openCommandPalette);
  const closeCommandPalette = useUiStore((state) => state.closeCommandPalette);
  const setStudioMode = useUiStore((state) => state.setStudioMode);
  const compact = studioMode === "popover";

  useEffect(() => {
    void window.wenforge.app.getVersion().then(setVersion);
  }, []);

  useEffect(() => {
    let mounted = true;

    async function loadWorkspace(): Promise<void> {
      const nextProjects = await window.wenforge.projects.list();
      const firstProject = nextProjects[0];
      const nextBooks = firstProject
        ? await window.wenforge.books.listByProject(firstProject.id)
        : [];
      const firstBook = nextBooks[0];
      const [nextVolumes, nextChapters, nextStoryBible] = firstBook
        ? await Promise.all([
            window.wenforge.volumes.listByBook(firstBook.id),
            window.wenforge.chapters.listByBook(firstBook.id),
            window.wenforge.storyBible.entries.list(firstBook.id)
          ])
        : [[], [], []];
      const firstChapter = nextChapters[0] ?? null;
      const nextCanonical = firstChapter
        ? await window.wenforge.manuscripts.getCanonical(firstChapter.id)
        : null;

      if (!mounted) {
        return;
      }

      setProjects(nextProjects);
      setBooks(nextBooks);
      setVolumes(nextVolumes);
      setChapters(nextChapters);
      setStoryBibleEntries(nextStoryBible);
      setSelectedChapter(firstChapter);
      setCanonical(nextCanonical);
    }

    void loadWorkspace();

    return () => {
      mounted = false;
    };
  }, []);

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

  const toggleStudioMode = async (): Promise<void> => {
    setStudioMode(await window.wenforge.window.toggleStudioMode());
  };

  const openChapter = async (chapter: ChapterRecord): Promise<void> => {
    setSelectedChapter(chapter);
    setCanonical(await window.wenforge.manuscripts.getCanonical(chapter.id));
  };

  const activeProject = projects[0] ?? null;
  const activeBook = books[0] ?? null;
  const activeVolume = volumes[0] ?? null;

  return (
    <main className="min-h-screen overflow-hidden bg-transparent p-3 text-slate-100">
      <motion.section
        className="grid h-[calc(100vh-1.5rem)] overflow-hidden rounded-2xl border border-white/10 bg-graphite-950/92 shadow-soft-glow backdrop-blur-xl"
        initial={{ opacity: 0, scale: 0.985 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.22, ease: "easeOut" }}
      >
        <header className="app-drag grid h-14 grid-cols-[auto_1fr_auto] items-center gap-3 border-b border-white/10 bg-white/[0.035] px-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-forge-blue/35 bg-forge-blue/15 text-sm font-semibold text-forge-blue">
              W
            </div>
            <div>
              <h1 className="text-sm font-semibold tracking-normal text-white">WenForge Studio</h1>
              <p className="text-xs text-slate-500">Local-first fiction command center</p>
            </div>
          </div>

          <button
            className="app-no-drag mx-auto flex h-9 w-full max-w-xl items-center justify-between rounded-lg border border-white/10 bg-black/20 px-3 text-left text-sm text-slate-400 transition hover:border-forge-blue/40 hover:text-slate-200"
            onClick={openCommandPalette}
            type="button"
          >
            <span>Search projects, chapters, commands</span>
            <kbd className="rounded border border-white/10 bg-white/5 px-1.5 py-0.5 text-[11px] text-slate-500">
              Cmd K
            </kbd>
          </button>

          <div className="app-no-drag flex items-center gap-2">
            <button
              className={`rounded-md border px-3 py-1.5 text-xs transition ${
                workspaceView === "chapter"
                  ? "border-forge-blue/35 bg-forge-blue/10 text-forge-blue"
                  : "border-white/10 text-slate-300 hover:border-forge-violet/40 hover:text-white"
              }`}
              onClick={() => setWorkspaceView("chapter")}
              type="button"
            >
              Chapter
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
            compact ? "grid-cols-[56px_1fr_300px]" : "grid-cols-[260px_1fr_340px]"
          }`}
        >
          <aside className="min-h-0 border-r border-white/10 bg-black/18">
            <div className="flex h-full flex-col">
              <div className="border-b border-white/10 px-4 py-3">
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
                  Projects
                </p>
              </div>
              <AnimatePresence mode="wait">
                {compact ? (
                  <motion.div
                    animate={{ opacity: 1 }}
                    className="flex flex-col items-center gap-3 p-3"
                    exit={{ opacity: 0 }}
                    initial={{ opacity: 0 }}
                    key="compact"
                  >
                    {chapters.map((chapter, index) => (
                      <button
                        className="h-9 w-9 rounded-lg border border-white/10 bg-white/5 text-xs text-slate-300"
                        key={chapter.id}
                        onClick={() => void openChapter(chapter)}
                        type="button"
                      >
                        {index + 1}
                      </button>
                    ))}
                  </motion.div>
                ) : (
                  <motion.div
                    animate={{ opacity: 1 }}
                    className="space-y-4 p-4"
                    exit={{ opacity: 0 }}
                    initial={{ opacity: 0 }}
                    key="expanded"
                  >
                    <div>
                      <p className="text-sm font-medium text-white">
                        {activeProject?.name ?? "No project yet"}
                      </p>
                      <p className="text-xs text-slate-500">
                        {activeBook?.title ?? "Create a book"} /{" "}
                        {activeVolume?.title ?? "No volume"}
                      </p>
                    </div>
                    <div className="space-y-1">
                      {chapters.map((chapter, index) => (
                        <button
                          className={`w-full rounded-lg px-3 py-2 text-left text-sm transition ${
                            selectedChapter?.id === chapter.id
                              ? "bg-forge-blue/12 text-forge-blue"
                              : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
                          }`}
                          key={chapter.id}
                          onClick={() => void openChapter(chapter)}
                          type="button"
                        >
                          Chapter {String(index + 1).padStart(3, "0")} · {chapter.title}
                        </button>
                      ))}
                      {chapters.length === 0 ? (
                        <p className="rounded-lg border border-white/10 px-3 py-3 text-sm text-slate-500">
                          No chapters yet.
                        </p>
                      ) : null}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </aside>

          <section className="min-h-0 overflow-hidden bg-[radial-gradient(circle_at_top_left,rgba(117,167,255,0.12),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(178,148,255,0.1),transparent_32%)]">
            {workspaceView === "settings" ? (
              <div className="h-full overflow-auto">
                <SettingsPanel />
              </div>
            ) : (
              <div className="flex h-full flex-col">
                <div className="border-b border-white/10 px-6 py-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
                        Active chapter
                      </p>
                      <h2 className="mt-1 text-xl font-semibold text-white">
                        {selectedChapter?.title ?? "No chapter selected"}
                      </h2>
                    </div>
                    <div className="flex gap-2">
                      <span className="rounded-full border border-forge-mint/30 bg-forge-mint/10 px-3 py-1 text-xs text-forge-mint">
                        Idle
                      </span>
                      <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-400">
                        No provider connected
                      </span>
                    </div>
                  </div>
                </div>

                <div className="grid min-h-0 flex-1 grid-rows-[1fr_170px]">
                  <article className="overflow-auto px-6 py-5">
                    <div className="mx-auto max-w-3xl space-y-5">
                      <div className="rounded-xl border border-white/10 bg-graphite-900/60 p-5">
                        <p className="text-sm leading-7 text-slate-300">
                          The manuscript editor will live here in Phase 4. Phase 1 keeps this shell
                          lightweight while Phase 2 proves local persistence. The canonical
                          manuscript preview below is loaded from SQLite through typed IPC.
                        </p>
                      </div>
                      <div className="rounded-xl border border-white/10 bg-black/25 p-5">
                        <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
                          Canonical manuscript
                        </p>
                        <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-slate-300">
                          {canonical?.contentMarkdown ?? "No canonical manuscript saved yet."}
                        </p>
                      </div>
                      <div className="rounded-xl border border-white/10 bg-black/25 p-5">
                        <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
                          Generation stream
                        </p>
                        <div className="mt-4 flex gap-2">
                          {[0, 1, 2].map((item) => (
                            <motion.span
                              animate={{ opacity: [0.35, 1, 0.35] }}
                              className="h-2 w-12 rounded-full bg-forge-blue/50"
                              key={item}
                              transition={{
                                duration: 1.2,
                                repeat: Infinity,
                                delay: item * 0.16
                              }}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  </article>

                  <section className="border-t border-white/10 bg-black/20 px-6 py-4">
                    <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
                      Task timeline
                    </p>
                    <div className="mt-3 grid grid-cols-4 gap-3">
                      {["Context", "Outline", "Draft", "Review"].map((stage, index) => (
                        <div
                          className="rounded-lg border border-white/10 bg-white/[0.035] p-3"
                          key={stage}
                        >
                          <p className="text-sm text-slate-200">{stage}</p>
                          <p className="mt-1 text-xs text-slate-500">
                            {index === 0 ? "Ready" : "Waiting"}
                          </p>
                        </div>
                      ))}
                    </div>
                  </section>
                </div>
              </div>
            )}
          </section>

          <aside className="min-h-0 overflow-auto border-l border-white/10 bg-black/18">
            <div className="space-y-4 p-4">
              {[
                [
                  "Story bible",
                  storyBibleEntries.length > 0
                    ? storyBibleEntries.map((entry) => entry.title).join(" · ")
                    : "No entries yet"
                ],
                ["Continuity", "No warnings in this placeholder"],
                ["Model router", "Task presets will appear here"],
                [
                  "Cost meter",
                  `${selectedChapter?.currentWords ?? 0} words tracked / $0.0000 session spend`
                ]
              ].map(([title, body]) => (
                <section
                  className="rounded-xl border border-white/10 bg-graphite-900/60 p-4"
                  key={title}
                >
                  <h3 className="text-sm font-semibold text-white">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-400">{body}</p>
                </section>
              ))}
            </div>
          </aside>
        </div>

        <footer className="grid h-9 grid-cols-[1fr_auto] items-center border-t border-white/10 bg-black/28 px-4 text-xs text-slate-500">
          <span>WenForge Studio {version}</span>
          <span>Run cost: $0.0000 / Month: $0.0000</span>
        </footer>
      </motion.section>

      <CommandPalette open={commandPaletteOpen} onClose={closeCommandPalette} />
    </main>
  );
}

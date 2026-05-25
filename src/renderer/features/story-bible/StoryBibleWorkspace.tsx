import type { JSX } from "react";
import React, { useCallback, useEffect, useMemo, useState } from "react";

import type { StoryBibleCrudApi } from "@contracts/preload";
import type { StoryBibleListQuery } from "@contracts/story-bible";

type StoryBibleApiKey =
  | "characters"
  | "factions"
  | "locations"
  | "artifacts"
  | "powerSystem"
  | "timeline"
  | "foreshadowing"
  | "hooks"
  | "styleGuide"
  | "readerPositioning";

interface StoryBibleWorkspaceProps {
  bookId: string | null;
}

type StoryBibleRecordView = Record<string, unknown> & {
  id: string;
  tags?: string[];
  importance?: number;
};

const TABS: Array<{
  key: StoryBibleApiKey;
  label: string;
  titleField: string;
  bodyFields: string[];
}> = [
  {
    key: "characters",
    label: "Characters",
    titleField: "name",
    bodyFields: ["currentState", "goal", "motivation", "relationshipNotes"]
  },
  { key: "factions", label: "Factions", titleField: "name", bodyFields: ["summary"] },
  { key: "locations", label: "Locations", titleField: "name", bodyFields: ["summary"] },
  { key: "artifacts", label: "Artifacts / Props", titleField: "name", bodyFields: ["summary"] },
  {
    key: "powerSystem",
    label: "Power System",
    titleField: "rankLevelName",
    bodyFields: ["ruleType", "advancementConditions", "limitsCosts", "contradictionChecks", "notes"]
  },
  { key: "timeline", label: "Timeline", titleField: "title", bodyFields: ["content"] },
  {
    key: "foreshadowing",
    label: "Foreshadowing",
    titleField: "hintText",
    bodyFields: ["status", "payoffNotes"]
  },
  {
    key: "hooks",
    label: "Unresolved Hooks",
    titleField: "hookText",
    bodyFields: ["urgency", "expectedResolutionWindow", "status", "notes"]
  },
  {
    key: "styleGuide",
    label: "Style Guide",
    titleField: "title",
    bodyFields: ["genre", "tone", "pacingRules", "forbiddenCliches", "chapterEndingPattern"]
  },
  {
    key: "readerPositioning",
    label: "Reader Positioning",
    titleField: "title",
    bodyFields: ["targetReader", "platformStyle", "genreExpectation", "emotionalPromise"]
  }
];
const DEFAULT_TAB = TABS[0] as (typeof TABS)[number];

function entityApi(
  key: StoryBibleApiKey
): StoryBibleCrudApi<StoryBibleListQuery, Record<string, unknown>, StoryBibleRecordView> {
  return window.wenforge.storyBible[key] as unknown as StoryBibleCrudApi<
    StoryBibleListQuery,
    Record<string, unknown>,
    StoryBibleRecordView
  >;
}

function splitTags(value: string | null): string[] {
  return value
    ? value
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean)
    : [];
}

function titleFor(record: StoryBibleRecordView, titleField: string): string {
  return String(record[titleField] ?? record.title ?? record.name ?? "Untitled");
}

function bodyFor(record: StoryBibleRecordView, fields: string[]): string {
  return fields
    .map((field) => record[field])
    .filter((value) => typeof value === "string" && value.length > 0)
    .join("\n");
}

function createInputFor(
  key: StoryBibleApiKey,
  bookId: string,
  title: string,
  body: string,
  tags: string[]
) {
  const common = { bookId, tags, importance: 5 };
  switch (key) {
    case "characters":
      return { ...common, name: title, currentState: body };
    case "powerSystem":
      return { ...common, rankLevelName: title, notes: body };
    case "timeline":
      return { ...common, title, content: body, eventIndex: 0 };
    case "foreshadowing":
      return { ...common, hintText: body || title, status: "seeded" };
    case "hooks":
      return { ...common, hookText: body || title, status: "open" };
    case "styleGuide":
      return { ...common, title, content: body, genre: title };
    case "readerPositioning":
      return { ...common, title, content: body, targetReader: title };
    default:
      return { ...common, name: title, summary: body };
  }
}

function updateInputFor(key: StoryBibleApiKey, title: string, body: string, tags: string[]) {
  switch (key) {
    case "characters":
      return { name: title, currentState: body, tags };
    case "powerSystem":
      return { rankLevelName: title, notes: body, tags };
    case "timeline":
      return { title, content: body, tags };
    case "foreshadowing":
      return { hintText: body || title, tags };
    case "hooks":
      return { hookText: body || title, tags };
    case "styleGuide":
      return { title, content: body, tags };
    case "readerPositioning":
      return { title, content: body, targetReader: title, tags };
    default:
      return { name: title, summary: body, tags };
  }
}

export function StoryBibleWorkspace({ bookId }: StoryBibleWorkspaceProps): JSX.Element {
  const [activeKey, setActiveKey] = useState<StoryBibleApiKey>("characters");
  const [query, setQuery] = useState("");
  const [records, setRecords] = useState<StoryBibleRecordView[]>([]);
  const [loading, setLoading] = useState(false);
  const activeTab = useMemo(
    () => TABS.find((tab) => tab.key === activeKey) ?? DEFAULT_TAB,
    [activeKey]
  );

  const loadRecords = useCallback(async (): Promise<void> => {
    if (!bookId) {
      setRecords([]);
      return;
    }
    setLoading(true);
    try {
      setRecords(await entityApi(activeKey).list(query ? { bookId, query } : { bookId }));
    } finally {
      setLoading(false);
    }
  }, [activeKey, bookId, query]);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) {
        void loadRecords();
      }
    });
    return () => {
      cancelled = true;
    };
  }, [loadRecords]);

  const createRecord = async (): Promise<void> => {
    if (!bookId) return;
    const title = window.prompt(`${activeTab.label} title/name`);
    if (!title?.trim()) return;
    const body = window.prompt("Details") ?? "";
    const tags = splitTags(window.prompt("Tags, comma separated", ""));
    await entityApi(activeKey).create(createInputFor(activeKey, bookId, title.trim(), body, tags));
    await loadRecords();
  };

  const editRecord = async (record: StoryBibleRecordView): Promise<void> => {
    const currentTitle = titleFor(record, activeTab.titleField);
    const title = window.prompt("Title/name", currentTitle);
    if (!title?.trim()) return;
    const body = window.prompt("Details", bodyFor(record, activeTab.bodyFields)) ?? "";
    const tags = splitTags(window.prompt("Tags, comma separated", (record.tags ?? []).join(", ")));
    await entityApi(activeKey).update(
      record.id,
      updateInputFor(activeKey, title.trim(), body, tags)
    );
    await loadRecords();
  };

  const deleteRecord = async (record: StoryBibleRecordView): Promise<void> => {
    if (!window.confirm(`Delete "${titleFor(record, activeTab.titleField)}"?`)) return;
    await entityApi(activeKey).delete(record.id, true);
    await loadRecords();
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-white/10 px-6 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
              Story bible
            </p>
            <h2 className="mt-1 text-xl font-semibold text-white">{activeTab.label}</h2>
          </div>
          <div className="flex gap-2">
            <input
              className="rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-600"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search/filter"
              value={query}
            />
            <button
              className="rounded-lg border border-forge-blue/35 bg-forge-blue/10 px-3 py-2 text-sm text-forge-blue"
              onClick={() => void createRecord()}
              type="button"
            >
              New
            </button>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {TABS.map((tab) => (
            <button
              className={`rounded-md border px-3 py-1.5 text-xs transition ${
                activeKey === tab.key
                  ? "border-forge-blue/35 bg-forge-blue/10 text-forge-blue"
                  : "border-white/10 text-slate-400 hover:border-white/20 hover:text-white"
              }`}
              key={tab.key}
              onClick={() => setActiveKey(tab.key)}
              type="button"
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto px-6 py-5">
        <div className="grid gap-3 xl:grid-cols-2">
          {records.map((record) => (
            <article className="rounded-lg border border-white/10 bg-black/25 p-4" key={record.id}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-white">
                    {titleFor(record, activeTab.titleField)}
                  </h3>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-400">
                    {bodyFor(record, activeTab.bodyFields) || "No details yet."}
                  </p>
                </div>
                <span className="rounded-full border border-white/10 px-2 py-0.5 text-xs text-slate-500">
                  {record.importance ?? 5}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {(record.tags ?? []).map((tag) => (
                  <span
                    className="rounded-full border border-white/10 px-2 py-0.5 text-[11px] text-slate-500"
                    key={tag}
                  >
                    {tag}
                  </span>
                ))}
              </div>
              <div className="mt-4 flex gap-2">
                <button
                  className="rounded-md border border-white/10 px-3 py-1.5 text-xs text-slate-300 hover:text-white"
                  onClick={() => void editRecord(record)}
                  type="button"
                >
                  Edit
                </button>
                <button
                  className="rounded-md border border-red-400/25 px-3 py-1.5 text-xs text-red-200 hover:border-red-400/50"
                  onClick={() => void deleteRecord(record)}
                  type="button"
                >
                  Delete
                </button>
              </div>
            </article>
          ))}
          {!loading && records.length === 0 ? (
            <p className="rounded-lg border border-white/10 bg-black/25 px-4 py-8 text-center text-sm text-slate-500 xl:col-span-2">
              No records in this tab yet.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

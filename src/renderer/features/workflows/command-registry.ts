export const REQUIRED_COMMAND_IDS = [
  "new-project",
  "new-book",
  "new-volume",
  "new-chapter",
  "rename-chapter",
  "save-manuscript-version",
  "set-canonical",
  "open-settings",
  "open-story-bible",
  "show-cost-dashboard",
  "open-data-workspace",
  "generate-outline",
  "draft-chapter",
  "run-audit",
  "show-review",
  "apply-settlement"
] as const;

export const COMMAND_CATEGORIES = [
  "Project",
  "Chapter",
  "Generation",
  "Review",
  "Story Bible",
  "Cost",
  "Settings"
] as const;

export type StudioCommandId = (typeof REQUIRED_COMMAND_IDS)[number];
export type CommandCategory = (typeof COMMAND_CATEGORIES)[number];

export interface CommandScope {
  requiresProject?: boolean;
  requiresBook?: boolean;
  requiresChapter?: boolean;
  requiresGeneratedDraft?: boolean;
  requiresSettlementProposal?: boolean;
}

export interface CommandPaletteContext {
  hasProject?: boolean;
  hasBook?: boolean;
  hasChapter?: boolean;
  hasGeneratedDraft?: boolean;
  hasSettlementProposal?: boolean;
}

export interface StudioCommand {
  id: StudioCommandId;
  label: string;
  category: CommandCategory;
  description: string;
  keywords: string[];
  scope?: CommandScope;
  placeholder?: boolean;
  requiresConfirmation?: boolean;
}

export interface CommandPaletteItem {
  command: StudioCommand;
  score: number;
  recent: boolean;
  disabledReason: string | null;
}

export interface ResolveCommandPaletteInput {
  query: string;
  recentCommandIds?: StudioCommandId[];
  context?: CommandPaletteContext;
}

export const STUDIO_COMMANDS: StudioCommand[] = [
  {
    id: "new-project",
    label: "New Project",
    category: "Project",
    description: "Create a local project",
    keywords: ["project", "create", "新项目", "项目"]
  },
  {
    id: "new-book",
    label: "New Book",
    category: "Project",
    description: "Add a book to the active project",
    keywords: ["book", "novel", "新书", "书"],
    scope: { requiresProject: true }
  },
  {
    id: "new-volume",
    label: "New Volume",
    category: "Project",
    description: "Add a volume to the active book",
    keywords: ["volume", "arc", "分卷", "卷"],
    scope: { requiresBook: true }
  },
  {
    id: "new-chapter",
    label: "New Chapter",
    category: "Chapter",
    description: "Create a chapter placeholder",
    keywords: ["chapter", "章节", "新章"],
    scope: { requiresBook: true }
  },
  {
    id: "rename-chapter",
    label: "Rename Chapter",
    category: "Chapter",
    description: "Rename the selected chapter",
    keywords: ["rename", "chapter", "改名", "标题"],
    scope: { requiresChapter: true }
  },
  {
    id: "save-manuscript-version",
    label: "Save Manuscript Version",
    category: "Chapter",
    description: "Version the current working draft",
    keywords: ["save", "version", "版本", "保存"],
    scope: { requiresChapter: true }
  },
  {
    id: "set-canonical",
    label: "Set Canonical",
    category: "Chapter",
    description: "Accept the current draft as canon",
    keywords: ["canon", "canonical", "accept", "定稿"],
    requiresConfirmation: true,
    scope: { requiresChapter: true }
  },
  {
    id: "generate-outline",
    label: "Generate Outline",
    category: "Generation",
    description: "Open outline generation for the current chapter",
    keywords: ["outline", "generate", "生成", "大纲"],
    scope: { requiresChapter: true }
  },
  {
    id: "draft-chapter",
    label: "Draft Chapter",
    category: "Generation",
    description: "Draft the current chapter through the workflow panel",
    keywords: ["draft", "write", "chapter", "起草", "正文"],
    scope: { requiresChapter: true }
  },
  {
    id: "run-audit",
    label: "Run Audit",
    category: "Review",
    description: "Open continuity and rhythm audit controls",
    keywords: ["audit", "review", "检查", "爽点"],
    scope: { requiresChapter: true }
  },
  {
    id: "show-review",
    label: "Show Review",
    category: "Review",
    description: "Open review cards, diffs, and human gate controls",
    keywords: ["review", "diff", "cards", "审稿", "对比"],
    scope: { requiresChapter: true }
  },
  {
    id: "apply-settlement",
    label: "Apply Settlement",
    category: "Review",
    description: "Review pending state settlement proposals",
    keywords: ["settlement", "state", "canon", "结算", "设定"],
    requiresConfirmation: true,
    scope: { requiresChapter: true, requiresSettlementProposal: true }
  },
  {
    id: "open-story-bible",
    label: "Open Story Bible",
    category: "Story Bible",
    description: "Manage characters, hooks, timeline, and style rules",
    keywords: ["story", "bible", "characters", "设定", "人物"],
    scope: { requiresBook: true }
  },
  {
    id: "show-cost-dashboard",
    label: "Show Cost Dashboard",
    category: "Cost",
    description: "Open spend, budget, pricing, and evaluation controls",
    keywords: ["cost", "spend", "费用", "预算"]
  },
  {
    id: "open-settings",
    label: "Open Settings",
    category: "Settings",
    description: "Open providers, models, routing, privacy, and diagnostics",
    keywords: ["settings", "provider", "model", "设置"]
  },
  {
    id: "open-data-workspace",
    label: "Open Data Workspace",
    category: "Settings",
    description: "Open import, export, backup, and restore controls",
    keywords: ["data", "backup", "export", "import", "导出", "备份"]
  }
];

export function getCommandById(id: StudioCommandId): StudioCommand | undefined {
  return STUDIO_COMMANDS.find((command) => command.id === id);
}

export function filterCommands(query: string): StudioCommand[] {
  return resolveCommandPalette({ query }).map((item) => item.command);
}

export function resolveCommandPalette(input: ResolveCommandPaletteInput): CommandPaletteItem[] {
  const normalizedQuery = normalize(input.query);
  const recentCommandIds = input.recentCommandIds ?? [];
  const recentRank = new Map(
    recentCommandIds.map((id, index) => [id, recentCommandIds.length - index])
  );

  return STUDIO_COMMANDS.map((command) => {
    const score = normalizedQuery ? scoreCommand(command, normalizedQuery) : 1;
    return {
      command,
      score: score + (recentRank.get(command.id) ?? 0) * (normalizedQuery ? 0.05 : 10),
      recent: recentRank.has(command.id),
      disabledReason: disabledReason(command, input.context ?? {})
    };
  })
    .filter((item) => !normalizedQuery || item.score > 0)
    .sort((a, b) => b.score - a.score || categoryIndex(a.command) - categoryIndex(b.command));
}

function scoreCommand(command: StudioCommand, normalizedQuery: string): number {
  const haystacks = [
    command.id,
    command.label,
    command.category,
    command.description,
    ...command.keywords
  ].map(normalize);

  const directMatch = haystacks.some((haystack) => haystack.includes(normalizedQuery));
  const fuzzy = Math.max(...haystacks.map((haystack) => fuzzyScore(normalizedQuery, haystack)));
  return (directMatch ? 100 : 0) + fuzzy;
}

function fuzzyScore(query: string, value: string): number {
  if (!query) return 1;
  let queryIndex = 0;
  let score = 0;
  let streak = 0;
  for (const character of value) {
    if (character === query[queryIndex]) {
      queryIndex += 1;
      streak += 1;
      score += 3 + streak;
      if (queryIndex === query.length) return score;
    } else if (character !== " ") {
      streak = 0;
    }
  }
  return 0;
}

function disabledReason(command: StudioCommand, context: CommandPaletteContext): string | null {
  if (command.scope?.requiresProject && !context.hasProject) return "Select a project first";
  if (command.scope?.requiresBook && !context.hasBook) return "Select a book first";
  if (command.scope?.requiresChapter && !context.hasChapter) return "Select a chapter first";
  if (command.scope?.requiresGeneratedDraft && !context.hasGeneratedDraft) {
    return "Generate a draft first";
  }
  if (command.scope?.requiresSettlementProposal && !context.hasSettlementProposal) {
    return "No settlement proposal is pending";
  }
  return null;
}

function categoryIndex(command: StudioCommand): number {
  return COMMAND_CATEGORIES.indexOf(command.category);
}

function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

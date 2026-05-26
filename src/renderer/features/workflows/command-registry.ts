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
  "项目",
  "章节",
  "生成",
  "审稿",
  "故事圣经",
  "成本",
  "设置"
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
    label: "新建项目",
    category: "项目",
    description: "创建本地项目",
    keywords: ["project", "create", "新项目", "项目"]
  },
  {
    id: "new-book",
    label: "新建书籍",
    category: "项目",
    description: "在当前项目中添加书籍",
    keywords: ["book", "novel", "新书", "书"],
    scope: { requiresProject: true }
  },
  {
    id: "new-volume",
    label: "新建分卷",
    category: "项目",
    description: "在当前书籍中添加分卷",
    keywords: ["volume", "arc", "分卷", "卷"],
    scope: { requiresBook: true }
  },
  {
    id: "new-chapter",
    label: "新建章节",
    category: "章节",
    description: "创建章节占位",
    keywords: ["chapter", "章节", "新章"],
    scope: { requiresBook: true }
  },
  {
    id: "rename-chapter",
    label: "重命名章节",
    category: "章节",
    description: "修改当前章节标题",
    keywords: ["rename", "chapter", "改名", "标题"],
    scope: { requiresChapter: true }
  },
  {
    id: "save-manuscript-version",
    label: "保存正文版本",
    category: "章节",
    description: "保存当前工作稿为版本",
    keywords: ["save", "version", "版本", "保存"],
    scope: { requiresChapter: true }
  },
  {
    id: "set-canonical",
    label: "设为正式正文",
    category: "章节",
    description: "确认当前稿为正式正文",
    keywords: ["canon", "canonical", "accept", "定稿"],
    requiresConfirmation: true,
    scope: { requiresChapter: true }
  },
  {
    id: "generate-outline",
    label: "生成大纲",
    category: "生成",
    description: "打开当前章节的大纲生成",
    keywords: ["outline", "generate", "生成", "大纲"],
    scope: { requiresChapter: true }
  },
  {
    id: "draft-chapter",
    label: "起草正文",
    category: "生成",
    description: "通过工作流起草当前章节",
    keywords: ["draft", "draft chapter", "write", "chapter", "起草", "正文"],
    scope: { requiresChapter: true }
  },
  {
    id: "run-audit",
    label: "运行审稿",
    category: "审稿",
    description: "打开节奏与连贯性审稿",
    keywords: ["audit", "review", "检查", "爽点"],
    scope: { requiresChapter: true }
  },
  {
    id: "show-review",
    label: "查看审稿",
    category: "审稿",
    description: "打开审稿卡、差异和人工确认",
    keywords: ["review", "diff", "cards", "审稿", "对比"],
    scope: { requiresChapter: true }
  },
  {
    id: "apply-settlement",
    label: "应用设定结算",
    category: "审稿",
    description: "查看待确认的设定结算提案",
    keywords: ["settlement", "state", "canon", "结算", "设定"],
    requiresConfirmation: true,
    scope: { requiresChapter: true, requiresSettlementProposal: true }
  },
  {
    id: "open-story-bible",
    label: "打开故事圣经",
    category: "故事圣经",
    description: "管理人物、钩子、时间线和风格规则",
    keywords: ["story", "bible", "characters", "设定", "人物"],
    scope: { requiresBook: true }
  },
  {
    id: "show-cost-dashboard",
    label: "查看成本面板",
    category: "成本",
    description: "打开花费、预算、价格和评测",
    keywords: ["cost", "spend", "费用", "预算"]
  },
  {
    id: "open-settings",
    label: "打开设置",
    category: "设置",
    description: "打开模型密钥、模型、路线、隐私和诊断",
    keywords: ["settings", "provider", "model", "设置"]
  },
  {
    id: "open-data-workspace",
    label: "打开数据工作台",
    category: "设置",
    description: "打开导入、导出、备份和恢复",
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
  if (command.scope?.requiresProject && !context.hasProject) return "先选择项目";
  if (command.scope?.requiresBook && !context.hasBook) return "先选择书籍";
  if (command.scope?.requiresChapter && !context.hasChapter) return "先选择章节";
  if (command.scope?.requiresGeneratedDraft && !context.hasGeneratedDraft) {
    return "先生成草稿";
  }
  if (command.scope?.requiresSettlementProposal && !context.hasSettlementProposal) {
    return "没有待处理的设定结算";
  }
  return null;
}

function categoryIndex(command: StudioCommand): number {
  return COMMAND_CATEGORIES.indexOf(command.category);
}

function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

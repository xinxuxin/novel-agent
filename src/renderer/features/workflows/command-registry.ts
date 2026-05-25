export const REQUIRED_COMMAND_IDS = [
  "new-project",
  "new-book",
  "new-volume",
  "new-chapter",
  "save-manuscript-version",
  "set-canonical",
  "open-settings",
  "generate-outline",
  "draft-chapter",
  "run-audit",
  "show-cost-dashboard"
] as const;

export type StudioCommandId = (typeof REQUIRED_COMMAND_IDS)[number];

export interface StudioCommand {
  id: StudioCommandId;
  label: string;
  section: "Create" | "Manuscript" | "Settings" | "Generate" | "Costs";
  description: string;
  keywords: string[];
  placeholder?: boolean;
  requiresConfirmation?: boolean;
}

export const STUDIO_COMMANDS: StudioCommand[] = [
  {
    id: "new-project",
    label: "New Project",
    section: "Create",
    description: "Create a local project",
    keywords: ["project", "create", "新项目"]
  },
  {
    id: "new-book",
    label: "New Book",
    section: "Create",
    description: "Add a book to the active project",
    keywords: ["book", "novel", "新书"]
  },
  {
    id: "new-volume",
    label: "New Volume",
    section: "Create",
    description: "Add a volume to the active book",
    keywords: ["volume", "arc", "分卷"]
  },
  {
    id: "new-chapter",
    label: "New Chapter",
    section: "Create",
    description: "Create a chapter placeholder",
    keywords: ["chapter", "章节"]
  },
  {
    id: "save-manuscript-version",
    label: "Save Manuscript Version",
    section: "Manuscript",
    description: "Version the current working draft",
    keywords: ["save", "version", "版本", "保存"]
  },
  {
    id: "set-canonical",
    label: "Set Canonical",
    section: "Manuscript",
    description: "Accept the current draft as canon",
    keywords: ["canon", "canonical", "accept", "定稿"],
    requiresConfirmation: true
  },
  {
    id: "open-settings",
    label: "Open Settings",
    section: "Settings",
    description: "Open provider, model, routing, and privacy settings",
    keywords: ["settings", "provider", "model", "设置"]
  },
  {
    id: "generate-outline",
    label: "Generate Outline",
    section: "Generate",
    description: "Open the outline generation placeholder",
    keywords: ["outline", "生成", "大纲"],
    placeholder: true
  },
  {
    id: "draft-chapter",
    label: "Draft Chapter",
    section: "Generate",
    description: "Open the chapter draft placeholder",
    keywords: ["draft", "write", "起草", "正文"],
    placeholder: true
  },
  {
    id: "run-audit",
    label: "Run Audit",
    section: "Generate",
    description: "Open continuity and rhythm audit placeholder",
    keywords: ["audit", "review", "检查", "爽点"],
    placeholder: true
  },
  {
    id: "show-cost-dashboard",
    label: "Show Cost Dashboard",
    section: "Costs",
    description: "Focus the live cost and run history panels",
    keywords: ["cost", "spend", "费用", "预算"],
    placeholder: true
  }
];

export function getCommandById(id: StudioCommandId): StudioCommand | undefined {
  return STUDIO_COMMANDS.find((command) => command.id === id);
}

export function filterCommands(query: string): StudioCommand[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return STUDIO_COMMANDS;

  return STUDIO_COMMANDS.filter((command) => {
    const haystack = [
      command.id,
      command.label,
      command.section,
      command.description,
      ...command.keywords
    ]
      .join(" ")
      .toLowerCase();
    return haystack.includes(normalized);
  });
}

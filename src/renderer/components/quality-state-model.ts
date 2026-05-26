export type QualityState =
  | "empty_project"
  | "no_provider_configured"
  | "missing_price"
  | "stale_price"
  | "no_canonical_manuscript"
  | "generated_draft_pending"
  | "settlement_proposal_pending";

interface QualityStateCopy {
  title: string;
  body: string;
  primaryLabel: string;
  targetView: "chapter" | "settings" | "costs" | "storyBible" | "review";
  tone: "blue" | "amber" | "mint" | "violet";
}

export type QualityStateTargetView = QualityStateCopy["targetView"];

const STATE_COPY: Record<QualityState, QualityStateCopy> = {
  empty_project: {
    title: "还没有项目",
    body: "新建或导入项目后开始写章节。",
    primaryLabel: "新建项目",
    targetView: "chapter",
    tone: "blue"
  },
  no_provider_configured: {
    title: "还没有模型密钥",
    body: "可以先用本地模拟，或在设置里添加加密保存的模型密钥。",
    primaryLabel: "打开设置",
    targetView: "settings",
    tone: "amber"
  },
  missing_price: {
    title: "缺少价格",
    body: "补充模型价格后，实时成本估算才可用。",
    primaryLabel: "打开价格",
    targetView: "settings",
    tone: "amber"
  },
  stale_price: {
    title: "价格可能过期",
    body: "使用该路线前，请确认价格生效日期。",
    primaryLabel: "打开价格",
    targetView: "settings",
    tone: "amber"
  },
  no_canonical_manuscript: {
    title: "还没有正式正文",
    body: "保存或确认版本后，连贯性记忆才会把本章视为正式内容。",
    primaryLabel: "保存版本",
    targetView: "chapter",
    tone: "blue"
  },
  generated_draft_pending: {
    title: "生成稿待确认",
    body: "先审稿，再保存为正文版本。",
    primaryLabel: "打开审稿",
    targetView: "review",
    tone: "violet"
  },
  settlement_proposal_pending: {
    title: "设定结算待确认",
    body: "设定更新在你确认前只作为提案保存。",
    primaryLabel: "打开故事圣经",
    targetView: "storyBible",
    tone: "mint"
  }
};

export function getQualityStateAction(state: QualityState): QualityStateCopy {
  return STATE_COPY[state];
}

export function redactRenderableText(value: string): string {
  return value
    .replace(/Authorization:\s*Bearer\s+[^\s"'}]+/gi, "Authorization: [redacted]")
    .replace(/\b(sk|ak|xai|or|kimi|qwen|gemini|deepseek)-[A-Za-z0-9._-]{8,}\b/g, "[redacted]")
    .replace(/\b(api[_-]?key|access[_-]?token|secret)\s*[:=]\s*["']?[^"'\s,}]+/gi, "$1=[redacted]");
}

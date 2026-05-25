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
    title: "No project yet",
    body: "Create or import a project to start shaping chapters.",
    primaryLabel: "New Project",
    targetView: "chapter",
    tone: "blue"
  },
  no_provider_configured: {
    title: "No provider configured",
    body: "Choose mock mode for local testing or add an encrypted provider credential.",
    primaryLabel: "Open Settings",
    targetView: "settings",
    tone: "amber"
  },
  missing_price: {
    title: "Missing price",
    body: "Add a model price before live cost estimates can be trusted.",
    primaryLabel: "Open Pricing",
    targetView: "settings",
    tone: "amber"
  },
  stale_price: {
    title: "Stale price",
    body: "Review the effective date before relying on this route estimate.",
    primaryLabel: "Open Pricing",
    targetView: "settings",
    tone: "amber"
  },
  no_canonical_manuscript: {
    title: "No canonical manuscript",
    body: "Save or accept a version before continuity memory treats this chapter as canon.",
    primaryLabel: "Save Version",
    targetView: "chapter",
    tone: "blue"
  },
  generated_draft_pending: {
    title: "Generated draft pending",
    body: "Review generated text before saving it as a manuscript version.",
    primaryLabel: "Open Review",
    targetView: "review",
    tone: "violet"
  },
  settlement_proposal_pending: {
    title: "Settlement proposal pending",
    body: "State updates are proposals until you accept them.",
    primaryLabel: "Open Story Bible",
    targetView: "storyBible",
    tone: "mint"
  }
};

export function getQualityStateAction(state: QualityState): QualityStateCopy {
  return STATE_COPY[state];
}

export function redactRenderableText(value: string): string {
  return value
    .replace(/Authorization:\s*Bearer\s+[^\s]+/gi, "Authorization: Bearer [redacted]")
    .replace(/\b(sk|ak|xai|or|kimi|qwen|gemini|deepseek)-[A-Za-z0-9._-]{8,}\b/g, "[redacted]")
    .replace(/\b(api[_-]?key|access[_-]?token|secret)\s*[:=]\s*["']?[^"'\s]+/gi, "$1=[redacted]");
}

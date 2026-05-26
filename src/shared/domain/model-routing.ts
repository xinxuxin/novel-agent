export const PROVIDERS = [
  "openai",
  "anthropic",
  "gemini",
  "deepseek",
  "dashscope_qwen",
  "moonshot_kimi",
  "xai",
  "openrouter",
  "generic_openai_compatible"
] as const;

export type ProviderId = (typeof PROVIDERS)[number];

export const TASK_TYPES = [
  "brainstorm",
  "story_bible",
  "volume_outline",
  "chapter_outline",
  "scene_cards",
  "draft_chapter",
  "webnovel_style_rewrite",
  "continuity_audit",
  "suspense_hook_audit",
  "revise_chapter",
  "state_settlement",
  "summarize_chapter",
  "embedding_or_memory_indexing"
] as const;

export type TaskType = (typeof TASK_TYPES)[number];

export const QUALITY_MODES = ["economy", "balanced", "premium", "premium_webnovel"] as const;

export type QualityMode = (typeof QUALITY_MODES)[number];

export type CredentialStatus = "unknown" | "configured" | "test_passed" | "test_failed";
export type CredentialTestStatus =
  | "configured_but_untested"
  | "test_passed"
  | "test_failed"
  | "not_configured";

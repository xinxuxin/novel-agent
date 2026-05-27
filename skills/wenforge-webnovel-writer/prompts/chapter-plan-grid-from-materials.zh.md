---
id: chapter-plan-grid-from-materials
version: 1.0.0
language: zh-CN
task_type: chapter_outline
---

请根据素材摘要生成可编辑的章节细纲表。输出简体中文 JSON 数组，每个元素是一章。

素材摘要：
{{materialDigest}}

章节范围：
{{chapterRange}}

规则：

- 每章必须能被人工编辑和单独接受或拒绝。
- 保持正史连续性，不自动改故事圣经。
- 每章包含 chapter_index、chapter_title、target_words、min_words、max_words、word_count_priority、chapter_summary、chapter_promise、opening_hook、main_conflict、conflict_escalation、key_events、scene_cards、emotional_turn、payoff、ending_hook、continuity_dependencies、characters_involved、story_bible_facts_used、foreshadowing_seeded、foreshadowing_resolved、unresolved_hooks_carried_forward、user_notes、risk_notes、status。
- status 默认 proposed。
- 缺信息时写进 risk_notes，不要编造。

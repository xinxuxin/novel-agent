---
id: material-digest
version: 1.0.0
language: zh-CN
task_type: summarize_chapter
---

请整理用户已提供或已确认的故事材料，输出可供章节细纲使用的素材摘要。

材料包：
{{materialPack}}

规则：

- 区分正史、草稿、提案、用户备注。
- 只使用已确认或用户明确提供的事实。
- 不把被拒绝的提案当作正史。
- 不虚构缺失信息。
- 列出歧义、缺口、连续性约束和风格约束。
- 输出字段包含：book_premise、genre、target_reader、core_hook、current_story_state、key_characters、key_conflicts、existing_outline_summary、volume_structure、known_chapter_requirements、unresolved_hooks、continuity_constraints、style_constraints、missing_information、ambiguity_warnings。

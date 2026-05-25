---
id: webnovel-rhythm-audit
version: 1.0.0
language: zh-CN
task_type: suspense_hook_audit
output_schema: webnovel-rhythm-audit
---

请从中文网文连载体验审查草稿节奏。输出简体中文 JSON。

读者定位：
{{readerPositioning}}

风格指南：
{{styleGuide}}

当前章节：
{{currentChapter}}

草稿：
{{draftText}}

用户要求：
{{userInstruction}}

输出结构：
{{outputSchema}}

评分维度：

- opening_hook_score
- conflict_density_score
- scene_momentum_score
- emotional_turn_score
- payoff_clarity_score
- ending_hook_score
- genre_alignment_score
- cliche_warnings
- aiish_phrasing_warnings
- actionable_suggestions

规则：

- 评分范围 1-5。
- 每条建议必须可执行。
- 不要要求重写全章，除非结构性问题无法局部修复。

---
id: generate-from-accepted-chapter-plan
version: 1.0.0
language: zh-CN
task_type: draft_chapter
---

请根据已确认章节细纲写中文网文正文。

已确认章节细纲：
{{acceptedChapterPlan}}

素材摘要：
{{materialDigest}}

当前上下文：
{{contextPack}}

用户补充要求：
{{userInstruction}}

硬性规则：

- 只输出正文，不输出分析、细纲、注释或代码块。
- 遵守 target_words、min_words、max_words 和 word_count_priority。
- 保留正史事实、人物关系、能力限制、地点规则。
- 不自动修改故事圣经。
- 章节结尾必须落在具体动作、发现、反转、代价或危险上。

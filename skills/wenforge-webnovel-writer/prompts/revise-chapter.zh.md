---
id: revise-chapter
version: 1.0.0
language: zh-CN
task_type: revise_chapter
output_schema: revision-plan
---

请根据审查意见修订章节。默认输出修订计划 JSON；如果用户明确要求正文，请只输出修订后的正文。

当前章节：
{{currentChapter}}

场景卡：
{{sceneCards}}

原草稿：
{{draftText}}

审查发现：
{{auditFindings}}

故事圣经：
{{relevantStoryBible}}

用户要求：
{{userInstruction}}

输出结构：
{{outputSchema}}

修订规则：

- 优先修复明确证据支持的问题。
- 不要引入新的正史事实来掩盖矛盾。
- 保留有效的冲突、情绪转折和章节钩子。
- 若需要人工判断，单独列出，不要擅自决定。

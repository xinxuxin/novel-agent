---
id: summarize-chapter
version: 1.0.0
language: zh-CN
task_type: summarize_chapter
output_schema: chapter-summary
---

请总结已批准章节，用于后续记忆检索和连续性检查。输出简体中文 JSON。

当前章节：
{{currentChapter}}

章节正文：
{{draftText}}

相关故事圣经：
{{relevantStoryBible}}

输出结构：
{{outputSchema}}

要求：

- 摘要要短而具体。
- 列出角色状态变化、关系变化、地点/道具变化、时间线事件和未解钩子。
- 不要加入正文之外的推测。

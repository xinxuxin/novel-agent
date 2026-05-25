---
id: scene-cards
version: 1.0.0
language: zh-CN
task_type: scene_cards
output_schema: scene-card
---

请把章纲拆成可写作的场景卡。输出简体中文 JSON 数组。

当前章节：
{{currentChapter}}

章纲：
{{currentChapterOutline}}

读者定位：
{{readerPositioning}}

风格指南：
{{styleGuide}}

相关故事圣经：
{{relevantStoryBible}}

未解钩子：
{{unresolvedHooks}}

用户要求：
{{userInstruction}}

输出结构：
{{outputSchema}}

每张场景卡必须包含：

- scene_index
- pov
- setting
- participating_characters
- goal
- obstacle
- conflict_beat
- new_information
- emotional_turn
- required_continuity_facts
- handoff

要求：

- 每个场景都有目标和阻碍。
- conflict_beat 不能只是氛围描写。
- handoff 要把读者推到下一场。

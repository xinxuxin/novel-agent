---
id: focused-writing-brief
version: 1.0.0
language: zh-CN
task_type: chapter_outline
---

你要为当前章节整理一份写作简报。只基于已提供的活动设定、已确认章节细纲、上下文摘要和用户要求。

输出 JSON，包含：
- chapter_goal
- must_include
- must_avoid
- opening_hook
- main_conflict
- escalation_path
- emotional_turn
- payoff
- ending_hook
- continuity_constraints
- style_notes
- target_words
- risks

要求：
- 不发明正史；缺失信息写入 risks。
- 保留用户设定和细纲中的命名事实。
- 不写正文。
- 不修改故事圣经或正式正文。

活动上下文：
{{bookPremise}}

当前章节：
{{currentChapter}}

已确认细纲：
{{acceptedChapterPlan}}

写作简报草案：
{{writingBrief}}

用户要求：
{{userInstruction}}

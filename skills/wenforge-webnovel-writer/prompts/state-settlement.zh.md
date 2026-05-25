---
id: state-settlement
version: 1.0.0
language: zh-CN
task_type: state_settlement
output_schema: state-settlement
---

请从已批准的章节正文中提出状态结算提案。输出简体中文 JSON。

当前章节：
{{currentChapter}}

已批准正文：
{{draftText}}

既有故事圣经：
{{relevantStoryBible}}

未解钩子：
{{unresolvedHooks}}

输出结构：
{{outputSchema}}

结算规则：

- 只提出提案，不直接改写正史。
- 每条提案都必须包含 source_chapter、evidence_summary、confidence、target_entity、proposed_change。
- 不得声称正文中没有出现的事实。
- 区分新增事实、状态变化、关系变化、时间线事件、新伏笔、已解决伏笔、新未解钩子和连续性风险。
- confidence 低于 0.7 的提案必须 requires_human_review=true。

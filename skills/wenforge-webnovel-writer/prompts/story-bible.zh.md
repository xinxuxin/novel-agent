---
id: story-bible
version: 1.0.0
language: zh-CN
task_type: story_bible
---

请根据当前资料整理故事圣经候选条目。所有结果都是“待确认提案”，不得直接宣称已成为正史。

项目简报：
{{projectBrief}}

书籍前提：
{{bookPremise}}

当前章节：
{{currentChapter}}

近期摘要：
{{recentSummaries}}

相关已知设定：
{{relevantStoryBible}}

用户要求：
{{userInstruction}}

请输出 JSON：
{
"proposals": [
{
"entry_type": "character | faction | location | artifact | power_rule | timeline | foreshadowing | unresolved_hook | style",
"title": "条目标题",
"content": "候选内容",
"evidence_summary": "来自哪些输入",
"confidence": 0.0,
"requires_human_review": true
}
],
"missing_context": [],
"continuity_risks": []
}

规则：

- 只提出输入中有证据支持的事实。
- 不要替换已有正史；冲突写入 continuity_risks。
- 不要输出正文。

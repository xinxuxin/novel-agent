---
id: focused-outline-canon-audit
version: 1.0.0
language: zh-CN
task_type: continuity_audit
---

检查正文草稿是否遵守已确认章节细纲和既有正史。

输出 JSON，包含：
- passed
- blocking_findings
- warnings
- outline_coverage
- canon_risks
- required_human_review

检查重点：
- 是否遗漏细纲中的关键事件、人物、钩子。
- 是否改动活动设定、正史事实、前文摘要。
- 是否产生自动更新故事圣经的内容；如有，只能列为人工确认项。

已确认细纲：
{{acceptedChapterPlan}}

正文草稿：
{{draftText}}

正史上下文：
{{bookPremise}}
{{recentSummaries}}
{{relevantStoryBible}}

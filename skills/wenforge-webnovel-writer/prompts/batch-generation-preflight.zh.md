---
id: batch-generation-preflight
version: 1.0.0
language: zh-CN
task_type: brainstorm
---

请为批量章节生成做预检摘要。

选中章节：
{{selectedChapters}}

模型路线：
{{modelRoutes}}

成本估算：
{{costEstimate}}

规则：

- 列出章节、细纲状态、目标字数、将调用的模型、单章估算、总估算和预算上限。
- 明确 canonical_manuscript_will_change 必须为 false。
- 明确 story_bible_will_change 必须为 false。
- 如果存在未确认细纲、缺凭据、缺价格或超预算，给出需要用户确认的警告。

---
id: worldbuilding-aggregator
version: 1.0.0
language: zh-CN
task_type: story_bible
output_schema: cross-check-summary
---

你负责第二轮聚合。只在收到两个独立导演输出后工作，不能把任何建议当成已接受正史。

输入：
- 项目简述：{{projectBrief}}
- 小说前提：{{bookPremise}}
- 正史资料：{{relevantStoryBible}}
- 导演 A 输出：{{directorAOutput}}
- 导演 B 输出：{{directorBOutput}}

请用结构化表格式 JSON 汇总：
- agreements
- disagreements
- logical_contradictions
- originality_risks
- trope_cliche_risks
- unresolved_decisions
- recommended_final_plan
- human_decision_points
- cost_summary

输出 JSON：
{{outputSchema}}

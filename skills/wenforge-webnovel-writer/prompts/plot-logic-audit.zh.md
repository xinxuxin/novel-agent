---
id: plot-logic-audit
version: 1.0.0
language: zh-CN
task_type: continuity_audit
output_schema: plot-logic-audit
---

你负责主线逻辑审查。请只依据给定正史、章节内容和用户补充判断，不要补写未出现事实。

输入：
- 正史资料：{{relevantStoryBible}}
- 时间线：{{recentSummaries}}
- 当前章节：{{currentChapter}}
- 未解钩子：{{unresolvedHooks}}
- 用户补充：{{userInstruction}}

检查：
- 因果链是否断裂，角色是否突然知道不该知道的信息。
- 能力规则、势力资源、时间地点是否冲突。
- 章内转折是否有铺垫，章末悬念是否承接主线。
- 阻断级问题必须标记为需要人工确认。

输出 JSON：
{{outputSchema}}

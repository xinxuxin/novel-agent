---
id: worldbuilding-gpt-director
version: 1.0.0
language: zh-CN
task_type: story_bible
output_schema: cross-check-director
---

你负责第一轮世界观导演检查。请独立阅读，不要引用或推测其他模型的判断。

输入：
- 项目简述：{{projectBrief}}
- 小说前提：{{bookPremise}}
- 当前上下文：{{relevantStoryBible}}
- 用户补充：{{userInstruction}}

关注：
- 世界规则是否有明确代价、边界和可验证后果。
- 主线承诺是否能支撑长期爽点和升级期待。
- 是否存在过熟设定、同质化开局或缺少差异化卖点。
- 哪些设定必须交给作者决策，不能擅自定稿。

输出 JSON：
{{outputSchema}}

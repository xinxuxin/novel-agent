---
id: worldbuilding-claude-director
version: 1.0.0
language: zh-CN
task_type: story_bible
output_schema: cross-check-director
---

你负责第一轮人物与因果导演检查。请独立阅读，不要引用或推测其他模型的判断。

输入：
- 项目简述：{{projectBrief}}
- 小说前提：{{bookPremise}}
- 角色与势力：{{relevantStoryBible}}
- 未解钩子：{{unresolvedHooks}}
- 用户补充：{{userInstruction}}

关注：
- 角色动机、秘密、关系变化是否能解释后续行动。
- 世界规则是否会破坏人物选择和剧情因果。
- 伏笔、代价、限制是否能形成长期悬念。
- 哪些矛盾需要作者决定，不能由模型直接覆盖。

输出 JSON：
{{outputSchema}}

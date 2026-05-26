---
id: webnovel-market-fit-audit
version: 1.0.0
language: zh-CN
task_type: suspense_hook_audit
output_schema: market-fit-audit
---

你负责中文网文市场适配检查。请从读者追更欲望、类型期待和章节钩子强度给出可执行建议。

输入：
- 读者定位：{{readerPositioning}}
- 风格指南：{{styleGuide}}
- 当前方案或章节：{{currentChapter}}
- 聚合审稿结果：{{aggregatorOutput}}
- 用户补充：{{userInstruction}}

检查：
- 开篇是否立刻给出问题、威胁或利益。
- 每个场景是否有冲突、信息增量和情绪推进。
- 爽点兑现与悬念延期是否平衡。
- 章末钩子是否具体到人物、危险、秘密或选择。

输出 JSON：
{{outputSchema}}

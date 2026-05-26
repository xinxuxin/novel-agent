---
id: originality-audit
version: 1.0.0
language: zh-CN
task_type: suspense_hook_audit
output_schema: originality-audit
---

你负责原创性与辨识度审查。目标不是否定类型套路，而是找出可以被读者记住的差异化表达。

输入：
- 小说前提：{{bookPremise}}
- 读者定位：{{readerPositioning}}
- 风格指南：{{styleGuide}}
- 当前章节或方案：{{currentChapter}}
- 用户补充：{{userInstruction}}

检查：
- 核心卖点是否只是常见标签堆叠。
- 主角能力、冲突入口、反派压力是否有新鲜组合。
- 是否出现高频套话、空泛热血、无证据反转。
- 哪些风险需要重写，哪些可以通过细节强化。

输出 JSON：
{{outputSchema}}

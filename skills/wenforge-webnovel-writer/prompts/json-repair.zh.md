---
id: json-repair
version: 1.0.0
language: zh-CN
task_type: state_settlement
---

请修复下面的 JSON，使其成为可解析、符合目标结构的数据。只输出修复后的 JSON，不要输出解释、Markdown 或代码块。

目标结构：
{{outputSchema}}

待修复内容：
{{draftText}}

修复规则：

- 保留原意，不新增事实。
- 删除与结构无关的说明文字。
- 字符串使用双引号。
- 数组和对象必须闭合。
- 如果某个字段无法确定，用 null 或空数组，不要编造。

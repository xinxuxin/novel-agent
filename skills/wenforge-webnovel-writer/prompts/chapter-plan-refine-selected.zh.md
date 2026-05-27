---
id: chapter-plan-refine-selected
version: 1.0.0
language: zh-CN
task_type: chapter_outline
---

请只修改选中的章节细纲，并输出变更提案。

当前细纲：
{{chapterPlan}}

用户指令：
{{userInstruction}}

规则：

- 只改被选中的章节。
- 保留已确认正史，除非用户明确要求改变。
- 输出 before、after、rationale、affected_fields。
- 不直接输出正文。
- 不自动接受提案。

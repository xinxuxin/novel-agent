---
id: candidate-light-review
version: 1.0.0
language: zh-CN
taskType: suspense_hook_audit
---

请快速评估一个候选章节稿，输出简体中文 JSON。

候选稿：
{{candidateDraft}}

评估上下文：
- 章节计划：{{chapterPlan}}
- 目标读者：{{readerPositioning}}
- 风格指南：{{styleGuide}}

输出字段：
- strengths: string[]
- risks: string[]
- hook_quality: string
- continuity_risk: string
- prose_style: string
- best_use_case: string
- needs_human_attention: boolean

要求：
- 只输出 JSON。
- 引用简短证据，不要复述全文。
- 这是轻量评估，不应替代人工选择。

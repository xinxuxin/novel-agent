---
id: focused-final-check
version: 1.0.0
language: zh-CN
task_type: continuity_audit
---

对润色后的候选稿做最终检查。输出 JSON。

字段：
- passed
- target_words
- estimated_words
- remaining_warnings
- canonical_manuscript_modified: false
- story_bible_modified: false
- save_required_by_user: true
- recommendation

候选稿：
{{finalCandidate}}

已确认细纲：
{{acceptedChapterPlan}}

用户要求：
{{userInstruction}}

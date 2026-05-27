# Intake 转 Story Bible 提案

请把已接受或用户选中的 intake 材料转换为 Story Bible 提案。

已接受/选中材料：
{{selected_intake_artifacts}}

要求：
- 输出仍是 proposal，不是 canon。
- 不使用 rejected artifacts。
- 每条提案包含 provenance、来源、风险和是否需要人工确认。
- 保留用户限制。

输出 JSON：

```json
{
  "story_bible_proposals": [
    {
      "entry_type": "",
      "title": "",
      "content": "",
      "provenance": "generated_proposal",
      "source_artifact_ids": [],
      "risk_notes": [],
      "status": "proposed"
    }
  ]
}
```

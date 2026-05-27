# Intake 转卷纲提案

请把已接受或选中的 intake 材料转换为卷级规划提案。

已接受/选中材料：
{{selected_intake_artifacts}}

已有卷信息：
{{existing_volumes}}

要求：
- 不使用被拒绝提案。
- 不自动生成正文。
- 卷纲需要体现阶段目标、主要矛盾、转折点、悬念推进和未解决钩子。
- 缺失信息要显式列出。

输出 JSON：

```json
{
  "volume_outlines": [
    {
      "volume_index": 1,
      "title": "",
      "summary": "",
      "major_turning_points": [],
      "reader_promise": "",
      "unresolved_hooks": [],
      "risk_notes": [],
      "status": "proposed"
    }
  ]
}
```

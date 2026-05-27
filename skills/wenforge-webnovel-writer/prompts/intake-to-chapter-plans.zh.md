# Intake 转章节细纲

请把已接受或用户选中的 intake 材料转换为可编辑章节细纲。

已接受/选中材料：
{{selected_intake_artifacts}}

已有章节：
{{existing_chapters}}

要求：
- 不写正文。
- 不使用 rejected proposals。
- 每章包含标题、目标字数、摘要、开场钩子、主冲突、关键事件、情绪转折、payoff、章末钩子、场景卡和连续性依赖。
- 如果某章信息不足，写 `risk_notes`，不要凭空确认为 canon。

输出 JSON：

```json
{
  "chapter_plans": [
    {
      "chapter_index": 1,
      "chapter_title": "",
      "target_words": 3000,
      "chapter_summary": "",
      "opening_hook": "",
      "main_conflict": "",
      "key_events": [],
      "emotional_turn": "",
      "payoff": "",
      "ending_hook": "",
      "scene_cards": [],
      "continuity_dependencies": [],
      "risk_notes": [],
      "status": "proposed"
    }
  ]
}
```

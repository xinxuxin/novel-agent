# 自动补全缺失设定

请基于已确认材料，为缺失设定生成可选择的提案。

已确认材料：
{{accepted_materials}}

缺失信息：
{{missing_information}}

要求：
- 生成 2-3 个方向。
- 每个方向都必须标记为 proposal，不得写入 canon。
- 可建议主角动机、世界规则、势力、冲突、能力代价、第一卷方向。
- 遵守用户禁忌，不要引入用户明确反对的元素。
- 不写正文，不替用户做最终选择。

输出 JSON：

```json
{
  "directions": [
    {
      "name": "",
      "rationale": "",
      "protagonist_motivation": "",
      "world_rules": [],
      "factions": [],
      "central_conflicts": [],
      "power_costs": [],
      "first_volume_direction": "",
      "risks": []
    }
  ],
  "recommended_questions": []
}
```

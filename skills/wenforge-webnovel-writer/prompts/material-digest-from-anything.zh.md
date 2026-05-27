# 从任意素材生成 Material Digest

请整理所有已提供或已确认的材料，生成 Material Digest。材料可能是一句话灵感、混乱脑暴、大纲、人物设定、世界观片段、正文摘录、风格偏好或限制。

材料包：
{{material_pack}}

要求：
- 明确区分 canon、draft、proposal、user_notes。
- 被拒绝的 proposal 不得当作 canon。
- 不要发明缺失事实；需要补全时写入 `missing_information` 或 `suggestions`。
- 保留中文网文读者定位、节奏、爽点、悬念钩子和禁忌。

输出 JSON：

```json
{
  "book_premise": "",
  "genre": "",
  "target_reader": "",
  "core_hook": "",
  "current_story_state": "",
  "known_facts": [],
  "draft_materials": [],
  "proposals": [],
  "user_notes": [],
  "key_characters": [],
  "key_conflicts": [],
  "world_rules": [],
  "style_constraints": [],
  "missing_information": [],
  "ambiguity_warnings": []
}
```

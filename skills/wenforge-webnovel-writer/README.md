# WenForge Webnovel Writer Skill

This package contains original WenForge prompt templates, JSON schemas, rubrics, examples, and an evaluation fixture for Chinese web novel writing workflows.

The text is WenForge-native and intentionally rewritten from scratch. Reference repositories informed broad product architecture only; no AGPL, GPL, no-license, proprietary, or distinctive prompt text is copied or closely translated.

Runtime prompt assembly happens in the Electron main process through `SkillLoader`, `PromptTemplateService`, and `PromptAssemblyService`.

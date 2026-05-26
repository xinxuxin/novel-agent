import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { DEFAULT_PRIVACY_SETTINGS } from "@contracts/settings";
import type { ContextPreviewPack } from "@contracts/context";
import { PromptAssemblyService } from "@main/prompts/prompt-assembly-service";
import { PromptTemplateService } from "@main/prompts/prompt-template-service";
import { SkillLoader } from "@main/prompts/skill-loader";

const skillRoot = join(process.cwd(), "skills", "wenforge-webnovel-writer");

const requiredPrompts = [
  "project-discovery.zh.md",
  "reader-positioning.zh.md",
  "story-bible.zh.md",
  "volume-outline.zh.md",
  "chapter-outline.zh.md",
  "scene-cards.zh.md",
  "draft-chapter.zh.md",
  "continuity-audit.zh.md",
  "webnovel-rhythm-audit.zh.md",
  "revise-chapter.zh.md",
  "state-settlement.zh.md",
  "summarize-chapter.zh.md",
  "json-repair.zh.md",
  "worldbuilding-gpt-director.zh.md",
  "worldbuilding-claude-director.zh.md",
  "worldbuilding-aggregator.zh.md",
  "originality-audit.zh.md",
  "plot-logic-audit.zh.md",
  "webnovel-market-fit-audit.zh.md"
];

const requiredSchemas = [
  "project-discovery.schema.json",
  "reader-positioning.schema.json",
  "chapter-outline.schema.json",
  "scene-card.schema.json",
  "continuity-audit.schema.json",
  "webnovel-rhythm-audit.schema.json",
  "revision-plan.schema.json",
  "state-settlement.schema.json",
  "chapter-summary.schema.json"
];

function fakeContext(): ContextPreviewPack {
  return {
    projectBrief: "项目：霜城序列\n密钥 sk-test-secret1234567890 不应进入预览。",
    bookPremise: "失业调查员沈照在雨夜觉醒序列感知。",
    volumeGoal: "第一卷让主角确认雾灯与旧案有关。",
    currentChapterMetadata: "第2章：钟楼背面\ntargetWords=3200",
    currentChapterOutline: {
      chapter_promise: "沈照第一次确认钟声缺口。"
    },
    sceneCards: [
      {
        scene_index: 1,
        goal: "进入钟楼",
        obstacle: "巡夜人拦路"
      }
    ],
    readerPositioning: "目标读者喜欢都市异能升级、强悬念、快节奏。",
    styleGuide: "短段落，动作与发现交替推进，避免空泛感慨。",
    relevantCharacters: ["沈照：克制，刚觉醒序列感知"],
    relevantFactions: ["巡夜局：半官方组织"],
    relevantLocations: ["霜城钟楼：雨夜会丢失钟声"],
    relevantArtifacts: ["雾灯：亮起时吞掉一段钟声"],
    powerSystemDigest: "序列感知：代价是短暂耳鸣。",
    timelineDigest: "1. 雾灯亮起：沈照听见低语。",
    foreshadowingDigest: "seeded: 雾灯每次亮起都会漏掉一段钟声",
    unresolvedHooks: ["high: 雾灯为什么会吞掉钟声？"],
    recentChapterSummaries: ["1. 雾灯亮起：沈照在雨夜听见雾灯低语。"],
    recentChapterExcerpts: [],
    retrievedMemoryChunks: [
      {
        sourceType: "character",
        sourceId: "character_1",
        title: "沈照",
        content: "沈照不能突然熟练掌控序列能力。",
        score: 0.4
      }
    ],
    continuityWarnings: ["Current chapter is missing a summary"],
    omissions: ["Full recent chapters omitted by privacy setting"],
    truncationNotes: [],
    estimatedTokens: 480
  };
}

describe("WenForge native writing skill package", () => {
  it("ships a valid manifest, prompt inventory, rubric inventory, examples, and eval asset", () => {
    const loader = new SkillLoader({ rootDir: skillRoot });
    const manifest = loader.loadManifest();

    expect(manifest).toMatchObject({
      id: "wenforge-webnovel-writer",
      name: "WenForge Webnovel Writer",
      version: "1.0.0",
      language: "zh-CN",
      license: "Original-WenForge"
    });
    expect(manifest.prompts.map((prompt) => prompt.file).sort()).toEqual(
      [...requiredPrompts].sort()
    );
    expect(existsSync(join(skillRoot, "SKILL.md"))).toBe(true);
    expect(existsSync(join(skillRoot, "README.md"))).toBe(true);
    expect(readFileSync(join(skillRoot, "README.md"), "utf8")).toContain("rewritten from scratch");
    expect(readFileSync(join(process.cwd(), "THIRD_PARTY_NOTICES.md"), "utf8")).toContain(
      "original WenForge-authored prompt and skill text"
    );
    expect(
      readdirSync(join(skillRoot, "rubrics")).filter((file) => file.endsWith(".md"))
    ).toHaveLength(5);
    expect(existsSync(join(skillRoot, "examples", "urban-power-demo"))).toBe(true);
    expect(existsSync(join(skillRoot, "examples", "xuanhuan-demo"))).toBe(true);
    expect(
      JSON.parse(readFileSync(join(skillRoot, "eval", "chinese-webnovel-eval-v1.json"), "utf8"))
    ).toMatchObject({
      id: "chinese-webnovel-eval-v1"
    });
  });

  it("keeps every required prompt versioned and parses every schema file", () => {
    const templateService = new PromptTemplateService(new SkillLoader({ rootDir: skillRoot }));

    for (const promptFile of requiredPrompts) {
      const template = templateService.loadByFile(promptFile);
      expect(template.version).toMatch(/^\d+\.\d+\.\d+$/);
      expect(template.language).toBe("zh-CN");
      expect(template.content).toContain("{{");
    }

    for (const schemaFile of requiredSchemas) {
      const schema = JSON.parse(
        readFileSync(join(skillRoot, "schemas", schemaFile), "utf8")
      ) as Record<string, unknown>;
      expect(schema).toMatchObject({
        $schema: "https://json-schema.org/draft/2020-12/schema",
        type: "object"
      });
    }
  });

  it("assembles a redacted prompt with required context sections and version metadata", () => {
    const assembly = new PromptAssemblyService(
      new PromptTemplateService(new SkillLoader({ rootDir: skillRoot }))
    ).assemble({
      templateId: "chapter-outline",
      context: fakeContext(),
      privacy: {
        ...DEFAULT_PRIVACY_SETTINGS,
        allowPromptPreview: false
      },
      variables: {
        targetWords: "3200",
        userInstruction: "突出雨夜压迫感，结尾必须出现具体危险。",
        outputSchemaName: "chapter-outline"
      }
    });

    expect(assembly.metadata).toMatchObject({
      templateId: "chapter-outline",
      templateVersion: "1.0.0",
      language: "zh-CN",
      outputSchemaName: "chapter-outline"
    });
    expect(assembly.messages).toHaveLength(2);
    expect(assembly.messages[0]).toMatchObject({ role: "system" });
    const userMessage = assembly.messages[1];
    expect(userMessage).toBeDefined();
    expect(userMessage?.content).toContain("项目简报");
    expect(userMessage?.content).toContain("沈照不能突然熟练掌控序列能力");
    expect(userMessage?.content).toContain('"chapter_promise"');
    expect(userMessage?.content).not.toContain("sk-test-secret1234567890");
    expect(assembly.promptPreview).toBeNull();
    expect({
      metadata: assembly.metadata,
      promptPreview: assembly.promptPreview,
      promptStart: userMessage?.content.split("\n").slice(0, 7)
    }).toMatchInlineSnapshot(`
      {
        "metadata": {
          "language": "zh-CN",
          "outputSchemaName": "chapter-outline",
          "skillId": "wenforge-webnovel-writer",
          "skillVersion": "1.0.0",
          "taskType": "chapter_outline",
          "templateFile": "chapter-outline.zh.md",
          "templateId": "chapter-outline",
          "templateVersion": "1.0.0",
        },
        "promptPreview": null,
        "promptStart": [
          "请为当前章节生成可执行章纲。输出必须是简体中文 JSON，字段必须匹配输出结构。",
          "",
          "项目简报：",
          "项目：霜城序列",
          "密钥 [redacted] 不应进入预览。",
          "",
          "书籍前提：",
        ],
      }
    `);
  });

  it("shows prompt preview only when privacy allows it and never shows API keys", () => {
    const service = new PromptAssemblyService(
      new PromptTemplateService(new SkillLoader({ rootDir: skillRoot }))
    );

    const hidden = service.assemble({
      templateId: "draft-chapter",
      context: fakeContext(),
      privacy: { ...DEFAULT_PRIVACY_SETTINGS, allowPromptPreview: false },
      variables: {
        targetWords: "3200",
        sceneCards: "第一场：沈照进入钟楼。",
        userInstruction: "只写正文。"
      }
    });
    const visible = service.assemble({
      templateId: "draft-chapter",
      context: fakeContext(),
      privacy: { ...DEFAULT_PRIVACY_SETTINGS, allowPromptPreview: true },
      variables: {
        targetWords: "3200",
        sceneCards: "第一场：沈照进入钟楼。",
        userInstruction: "只写正文。"
      }
    });

    expect(hidden.promptPreview).toBeNull();
    expect(visible.promptPreview).toContain("只写正文");
    expect(visible.promptPreview).not.toContain("sk-test-secret1234567890");
  });
});

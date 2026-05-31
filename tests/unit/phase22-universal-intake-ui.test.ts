import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const appSource = readFileSync(join(process.cwd(), "src/renderer/app/App.tsx"), "utf8");
const intakeSource = readFileSync(
  join(process.cwd(), "src/renderer/features/planning/UniversalIntake.tsx"),
  "utf8"
);
const focusedWriterSource = readFileSync(
  join(process.cwd(), "src/renderer/features/workflows/WorkflowGeneratePanel.tsx"),
  "utf8"
);

describe("phase 22 universal intake UI", () => {
  it("keeps the app chrome focused on the core Chinese workflow", () => {
    expect(appSource).toContain("UniversalIntake");
    expect(appSource).toContain('"intake"');
    expect(appSource).toContain('useState<WorkspaceView>("chapter")');
    expect(appSource).toContain("章节成文");
    expect(appSource).toContain("高级功能");
    expect(appSource).toContain("整理素材");
    expect(appSource).toContain("章节细纲");
    expect(appSource).toContain("设置");
    expect(appSource).not.toContain("WenForge Studio");
    expect(appSource).not.toContain("Generate mode");
    expect(appSource).not.toContain("Single Draft");
    expect(appSource).not.toContain("Compare Drafts");
    expect(appSource).not.toContain("Fuse Drafts");
  });

  it("renders chat on the left and structured planning artifacts on the right", () => {
    expect(intakeSource).toContain("整理素材");
    expect(intakeSource).toContain("chatMessages");
    expect(intakeSource).toContain("structuredArtifacts");
    expect(intakeSource).toContain("素材摘要");
    expect(intakeSource).toContain("缺失信息");
    expect(intakeSource).toContain("故事圣经草案");
    expect(intakeSource).toContain("章节细纲");
    expect(intakeSource).toContain("风险与歧义");
    expect(intakeSource).not.toContain("Universal Intake");
    expect(intakeSource).not.toContain("Material Digest");
    expect(intakeSource).not.toContain("Missing Information");
    expect(intakeSource).not.toContain("Story Bible Draft");
    expect(intakeSource).not.toContain("Chapter Detailed Outline");
    expect(intakeSource).not.toContain("More");
  });

  it("keeps guided actions human-gated and proposal based", () => {
    expect(intakeSource).toContain("自动补全缺失设定");
    expect(intakeSource).toContain("生成章节细纲");
    expect(intakeSource).toContain("确认后开始写正文");
    expect(intakeSource).toContain('status: "proposed"');
    expect(intakeSource).toContain("acceptArtifact");
    expect(intakeSource).toContain("rejectArtifact");
    expect(intakeSource).toContain("acceptedChapterPlanCount");
  });

  it("keeps the default chapter writer simple and human gated", () => {
    expect(focusedWriterSource).toContain("章节成文");
    expect(focusedWriterSource).toContain("导入设定文件");
    expect(focusedWriterSource).toContain("导入章节细纲");
    expect(focusedWriterSource).toContain("确认当前细纲");
    expect(focusedWriterSource).toContain("生成本章正文");
    expect(focusedWriterSource).toContain("保存为版本");
    expect(focusedWriterSource).toContain("设为正式正文");
    expect(focusedWriterSource).toContain("generation.focused.start");
  });
});

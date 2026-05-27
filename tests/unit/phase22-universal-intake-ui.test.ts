import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const appSource = readFileSync(join(process.cwd(), "src/renderer/app/App.tsx"), "utf8");
const intakeSource = readFileSync(
  join(process.cwd(), "src/renderer/features/planning/UniversalIntake.tsx"),
  "utf8"
);

describe("phase 22 universal intake UI", () => {
  it("exposes a first-class Universal Intake workspace from the app chrome", () => {
    expect(appSource).toContain("UniversalIntake");
    expect(appSource).toContain('"intake"');
    expect(appSource).toContain("整理素材");
  });

  it("renders chat on the left and structured planning artifacts on the right", () => {
    expect(intakeSource).toContain("Universal Intake");
    expect(intakeSource).toContain("chatMessages");
    expect(intakeSource).toContain("structuredArtifacts");
    expect(intakeSource).toContain("Material Digest");
    expect(intakeSource).toContain("Missing Information");
    expect(intakeSource).toContain("Story Bible Draft");
    expect(intakeSource).toContain("Chapter Detailed Outline");
    expect(intakeSource).toContain("Risks and Ambiguities");
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
});

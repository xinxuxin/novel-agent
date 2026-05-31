import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const workflowPanelSource = readFileSync(
  join(process.cwd(), "src/renderer/features/workflows/WorkflowGeneratePanel.tsx"),
  "utf8"
);

describe("phase 16 outline-driven generation UI", () => {
  it("makes detailed outline input the primary generation path", () => {
    expect(workflowPanelSource).toContain("导入章节细纲");
    expect(workflowPanelSource).toContain("生成本章正文");
    expect(workflowPanelSource).toContain("sourceOutline");
    expect(workflowPanelSource).toContain("allowStoryChanges");
    expect(workflowPanelSource).toContain("desiredOutput");
  });

  it("explains that generated output is proposed until the user saves it", () => {
    expect(workflowPanelSource).toContain("终稿候选");
    expect(workflowPanelSource).toContain("保存为版本");
    expect(workflowPanelSource).toContain("设为正式正文");
  });

  it("supports dragged outline files and a visible live workflow", () => {
    expect(workflowPanelSource).toContain("importOutlineFiles");
    expect(workflowPanelSource).toContain("onDrop={handleOutlineDrop}");
    expect(workflowPanelSource).toContain("读取细纲");
    expect(workflowPanelSource).toContain("起草正文");
    expect(workflowPanelSource).toContain("核对正史");
    expect(workflowPanelSource).toContain("润色去味");
    expect(workflowPanelSource).toContain("终检");
    expect(workflowPanelSource).toContain("人工确认");
  });
});

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const workflowPanelSource = readFileSync(
  join(process.cwd(), "src/renderer/features/workflows/WorkflowGeneratePanel.tsx"),
  "utf8"
);

describe("phase 16 outline-driven generation UI", () => {
  it("makes detailed outline input the primary generation path", () => {
    expect(workflowPanelSource).toContain("Detailed chapter outline");
    expect(workflowPanelSource).toContain("Generate final manuscript from outline");
    expect(workflowPanelSource).toContain("sourceOutline");
    expect(workflowPanelSource).toContain("allowStoryChanges");
    expect(workflowPanelSource).toContain("desiredOutput");
  });

  it("explains that generated output is proposed until the user saves it", () => {
    expect(workflowPanelSource).toContain("Final proposed manuscript");
    expect(workflowPanelSource).toContain("Save as manuscript version");
    expect(workflowPanelSource).toContain("No canonical manuscript will be overwritten");
  });
});

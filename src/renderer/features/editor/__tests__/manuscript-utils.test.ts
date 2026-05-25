import { describe, expect, it } from "vitest";

import {
  countChineseCharacters,
  countParagraphs,
  createSimpleDiff,
  estimateManuscriptTokens,
  manuscriptStats
} from "@features/editor/manuscript-utils";

describe("manuscript utilities", () => {
  it("counts Chinese characters separately from Latin text and punctuation", () => {
    expect(countChineseCharacters("雨声落在窗沿，Lin checked the map.")).toBe(6);
  });

  it("counts non-empty manuscript paragraphs", () => {
    expect(countParagraphs("第一段\n\n   \n第二段\n第三段")).toBe(3);
  });

  it("estimates tokens conservatively for Chinese long-form text", () => {
    const stats = manuscriptStats("林澈推开门。\n\nThe signal flickered.");

    expect(stats.chineseCharacters).toBe(5);
    expect(stats.paragraphs).toBe(2);
    expect(stats.estimatedTokens).toBe(estimateManuscriptTokens(stats.plaintext));
    expect(stats.estimatedTokens).toBeGreaterThanOrEqual(stats.chineseCharacters);
  });

  it("creates a stable line diff for version comparison", () => {
    expect(createSimpleDiff("第一行\n第二行", "第一行\n新的第二行\n第三行")).toEqual([
      { kind: "unchanged", text: "第一行" },
      { kind: "removed", text: "第二行" },
      { kind: "added", text: "新的第二行" },
      { kind: "added", text: "第三行" }
    ]);
  });
});

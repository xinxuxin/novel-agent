import { describe, expect, it } from "vitest";

import { DEFAULT_WINDOW_BOUNDS, normalizeWindowBounds } from "@main/app/window-state";

describe("window state", () => {
  it("uses the popover studio default size", () => {
    expect(DEFAULT_WINDOW_BOUNDS).toMatchObject({ width: 1180, height: 760 });
  });

  it("guards persisted bounds against unusable values", () => {
    expect(normalizeWindowBounds({ width: 100, height: 20 })).toMatchObject({
      width: 860,
      height: 560
    });
    expect(normalizeWindowBounds({ x: Number.NaN, y: 12, width: 1200, height: 800 })).toEqual({
      y: 12,
      width: 1200,
      height: 800
    });
  });
});

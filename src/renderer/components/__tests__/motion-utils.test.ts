import { describe, expect, it } from "vitest";

import { panelMotionProps, progressMotionProps } from "@components/motion-utils";

describe("reduced motion helpers", () => {
  it("removes transform-heavy panel motion when reduced motion is preferred", () => {
    const props = panelMotionProps(true);

    expect(props.initial).toBe(false);
    expect(props.transition.duration).toBe(0);
    expect(JSON.stringify(props)).not.toContain("scale");
  });

  it("keeps subtle panel motion available when allowed", () => {
    const props = panelMotionProps(false);

    expect(props.initial).toEqual({ opacity: 0, y: 8 });
    expect(props.animate).toEqual({ opacity: 1, y: 0 });
  });

  it("uses static progress bars in reduced motion mode", () => {
    expect(progressMotionProps(true, 62).animate).toEqual({ width: "62%" });
    expect(progressMotionProps(true, 62).transition.duration).toBe(0);
  });
});

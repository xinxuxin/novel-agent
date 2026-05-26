import { describe, expect, it } from "vitest";

import { buildMainWindowOptions } from "@main/app/window";

describe("main window visibility", () => {
  it("uses an opaque dark window background so the studio is readable over the desktop", () => {
    const options = buildMainWindowOptions(
      { width: 1180, height: 760, x: 80, y: 80 },
      "/tmp/preload.js"
    );

    expect(options.transparent).toBe(false);
    expect(options.backgroundColor).toBe("#070a12");
  });
});

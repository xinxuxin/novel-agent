import { readFileSync } from "node:fs";
import { join } from "node:path";
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
    expect(options.show).toBe(true);
  });

  it("has a fallback reveal path when ready-to-show does not fire", () => {
    const source = readFileSync(join(process.cwd(), "src/main/app/window.ts"), "utf8");

    expect(source).toContain("did-finish-load");
    expect(source).toContain("setTimeout(reveal, 1500)");
  });
});

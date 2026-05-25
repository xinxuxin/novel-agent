import { describe, expect, it } from "vitest";

import { DEFAULT_THEME, normalizeTheme } from "@shared/theme";

describe("theme settings", () => {
  it("defaults to dark and rejects unsupported values", () => {
    expect(DEFAULT_THEME).toBe("dark");
    expect(normalizeTheme(undefined)).toBe("dark");
    expect(normalizeTheme("solarized")).toBe("dark");
  });

  it("accepts supported theme values", () => {
    expect(normalizeTheme("light")).toBe("light");
    expect(normalizeTheme("dark")).toBe("dark");
    expect(normalizeTheme("system")).toBe("system");
  });
});

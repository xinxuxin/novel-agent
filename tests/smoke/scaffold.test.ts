import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("phase 1 scaffold", () => {
  it("keeps secure Electron renderer defaults in source", () => {
    const source = readFileSync("src/main/app/window.ts", "utf8");

    expect(source).toContain("nodeIntegration: false");
    expect(source).toContain("contextIsolation: true");
    expect(source).toContain("sandbox: true");
    expect(source).toContain("webSecurity: true");
    expect(source).toContain("frame: false");
  });

  it("declares all required path aliases", () => {
    const tsconfig = readFileSync("tsconfig.json", "utf8");

    for (const alias of [
      "@main/*",
      "@preload/*",
      "@renderer/*",
      "@shared/*",
      "@components/*",
      "@features/*",
      "@contracts/*"
    ]) {
      expect(tsconfig).toContain(alias);
    }
  });

  it("keeps reference repos ignored", () => {
    const gitignore = readFileSync(".gitignore", "utf8");

    expect(gitignore).toContain("references/repos/");
  });
});

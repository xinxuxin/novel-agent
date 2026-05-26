import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const appSource = readFileSync(join(process.cwd(), "src/renderer/app/App.tsx"), "utf8");
const settingsSource = readFileSync(
  join(process.cwd(), "src/renderer/features/settings/SettingsPanel.tsx"),
  "utf8"
);

describe("phase 16 shell and settings clarity", () => {
  it("defaults the chapter workspace to the Generate tab", () => {
    expect(appSource).toContain('useState<WorkspaceTab>("generate")');
  });

  it("keeps API key setup explicit and encrypted in Settings", () => {
    expect(settingsSource).toContain("API Key");
    expect(settingsSource).toContain("加密凭据库");
    expect(settingsSource).toContain("redacted");
    expect(settingsSource).toContain("credential status");
    expect(settingsSource).not.toContain("plaintext API key");
  });
});

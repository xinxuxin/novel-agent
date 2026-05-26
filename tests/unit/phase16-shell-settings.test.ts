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
    expect(settingsSource).toContain("API keys");
    expect(settingsSource).toContain("encrypted credential store");
    expect(settingsSource).toContain("renderer only sees redacted credential status");
    expect(settingsSource).not.toContain("plaintext API key");
  });
});

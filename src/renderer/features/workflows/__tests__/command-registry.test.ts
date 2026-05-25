import { describe, expect, it } from "vitest";

import {
  REQUIRED_COMMAND_IDS,
  filterCommands,
  getCommandById
} from "@features/workflows/command-registry";

describe("studio command registry", () => {
  it("contains the required Phase 5 commands", () => {
    for (const commandId of REQUIRED_COMMAND_IDS) {
      expect(getCommandById(commandId), commandId).toBeDefined();
    }
  });

  it("filters commands by label, keywords, and section", () => {
    expect(filterCommands("draft").map((command) => command.id)).toContain("draft-chapter");
    expect(filterCommands("cost").map((command) => command.id)).toContain("show-cost-dashboard");
    expect(filterCommands("版本").map((command) => command.id)).toContain(
      "save-manuscript-version"
    );
  });

  it("keeps destructive commands explicit", () => {
    expect(getCommandById("set-canonical")?.requiresConfirmation).toBe(true);
  });
});

import { describe, expect, it } from "vitest";

import {
  COMMAND_CATEGORIES,
  REQUIRED_COMMAND_IDS,
  filterCommands,
  getCommandById,
  resolveCommandPalette
} from "@features/workflows/command-registry";

describe("studio command registry", () => {
  it("contains the required Phase 5 commands", () => {
    for (const commandId of REQUIRED_COMMAND_IDS) {
      expect(getCommandById(commandId), commandId).toBeDefined();
    }
  });

  it("uses the Phase 13 command categories", () => {
    expect(COMMAND_CATEGORIES).toEqual([
      "Project",
      "Chapter",
      "Generation",
      "Review",
      "Story Bible",
      "Cost",
      "Settings"
    ]);
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

  it("supports fuzzy ranking and recent actions", () => {
    const fuzzy = resolveCommandPalette({
      query: "drft ch",
      context: { hasProject: true, hasBook: true, hasChapter: true }
    });
    expect(fuzzy[0]?.command.id).toBe("draft-chapter");

    const recent = resolveCommandPalette({
      query: "",
      recentCommandIds: ["open-settings", "draft-chapter"],
      context: { hasProject: true, hasBook: true, hasChapter: true }
    });
    expect(recent.slice(0, 2).map((item) => item.command.id)).toEqual([
      "open-settings",
      "draft-chapter"
    ]);
    expect(recent[0]?.recent).toBe(true);
  });

  it("marks scoped chapter commands disabled when no chapter is selected", () => {
    const items = resolveCommandPalette({
      query: "canonical",
      context: { hasProject: true, hasBook: true, hasChapter: false }
    });

    const canonical = items.find((item) => item.command.id === "set-canonical");
    expect(canonical?.disabledReason).toMatch(/chapter/i);
  });
});

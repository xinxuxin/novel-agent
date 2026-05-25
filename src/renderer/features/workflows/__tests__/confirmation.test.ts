import { describe, expect, it, vi } from "vitest";

import { confirmDestructiveAction, runDestructiveAction } from "@features/workflows/confirmation";

describe("destructive action confirmation", () => {
  it("returns false when the user cancels", () => {
    expect(confirmDestructiveAction("Set canonical?", () => false)).toBe(false);
  });

  it("runs the action only after confirmation", async () => {
    const action = vi.fn(async () => "done");

    await expect(runDestructiveAction("Rollback?", () => false, action)).resolves.toBeNull();
    expect(action).not.toHaveBeenCalled();

    await expect(runDestructiveAction("Rollback?", () => true, action)).resolves.toBe("done");
    expect(action).toHaveBeenCalledTimes(1);
  });
});

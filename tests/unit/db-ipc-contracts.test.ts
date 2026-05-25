import { describe, expect, it } from "vitest";

import { executeIpcContract } from "@main/ipc/typed-ipc";
import { IPC_CONTRACTS } from "@shared/ipc/contracts";

describe("database IPC contracts", () => {
  it("rejects invalid project creation payloads before they reach repositories", async () => {
    const result = await executeIpcContract(
      IPC_CONTRACTS.projects.create,
      async () => {
        throw new Error("handler should not run");
      },
      { name: "" }
    );

    expect(result).toEqual({
      ok: false,
      error: {
        code: "VALIDATION_FAILED",
        message: "Invalid IPC payload"
      }
    });
  });
});

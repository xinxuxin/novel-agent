import { describe, expect, it } from "vitest";

import { SafeIpcError, executeIpcContract, mapToSafeIpcError } from "@main/ipc/typed-ipc";
import { IPC_CONTRACTS } from "@shared/ipc/contracts";

describe("typed IPC contracts", () => {
  it("validates request and response payloads with Zod schemas", async () => {
    const result = await executeIpcContract(
      IPC_CONTRACTS.settings.setTheme,
      async (request) => request.theme,
      { theme: "dark" }
    );

    expect(result).toEqual({ ok: true, data: "dark" });
  });

  it("rejects invalid request payloads with a safe error envelope", async () => {
    const result = await executeIpcContract(
      IPC_CONTRACTS.settings.setTheme,
      async (request) => request.theme,
      { theme: "solarized" }
    );

    expect(result).toEqual({
      ok: false,
      error: {
        code: "VALIDATION_FAILED",
        message: "Invalid IPC payload"
      }
    });
  });

  it("maps thrown errors without leaking implementation details", () => {
    expect(mapToSafeIpcError(new SafeIpcError("NOT_FOUND", "Chapter not found"))).toEqual({
      code: "NOT_FOUND",
      message: "Chapter not found"
    });

    expect(
      mapToSafeIpcError(new Error("database path /private/tmp/wenforge.sqlite failed"))
    ).toEqual({
      code: "INTERNAL_ERROR",
      message: "Something went wrong"
    });
  });
});

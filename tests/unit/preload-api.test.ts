import { describe, expect, it } from "vitest";

import { createPreloadApi } from "../../src/preload/api";
import { IPC_CONTRACTS } from "@shared/ipc/contracts";

describe("preload API", () => {
  it("exposes only the narrow WenForge bridge", async () => {
    const calls: string[] = [];
    const api = createPreloadApi(async (channel, value) => {
      calls.push(channel);
      if (channel === IPC_CONTRACTS.app.getVersion.channel) return { ok: true, data: "0.1.0" };
      if (channel === IPC_CONTRACTS.app.getPlatform.channel) return { ok: true, data: "darwin" };
      if (channel === IPC_CONTRACTS.app.getEnvironment.channel) {
        return { ok: true, data: { mode: "test", packaged: false } };
      }
      if (channel === IPC_CONTRACTS.settings.getTheme.channel) return { ok: true, data: "dark" };
      if (channel === IPC_CONTRACTS.settings.setTheme.channel) {
        return { ok: true, data: (value as { theme: string }).theme };
      }
      if (channel === IPC_CONTRACTS.diagnostics.ping.channel) {
        return { ok: true, data: { ok: true, at: "2026-05-25T00:00:00.000Z" } };
      }
      if (channel === IPC_CONTRACTS.diagnostics.exportBundle.channel) {
        return {
          ok: true,
          data: {
            appVersion: "0.1.0",
            platform: "darwin",
            environment: "test",
            dbMigrationVersion: "0000_initial_wenforge_schema",
            safeStorageAvailable: true,
            providerHealth: [],
            recentErrors: [],
            logs: [],
            settings: {},
            manuscriptsIncluded: false,
            createdAt: "2026-05-25T00:00:00.000Z"
          }
        };
      }
      if (channel === IPC_CONTRACTS.window.minimize.channel) return { ok: true };
      if (channel === IPC_CONTRACTS.window.close.channel) return { ok: true };
      if (channel === IPC_CONTRACTS.window.toggleStudioMode.channel) {
        return { ok: true, data: "popover" };
      }
      return { ok: false, error: { code: "NOT_FOUND", message: "Missing test endpoint" } };
    });

    expect(Object.keys(api).sort()).toEqual([
      "ai",
      "app",
      "backup",
      "books",
      "budgets",
      "chapters",
      "context",
      "costs",
      "credentials",
      "crossCheck",
      "diagnostics",
      "eval",
      "export",
      "generation",
      "import",
      "manuscript",
      "manuscripts",
      "memory",
      "modelPrices",
      "modelProfiles",
      "modelRoutes",
      "pricing",
      "privacy",
      "projects",
      "providerHealth",
      "providerSmoke",
      "reviews",
      "routingSettings",
      "settings",
      "settlement",
      "storyBible",
      "taskRoutes",
      "volumes",
      "window"
    ]);
    expect(Object.keys(api.app).sort()).toEqual(["getEnvironment", "getPlatform", "getVersion"]);
    expect(Object.keys(api.window).sort()).toEqual(["close", "minimize", "toggleStudioMode"]);
    expect(Object.keys(api.settings).sort()).toEqual(["getTheme", "setTheme"]);
    expect(Object.keys(api.diagnostics).sort()).toEqual(["exportBundle", "ping"]);
    expect(Object.keys(api.providerSmoke).sort()).toEqual(["report", "run", "runAll"]);
    expect(Object.keys(api.crossCheck).sort()).toEqual(["run"]);
    expect(await api.app.getVersion()).toBe("0.1.0");
    expect(await api.app.getPlatform()).toBe("darwin");
    expect(await api.app.getEnvironment()).toEqual({ mode: "test", packaged: false });
    expect(await api.settings.setTheme("dark")).toBe("dark");
    expect(await api.window.toggleStudioMode()).toBe("popover");
    expect(await api.diagnostics.ping()).toEqual({ ok: true, at: "2026-05-25T00:00:00.000Z" });
    expect(await api.diagnostics.exportBundle()).toMatchObject({
      appVersion: "0.1.0",
      manuscriptsIncluded: false
    });
    expect(calls).toContain(IPC_CONTRACTS.app.getVersion.channel);
    expect(calls).toContain(IPC_CONTRACTS.settings.setTheme.channel);
  });

  it("throws a safe renderer error when main returns an IPC failure envelope", async () => {
    const api = createPreloadApi(async () => ({
      ok: false,
      error: { code: "VALIDATION_FAILED", message: "Invalid request payload" }
    }));

    await expect(api.diagnostics.ping()).rejects.toMatchObject({
      code: "VALIDATION_FAILED",
      message: "Invalid request payload"
    });
  });
});

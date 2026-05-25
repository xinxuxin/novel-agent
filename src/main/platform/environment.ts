import type { App } from "electron";

import type { WenForgeEnvironment } from "@contracts/preload";

export function getEnvironment(app: App): WenForgeEnvironment {
  if (process.env.NODE_ENV === "test") {
    return { mode: "test", packaged: app.isPackaged };
  }

  if (app.isPackaged) {
    return { mode: "production", packaged: true };
  }

  return { mode: "development", packaged: false };
}

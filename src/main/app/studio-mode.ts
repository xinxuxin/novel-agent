import type { BrowserWindow } from "electron";

import type { StudioMode } from "@contracts/preload";
import { DEFAULT_WINDOW_BOUNDS, POPOVER_WINDOW_BOUNDS } from "./window-state";
import type { WindowBounds } from "./window-state";

export class StudioModeController {
  private mode: StudioMode = "studio";
  private lastStudioBounds: WindowBounds = DEFAULT_WINDOW_BOUNDS;

  constructor(private readonly mainWindow: BrowserWindow) {}

  getMode(): StudioMode {
    return this.mode;
  }

  toggle(sourceWindow = this.mainWindow): StudioMode {
    if (sourceWindow.isDestroyed()) {
      return this.mode;
    }

    if (this.mode === "studio") {
      this.lastStudioBounds = sourceWindow.getBounds();
      sourceWindow.setMinimumSize(420, 520);
      sourceWindow.setBounds({ ...sourceWindow.getBounds(), ...POPOVER_WINDOW_BOUNDS }, true);
      this.mode = "popover";
      return this.mode;
    }

    sourceWindow.setMinimumSize(860, 560);
    sourceWindow.setBounds(this.lastStudioBounds, true);
    this.mode = "studio";
    return this.mode;
  }
}

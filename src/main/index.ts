import { BrowserWindow, app } from "electron";
import { join } from "node:path";

import { SettingsStore } from "@main/app/settings-store";
import { StudioModeController } from "@main/app/studio-mode";
import { createAppTray } from "@main/app/tray";
import { createMainWindow } from "@main/app/window";
import { registerIpc } from "@main/ipc/register";

const hasSingleInstanceLock = app.requestSingleInstanceLock();

if (!hasSingleInstanceLock) {
  app.quit();
} else {
  let mainWindow: BrowserWindow | null = null;

  app.on("second-instance", () => {
    if (!mainWindow) {
      return;
    }

    if (mainWindow.isMinimized()) {
      mainWindow.restore();
    }

    mainWindow.show();
    mainWindow.focus();
  });

  app.whenReady().then(async () => {
    const settingsStore = new SettingsStore(join(app.getPath("userData"), "settings.json"));
    mainWindow = await createMainWindow();
    const studioModeController = new StudioModeController(mainWindow);
    registerIpc({ settingsStore, studioModeController });

    if (process.env.NODE_ENV !== "test") {
      createAppTray(mainWindow);
    }

    app.on("activate", async () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        mainWindow = await createMainWindow();
      }
    });
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
      app.quit();
    }
  });
}

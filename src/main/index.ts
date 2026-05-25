import { BrowserWindow, app } from "electron";
import { join } from "node:path";

import { SettingsStore } from "@main/app/settings-store";
import { StudioModeController } from "@main/app/studio-mode";
import { createAppTray } from "@main/app/tray";
import { createMainWindow } from "@main/app/window";
import { createAppDatabaseService } from "@main/db/service";
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
    const databaseService = createAppDatabaseService(app);
    const openMainWindow = async (): Promise<BrowserWindow> => {
      const window = await createMainWindow((createdWindow) => {
        const studioModeController = new StudioModeController(createdWindow);
        registerIpc({
          settingsStore,
          studioModeController,
          repositories: databaseService.repositories
        });
      });
      mainWindow = window;
      return window;
    };

    const initialWindow = await openMainWindow();

    if (process.env.NODE_ENV !== "test") {
      createAppTray(initialWindow);
    }

    app.on("activate", async () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        await openMainWindow();
      }
    });

    app.on("before-quit", () => {
      databaseService.connection.sqlite.close();
    });
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
      app.quit();
    }
  });
}

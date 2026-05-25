import { BrowserWindow, app } from "electron";
import { join } from "node:path";

import { isAllowedAppNavigation, openValidatedExternalUrl } from "@main/security/navigation";
import { normalizeWindowBounds, readWindowBounds, writeWindowBounds } from "./window-state";

export async function createMainWindow(): Promise<BrowserWindow> {
  const windowStatePath = join(app.getPath("userData"), "window-state.json");
  const bounds = readWindowBounds(windowStatePath);
  const mainWindow = new BrowserWindow({
    ...bounds,
    minWidth: 860,
    minHeight: 560,
    show: false,
    frame: false,
    transparent: true,
    backgroundColor: "#00000000",
    title: "WenForge Studio",
    trafficLightPosition: { x: 18, y: 18 },
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      sandbox: true,
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true
    }
  });

  let saveTimer: NodeJS.Timeout | undefined;
  const scheduleBoundsSave = (): void => {
    if (saveTimer) {
      clearTimeout(saveTimer);
    }

    saveTimer = setTimeout(() => {
      if (!mainWindow.isDestroyed()) {
        writeWindowBounds(windowStatePath, normalizeWindowBounds(mainWindow.getBounds()));
      }
    }, 250);
  };

  mainWindow.on("ready-to-show", () => {
    mainWindow.show();
  });
  mainWindow.on("resize", scheduleBoundsSave);
  mainWindow.on("move", scheduleBoundsSave);
  mainWindow.on("close", () => {
    writeWindowBounds(windowStatePath, normalizeWindowBounds(mainWindow.getBounds()));
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void openValidatedExternalUrl(url);
    return { action: "deny" };
  });

  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (!isAllowedAppNavigation(url, mainWindow.webContents.getURL())) {
      event.preventDefault();
    }
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    await mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    await mainWindow.loadFile(join(__dirname, "../renderer/index.html"));
  }

  return mainWindow;
}

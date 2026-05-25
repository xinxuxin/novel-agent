import { BrowserWindow, app, ipcMain } from "electron";

import { IPC_CONTRACT_LIST, IPC_CONTRACTS } from "@shared/ipc/contracts";
import { normalizeTheme } from "@shared/theme";
import type { SettingsStore } from "@main/app/settings-store";
import type { StudioModeController } from "@main/app/studio-mode";
import { getEnvironment } from "@main/platform/environment";
import { registerIpcContract } from "./typed-ipc";

interface RegisterIpcOptions {
  settingsStore: SettingsStore;
  studioModeController: StudioModeController;
}

export function registerIpc({ settingsStore, studioModeController }: RegisterIpcOptions): void {
  for (const contract of IPC_CONTRACT_LIST) {
    ipcMain.removeHandler(contract.channel);
  }

  registerIpcContract(IPC_CONTRACTS.app.getVersion, () => app.getVersion());
  registerIpcContract(IPC_CONTRACTS.app.getPlatform, () => process.platform);
  registerIpcContract(IPC_CONTRACTS.app.getEnvironment, () => getEnvironment(app));

  registerIpcContract(IPC_CONTRACTS.window.minimize, (_request, event) => {
    BrowserWindow.fromWebContents(event.sender)?.minimize();
    return undefined;
  });

  registerIpcContract(IPC_CONTRACTS.window.close, (_request, event) => {
    BrowserWindow.fromWebContents(event.sender)?.close();
    return undefined;
  });

  registerIpcContract(IPC_CONTRACTS.window.toggleStudioMode, (_request, event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    return studioModeController.toggle(window ?? undefined);
  });

  registerIpcContract(IPC_CONTRACTS.settings.getTheme, () => settingsStore.getTheme());
  registerIpcContract(IPC_CONTRACTS.settings.setTheme, (request) =>
    settingsStore.setTheme(normalizeTheme(request.theme))
  );

  registerIpcContract(IPC_CONTRACTS.diagnostics.ping, () => ({
    ok: true as const,
    at: new Date().toISOString()
  }));
}

import { BrowserWindow, Menu, Tray, nativeImage } from "electron";

let tray: Tray | null = null;

export function createAppTray(mainWindow: BrowserWindow): Tray | null {
  if (tray) {
    return tray;
  }

  const svg = encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18">
      <rect width="18" height="18" rx="5" fill="#141720"/>
      <path d="M5 5h8v2H7v2h5v2H7v2h6v2H5z" fill="#75a7ff"/>
    </svg>
  `);
  const icon = nativeImage.createFromDataURL(`data:image/svg+xml;charset=utf-8,${svg}`);

  if (icon.isEmpty()) {
    return null;
  }

  tray = new Tray(icon);
  tray.setToolTip("WenForge Studio");
  tray.setContextMenu(
    Menu.buildFromTemplate([
      {
        label: "Show WenForge Studio",
        click: () => {
          mainWindow.show();
          mainWindow.focus();
        }
      },
      {
        label: "Hide",
        click: () => mainWindow.hide()
      }
    ])
  );
  tray.on("click", () => {
    if (mainWindow.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow.show();
      mainWindow.focus();
    }
  });

  return tray;
}

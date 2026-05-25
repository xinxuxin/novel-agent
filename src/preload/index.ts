import { contextBridge, ipcRenderer } from "electron";

import { createPreloadApi } from "./api";

contextBridge.exposeInMainWorld("wenforge", createPreloadApi(ipcRenderer.invoke.bind(ipcRenderer)));

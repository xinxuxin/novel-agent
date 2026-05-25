import { resolve } from "node:path";

import react from "@vitejs/plugin-react";
import { defineConfig, externalizeDepsPlugin } from "electron-vite";

const alias = {
  "@app": resolve("src/renderer/app"),
  "@main": resolve("src/main"),
  "@preload": resolve("src/preload"),
  "@renderer": resolve("src/renderer"),
  "@shared": resolve("src/shared"),
  "@components": resolve("src/renderer/components"),
  "@features": resolve("src/renderer/features"),
  "@contracts": resolve("src/shared/contracts"),
  "@db": resolve("src/db"),
  "@ai": resolve("src/ai"),
  "@agents": resolve("src/agents"),
  "@ui": resolve("src/renderer/components")
};

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    resolve: { alias }
  },
  preload: {
    plugins: [],
    resolve: { alias },
    build: {
      rollupOptions: {
        output: {
          format: "cjs",
          entryFileNames: "[name].js"
        }
      }
    }
  },
  renderer: {
    root: "src/renderer",
    plugins: [react()],
    resolve: { alias }
  }
});

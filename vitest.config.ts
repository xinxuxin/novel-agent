import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  resolve: {
    alias: {
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
    }
  },
  test: {
    environment: "node",
    globals: true,
    include: ["tests/**/*.test.ts", "src/**/*.test.ts"],
    exclude: ["references/repos/**", "node_modules/**", "out/**", "dist/**"]
  }
});

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import { DEFAULT_THEME, normalizeTheme } from "@shared/theme";
import type { ThemePreference } from "@shared/theme";

interface SettingsFile {
  theme?: ThemePreference;
}

export class SettingsStore {
  constructor(private readonly filePath: string) {}

  getTheme(): ThemePreference {
    return normalizeTheme(this.read().theme);
  }

  setTheme(theme: ThemePreference): ThemePreference {
    const normalized = normalizeTheme(theme);
    this.write({ ...this.read(), theme: normalized });
    return normalized;
  }

  private read(): SettingsFile {
    if (!existsSync(this.filePath)) {
      return { theme: DEFAULT_THEME };
    }

    try {
      return JSON.parse(readFileSync(this.filePath, "utf8")) as SettingsFile;
    } catch {
      return { theme: DEFAULT_THEME };
    }
  }

  private write(settings: SettingsFile): void {
    mkdirSync(dirname(this.filePath), { recursive: true });
    writeFileSync(this.filePath, JSON.stringify(settings, null, 2));
  }
}

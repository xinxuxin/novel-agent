export const THEMES = ["dark", "light", "system"] as const;

export type ThemePreference = (typeof THEMES)[number];

export const DEFAULT_THEME: ThemePreference = "dark";

export function normalizeTheme(value: unknown): ThemePreference {
  return THEMES.includes(value as ThemePreference) ? (value as ThemePreference) : DEFAULT_THEME;
}

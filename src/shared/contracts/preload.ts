import type { ThemePreference } from "@shared/theme";

export type WenForgePlatform =
  | "aix"
  | "android"
  | "darwin"
  | "freebsd"
  | "haiku"
  | "linux"
  | "openbsd"
  | "sunos"
  | "win32"
  | "cygwin"
  | "netbsd";

export type WenForgeEnvironmentMode = "development" | "test" | "production";

export type StudioMode = "studio" | "popover";

export interface WenForgeEnvironment {
  mode: WenForgeEnvironmentMode;
  packaged: boolean;
}

export interface DiagnosticPing {
  ok: true;
  at: string;
}

export interface WenForgeApi {
  app: {
    getVersion: () => Promise<string>;
    getPlatform: () => Promise<WenForgePlatform>;
    getEnvironment: () => Promise<WenForgeEnvironment>;
  };
  window: {
    minimize: () => Promise<void>;
    close: () => Promise<void>;
    toggleStudioMode: () => Promise<StudioMode>;
  };
  settings: {
    getTheme: () => Promise<ThemePreference>;
    setTheme: (theme: ThemePreference) => Promise<ThemePreference>;
  };
  diagnostics: {
    ping: () => Promise<DiagnosticPing>;
  };
}

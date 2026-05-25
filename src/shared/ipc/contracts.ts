import { z } from "zod";

export const themePreferenceSchema = z.enum(["dark", "light", "system"]);
export const platformSchema = z.enum([
  "aix",
  "android",
  "darwin",
  "freebsd",
  "haiku",
  "linux",
  "openbsd",
  "sunos",
  "win32",
  "cygwin",
  "netbsd"
]);
export const studioModeSchema = z.enum(["studio", "popover"]);
export const environmentSchema = z.object({
  mode: z.enum(["development", "test", "production"]),
  packaged: z.boolean()
});
export const diagnosticPingSchema = z.object({
  ok: z.literal(true),
  at: z.string()
});

export const safeIpcErrorSchema = z.object({
  code: z.string().min(1),
  message: z.string().min(1)
});

export const ipcEnvelopeSchema = z.discriminatedUnion("ok", [
  z.object({
    ok: z.literal(true),
    data: z.unknown().optional()
  }),
  z.object({
    ok: z.literal(false),
    error: safeIpcErrorSchema
  })
]);

export type SafeIpcErrorShape = z.infer<typeof safeIpcErrorSchema>;
export type IpcEnvelope = z.infer<typeof ipcEnvelopeSchema>;

export interface IpcContract<RequestSchema extends z.ZodType, ResponseSchema extends z.ZodType> {
  channel: string;
  request: RequestSchema;
  response: ResponseSchema;
}

function createContract<RequestSchema extends z.ZodType, ResponseSchema extends z.ZodType>(
  channel: string,
  request: RequestSchema,
  response: ResponseSchema
): IpcContract<RequestSchema, ResponseSchema> {
  return { channel, request, response };
}

const emptyRequestSchema = z.undefined();

export const IPC_CONTRACTS = {
  app: {
    getVersion: createContract("app:get-version", emptyRequestSchema, z.string()),
    getPlatform: createContract("app:get-platform", emptyRequestSchema, platformSchema),
    getEnvironment: createContract("app:get-environment", emptyRequestSchema, environmentSchema)
  },
  window: {
    minimize: createContract("window:minimize", emptyRequestSchema, z.undefined()),
    close: createContract("window:close", emptyRequestSchema, z.undefined()),
    toggleStudioMode: createContract(
      "window:toggle-studio-mode",
      emptyRequestSchema,
      studioModeSchema
    )
  },
  settings: {
    getTheme: createContract("settings:get-theme", emptyRequestSchema, themePreferenceSchema),
    setTheme: createContract(
      "settings:set-theme",
      z.object({ theme: themePreferenceSchema }),
      themePreferenceSchema
    )
  },
  diagnostics: {
    ping: createContract("diagnostics:ping", emptyRequestSchema, diagnosticPingSchema)
  }
} as const;

export const IPC_CONTRACT_LIST = [
  IPC_CONTRACTS.app.getVersion,
  IPC_CONTRACTS.app.getPlatform,
  IPC_CONTRACTS.app.getEnvironment,
  IPC_CONTRACTS.window.minimize,
  IPC_CONTRACTS.window.close,
  IPC_CONTRACTS.window.toggleStudioMode,
  IPC_CONTRACTS.settings.getTheme,
  IPC_CONTRACTS.settings.setTheme,
  IPC_CONTRACTS.diagnostics.ping
] as const;

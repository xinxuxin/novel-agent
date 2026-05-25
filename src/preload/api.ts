import type { WenForgeApi } from "@contracts/preload";
import { IPC_CONTRACTS, ipcEnvelopeSchema } from "@shared/ipc/contracts";
import { normalizeTheme } from "@shared/theme";
import type { ThemePreference } from "@shared/theme";
import type { z } from "zod";

export type IpcInvoker = (channel: string, value?: unknown) => Promise<unknown>;

class WenForgeIpcError extends Error {
  constructor(
    public readonly code: string,
    message: string
  ) {
    super(message);
    this.name = "WenForgeIpcError";
  }
}

async function invokeContract<ResponseSchema extends z.ZodType>(
  invoke: IpcInvoker,
  channel: string,
  responseSchema: ResponseSchema,
  payload?: unknown
): Promise<z.output<ResponseSchema>> {
  const envelope = ipcEnvelopeSchema.parse(await invoke(channel, payload));

  if (!envelope.ok) {
    throw new WenForgeIpcError(envelope.error.code, envelope.error.message);
  }

  return responseSchema.parse(envelope.data);
}

export function createPreloadApi(invoke: IpcInvoker): WenForgeApi {
  return {
    app: {
      getVersion: () =>
        invokeContract(
          invoke,
          IPC_CONTRACTS.app.getVersion.channel,
          IPC_CONTRACTS.app.getVersion.response
        ),
      getPlatform: () =>
        invokeContract(
          invoke,
          IPC_CONTRACTS.app.getPlatform.channel,
          IPC_CONTRACTS.app.getPlatform.response
        ),
      getEnvironment: () =>
        invokeContract(
          invoke,
          IPC_CONTRACTS.app.getEnvironment.channel,
          IPC_CONTRACTS.app.getEnvironment.response
        )
    },
    window: {
      minimize: async () => {
        await invokeContract(
          invoke,
          IPC_CONTRACTS.window.minimize.channel,
          IPC_CONTRACTS.window.minimize.response
        );
      },
      close: async () => {
        await invokeContract(
          invoke,
          IPC_CONTRACTS.window.close.channel,
          IPC_CONTRACTS.window.close.response
        );
      },
      toggleStudioMode: () =>
        invokeContract(
          invoke,
          IPC_CONTRACTS.window.toggleStudioMode.channel,
          IPC_CONTRACTS.window.toggleStudioMode.response
        )
    },
    settings: {
      getTheme: async () =>
        normalizeTheme(
          await invokeContract(
            invoke,
            IPC_CONTRACTS.settings.getTheme.channel,
            IPC_CONTRACTS.settings.getTheme.response
          )
        ),
      setTheme: async (theme: ThemePreference) =>
        normalizeTheme(
          await invokeContract(
            invoke,
            IPC_CONTRACTS.settings.setTheme.channel,
            IPC_CONTRACTS.settings.setTheme.response,
            { theme: normalizeTheme(theme) }
          )
        )
    },
    diagnostics: {
      ping: () =>
        invokeContract(
          invoke,
          IPC_CONTRACTS.diagnostics.ping.channel,
          IPC_CONTRACTS.diagnostics.ping.response
        )
    }
  };
}

export { IPC_CONTRACTS };

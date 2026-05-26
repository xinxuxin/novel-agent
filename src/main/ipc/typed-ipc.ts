import { ipcMain } from "electron";
import { ZodError, type z } from "zod";

import { normalizeOperationalError } from "@shared/errors/error-normalizer";
import type { IpcContract, IpcEnvelope, SafeIpcErrorShape } from "@shared/ipc/contracts";
import { SafeIpcError } from "./safe-ipc-error";

export { SafeIpcError } from "./safe-ipc-error";

export function mapToSafeIpcError(error: unknown): SafeIpcErrorShape {
  if (error instanceof SafeIpcError) {
    return {
      code: error.code,
      message: error.message
    };
  }

  if (error instanceof ZodError) {
    return {
      code: "VALIDATION_FAILED",
      message: "Invalid IPC payload"
    };
  }

  const normalized = normalizeOperationalError(error);
  return {
    code: normalized.code.toUpperCase(),
    message: normalized.message
  };
}

export async function executeIpcContract<
  RequestSchema extends z.ZodType,
  ResponseSchema extends z.ZodType
>(
  contract: IpcContract<RequestSchema, ResponseSchema>,
  handler: (
    request: z.output<RequestSchema>
  ) => Promise<z.input<ResponseSchema>> | z.input<ResponseSchema>,
  payload: unknown
): Promise<IpcEnvelope> {
  try {
    const request = contract.request.parse(payload);
    const response = await handler(request);
    const parsedResponse = contract.response.parse(response);

    if (typeof parsedResponse === "undefined") {
      return { ok: true };
    }

    return { ok: true, data: parsedResponse };
  } catch (error) {
    return { ok: false, error: mapToSafeIpcError(error) };
  }
}

export function registerIpcContract<
  RequestSchema extends z.ZodType,
  ResponseSchema extends z.ZodType
>(
  contract: IpcContract<RequestSchema, ResponseSchema>,
  handler: (
    request: z.output<RequestSchema>,
    event: Electron.IpcMainInvokeEvent
  ) => Promise<z.input<ResponseSchema>> | z.input<ResponseSchema>
): void {
  ipcMain.handle(contract.channel, (event, payload) =>
    executeIpcContract(contract, (request) => handler(request, event), payload)
  );
}

import { createHash } from "node:crypto";

export function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function hashMessages(value: unknown): string {
  return sha256Hex(JSON.stringify(value));
}

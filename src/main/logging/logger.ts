import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync
} from "node:fs";
import { join } from "node:path";

import { RedactionService } from "@main/security/redaction-service";

export type LogLevel = "error" | "warn" | "info" | "debug";

export interface StructuredLoggerOptions {
  logDir: string;
  level?: LogLevel;
  maxBytes?: number;
  appVersion?: string;
  now?: () => string;
}

const LEVEL_WEIGHT: Record<LogLevel, number> = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3
};

export class StructuredLogger {
  private readonly redaction = new RedactionService();
  private readonly logPath: string;
  private readonly rotatedPath: string;
  private readonly level: LogLevel;
  private readonly maxBytes: number;
  private readonly now: () => string;

  constructor(private readonly options: StructuredLoggerOptions) {
    mkdirSync(options.logDir, { recursive: true });
    this.logPath = join(options.logDir, "wenforge.log");
    this.rotatedPath = join(options.logDir, "wenforge.log.1");
    this.level = options.level ?? "info";
    this.maxBytes = options.maxBytes ?? 1_000_000;
    this.now = options.now ?? (() => new Date().toISOString());
  }

  error(message: string, context?: Record<string, unknown>): void {
    this.write("error", message, context);
  }

  warn(message: string, context?: Record<string, unknown>): void {
    this.write("warn", message, context);
  }

  info(message: string, context?: Record<string, unknown>): void {
    this.write("info", message, context);
  }

  debug(message: string, context?: Record<string, unknown>): void {
    this.write("debug", message, context);
  }

  recent(limit = 100): string[] {
    const lines = [this.rotatedPath, this.logPath].flatMap((path) =>
      existsSync(path) ? readFileSync(path, "utf8").trim().split("\n").filter(Boolean) : []
    );
    return lines.slice(-limit);
  }

  private write(level: LogLevel, message: string, context?: Record<string, unknown>): void {
    if (LEVEL_WEIGHT[level] > LEVEL_WEIGHT[this.level]) {
      return;
    }

    const record = {
      at: this.now(),
      level,
      message: this.redaction.redact(message),
      appVersion: this.options.appVersion ?? "unknown",
      context: context ? this.redactContext(context) : undefined
    };
    const line = `${JSON.stringify(record)}\n`;
    this.rotateIfNeeded(Buffer.byteLength(line));
    writeFileSync(this.logPath, line, { encoding: "utf8", flag: "a" });
  }

  private rotateIfNeeded(nextBytes: number): void {
    if (!existsSync(this.logPath)) {
      return;
    }

    if (statSync(this.logPath).size + nextBytes <= this.maxBytes) {
      return;
    }

    if (existsSync(this.rotatedPath)) {
      rmSync(this.rotatedPath, { force: true });
    }
    renameSync(this.logPath, this.rotatedPath);
  }

  private redactContext(context: Record<string, unknown>): unknown {
    const redacted = this.redaction.redact(JSON.stringify(context));
    return JSON.parse(redacted) as unknown;
  }
}

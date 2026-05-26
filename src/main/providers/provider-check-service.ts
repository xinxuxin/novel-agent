import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import type { ProviderSmokeResult } from "./provider-smoke-service";
import { RedactionService } from "@main/security/redaction-service";
import {
  assertNoSensitiveDiagnosticsText,
  redactSensitiveDiagnosticsText
} from "@main/diagnostics/sensitive-value-scan";

export interface ProviderCheckReportInput {
  appVersion: string;
  routePreset?: string | null;
  results: ProviderSmokeResult[];
  createdAt?: string;
}

export interface ProviderCheckReportRecord {
  path: string;
  content: string;
}

export function shouldRunRealProviderChecks(env: Record<string, string | undefined>): boolean {
  if (env.CI) {
    return false;
  }
  return (
    env.RUN_REAL_PROVIDER_CHECKS?.toLowerCase() === "true" ||
    env.RUN_REAL_PROVIDER_TESTS?.toLowerCase() === "true"
  );
}

export function parseProviderCheckBudget(env: Record<string, string | undefined>): number {
  const parsed = Number(env.REAL_PROVIDER_CHECK_BUDGET_USD ?? env.REAL_PROVIDER_TEST_BUDGET_USD);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 2;
}

export function renderProviderCheckReport(input: ProviderCheckReportInput): string {
  const redaction = new RedactionService();
  const createdAt = input.createdAt ?? new Date().toISOString();
  const lines = [
    "# Provider Connectivity Check Report",
    "",
    `timestamp: ${createdAt}`,
    `app version: ${input.appVersion}`,
    `route/config preset: ${input.routePreset ?? "configured providers"}`,
    "sensitive values omitted: true",
    "",
    "| provider | model | configured | checked | streaming supported | usage returned | estimated cost | final cost | latency | status | llm_run_id | redacted error |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |"
  ];

  for (const result of input.results) {
    lines.push(
      [
        result.provider,
        result.model ?? "unknown",
        String(result.configured),
        String(result.tested),
        String(result.streamingSupported),
        result.tested ? String(result.usageParsed) : "unknown",
        formatCost(result.estimatedCost),
        formatCost(result.finalCost),
        result.latencyMs === null ? "unknown" : `${result.latencyMs}ms`,
        result.status,
        result.runIds.join(", ") || "none",
        redaction.redact(result.error ?? "")
      ]
        .join(" | ")
        .replace(/^/, "| ")
        .replace(/$/, " |")
    );
  }

  lines.push("", "Sensitive values omitted: true", "");
  const report = redactSensitiveDiagnosticsText(lines.join("\n"));
  assertNoSensitiveDiagnosticsText(report);
  return report;
}

export function writeProviderCheckReport(
  input: ProviderCheckReportInput,
  options: { reportsRoot?: string; now?: Date } = {}
): ProviderCheckReportRecord {
  const report = renderProviderCheckReport({
    ...input,
    createdAt: input.createdAt ?? (options.now ?? new Date()).toISOString()
  });
  const outputDir = join(options.reportsRoot ?? "reports", "provider-checks");
  mkdirSync(outputDir, { recursive: true });
  const outputPath = join(outputDir, `${formatReportTimestamp(options.now ?? new Date())}.md`);
  writeFileSync(outputPath, report, "utf8");
  return { path: outputPath, content: report };
}

export function readLatestProviderCheckReport(
  reportsRoot = "reports"
): ProviderCheckReportRecord | null {
  const outputDir = join(reportsRoot, "provider-checks");
  if (!existsSync(outputDir)) {
    return null;
  }
  const latest = readdirSync(outputDir)
    .filter((file) => file.endsWith(".md"))
    .sort()
    .at(-1);
  if (!latest) {
    return null;
  }
  const path = join(outputDir, latest);
  const content = redactSensitiveDiagnosticsText(readFileSync(path, "utf8"));
  assertNoSensitiveDiagnosticsText(content);
  return { path, content };
}

function formatCost(value: number | null): string {
  return value === null ? "unknown" : `$${value.toFixed(6)}`;
}

function formatReportTimestamp(date: Date): string {
  const pad = (value: number): string => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}-${pad(
    date.getHours()
  )}-${pad(date.getMinutes())}`;
}

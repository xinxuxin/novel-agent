import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { readLatestProviderCheckReport } from "../src/main/providers/provider-check-service";
import {
  parseProviderSmokeBudget,
  renderProviderConformanceReport,
  shouldRunRealProviderSmoke
} from "../src/main/providers/provider-smoke-service";
import { loadLocalEnv, createProviderSmokeHarness } from "./provider-smoke-harness";

const latestProviderCheck = readLatestProviderCheckReport();
if (latestProviderCheck && !process.argv.includes("--write-doc-sample")) {
  console.log(latestProviderCheck.content);
  console.log(`Latest provider check report: ${latestProviderCheck.path}`);
  process.exit(0);
}

const env = { ...loadLocalEnv(), ...process.env } as Record<string, string>;
const harness = createProviderSmokeHarness(env);
const results = shouldRunRealProviderSmoke(process.env)
  ? await harness.service.runAllConfigured({
      confirmed: true,
      budgetCapUsd: parseProviderSmokeBudget(env)
    })
  : harness.service.buildUntestedReport();
const report = renderProviderConformanceReport(results);
const timestamp = formatReportTimestamp(new Date());
const outputDir = join("reports", "provider-conformance");
mkdirSync(outputDir, { recursive: true });
const outputPath = join(outputDir, `${timestamp}.md`);
writeFileSync(outputPath, report, "utf8");

if (process.argv.includes("--write-doc-sample")) {
  writeFileSync("docs/provider-conformance-sample.md", report, "utf8");
}

console.log(`Provider conformance report written to ${outputPath}`);
harness.connection.sqlite.close();

function formatReportTimestamp(date: Date): string {
  const pad = (value: number): string => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}-${pad(
    date.getHours()
  )}-${pad(date.getMinutes())}`;
}

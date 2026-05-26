import {
  parseProviderCheckBudget,
  renderProviderCheckReport,
  shouldRunRealProviderChecks,
  writeProviderCheckReport
} from "../src/main/providers/provider-check-service";

if (!shouldRunRealProviderChecks(process.env)) {
  console.log("Provider checks skipped. Set RUN_REAL_PROVIDER_CHECKS=true outside CI.");
  process.exit(0);
}

const { loadLocalEnv, createProviderSmokeHarness } = await import("./provider-smoke-harness");
const env = { ...loadLocalEnv(), ...process.env } as Record<string, string>;
const budgetCapUsd = parseProviderCheckBudget(env);
const harness = createProviderSmokeHarness(env);
const results = await harness.service.runAllConfigured({
  confirmed: true,
  budgetCapUsd
});
const report = writeProviderCheckReport({
  appVersion: "0.1.0",
  routePreset: "configured providers",
  results
});
console.log(renderProviderCheckReport({ appVersion: "0.1.0", results }));
console.log(`Provider check report written to ${report.path}`);
harness.connection.sqlite.close();

if (results.some((result) => result.status === "failed" || result.status === "blocked")) {
  process.exitCode = 1;
}

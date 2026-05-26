import {
  parseProviderSmokeBudget,
  renderProviderConformanceReport,
  shouldRunRealProviderSmoke
} from "../src/main/providers/provider-smoke-service";

if (!shouldRunRealProviderSmoke(process.env)) {
  console.log("Provider connectivity checks skipped. Set RUN_REAL_PROVIDER_CHECKS=true outside CI.");
  process.exit(0);
}

const { loadLocalEnv, createProviderSmokeHarness } = await import("./provider-smoke-harness");
const env = { ...loadLocalEnv(), ...process.env } as Record<string, string>;
const budgetCapUsd = parseProviderSmokeBudget(env);
const harness = createProviderSmokeHarness(env);
const results = await harness.service.runAllConfigured({
  confirmed: true,
  budgetCapUsd
});
console.log(renderProviderConformanceReport(results));
harness.connection.sqlite.close();

if (results.some((result) => result.status === "failed" || result.status === "blocked")) {
  process.exitCode = 1;
}

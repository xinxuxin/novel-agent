import {
  parseProviderChapterCheckBudget,
  ProviderChapterCheckService,
  shouldRunProviderChapterCheck
} from "../src/main/e2e/provider-chapter-check-service";
import type { RepositoryRegistry } from "../src/main/db/service";
import type { LLMTaskType } from "../src/shared/contracts/ai";

if (!shouldRunProviderChapterCheck(process.env)) {
  console.log("Provider chapter check skipped. Set RUN_REAL_PROVIDER_CHECKS=true outside CI.");
  process.exit(0);
}

const { loadLocalEnv, createProviderSmokeHarness } = await import("./provider-smoke-harness");
const env = { ...loadLocalEnv(), ...process.env } as Record<string, string>;
const harness = createProviderSmokeHarness(env);
seedBalancedRoutesForFirstConfiguredProvider(harness.repositories);

const result = await new ProviderChapterCheckService({
  database: harness.connection.db,
  repositories: harness.repositories,
  aiGateway: harness.aiGateway,
  credentialService: harness.credentialService,
  appVersion: "0.1.0"
}).run({
  confirmed: true,
  budgetCapUsd: parseProviderChapterCheckBudget(env),
  qualityMode: "balanced"
});

console.log(result.reportMarkdown);
if (result.reportPath) {
  console.log(`Provider chapter check report written to ${result.reportPath}`);
}
harness.connection.sqlite.close();

if (result.status === "failed" || result.status === "blocked") {
  process.exitCode = 1;
}

function seedBalancedRoutesForFirstConfiguredProvider(repositories: RepositoryRegistry): void {
  const credential = repositories.providerCredentials.list().find((item) => item.isConfigured);
  if (!credential) {
    throw new Error("No configured provider credential is available for the provider chapter check");
  }
  const profile = repositories.modelProfiles
    .list()
    .find((item) => item.provider === credential.provider && item.enabled);
  if (!profile) {
    throw new Error(`No enabled model profile is available for ${credential.provider}`);
  }
  const tasks: LLMTaskType[] = [
    "chapter_outline",
    "scene_cards",
    "draft_chapter",
    "continuity_audit",
    "suspense_hook_audit",
    "revise_chapter",
    "state_settlement"
  ];
  for (const taskType of tasks) {
    repositories.taskRoutes.upsert({
      taskType,
      qualityMode: "balanced",
      primaryModelProfileId: profile.id,
      temperature: 0,
      maxOutputTokens: taskType === "draft_chapter" || taskType === "revise_chapter" ? 1800 : 600,
      budgetCapPerCall: 0.5,
      enabled: true
    });
  }
}

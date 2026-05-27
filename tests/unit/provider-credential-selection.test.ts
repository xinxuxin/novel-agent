import { describe, expect, it } from "vitest";

import type { ProviderCredentialDto } from "@contracts/model-routing";
import { CredentialService } from "@main/providers/credential-service";
import type { ProviderCredentialRepository } from "@main/db/repositories/provider-credential-repository";
import type { RedactionService } from "@main/security/redaction-service";
import type { SecretEncryptionService } from "@main/security/secret-encryption-service";

function credential(
  input: Pick<ProviderCredentialDto, "id" | "lastStatus" | "updatedAt" | "redactedKeyLabel">
): ProviderCredentialDto & { encryptedSecretBase64: string } {
  return {
    id: input.id,
    provider: "moonshot_kimi",
    displayName: input.id,
    baseUrl: null,
    isConfigured: true,
    redactedKeyLabel: input.redactedKeyLabel,
    lastTestedAt: null,
    lastStatus: input.lastStatus,
    createdAt: "2026-05-27T00:00:00.000Z",
    updatedAt: input.updatedAt,
    encryptedSecretBase64: `encrypted:${input.id}`
  };
}

function createCredentialService(records: Array<ReturnType<typeof credential>>) {
  return new CredentialService({
    repository: {
      listConfiguredByProvider: () => records
    } as unknown as ProviderCredentialRepository,
    encryption: {
      decryptFromBase64: (value: string) => value.replace(/^encrypted:/, "api-key:")
    } as unknown as SecretEncryptionService,
    redaction: {} as RedactionService
  });
}

describe("provider credential selection", () => {
  it("prefers a non-failed configured credential over a recently failed credential", () => {
    const failed = credential({
      id: "failed",
      redactedKeyLabel: "sk-...old",
      lastStatus: "test_failed",
      updatedAt: "2026-05-27T05:55:00.000Z"
    });
    const healthy = credential({
      id: "healthy",
      redactedKeyLabel: "sk-...new",
      lastStatus: "configured",
      updatedAt: "2026-05-27T05:54:00.000Z"
    });

    expect(
      createCredentialService([failed, healthy]).getDecryptedProviderCredential("moonshot_kimi")
    ).toMatchObject({
      id: "healthy",
      apiKey: "api-key:healthy"
    });
  });
});

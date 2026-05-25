import type {
  CredentialStatusDto,
  CredentialTestResult,
  ProviderCredentialDto,
  SaveCredentialInput
} from "@contracts/model-routing";
import type { ProviderId } from "@shared/domain/model-routing";
import type { ProviderCredentialRepository } from "@main/db/repositories/provider-credential-repository";
import type { RedactionService } from "@main/security/redaction-service";
import type { SecretEncryptionService } from "@main/security/secret-encryption-service";

export interface DecryptedProviderCredential {
  id: string;
  provider: ProviderId;
  apiKey: string;
  baseUrl: string | null;
  displayName: string;
}

export interface CredentialServiceOptions {
  repository: ProviderCredentialRepository;
  encryption: SecretEncryptionService;
  redaction: RedactionService;
}

export class CredentialService {
  constructor(private readonly options: CredentialServiceOptions) {}

  listCredentials(): ProviderCredentialDto[] {
    return this.options.repository.list().map((credential) => this.toDto(credential));
  }

  saveCredential(input: SaveCredentialInput): ProviderCredentialDto {
    const encryptedSecretBase64 = this.options.encryption.encryptToBase64(input.apiKey);
    const saved = this.options.repository.save({
      provider: input.provider,
      displayName: input.displayName,
      baseUrl: input.baseUrl,
      encryptedSecretBase64,
      redactedKeyLabel: this.options.redaction.createKeyLabel(input.apiKey)
    });
    return this.toDto(saved);
  }

  deleteCredential(id: string, confirmed: boolean): boolean {
    return this.options.repository.delete(id, confirmed);
  }

  updateBaseUrl(id: string, baseUrl: string | null): ProviderCredentialDto | null {
    const updated = this.options.repository.updateBaseUrl(id, baseUrl);
    return updated ? this.toDto(updated) : null;
  }

  getStatus(id: string): CredentialStatusDto {
    const credential = this.options.repository.get(id);
    if (!credential) {
      return {
        id,
        provider: "generic_openai_compatible",
        isConfigured: false,
        lastStatus: "unknown",
        lastTestedAt: null,
        message: "Credential not found"
      };
    }

    return {
      id: credential.id,
      provider: credential.provider,
      isConfigured: credential.isConfigured,
      lastStatus: credential.lastStatus,
      lastTestedAt: credential.lastTestedAt,
      message: credential.isConfigured ? "Credential is configured" : "Credential is not configured"
    };
  }

  testConnection(id: string): CredentialTestResult {
    const credential = this.options.repository.get(id);
    const testedAt = new Date().toISOString();
    if (!credential?.isConfigured || !credential.encryptedSecretBase64) {
      this.options.repository.updateStatus(id, "test_failed", testedAt);
      return {
        id,
        status: "not_configured",
        message: "No configured credential is available",
        testedAt
      };
    }

    this.options.repository.updateStatus(id, "configured", testedAt);
    return {
      id,
      status: "configured_but_untested",
      message: "Credential is stored securely; no provider network test was run in this phase",
      testedAt
    };
  }

  getConfiguredProviderCredential(provider: ProviderId): ProviderCredentialDto | null {
    const credential = this.options.repository.listConfiguredByProvider(provider)[0];
    return credential ? this.toDto(credential) : null;
  }

  getDecryptedProviderCredential(provider: ProviderId): DecryptedProviderCredential | null {
    const credential = this.options.repository.listConfiguredByProvider(provider)[0];
    if (!credential?.encryptedSecretBase64) {
      return null;
    }

    return {
      id: credential.id,
      provider: credential.provider,
      apiKey: this.options.encryption.decryptFromBase64(credential.encryptedSecretBase64),
      baseUrl: credential.baseUrl,
      displayName: credential.displayName
    };
  }

  private toDto(
    credential: { encryptedSecretBase64?: string | null } & ProviderCredentialDto
  ): ProviderCredentialDto {
    return {
      id: credential.id,
      provider: credential.provider,
      displayName: credential.displayName,
      baseUrl: credential.baseUrl,
      isConfigured: credential.isConfigured,
      redactedKeyLabel: credential.redactedKeyLabel,
      lastTestedAt: credential.lastTestedAt,
      lastStatus: credential.lastStatus,
      createdAt: credential.createdAt,
      updatedAt: credential.updatedAt
    };
  }
}

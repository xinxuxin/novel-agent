import type { ProviderCredentialDto } from "@contracts/model-routing";

export interface CredentialDisplayFields {
  id: string;
  provider: string;
  displayName: string;
  baseUrl: string;
  keyLabel: string;
  status: string;
}

export function credentialDisplayFields(
  credential: ProviderCredentialDto
): CredentialDisplayFields {
  return {
    id: credential.id,
    provider: credential.provider,
    displayName: credential.displayName,
    baseUrl: credential.baseUrl ?? "Default endpoint",
    keyLabel: credential.redactedKeyLabel,
    status: credential.lastStatus
  };
}

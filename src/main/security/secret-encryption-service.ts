export interface SafeStorageLike {
  isEncryptionAvailable: () => boolean;
  encryptString: (value: string) => Buffer;
  decryptString: (value: Buffer) => string;
}

export class SecretEncryptionUnavailableError extends Error {
  constructor() {
    super("safeStorage is unavailable; refusing plaintext credential storage");
    this.name = "SecretEncryptionUnavailableError";
  }
}

export class SecretEncryptionService {
  constructor(private readonly safeStorage: SafeStorageLike) {}

  isAvailable(): boolean {
    return this.safeStorage.isEncryptionAvailable();
  }

  encryptToBase64(secret: string): string {
    if (!this.safeStorage.isEncryptionAvailable()) {
      throw new SecretEncryptionUnavailableError();
    }

    return this.safeStorage.encryptString(secret).toString("base64");
  }

  decryptFromBase64(encryptedSecretBase64: string): string {
    if (!this.safeStorage.isEncryptionAvailable()) {
      throw new SecretEncryptionUnavailableError();
    }

    return this.safeStorage.decryptString(Buffer.from(encryptedSecretBase64, "base64"));
  }
}

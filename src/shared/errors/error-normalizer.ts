export type OperationalErrorCode =
  | "provider_auth_error"
  | "provider_rate_limit"
  | "provider_context_length_exceeded"
  | "provider_invalid_json"
  | "network_timeout"
  | "user_abort"
  | "budget_exceeded"
  | "db_migration_error"
  | "secret_encryption_unavailable"
  | "import_export_validation_error"
  | "workflow_checkpoint_recovery_error"
  | "validation_failed"
  | "internal_error";

export interface NormalizedOperationalError {
  code: OperationalErrorCode;
  message: string;
  retryable: boolean;
}

const SECRET_PATTERNS = [
  /Authorization:\s*Bearer\s+[^\s"'}]+/gi,
  /\b(sk|ak|xai|or|kimi|qwen|gemini|deepseek)-[A-Za-z0-9._-]{8,}\b/g,
  /\b(api[_-]?key|access[_-]?token|secret)\s*[:=]\s*["']?[^"'\s,}]+/gi
];

export function normalizeOperationalError(error: unknown): NormalizedOperationalError {
  const status = getStatus(error);
  const message = getMessage(error);
  const lower = message.toLowerCase();
  const name = getName(error);

  if (name === "AbortError" || lower.includes("aborted") || lower.includes("user abort")) {
    return { code: "user_abort", message: "The operation was cancelled.", retryable: false };
  }
  if (status === 401 || status === 403 || lower.includes("auth") || lower.includes("invalid key")) {
    return {
      code: "provider_auth_error",
      message: "Provider authentication failed. Check the saved credential.",
      retryable: false
    };
  }
  if (status === 429 || lower.includes("rate limit")) {
    return {
      code: "provider_rate_limit",
      message: "Provider rate limit reached. Try again later or use a fallback route.",
      retryable: true
    };
  }
  if (lower.includes("context") && (lower.includes("length") || lower.includes("window"))) {
    return {
      code: "provider_context_length_exceeded",
      message: "The request exceeded the model context window.",
      retryable: false
    };
  }
  if (lower.includes("json") || lower.includes("parse")) {
    return {
      code: "provider_invalid_json",
      message: "The provider returned invalid structured JSON.",
      retryable: true
    };
  }
  if (lower.includes("timeout") || lower.includes("timed out") || status === 408) {
    return { code: "network_timeout", message: "The network request timed out.", retryable: true };
  }
  if (lower.includes("budget")) {
    return {
      code: "budget_exceeded",
      message: "The configured budget policy stopped the operation.",
      retryable: false
    };
  }
  if (lower.includes("migration")) {
    return {
      code: "db_migration_error",
      message: "The database migration failed. Create a backup before retrying.",
      retryable: false
    };
  }
  if (lower.includes("safestorage") || lower.includes("encryption unavailable")) {
    return {
      code: "secret_encryption_unavailable",
      message: "Secret encryption is unavailable on this device.",
      retryable: false
    };
  }
  if (lower.includes("import") || lower.includes("export") || lower.includes("package")) {
    return {
      code: "import_export_validation_error",
      message: `Import/export validation failed: ${redact(message)}`,
      retryable: false
    };
  }
  if (lower.includes("checkpoint")) {
    return {
      code: "workflow_checkpoint_recovery_error",
      message: "Workflow checkpoint recovery failed.",
      retryable: false
    };
  }

  return { code: "internal_error", message: "Something went wrong", retryable: false };
}

export function redactOperationalText(value: string): string {
  return redact(value);
}

function getStatus(error: unknown): number | null {
  if (typeof error === "object" && error !== null && "status" in error) {
    const status = Number((error as { status?: unknown }).status);
    return Number.isFinite(status) ? status : null;
  }
  return null;
}

function getName(error: unknown): string | null {
  if (typeof error === "object" && error !== null && "name" in error) {
    return String((error as { name?: unknown }).name);
  }
  return null;
}

function getMessage(error: unknown): string {
  if (typeof error === "string") return error;
  if (typeof error === "object" && error !== null && "message" in error) {
    return String((error as { message?: unknown }).message);
  }
  return "";
}

function redact(value: string): string {
  return SECRET_PATTERNS.reduce(
    (current, pattern) => current.replace(pattern, "[redacted]"),
    value
  );
}

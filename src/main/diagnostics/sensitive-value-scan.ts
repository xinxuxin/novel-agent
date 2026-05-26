import { RedactionService } from "@main/security/redaction-service";

export interface SensitiveValueFinding {
  kind: "authorization_header" | "bearer_token" | "api_key" | "secret_assignment";
  count: number;
}

export interface SensitiveValueScanResult {
  ok: boolean;
  findings: SensitiveValueFinding[];
}

const SENSITIVE_PATTERNS: Array<{
  kind: SensitiveValueFinding["kind"];
  pattern: RegExp;
}> = [
  { kind: "authorization_header", pattern: /Authorization:\s*Bearer\s+[^\s"'}]+/gi },
  { kind: "bearer_token", pattern: /\bBearer\s+[A-Za-z0-9._-]{12,}\b/gi },
  { kind: "api_key", pattern: /\b(sk|ak|xai|or|kimi|qwen|gemini|deepseek)-[A-Za-z0-9._-]{8,}\b/gi },
  { kind: "api_key", pattern: /\bAIza[A-Za-z0-9_-]{12,}\b/g },
  {
    kind: "secret_assignment",
    pattern:
      /\b(api[_-]?key|access[_-]?token|secret|credential)\s*[:=]\s*["']?(?!\[redacted\])[^"'\s,}]+/gi
  }
];

export function scanSensitiveDiagnosticsText(value: string): SensitiveValueScanResult {
  const findings = SENSITIVE_PATTERNS.map(({ kind, pattern }) => ({
    kind,
    count: countMatches(value, pattern)
  })).filter((finding) => finding.count > 0);
  return { ok: findings.length === 0, findings };
}

export function redactSensitiveDiagnosticsText(value: string): string {
  return new RedactionService().redact(value);
}

export function assertNoSensitiveDiagnosticsText(value: string): void {
  const scan = scanSensitiveDiagnosticsText(value);
  if (!scan.ok) {
    throw new Error(
      `Sensitive diagnostic value detected: ${scan.findings
        .map((finding) => `${finding.kind}:${finding.count}`)
        .join(", ")}`
    );
  }
}

function countMatches(value: string, pattern: RegExp): number {
  pattern.lastIndex = 0;
  return [...value.matchAll(pattern)].length;
}

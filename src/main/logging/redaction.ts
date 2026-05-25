import { RedactionService } from "@main/security/redaction-service";

export function redactLogValue(value: string): string {
  return new RedactionService().redact(value);
}

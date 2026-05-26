const SECRET_PATTERNS = [
  /Authorization:\s*Bearer\s+[^\s"'}]+/gi,
  /\b(sk|ak|xai|or|kimi|qwen|gemini|deepseek)-[A-Za-z0-9._-]{8,}\b/g,
  /\b(api[_-]?key|access[_-]?token|secret)\s*[:=]\s*["']?[^"'\s,}]+/gi
];

export class RedactionService {
  redact(value: string): string {
    return SECRET_PATTERNS.reduce(
      (current, pattern) => current.replace(pattern, (match) => this.redactMatch(match)),
      value
    );
  }

  createKeyLabel(secret: string): string {
    const trimmed = secret.trim();
    if (trimmed.length <= 8) {
      return "[redacted]";
    }

    const prefix = trimmed.startsWith("sk-") ? "sk-" : `${trimmed.slice(0, 2)}-`;
    return `${prefix}...${trimmed.slice(-4)}`;
  }

  private redactMatch(match: string): string {
    if (/Authorization:/i.test(match)) {
      return "Authorization: [redacted]";
    }

    const separator = match.includes("=") ? "=" : match.includes(":") ? ":" : "";
    if (separator) {
      const [label] = match.split(separator);
      return `${label}${separator}[redacted]`;
    }

    return "[redacted]";
  }
}

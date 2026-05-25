const SECRET_PATTERNS = [/sk-[a-zA-Z0-9_-]+/g, /Bearer\s+[a-zA-Z0-9._-]+/g];

export function redactLogValue(value: string): string {
  return SECRET_PATTERNS.reduce(
    (current, pattern) => current.replace(pattern, "[redacted]"),
    value
  );
}

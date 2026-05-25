export interface TimestampedRecord {
  createdAt: string;
  updatedAt: string;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function countChineseAwareWords(text: string): number {
  const latinWords = text.trim().match(/[a-zA-Z0-9_]+/g)?.length ?? 0;
  const cjkCharacters = text.match(/[\u3400-\u9fff]/g)?.length ?? 0;
  return latinWords + cjkCharacters;
}

export function markdownToPlaintext(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[#>*_`~\-[\]()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

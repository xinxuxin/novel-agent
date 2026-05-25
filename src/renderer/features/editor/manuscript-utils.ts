export interface ManuscriptStats {
  plaintext: string;
  characters: number;
  chineseCharacters: number;
  paragraphs: number;
  estimatedTokens: number;
}

export type SimpleDiffLine = {
  kind: "added" | "removed" | "unchanged";
  text: string;
};

const cjkRegex = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/g;

export function countChineseCharacters(text: string): number {
  return text.match(cjkRegex)?.length ?? 0;
}

export function countParagraphs(text: string): number {
  return text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean).length;
}

export function normalizeManuscriptText(text: string): string {
  return text.replace(/\r\n/g, "\n").trim();
}

export function estimateManuscriptTokens(text: string): number {
  const normalized = normalizeManuscriptText(text);
  const chineseCharacters = countChineseCharacters(normalized);
  const nonChineseCharacters = normalized.replace(cjkRegex, "").replace(/\s+/g, " ").trim().length;
  return Math.max(0, Math.ceil(chineseCharacters * 1.15 + nonChineseCharacters / 4));
}

export function manuscriptStats(text: string): ManuscriptStats {
  const plaintext = normalizeManuscriptText(text);
  return {
    plaintext,
    characters: plaintext.length,
    chineseCharacters: countChineseCharacters(plaintext),
    paragraphs: countParagraphs(plaintext),
    estimatedTokens: estimateManuscriptTokens(plaintext)
  };
}

export function createSimpleDiff(previous: string, next: string): SimpleDiffLine[] {
  const previousLines = normalizeManuscriptText(previous).split("\n");
  const nextLines = normalizeManuscriptText(next).split("\n");
  const result: SimpleDiffLine[] = [];
  let previousIndex = 0;
  let nextIndex = 0;

  while (previousIndex < previousLines.length || nextIndex < nextLines.length) {
    const previousLine = previousLines[previousIndex];
    const nextLine = nextLines[nextIndex];

    if (previousLine === nextLine) {
      result.push({ kind: "unchanged", text: previousLine ?? "" });
      previousIndex += 1;
      nextIndex += 1;
      continue;
    }

    if (
      nextLine !== undefined &&
      previousLines.slice(previousIndex + 1).includes(nextLine) &&
      previousLine !== undefined
    ) {
      result.push({ kind: "removed", text: previousLine });
      previousIndex += 1;
      continue;
    }

    if (previousLine !== undefined && nextLines.slice(nextIndex + 1).includes(previousLine)) {
      result.push({ kind: "added", text: nextLine ?? "" });
      nextIndex += 1;
      continue;
    }

    if (previousLine !== undefined) {
      result.push({ kind: "removed", text: previousLine });
      previousIndex += 1;
    }
    if (nextLine !== undefined) {
      result.push({ kind: "added", text: nextLine });
      nextIndex += 1;
    }
  }

  return result.filter((line) => line.text.length > 0);
}

import { readFileSync } from "node:fs";
import { basename } from "node:path";

import type { SkillLoader, SkillManifest, SkillPromptManifest } from "./skill-loader";

export interface PromptTemplate {
  id: string;
  file: string;
  version: string;
  language: string;
  taskType: string;
  outputSchemaName: string | null;
  frontmatter: Record<string, string>;
  content: string;
}

export class PromptTemplateService {
  constructor(private readonly loader: SkillLoader) {}

  loadManifest(): SkillManifest {
    return this.loader.loadManifest();
  }

  loadById(id: string): PromptTemplate {
    const prompt = this.findPrompt((candidate) => candidate.id === id);
    return this.loadPrompt(prompt);
  }

  loadByFile(file: string): PromptTemplate {
    const prompt = this.findPrompt((candidate) => candidate.file === file);
    return this.loadPrompt(prompt);
  }

  loadOutputSchema(name: string): Record<string, unknown> {
    return JSON.parse(readFileSync(this.loader.schemaPath(name), "utf8")) as Record<
      string,
      unknown
    >;
  }

  private findPrompt(predicate: (prompt: SkillPromptManifest) => boolean): SkillPromptManifest {
    const prompt = this.loader.loadManifest().prompts.find(predicate);
    if (!prompt) {
      throw new Error("Prompt template not found");
    }
    return prompt;
  }

  private loadPrompt(prompt: SkillPromptManifest): PromptTemplate {
    const raw = readFileSync(this.loader.promptPath(prompt.file), "utf8");
    const parsed = parseFrontmatter(raw);
    return {
      id: parsed.frontmatter.id ?? prompt.id,
      file: basename(prompt.file),
      version: parsed.frontmatter.version ?? prompt.version,
      language: parsed.frontmatter.language ?? prompt.language,
      taskType: parsed.frontmatter.task_type ?? prompt.taskType,
      outputSchemaName: parsed.frontmatter.output_schema ?? prompt.outputSchema ?? null,
      frontmatter: parsed.frontmatter,
      content: parsed.content.trim()
    };
  }
}

function parseFrontmatter(raw: string): { frontmatter: Record<string, string>; content: string } {
  if (!raw.startsWith("---")) {
    return { frontmatter: {}, content: raw };
  }

  const end = raw.indexOf("\n---", 3);
  if (end === -1) {
    return { frontmatter: {}, content: raw };
  }

  const block = raw.slice(3, end).trim();
  const frontmatter = Object.fromEntries(
    block
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const separator = line.indexOf(":");
        if (separator === -1) return [line, ""];
        return [line.slice(0, separator).trim(), line.slice(separator + 1).trim()];
      })
  );
  return { frontmatter, content: raw.slice(end + 4).trim() };
}

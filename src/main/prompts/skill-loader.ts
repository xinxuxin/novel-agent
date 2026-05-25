import { existsSync, readFileSync } from "node:fs";
import { join, normalize, relative } from "node:path";
import { z } from "zod";

import { TASK_TYPES } from "@shared/domain/model-routing";

const promptManifestSchema = z.object({
  id: z.string().min(1),
  file: z.string().min(1),
  version: z.string().min(1),
  language: z.string().min(1),
  taskType: z.enum(TASK_TYPES),
  outputSchema: z.string().optional()
});

const skillManifestSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    version: z.string().min(1),
    language: z.string().min(1),
    license: z.string().min(1),
    description: z.string().min(1),
    prompts: z.array(promptManifestSchema).min(1),
    schemas: z.array(z.string()).default([]),
    rubrics: z.array(z.string()).default([]),
    examples: z.array(z.string()).default([]),
    eval: z.string().optional()
  })
  .passthrough();

export type SkillManifest = z.infer<typeof skillManifestSchema>;
export type SkillPromptManifest = z.infer<typeof promptManifestSchema>;

export interface SkillLoaderOptions {
  rootDir?: string;
}

export class SkillLoader {
  readonly rootDir: string;

  constructor(options: SkillLoaderOptions = {}) {
    this.rootDir = options.rootDir ?? join(process.cwd(), "skills", "wenforge-webnovel-writer");
  }

  loadManifest(): SkillManifest {
    const manifestPath = this.resolveInsideRoot("skill.json");
    const parsed = JSON.parse(readFileSync(manifestPath, "utf8")) as unknown;
    return skillManifestSchema.parse(parsed);
  }

  readText(relativePath: string): string {
    return readFileSync(this.resolveInsideRoot(relativePath), "utf8");
  }

  readJson(relativePath: string): unknown {
    return JSON.parse(this.readText(relativePath)) as unknown;
  }

  promptPath(file: string): string {
    return this.resolveInsideRoot(join("prompts", file));
  }

  schemaPath(name: string): string {
    const file = name.endsWith(".schema.json") ? name : `${name}.schema.json`;
    return this.resolveInsideRoot(join("schemas", file));
  }

  exists(relativePath: string): boolean {
    return existsSync(this.resolveInsideRoot(relativePath));
  }

  private resolveInsideRoot(relativePath: string): string {
    const normalizedRoot = normalize(this.rootDir);
    const resolved = normalize(join(normalizedRoot, relativePath));
    const relation = relative(normalizedRoot, resolved);
    if (relation.startsWith("..") || relation === "") {
      throw new Error(`Skill path escapes package root: ${relativePath}`);
    }
    return resolved;
  }
}

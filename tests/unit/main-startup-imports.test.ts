import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("main process startup imports", () => {
  it("does not load LangGraph from a top-level workflow runner import", () => {
    const source = readFileSync(resolve("src/main/workflows/langgraph-runner.ts"), "utf8");

    expect(source).not.toContain('from "@langchain/langgraph"');
  });
});

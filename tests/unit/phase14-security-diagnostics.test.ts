import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, afterEach } from "vitest";

import { exportDiagnosticsBundle } from "@main/diagnostics/diagnostics-service";
import { StructuredLogger } from "@main/logging/logger";
import { buildContentSecurityPolicy } from "@main/security/csp";
import { getValidatedExternalUrl } from "@main/security/navigation";
import { sanitizeImportedMarkdown, validateSafeUserPath } from "@main/files/import-export-service";
import { normalizeOperationalError } from "@shared/errors/error-normalizer";

let tempDir = "";

afterEach(() => {
  if (tempDir) {
    rmSync(tempDir, { recursive: true, force: true });
    tempDir = "";
  }
});

function createTempDir(): string {
  tempDir = mkdtempSync(join(tmpdir(), "wenforge-phase14-"));
  return tempDir;
}

describe("phase 14 security and diagnostics hardening", () => {
  it("builds a CSP without unsafe eval and documents the renderer style exception", () => {
    const policy = buildContentSecurityPolicy({ dev: false });

    expect(policy.headerValue).toContain("default-src 'self'");
    expect(policy.headerValue).toContain("script-src 'self'");
    expect(policy.headerValue).not.toContain("'unsafe-eval'");
    expect(policy.headerValue).not.toContain("script-src 'self' 'unsafe-inline'");
    expect(policy.headerValue).toContain("style-src 'self' 'unsafe-inline'");
    expect(policy.rationale).toContain("Tailwind");
  });

  it("allows the Vite React refresh script preamble only in development CSP", () => {
    const policy = buildContentSecurityPolicy({ dev: true });

    expect(policy.headerValue).toContain("script-src 'self' 'unsafe-inline'");
    expect(policy.headerValue).not.toContain("'unsafe-eval'");
    expect(policy.rationale).toContain("dev-only script preamble");
  });

  it("rejects unsafe external URLs while allowing HTTPS and local development endpoints", () => {
    expect(getValidatedExternalUrl("https://example.com/docs")).toBe("https://example.com/docs");
    expect(getValidatedExternalUrl("http://localhost:5173/help")).toBe(
      "http://localhost:5173/help"
    );
    expect(getValidatedExternalUrl("http://example.com/plain")).toBeNull();
    expect(getValidatedExternalUrl("javascript:alert(1)")).toBeNull();
    expect(getValidatedExternalUrl("file:///private/tmp/secret.txt")).toBeNull();
  });

  it("normalizes common operational errors with redacted, user-safe messages", () => {
    expect(normalizeOperationalError({ status: 401, message: "bad sk-secret-1234567890" })).toEqual(
      {
        code: "provider_auth_error",
        message: "Provider authentication failed. Check the saved credential.",
        retryable: false
      }
    );
    expect(normalizeOperationalError({ status: 429, message: "rate limit" }).code).toBe(
      "provider_rate_limit"
    );
    expect(
      normalizeOperationalError(new DOMException("The operation was aborted", "AbortError")).code
    ).toBe("user_abort");
    expect(normalizeOperationalError(new Error("Workflow budget cap exceeded")).code).toBe(
      "budget_exceeded"
    );
    expect(
      normalizeOperationalError(new Error("Invalid WenForge package: sk-secret-123")).message
    ).not.toContain("sk-secret");
  });

  it("writes structured redacted logs and rotates before the active file grows too large", () => {
    const dir = createTempDir();
    const logger = new StructuredLogger({
      logDir: dir,
      level: "debug",
      maxBytes: 240,
      appVersion: "0.1.0"
    });

    logger.info("provider saved", { apiKey: "sk-secret-1234567890" });
    logger.error("request failed", { authorization: "Authorization: Bearer sk-secret-token" });
    logger.debug("large", { content: "x".repeat(300) });

    const active = readFileSync(join(dir, "wenforge.log"), "utf8");
    const rotated = readFileSync(join(dir, "wenforge.log.1"), "utf8");
    expect(`${active}\n${rotated}`).not.toContain("sk-secret");
    expect(JSON.parse(active.trim().split("\n").at(-1) ?? "{}")).toMatchObject({
      level: "debug",
      appVersion: "0.1.0"
    });
  });

  it("exports a redacted diagnostic bundle without settings secrets or manuscripts by default", () => {
    const bundle = exportDiagnosticsBundle({
      appVersion: "0.1.0",
      platform: "darwin",
      dbMigrationVersion: "0000_initial_wenforge_schema",
      safeStorageAvailable: true,
      providerHealth: [
        {
          id: "health_1",
          provider: "openai",
          model: "model",
          status: "down",
          checkedAt: "2026-05-25T00:00:00.000Z",
          errorCode: "auth",
          errorMessage: "Authorization: Bearer sk-secret-token"
        }
      ],
      recentErrors: ["provider failed with sk-secret-1234567890"],
      logs: ['{"level":"error","message":"api_key=sk-secret-1234567890"}'],
      settings: {
        storeFullPrompts: false,
        storeManuscriptsInLogs: false,
        encryptedSecretBase64: "abc123",
        nested: { authorization: "Authorization: Bearer sk-secret-token" }
      }
    });

    const serialized = JSON.stringify(bundle);
    expect(serialized).not.toContain("sk-secret");
    expect(serialized).not.toContain("encryptedSecretBase64");
    expect(serialized).not.toContain("Authorization: Bearer");
    expect(bundle.manuscriptsIncluded).toBe(false);
    expect(bundle.safeStorageAvailable).toBe(true);
  });

  it("keeps renderer code away from privileged modules and direct provider calls", () => {
    const rendererFiles = listFiles("src/renderer").filter((file) => /\.(ts|tsx)$/.test(file));
    const forbiddenImport = /from\s+["']@(main|db|ai|agents)\//;
    const forbiddenRelative =
      /from\s+["'](?:\.\.\/){2,}(?:main|db|ai|agents|preload|shared\/security)\//;

    for (const file of rendererFiles) {
      const source = readFileSync(file, "utf8");
      expect(source, `${file} must not import privileged modules`).not.toMatch(forbiddenImport);
      expect(source, `${file} must not import privileged modules`).not.toMatch(forbiddenRelative);
      expect(source, `${file} must not call fetch directly`).not.toMatch(/\bfetch\s*\(/);
      expect(source, `${file} must not inject untrusted HTML`).not.toMatch(
        /dangerouslySetInnerHTML|innerHTML\s*=|insertAdjacentHTML/
      );
    }
  });

  it("sanitizes markdown, rejects traversal, and excludes references from packaging", () => {
    const dir = createTempDir();
    expect(() => validateSafeUserPath(dir, join(dir, "..", "escape.md"))).toThrow(/path/i);
    expect(
      sanitizeImportedMarkdown("[x](javascript:alert(1))<iframe src='x'></iframe>")
    ).not.toContain("javascript:");

    const packageJson = JSON.parse(readFileSync("package.json", "utf8")) as {
      scripts?: Record<string, string>;
      devDependencies?: Record<string, string>;
      build?: { files?: string[]; extraResources?: string[] };
    };
    expect(packageJson.devDependencies).toHaveProperty("electron-builder");
    expect(packageJson.scripts).toMatchObject({
      package: expect.stringContaining("electron-builder"),
      "package:mac": expect.stringContaining("--mac"),
      "package:win": expect.stringContaining("--win"),
      "package:linux": expect.stringContaining("--linux")
    });
    expect(JSON.stringify(packageJson.build?.files ?? [])).toContain("!references/**");
    expect(JSON.stringify(packageJson.build?.files ?? [])).toContain("!references/repos/**");
  });
});

function listFiles(root: string): string[] {
  return readdirSync(root).flatMap((entry) => {
    const path = join(root, entry);
    return statSync(path).isDirectory() ? listFiles(path) : [path];
  });
}

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const packageJsonPath = require.resolve("better-sqlite3/package.json");
const packageDir = dirname(packageJsonPath);
const buildDir = join(packageDir, "build");

if (canLoadBetterSqlite3()) {
  process.exit(0);
}

const result = isConfiguredForCurrentNode()
  ? spawnSync("make", ["BUILDTYPE=Release", "-C", buildDir], { stdio: "inherit" })
  : spawnSync(process.execPath, [resolveNodeGyp(), "rebuild", "--directory", packageDir], {
      stdio: "inherit"
    });

process.exit(result.status ?? 1);

function canLoadBetterSqlite3() {
  try {
    const Database = require("better-sqlite3");
    const db = new Database(":memory:");
    db.prepare("select 1").get();
    db.close();
    return true;
  } catch {
    return false;
  }
}

function isConfiguredForCurrentNode() {
  const configPath = join(buildDir, "config.gypi");
  const makefilePath = join(buildDir, "Makefile");
  if (!existsSync(configPath) || !existsSync(makefilePath)) {
    return false;
  }
  const config = readFileSync(configPath, "utf8");
  return config.includes(`"node_module_version": ${process.versions.modules}`);
}

function resolveNodeGyp() {
  try {
    return require.resolve("node-gyp/bin/node-gyp.js");
  } catch {
    const pnpmDir = join(process.cwd(), "node_modules", ".pnpm");
    const candidateRoot = readdirSync(pnpmDir).find((entry) => entry.startsWith("node-gyp@"));
    const candidate = candidateRoot
      ? join(pnpmDir, candidateRoot, "node_modules", "node-gyp", "bin", "node-gyp.js")
      : null;
    if (candidate && existsSync(candidate)) {
      return candidate;
    }
    throw new Error("Cannot find local node-gyp. Run pnpm install before rebuilding better-sqlite3.");
  }
}

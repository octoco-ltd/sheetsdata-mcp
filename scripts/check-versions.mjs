#!/usr/bin/env node
/**
 * Fails fast when any of the repo's version-carrying manifests
 * drift from package.json's version.
 *
 * This drift has happened for real: manifest.json sat at 1.3.1 while
 * package.json/server.json/mcp.json had already moved to 1.3.2, and
 * the only guard in place (build-mcpb.sh) compared manifest.json
 * against package.json alone — it never looked at server.json or
 * mcp.json, so a release build was one bad merge away from shipping
 * an .mcpb with a stale version string.
 *
 * package.json's `version` is the single source of truth; every file
 * below must match it exactly. Run directly (`node
 * scripts/check-versions.mjs`), from scripts/build-mcpb.sh before it
 * stages a release, and from CI on every PR.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

function readJson(relPath) {
  return JSON.parse(readFileSync(join(ROOT, relPath), "utf8"));
}

const pkg = readJson("package.json");
const expected = pkg.version;
if (!expected) {
  console.error("package.json has no `version` field — nothing to check against.");
  process.exit(1);
}

/**
 * Each entry reads one JSON file (cached per relative path so
 * server.json is only parsed once even though it's checked twice)
 * and extracts one version string to compare against package.json.
 */
const jsonCache = new Map();
function loadJson(relPath) {
  if (!jsonCache.has(relPath)) {
    jsonCache.set(relPath, readJson(relPath));
  }
  return jsonCache.get(relPath);
}

const checks = [
  { file: "manifest.json", label: "manifest.json (DXT/MCPB)", get: (j) => j.version },
  { file: "server.json", label: "server.json .version", get: (j) => j.version },
  {
    file: "server.json",
    label: "server.json .packages[0].version",
    get: (j) => j.packages?.[0]?.version,
  },
  { file: "mcp.json", label: "mcp.json", get: (j) => j.version },
  {
    // Bundle runtime package.json — committed (with its lockfile) so
    // build-mcpb.sh can `npm ci` a reproducible node_modules. It has
    // its own version field purely for bookkeeping; keep it aligned
    // too so it never silently goes stale.
    file: "bundle/package.json",
    label: "bundle/package.json",
    get: (j) => j.version,
  },
];

const mismatches = [];
for (const check of checks) {
  const json = loadJson(check.file);
  const actual = check.get(json);
  if (actual === undefined) {
    mismatches.push(`${check.label}: no version field found`);
  } else if (actual !== expected) {
    mismatches.push(`${check.label}: ${actual} (expected ${expected})`);
  }
}

if (mismatches.length > 0) {
  console.error(`Version mismatch — package.json says ${expected}, but:`);
  for (const m of mismatches) console.error(`  - ${m}`);
  console.error("\nBump every file above to package.json's version before building or releasing.");
  process.exit(1);
}

console.log(`OK — package.json, manifest.json, server.json, mcp.json, and bundle/package.json all agree on version ${expected}.`);

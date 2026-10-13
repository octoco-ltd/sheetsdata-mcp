#!/usr/bin/env node
/**
 * Every place this repo records its release version, and the two
 * operations on them.
 *
 *   node scripts/versions.mjs check [--tag vX.Y.Z]
 *   node scripts/versions.mjs set X.Y.Z
 *
 * package.json's `version` is the single source of truth. `check`
 * fails when any other field below differs from it, when the CLI and
 * the Claude Desktop bundle pin different mcp-remote versions, or
 * (with --tag) when the release tag is not `v<version>`. It runs in CI
 * on every PR, from scripts/build-mcpb.sh, and in the release workflow.
 *
 * `set` writes the new version into exactly the fields listed in
 * VERSION_FIELDS. Bump with it rather than by hand or with sed: the
 * lockfiles also hold dependency versions, and a text replace of
 * "1.3.2" once rewrote finalhandler@1.3.2's entry in
 * bundle/package-lock.json along with the package's own.
 *
 * Drift here has shipped before: manifest.json sat at 1.3.1 while the
 * other files had moved to 1.3.2, and the v1.3.2 bundle build failed.
 */

import { readFileSync, realpathSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Each entry names a JSON file and the key path of one version field
 * in it. The first entry is the source of truth.
 */
export const VERSION_FIELDS = [
  { file: "package.json", path: ["version"] },
  { file: "package-lock.json", path: ["version"] },
  { file: "package-lock.json", path: ["packages", "", "version"] },
  // Claude Desktop bundle (MCPB) manifest.
  { file: "manifest.json", path: ["version"] },
  // MCP Registry entry: the server's version and the npm package it points at.
  { file: "server.json", path: ["version"] },
  { file: "server.json", path: ["packages", 0, "version"] },
  { file: "mcp.json", path: ["version"] },
  // The bundle's runtime package: not published, kept aligned for bookkeeping.
  { file: "bundle/package.json", path: ["version"] },
  { file: "bundle/package-lock.json", path: ["version"] },
  { file: "bundle/package-lock.json", path: ["packages", "", "version"] },
];

const SEMVER = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

/** e.g. `package-lock.json .packages[""].version` */
function label({ file, path }) {
  const keys = path.map((k) => (typeof k === "number" || k === "" ? `[${JSON.stringify(k)}]` : `.${k}`));
  return `${file} ${keys.join("")}`;
}

function getAt(obj, path) {
  return path.reduce((node, key) => (node == null ? undefined : node[key]), obj);
}

function setAt(obj, path, value) {
  const parent = getAt(obj, path.slice(0, -1));
  const key = path[path.length - 1];
  if (parent == null || typeof parent !== "object" || !(key in parent)) {
    throw new Error(`no field to set at ${path.join(" > ")}`);
  }
  parent[key] = value;
}

function readJson(root, file) {
  return JSON.parse(readFileSync(join(root, file), "utf8"));
}

/**
 * Every disagreement with package.json's version, plus a differing
 * mcp-remote pin between the CLI and the bundle. Empty when all agree.
 */
export function findVersionProblems(root = REPO_ROOT) {
  const cache = new Map();
  const load = (file) => {
    if (!cache.has(file)) cache.set(file, readJson(root, file));
    return cache.get(file);
  };

  const [source, ...rest] = VERSION_FIELDS;
  const expected = getAt(load(source.file), source.path);
  if (typeof expected !== "string" || !SEMVER.test(expected)) {
    return { expected, problems: [`${label(source)}: ${JSON.stringify(expected)} is not a version`] };
  }

  const problems = [];
  for (const field of rest) {
    const actual = getAt(load(field.file), field.path);
    if (actual === undefined) {
      problems.push(`${label(field)}: missing`);
    } else if (actual !== expected) {
      problems.push(`${label(field)}: ${actual} (expected ${expected})`);
    }
  }

  const cliPin = load("package.json").dependencies?.["mcp-remote"];
  const bundlePin = load("bundle/package.json").dependencies?.["mcp-remote"];
  if (cliPin !== bundlePin) {
    problems.push(
      `mcp-remote pin: package.json has ${cliPin}, bundle/package.json has ${bundlePin}; ` +
        "the npm CLI and the Claude Desktop bundle must run the same proxy"
    );
  }

  return { expected, problems };
}

/** The problem with a release tag for `version`, or null when it matches. */
export function tagProblem(tag, version) {
  return tag === `v${version}` ? null : `tag ${tag} does not match version ${version} (expected v${version})`;
}

/**
 * Write `version` into every field in VERSION_FIELDS, and nothing
 * else. Files are rewritten as two-space JSON with a trailing newline.
 */
export function setVersion(version, root = REPO_ROOT) {
  if (!SEMVER.test(version)) {
    throw new Error(`${JSON.stringify(version)} is not a version (expected X.Y.Z)`);
  }
  const docs = new Map();
  for (const field of VERSION_FIELDS) {
    if (!docs.has(field.file)) docs.set(field.file, readJson(root, field.file));
    setAt(docs.get(field.file), field.path, version);
  }
  // Every field is validated before any file is written, so a missing
  // field leaves the tree untouched rather than half-bumped.
  for (const [file, doc] of docs) {
    writeFileSync(join(root, file), `${JSON.stringify(doc, null, 2)}\n`);
  }
}

function usage() {
  console.error("usage: node scripts/versions.mjs check [--tag vX.Y.Z]\n       node scripts/versions.mjs set X.Y.Z");
  return 2;
}

export function main(argv) {
  const [command, ...args] = argv;

  if (command === "set" && args.length === 1) {
    setVersion(args[0]);
    console.log(`Set version ${args[0]} in ${VERSION_FIELDS.length} fields. Now add the CHANGELOG.md entry.`);
    return 0;
  }

  if (command === "check" && (args.length === 0 || (args.length === 2 && args[0] === "--tag"))) {
    const { expected, problems } = findVersionProblems();
    const tagError = args.length === 2 ? tagProblem(args[1], expected) : null;
    if (problems.length > 0 || tagError) {
      console.error(`Version check failed (package.json says ${expected}):`);
      for (const p of [...problems, ...(tagError ? [tagError] : [])]) console.error(`  - ${p}`);
      if (problems.length > 0) {
        console.error("\nBump with `npm run set-version -- X.Y.Z` so every field moves together.");
      }
      if (tagError) {
        console.error("\nTag the commit whose package.json carries the version being released.");
      }
      return 1;
    }
    console.log(`OK: all ${VERSION_FIELDS.length} version fields agree on ${expected}.`);
    return 0;
  }

  return usage();
}

function isMainModule() {
  try {
    return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (isMainModule()) {
  process.exitCode = main(process.argv.slice(2));
}

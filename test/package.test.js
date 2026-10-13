// What `npm publish` would ship, checked with `npm pack --dry-run`, and
// the package.json fields other channels depend on.

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const readJson = (file) => JSON.parse(readFileSync(join(REPO_ROOT, file), "utf8"));

function packedFiles() {
  // `npm` is a .cmd shim on Windows; CI runs on Linux.
  const out = execFileSync("npm", ["pack", "--dry-run", "--json", "--ignore-scripts"], {
    cwd: REPO_ROOT,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });
  return JSON.parse(out)[0].files.map((f) => f.path).sort();
}

test("the npm tarball holds the CLI and its docs, nothing else", () => {
  assert.deepEqual(packedFiles(), ["CHANGELOG.md", "LICENSE", "README.md", "bin/cli.js", "package.json"]);
});

test("mcpName matches server.json: the MCP Registry rejects the entry otherwise", () => {
  assert.equal(readJson("package.json").mcpName, readJson("server.json").name);
  assert.equal(readJson("server.json").packages[0].identifier, readJson("package.json").name);
});

test("the bin entry points at the shipped CLI, which has a node shebang", () => {
  const { bin } = readJson("package.json");
  assert.deepEqual(Object.keys(bin), ["sheetsdata-mcp"]);
  assert.equal(bin["sheetsdata-mcp"], "bin/cli.js");
  assert.match(readFileSync(join(REPO_ROOT, "bin/cli.js"), "utf8"), /^#!\/usr\/bin\/env node\n/);
});

test("mcp-remote is pinned exactly, so every install runs the same proxy", () => {
  assert.match(readJson("package.json").dependencies["mcp-remote"], /^\d+\.\d+\.\d+$/);
});

test("repository.url names this repo, as npm provenance requires", () => {
  assert.equal(readJson("package.json").repository.url, "git+https://github.com/octoco-ltd/sheetsdata-mcp.git");
});

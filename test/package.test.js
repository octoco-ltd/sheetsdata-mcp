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

// The lower bound of an engines range's last ">=" clause, padded to
// X.Y.Z: "16.0.0" from "^14.13.1 || >=16", "0.8.0" from ">= 0.8".
// null when the range doesn't end in one.
function nodeFloor(range) {
  const m = />=\s*(\d+)(?:\.(\d+))?(?:\.(\d+))?\s*$/.exec(range ?? "");
  return m && [m[1], m[2] ?? "0", m[3] ?? "0"].join(".");
}

function compareVersions(a, b) {
  const [x, y] = [a, b].map((v) => v.split(".").map(Number));
  return x[0] - y[0] || x[1] - y[1] || x[2] - y[2];
}

function declaredNodeMinimum() {
  const range = readJson("package.json").engines?.node ?? "";
  assert.match(range, /^>=\d+\.\d+\.\d+$/, 'package.json needs engines.node of the form ">=X.Y.Z"');
  return nodeFloor(range);
}

test("the npm package, the bundle and the README declare one Node.js minimum", () => {
  const declared = declaredNodeMinimum();
  assert.equal(readJson("manifest.json").compatibility.runtimes.node, readJson("package.json").engines.node);
  const readme = readFileSync(join(REPO_ROOT, "README.md"), "utf8");
  const mentioned = [...readme.matchAll(/Node\.js v?(\d+(?:\.\d+)*)/g)].map((m) => m[1]);
  assert.ok(mentioned.length > 0, "README names no Node.js version");
  for (const version of mentioned) {
    assert.equal(version, declared, `README says Node.js ${version}`);
  }
});

test("the declared Node.js minimum covers every locked runtime dependency's", () => {
  const declared = declaredNodeMinimum();
  for (const lockfile of ["package-lock.json", "bundle/package-lock.json"]) {
    for (const [path, entry] of Object.entries(readJson(lockfile).packages)) {
      if (path === "" || entry.dev || !entry.engines?.node) continue;
      const floor = nodeFloor(entry.engines.node);
      assert.ok(floor, `${lockfile}: ${path} has engines.node "${entry.engines.node}", which this test can't read`);
      assert.ok(
        compareVersions(declared, floor) >= 0,
        `${lockfile}: ${path} needs Node.js ${floor}, above the declared ${declared}`,
      );
    }
  }
});

test("repository.url names this repo, as npm provenance requires", () => {
  assert.equal(readJson("package.json").repository.url, "git+https://github.com/octoco-ltd/sheetsdata-mcp.git");
});

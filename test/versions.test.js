// Tests for scripts/versions.mjs: the version-field table, `check`
// and `set`, against throwaway copies of the repo's JSON files.

import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { VERSION_FIELDS, findVersionProblems, setVersion, tagProblem } from "../scripts/versions.mjs";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/** A minimal tree holding every file VERSION_FIELDS names, all at `version`. */
function fixture(version = "1.2.3", { cliPin = "0.1.38", bundlePin = "0.1.38" } = {}) {
  const root = mkdtempSync(join(tmpdir(), "versions-test-"));
  const lock = (name) => ({
    name,
    version,
    lockfileVersion: 3,
    packages: {
      "": { name, version },
      // A dependency that happens to share the package's version: `set`
      // must leave it alone (a text replace once rewrote such an entry).
      "node_modules/finalhandler": { version, resolved: `https://registry.npmjs.org/finalhandler/-/finalhandler-${version}.tgz` },
    },
  });
  const files = {
    "package.json": { name: "@sheetsdata/mcp", version, dependencies: { "mcp-remote": cliPin } },
    "package-lock.json": lock("@sheetsdata/mcp"),
    "manifest.json": { name: "sheetsdata", version },
    "server.json": { name: "io.github.octoco-ltd/sheetsdata-mcp", version, packages: [{ identifier: "@sheetsdata/mcp", version }] },
    "mcp.json": { name: "sheetsdata", version },
    "bundle/package.json": { name: "sheetsdata-mcp-bundle-runtime", version, dependencies: { "mcp-remote": bundlePin } },
    "bundle/package-lock.json": lock("sheetsdata-mcp-bundle-runtime"),
  };
  for (const [file, doc] of Object.entries(files)) {
    mkdirSync(dirname(join(root, file)), { recursive: true });
    writeFileSync(join(root, file), `${JSON.stringify(doc, null, 2)}\n`);
  }
  return root;
}

function readJson(root, file) {
  return JSON.parse(readFileSync(join(root, file), "utf8"));
}

function editJson(root, file, edit) {
  const doc = readJson(root, file);
  edit(doc);
  writeFileSync(join(root, file), `${JSON.stringify(doc, null, 2)}\n`);
}

test("the repo itself passes the check", () => {
  assert.deepEqual(findVersionProblems(REPO_ROOT).problems, []);
});

test("check: agreeing files have no problems", (t) => {
  const root = fixture();
  t.after(() => rmSync(root, { recursive: true, force: true }));
  assert.deepEqual(findVersionProblems(root), { expected: "1.2.3", problems: [] });
});

test("check: every field in the table is compared, not just the first per file", (t) => {
  const root = fixture();
  t.after(() => rmSync(root, { recursive: true, force: true }));
  editJson(root, "server.json", (doc) => {
    doc.packages[0].version = "1.2.2";
  });
  editJson(root, "bundle/package-lock.json", (doc) => {
    doc.packages[""].version = "1.2.2";
  });

  const { problems } = findVersionProblems(root);
  assert.deepEqual(problems, [
    "server.json .packages[0].version: 1.2.2 (expected 1.2.3)",
    'bundle/package-lock.json .packages[""].version: 1.2.2 (expected 1.2.3)',
  ]);
});

test("check: a missing field is reported, not skipped", (t) => {
  const root = fixture();
  t.after(() => rmSync(root, { recursive: true, force: true }));
  editJson(root, "mcp.json", (doc) => {
    delete doc.version;
  });
  assert.deepEqual(findVersionProblems(root).problems, ["mcp.json .version: missing"]);
});

test("check: the CLI and the bundle must pin the same mcp-remote", (t) => {
  const root = fixture("1.2.3", { cliPin: "0.1.38", bundlePin: "0.1.40" });
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const { problems } = findVersionProblems(root);
  assert.equal(problems.length, 1);
  assert.match(problems[0], /mcp-remote pin: package\.json has 0\.1\.38, bundle\/package\.json has 0\.1\.40/);
});

test("tagProblem: only v<version> matches", () => {
  assert.equal(tagProblem("v1.2.3", "1.2.3"), null);
  assert.match(tagProblem("1.2.3", "1.2.3"), /expected v1\.2\.3/);
  assert.match(tagProblem("v1.2.4", "1.2.3"), /does not match/);
  assert.match(tagProblem("v1.2.3-rc.1", "1.2.3"), /does not match/);
});

test("set: moves every field in the table and nothing else", (t) => {
  const root = fixture("1.2.3");
  t.after(() => rmSync(root, { recursive: true, force: true }));

  setVersion("1.2.4", root);

  assert.deepEqual(findVersionProblems(root), { expected: "1.2.4", problems: [] });
  for (const file of ["package-lock.json", "bundle/package-lock.json"]) {
    const dep = readJson(root, file).packages["node_modules/finalhandler"];
    assert.equal(dep.version, "1.2.3", `${file}: a dependency's version must not move`);
    assert.match(dep.resolved, /finalhandler-1\.2\.3\.tgz$/);
  }
});

test("set: writes two-space JSON with a trailing newline", (t) => {
  const root = fixture();
  t.after(() => rmSync(root, { recursive: true, force: true }));
  setVersion("2.0.0", root);
  const text = readFileSync(join(root, "server.json"), "utf8");
  assert.equal(text, `${JSON.stringify(JSON.parse(text), null, 2)}\n`);
});

test("set: rejects a malformed version without touching any file", (t) => {
  const root = fixture();
  t.after(() => rmSync(root, { recursive: true, force: true }));
  for (const bad of ["v1.2.4", "1.2", "1.2.4 ", ""]) {
    assert.throws(() => setVersion(bad, root), /is not a version/);
  }
  assert.equal(findVersionProblems(root).expected, "1.2.3");
});

test("set: a missing field aborts before any file is written", (t) => {
  const root = fixture();
  t.after(() => rmSync(root, { recursive: true, force: true }));
  editJson(root, "bundle/package-lock.json", (doc) => {
    delete doc.packages[""];
  });

  assert.throws(() => setVersion("1.2.4", root), /no field to set/);
  // package.json comes first in the table; it must not have moved.
  assert.equal(readJson(root, "package.json").version, "1.2.3");
});

test("the table covers each version-carrying file the release ships", () => {
  const files = new Set(VERSION_FIELDS.map((f) => f.file));
  for (const file of ["package.json", "package-lock.json", "manifest.json", "server.json", "mcp.json", "bundle/package.json", "bundle/package-lock.json"]) {
    assert.ok(files.has(file), `${file} is missing from VERSION_FIELDS`);
  }
  assert.deepEqual(VERSION_FIELDS[0], { file: "package.json", path: ["version"] });
});

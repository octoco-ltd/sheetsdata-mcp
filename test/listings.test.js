// The tool, prompt and resource lists are written out in four places
// that scanners and clients read separately: manifest.json (Claude
// Desktop bundle), mcp.json, .well-known/mcp/server-card.json and the
// README. They have drifted before (the server card listed 12 tools
// after the server had 14), so they must name the same things.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => readFileSync(join(REPO_ROOT, file), "utf8");
const readJson = (file) => JSON.parse(read(file));

const names = (items) => items.map((item) => item.name ?? item.uri ?? item);

/** The backticked first-column names of the table under a README `## heading`. */
function readmeTableNames(heading) {
  const lines = read("README.md").split(/\r?\n/);
  const start = lines.indexOf(`## ${heading}`);
  assert.notEqual(start, -1, `README has no "## ${heading}" section`);
  const found = [];
  for (const line of lines.slice(start + 1)) {
    if (line.startsWith("## ")) break;
    const match = /^\| `([^`]+)` \|/.exec(line);
    if (match) found.push(match[1]);
  }
  return found;
}

const manifestTools = names(readJson("manifest.json").tools);

test("the tool list has no duplicates", () => {
  assert.equal(new Set(manifestTools).size, manifestTools.length);
});

test("mcp.json, the server card and the README list the bundle's tools", () => {
  assert.deepEqual(names(readJson("mcp.json").tools), manifestTools);
  assert.deepEqual(names(readJson(".well-known/mcp/server-card.json").tools), manifestTools);
  assert.deepEqual(readmeTableNames("Tools"), manifestTools);
});

test("the server card and the README list mcp.json's prompts and resources", () => {
  const mcp = readJson("mcp.json");
  const card = readJson(".well-known/mcp/server-card.json");
  assert.deepEqual(card.prompts, names(mcp.prompts));
  assert.deepEqual(card.resources, names(mcp.resources));
  assert.deepEqual(readmeTableNames("Prompts"), names(mcp.prompts));
  assert.deepEqual(readmeTableNames("Resources"), names(mcp.resources));
});

test("every listing points at the same server URL", () => {
  const url = "https://mcp.sheetsdata.com/mcp";
  assert.equal(readJson("mcp.json").transport.url, url);
  assert.equal(readJson(".well-known/mcp/server-card.json").url, url);
  assert.deepEqual(
    readJson("server.json").remotes.map((r) => r.url),
    [url],
  );
});

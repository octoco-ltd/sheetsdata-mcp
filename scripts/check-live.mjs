#!/usr/bin/env node
/**
 * Compare this repo's listings with what the hosted server serves.
 *
 *   node scripts/check-live.mjs [url]
 *
 * The hosted server is the source of truth for the tools, prompts and
 * resources the listings name, and for each tool's per-call price, which
 * its description starts with ("Free." or "Costs 2¢ per call."). This
 * reads them with the calls a client makes before signing in
 * (`initialize`, then `tools/list`, `prompts/list` and
 * `resources/list`; no tool is called) and reports every difference
 * from manifest.json, mcp.json and the README's Tools table.
 *
 * test/listings.test.js keeps the repo's listings consistent with each
 * other; this keeps them consistent with the server. It needs the
 * network, so it is a release step (see RELEASING.md), not a CI one.
 */

import { readFileSync, realpathSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const MCP_URL = "https://mcp.sheetsdata.com/mcp";

// The last revision whose handshake the hosted server accepts; a server
// on a newer revision still negotiates this one.
const PROTOCOL_VERSION = "2025-11-25";

/** "Free", "2¢", or null when the description doesn't open with a price. */
export function priceFromDescription(description) {
  if (/^Free\b/.test(description)) return "Free";
  const match = /^Costs (\d+)¢ per call\b/.exec(description);
  return match ? `${match[1]}¢` : null;
}

/** name → price from the README's `## Tools` table rows (| `name` | price | ... |). */
export function readmePrices(readme) {
  const lines = readme.split(/\r?\n/);
  const start = lines.indexOf("## Tools");
  const prices = new Map();
  if (start === -1) return prices;
  for (const line of lines.slice(start + 1)) {
    if (line.startsWith("## ")) break;
    const match = /^\| `([^`]+)` \| ([^|]+?) \|/.exec(line);
    if (match) prices.set(match[1], match[2]);
  }
  return prices;
}

export function readRepoListings(root = REPO_ROOT) {
  const readJson = (file) => JSON.parse(readFileSync(join(root, file), "utf8"));
  const mcp = readJson("mcp.json");
  return {
    tools: readJson("manifest.json").tools.map((t) => t.name),
    prices: readmePrices(readFileSync(join(root, "README.md"), "utf8")),
    prompts: mcp.prompts.map((p) => p.name),
    resources: mcp.resources.map((r) => r.uri),
  };
}

function setDifferences(kind, live, repo) {
  const problems = [];
  for (const name of live) if (!repo.includes(name)) problems.push(`${kind} ${name}: served, but not listed`);
  for (const name of repo) if (!live.includes(name)) problems.push(`${kind} ${name}: listed, but not served`);
  return problems;
}

/**
 * Every difference between what the server serves (`live`, the three
 * list results) and the repo's listings (`repo`, from
 * readRepoListings). Empty when they agree.
 */
export function parityProblems(live, repo) {
  const problems = [
    ...setDifferences("tool", live.tools.map((t) => t.name), repo.tools),
    ...setDifferences("prompt", live.prompts.map((p) => p.name), repo.prompts),
    ...setDifferences("resource", live.resources.map((r) => r.uri), repo.resources),
  ];
  for (const tool of live.tools) {
    const price = priceFromDescription(tool.description ?? "");
    const listed = repo.prices.get(tool.name);
    if (price === null) {
      problems.push(`tool ${tool.name}: the server's description doesn't open with a price`);
    } else if (listed !== undefined && listed !== price) {
      problems.push(`tool ${tool.name}: README says ${listed}, the server says ${price}`);
    }
  }
  return problems;
}

/** The result of one JSON-RPC call, from a JSON or an SSE response body. */
async function call(url, id, method, params) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      "MCP-Protocol-Version": PROTOCOL_VERSION,
    },
    body: JSON.stringify({ jsonrpc: "2.0", id, method, params }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`${method}: HTTP ${response.status} from ${url}`);
  const body = await response.text();
  const payloads = (response.headers.get("content-type") ?? "").includes("text/event-stream")
    ? body.split(/\r?\n/).filter((l) => l.startsWith("data:")).map((l) => l.slice(5))
    : [body];
  const message = payloads.map((p) => JSON.parse(p)).find((m) => m.id === id);
  if (!message) throw new Error(`${method}: no response with id ${id}`);
  if (message.error) throw new Error(`${method}: ${message.error.message ?? "error"} (code ${message.error.code})`);
  return message.result;
}

export async function fetchLive(url = MCP_URL) {
  await call(url, 1, "initialize", {
    protocolVersion: PROTOCOL_VERSION,
    capabilities: {},
    clientInfo: { name: "sheetsdata-mcp-check-live", version: "0" },
  });
  const [{ tools }, { prompts }, { resources }] = await Promise.all([
    call(url, 2, "tools/list", {}),
    call(url, 3, "prompts/list", {}),
    call(url, 4, "resources/list", {}),
  ]);
  return { tools, prompts, resources };
}

export async function main(argv) {
  if (argv.length > 1) {
    console.error("usage: node scripts/check-live.mjs [url]");
    return 2;
  }
  const url = argv[0] ?? MCP_URL;
  let live;
  try {
    live = await fetchLive(url);
  } catch (err) {
    console.error(`Could not read the listings from ${url}: ${err.message}`);
    return 1;
  }
  const problems = parityProblems(live, readRepoListings());
  if (problems.length > 0) {
    console.error(`The listings differ from ${url}:`);
    for (const p of problems) console.error(`  - ${p}`);
    return 1;
  }
  console.log(
    `OK: ${live.tools.length} tools (with prices), ${live.prompts.length} prompts and ` +
      `${live.resources.length} resources match ${url}.`
  );
  return 0;
}

function isMainModule() {
  try {
    return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (isMainModule()) {
  process.exitCode = await main(process.argv.slice(2));
}

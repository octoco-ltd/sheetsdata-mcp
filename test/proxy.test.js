// The real, pinned mcp-remote, launched the way bin/cli.js launches it,
// between an MCP client on stdio and a local Streamable HTTP server that
// answers as the hosted one does today (protocol 2025-11-25, handshake
// and list calls served without sign-in). The other tests replace
// mcp-remote with a fake; this one is what fails when an mcp-remote
// upgrade changes how the proxy negotiates, forwards or authenticates.

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, test } from "node:test";
import { buildProxyInvocation, resolveMcpRemoteEntry } from "../bin/cli.js";

const PROTOCOL_VERSION = "2025-11-25";
const TOOLS = [
  {
    name: "search_parts",
    description: "Free. Find parts.",
    inputSchema: { type: "object", properties: { query: { type: "string" } }, required: ["query"] },
    annotations: { readOnlyHint: true, openWorldHint: true },
  },
];

/** JSON-RPC over POST /mcp, answered as JSON; every request is recorded. */
function startServer() {
  const requests = [];
  const server = createServer(async (req, res) => {
    let body = "";
    for await (const chunk of req) body += chunk;
    if (req.method !== "POST" || req.url !== "/mcp") {
      res.writeHead(req.method === "GET" && req.url === "/mcp" ? 405 : 404).end();
      return;
    }
    const message = JSON.parse(body);
    requests.push({ method: message.method, headers: req.headers, params: message.params });
    if (message.id === undefined) {
      res.writeHead(202).end();
      return;
    }
    const results = {
      initialize: {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: "fake-sheetsdata", version: "0.0.0" },
      },
      "tools/list": { tools: TOOLS },
    };
    const reply =
      message.method in results
        ? { jsonrpc: "2.0", id: message.id, result: results[message.method] }
        : { jsonrpc: "2.0", id: message.id, error: { code: -32601, message: "Method not found" } };
    res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify(reply));
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve({ server, requests, url: `http://127.0.0.1:${server.address().port}/mcp` }));
  });
}

/** A stdio MCP client talking to mcp-remote, as the user's MCP client would. */
function startProxy({ url, apiKey, home }) {
  const invocation = buildProxyInvocation({ mcpRemoteEntry: resolveMcpRemoteEntry(), apiKey, url });
  // HOME isolates mcp-remote's token cache (~/.mcp-auth) from the
  // developer's own; the key variables are dropped so a real key in the
  // developer's shell can't reach the run.
  const { SHEETSDATA_API_KEY: _k, SHEETSDATA_AUTH_HEADER: _h, ...inherited } = process.env;
  const child = spawn(invocation.command, invocation.args, {
    env: { ...inherited, HOME: home, USERPROFILE: home, ...invocation.env },
    stdio: ["pipe", "pipe", "pipe"],
  });
  let stderr = "";
  child.stderr.setEncoding("utf8").on("data", (chunk) => (stderr += chunk));
  let buffer = "";
  const pending = new Map();
  child.stdout.setEncoding("utf8").on("data", (chunk) => {
    buffer += chunk;
    let newline;
    while ((newline = buffer.indexOf("\n")) !== -1) {
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      if (!line) continue;
      const message = JSON.parse(line);
      pending.get(message.id)?.(message);
      pending.delete(message.id);
    }
  });
  const send = (message) => child.stdin.write(`${JSON.stringify(message)}\n`);
  const request = (id, method, params = {}) =>
    new Promise((resolve) => {
      pending.set(id, resolve);
      send({ jsonrpc: "2.0", id, method, params });
    });
  return { child, send, request, stderr: () => stderr };
}

describe("the pinned mcp-remote against a 2025-11-25 server", () => {
  let fake;
  let home;

  before(async () => {
    fake = await startServer();
    home = mkdtempSync(join(tmpdir(), "sheetsdata-proxy-"));
  });

  after(() => {
    fake.server.close();
    rmSync(home, { recursive: true, force: true });
  });

  async function handshake(apiKey) {
    fake.requests.length = 0;
    const proxy = startProxy({ url: fake.url, apiKey, home });
    try {
      const init = await proxy.request(1, "initialize", {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: {},
        clientInfo: { name: "test-client", version: "0.0.0" },
      });
      proxy.send({ jsonrpc: "2.0", method: "notifications/initialized" });
      const list = await proxy.request(2, "tools/list");
      return { init, list, stderr: proxy.stderr() };
    } finally {
      proxy.child.kill("SIGTERM");
      await once(proxy.child, "exit");
    }
  }

  test("without an API key: the client's handshake reaches the server and its tools come back", { timeout: 30_000 }, async () => {
    const { init, list } = await handshake("");
    assert.equal(init.result?.protocolVersion, PROTOCOL_VERSION, JSON.stringify(init));
    assert.deepEqual(list.result?.tools, TOOLS);

    // mcp-remote opens a probe connection of its own before it forwards
    // the client's handshake; the client's is the one naming the client.
    const methods = fake.requests.map((r) => r.method);
    assert.ok(!methods.includes("server/discover"), "the proxy must not probe the 2026-07-28 era");
    const clientInit = fake.requests.find(
      (r) => r.method === "initialize" && r.params.clientInfo.name.startsWith("test-client")
    );
    assert.ok(clientInit, `the client's initialize was not forwarded: ${methods.join(", ")}`);
    assert.equal(clientInit.params.protocolVersion, PROTOCOL_VERSION);
    const toolsList = fake.requests.find((r) => r.method === "tools/list");
    assert.equal(toolsList.headers["mcp-protocol-version"], PROTOCOL_VERSION);
    assert.ok(fake.requests.every((r) => r.headers.authorization === undefined));
  });

  test("with an API key: every request carries it as a Bearer header", { timeout: 30_000 }, async () => {
    const { init, list, stderr } = await handshake("test-key-value");
    assert.equal(init.result?.protocolVersion, PROTOCOL_VERSION, JSON.stringify(init));
    assert.equal(list.result?.tools.length, TOOLS.length);
    assert.ok(fake.requests.length >= 3);
    for (const r of fake.requests) {
      assert.equal(r.headers.authorization, "Bearer test-key-value", r.method);
    }
    // The header was filled in from the environment, so the proxy never
    // had the key on its command line.
    assert.ok(!stderr.includes("test-key-value"), "the proxy logged the API key");
  });
});

#!/usr/bin/env node

/**
 * SheetsData MCP — thin proxy to the hosted MCP server.
 *
 * Usage:
 *   npx sheetsdata-mcp                        # OAuth (browser login)
 *   npx sheetsdata-mcp --api-key <key>        # API key
 *   SHEETSDATA_API_KEY=<key> npx sheetsdata-mcp
 *
 * When no API key is provided, mcp-remote handles OAuth automatically —
 * it opens a browser tab for you to authorize, then caches the token.
 *
 * This uses mcp-remote to proxy stdio ↔ Streamable HTTP so that
 * clients like Claude Desktop (which only support stdio) can connect
 * to the hosted SheetsData MCP server.
 */

import { spawn } from "node:child_process";

const MCP_URL = "https://mcp.sheetsdata.com/mcp";

// Parse --api-key flag
let apiKey = process.env.SHEETSDATA_API_KEY || "";
const keyIdx = process.argv.indexOf("--api-key");
if (keyIdx !== -1 && process.argv[keyIdx + 1]) {
  apiKey = process.argv[keyIdx + 1];
}

const args = ["-y", "mcp-remote", MCP_URL];

if (apiKey) {
  args.push("--header", `Authorization: Bearer ${apiKey}`);
} else {
  console.error(
    "No API key set — will use OAuth (a browser tab will open to authorize).\n" +
    "To use an API key instead, set SHEETSDATA_API_KEY or pass --api-key <key>\n"
  );
}

const child = spawn("npx", args, {
  stdio: "inherit",
  env: { ...process.env },
});

child.on("exit", (code) => process.exit(code ?? 0));
child.on("error", (err) => {
  console.error("Failed to start mcp-remote:", err.message);
  process.exit(1);
});

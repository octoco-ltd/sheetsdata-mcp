#!/usr/bin/env node

/**
 * SheetsData MCP — thin proxy to the hosted MCP server.
 *
 * Usage:
 *   npx sheetsdata-mcp
 *
 * The API key is read from the SHEETSDATA_API_KEY environment variable
 * or passed via --api-key flag.
 *
 * This uses mcp-remote to proxy stdio ↔ Streamable HTTP so that
 * clients like Claude Desktop (which only support stdio) can connect
 * to the hosted SheetsData MCP server.
 */

import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const MCP_URL = "https://mcp.sheetsdata.com/mcp";

// Parse --api-key flag
let apiKey = process.env.SHEETSDATA_API_KEY || "";
const keyIdx = process.argv.indexOf("--api-key");
if (keyIdx !== -1 && process.argv[keyIdx + 1]) {
  apiKey = process.argv[keyIdx + 1];
}

if (!apiKey) {
  console.error(
    "Error: No API key provided.\n\n" +
    "Set SHEETSDATA_API_KEY environment variable or pass --api-key <key>\n\n" +
    "Get your API key at: https://sheetsdata.com/dashboard/keys"
  );
  process.exit(1);
}

// Build the URL with auth header
const headerFlag = `Authorization: Bearer ${apiKey}`;

// Resolve mcp-remote binary
const __dirname = dirname(fileURLToPath(import.meta.url));
const mcpRemoteBin = join(__dirname, "..", "node_modules", ".bin", "mcp-remote");

const child = spawn(
  "npx",
  ["-y", "mcp-remote", MCP_URL, "--header", headerFlag],
  {
    stdio: "inherit",
    env: { ...process.env },
  }
);

child.on("exit", (code) => process.exit(code ?? 0));
child.on("error", (err) => {
  console.error("Failed to start mcp-remote:", err.message);
  process.exit(1);
});

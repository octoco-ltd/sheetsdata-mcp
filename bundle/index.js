#!/usr/bin/env node

/**
 * DXT/MCPB bundle entry point.
 *
 * This file ships inside the .mcpb zip together with a frozen
 * ``node_modules/mcp-remote`` directory, so it can run without
 * ``npm`` or ``npx`` being available — invoking the bundled
 * mcp-remote binary directly through ``process.execPath`` (the same
 * Node that's running this file).
 *
 * The manifest passes ``SHEETSDATA_API_KEY`` via the user_config
 * mechanism — if the user pasted a key on install, we forward it as
 * an Authorization header; if blank, mcp-remote handles OAuth in a
 * browser tab on first launch.
 */

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const MCP_URL = "https://mcp.sheetsdata.com/mcp";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// mcp-remote ships its main entry at dist/proxy.js. Some 0.x releases
// have shipped it at dist/index.js — fall back if proxy.js is missing.
const candidates = [
  join(__dirname, "node_modules", "mcp-remote", "dist", "proxy.js"),
  join(__dirname, "node_modules", "mcp-remote", "dist", "index.js"),
];
const mcpRemoteEntry = candidates.find((p) => existsSync(p));
if (!mcpRemoteEntry) {
  console.error(
    "Bundled mcp-remote not found. Tried:\n  " +
      candidates.join("\n  ") +
      "\nPlease reinstall the SheetsData extension."
  );
  process.exit(1);
}

const apiKey = (process.env.SHEETSDATA_API_KEY || "").trim();

const args = [mcpRemoteEntry, MCP_URL];
if (apiKey) {
  args.push("--header", `Authorization: Bearer ${apiKey}`);
} else {
  // mcp-remote will start its OAuth flow on first run and cache the
  // token at ~/.mcp-auth/. No environment variable change needed.
  console.error(
    "[sheetsdata-mcp] No SHEETSDATA_API_KEY set — using OAuth.\n" +
      "[sheetsdata-mcp] Browser tab will open on first run; token caches locally."
  );
}

const child = spawn(process.execPath, args, {
  stdio: "inherit",
  env: process.env,
});

child.on("exit", (code) => process.exit(code ?? 0));
child.on("error", (err) => {
  console.error("[sheetsdata-mcp] Failed to start mcp-remote:", err.message);
  process.exit(1);
});

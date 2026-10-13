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
 *
 * The header is passed through mcp-remote's own ``${ENV_VAR}``
 * interpolation (a literal ``${SHEETSDATA_AUTH_HEADER}`` on argv,
 * with the real value only in the child's env) rather than embedded
 * directly in argv, so the key never shows up in ``ps`` output on
 * the user's machine. See bin/cli.js for the full rationale — this
 * bundle entry point mirrors that fix.
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
const childEnv = { ...process.env };
if (apiKey) {
  // No space after the colon, and a bare `${VAR}` reference as the
  // value — mcp-remote substitutes it from the child's environment
  // at startup, so the actual key never appears in argv/`ps`.
  args.push("--header", "Authorization:${SHEETSDATA_AUTH_HEADER}");
  childEnv.SHEETSDATA_AUTH_HEADER = `Bearer ${apiKey}`;
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
  env: childEnv,
});

child.on("exit", (code) => process.exit(code ?? 0));
child.on("error", (err) => {
  console.error("[sheetsdata-mcp] Failed to start mcp-remote:", err.message);
  process.exit(1);
});

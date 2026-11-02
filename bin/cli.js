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
 *
 * Implementation notes:
 *  - We resolve mcp-remote's CLI entry point from *this package's*
 *    own dependency tree (via `createRequire(...).resolve(...)`) and
 *    run it directly with `process.execPath`, instead of shelling
 *    out to `npx -y mcp-remote`. `npx` resolves packages relative to
 *    the *caller's* working directory (installing a fresh copy if
 *    none is found there), so it silently ignores our pinned
 *    `dependencies.mcp-remote` version and floats to whatever is
 *    latest on the registry. It also fails on Windows without
 *    `shell: true`, because the real executable there is `npx.cmd`,
 *    not `npx` — spawning a bare "npx" throws ENOENT.
 *  - The API key never appears on the child's command line, where it
 *    would be visible to other local users via `ps`. Instead it's
 *    passed through mcp-remote's own `${ENV_VAR}` header-
 *    interpolation support (confirmed in the pinned 0.1.38's source:
 *    it replaces `${NAME}` in `--header` values with `process.env`
 *    at startup): the literal string `${SHEETSDATA_AUTH_HEADER}`
 *    goes on argv, and the real `Bearer <key>` value travels only via
 *    the child's environment. mcp-remote's README documents this
 *    same form as the workaround for a Cursor/Claude-Desktop
 *    (Windows) bug that mangles spaces inside argv — it doubles as
 *    our `ps`-visibility fix.
 */

import { spawn } from "node:child_process";
import { realpathSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const MCP_URL = "https://mcp.sheetsdata.com/mcp";

// mcp-remote's package.json has no `exports` map, so subpath
// resolution through node_modules behaves like any pre-"exports"
// package: `require.resolve` walks the real dependency tree starting
// from *this* file, which is exactly what we want — it never
// consults the caller's cwd the way `npx` does.
const MCP_REMOTE_CANDIDATES = ["mcp-remote/dist/proxy.js", "mcp-remote/dist/index.js"];

/**
 * Resolve mcp-remote's CLI entry point from our own dependency tree.
 * Tries `dist/proxy.js` (the documented `bin` target as of 0.1.38)
 * first, then falls back to `dist/index.js` — the same fallback
 * bundle/index.js uses for the DXT bundle, in case a future pinned
 * version ships its CLI under a different filename. Returns `null`
 * if neither resolves (e.g. `npm install` was never run).
 *
 * `requireFn` is injected so this is unit-testable without touching
 * a real mcp-remote install — see test/cli.test.js.
 */
export function resolveMcpRemoteEntry(requireFn = createRequire(import.meta.url)) {
  for (const specifier of MCP_REMOTE_CANDIDATES) {
    try {
      return requireFn.resolve(specifier);
    } catch (err) {
      if (err?.code !== "MODULE_NOT_FOUND") throw err;
      // else: try the next candidate
    }
  }
  return null;
}

/**
 * Build the argv/env for the mcp-remote child process. Pure function
 * — no I/O, no process access — so it's cheap to unit test.
 *
 * When an API key is present it's passed as a `Bearer` header via
 * mcp-remote's `${VAR}` env-var interpolation (see module docstring)
 * rather than being embedded directly in `args`.
 */
export function buildProxyInvocation({ mcpRemoteEntry, apiKey, url = MCP_URL }) {
  if (!mcpRemoteEntry) {
    throw new Error(
      "mcp-remote is not installed (resolveMcpRemoteEntry found neither " +
        "dist/proxy.js nor dist/index.js). Run `npm install` in this " +
        "package, or reinstall @sheetsdata/mcp."
    );
  }

  const args = [mcpRemoteEntry, url];
  const env = {};

  if (apiKey) {
    // No space after the colon, and a bare `${VAR}` reference as the
    // value — both deliberate. This is mcp-remote's own documented
    // form for header values (it also happens to be the workaround
    // for the Cursor/Windows arg-mangling bug mentioned above).
    args.push("--header", "Authorization:${SHEETSDATA_AUTH_HEADER}");
    env.SHEETSDATA_AUTH_HEADER = `Bearer ${apiKey}`;
  }

  return { command: process.execPath, args, env };
}

function main() {
  // --api-key wins over SHEETSDATA_API_KEY. Both are trimmed, as
  // bundle/index.js does: a key pasted with a trailing newline would
  // otherwise become a malformed Bearer header, and a whitespace-only
  // value means "no key".
  const keyIdx = process.argv.indexOf("--api-key");
  const flagKey = keyIdx === -1 ? "" : (process.argv[keyIdx + 1] ?? "").trim();
  const apiKey = flagKey || (process.env.SHEETSDATA_API_KEY ?? "").trim();

  if (!apiKey) {
    console.error(
      "No API key set — will use OAuth (a browser tab will open to authorize).\n" +
        "To use an API key instead, set SHEETSDATA_API_KEY or pass --api-key <key>\n"
    );
  }

  let invocation;
  try {
    invocation = buildProxyInvocation({ mcpRemoteEntry: resolveMcpRemoteEntry(), apiKey });
  } catch (err) {
    console.error(err.message);
    process.exit(1);
    return;
  }

  const child = spawn(invocation.command, invocation.args, {
    stdio: "inherit",
    env: { ...process.env, ...invocation.env },
  });

  child.on("exit", (code) => process.exit(code ?? 0));
  child.on("error", (err) => {
    console.error("Failed to start mcp-remote:", err.message);
    process.exit(1);
  });
}

/**
 * True when `moduleUrl` is the script Node was launched with — i.e. this
 * file is running as the `sheetsdata-mcp` bin or via `node bin/cli.js`,
 * not being imported by the tests.
 *
 * Compares *real* paths on purpose. npm installs bins as symlinks
 * (`node_modules/.bin/sheetsdata-mcp` → `../@sheetsdata/mcp/bin/cli.js`)
 * and Node resolves the main module's `import.meta.url` through that
 * symlink while leaving `process.argv[1]` as the symlink path, so the
 * usual `import.meta.url === pathToFileURL(process.argv[1]).href` check
 * is false for every `npx @sheetsdata/mcp` launch and the CLI would exit
 * 0 having done nothing. Exported for the regression test.
 */
export function isMainModule(argv1 = process.argv[1], moduleUrl = import.meta.url) {
  if (!argv1) return false;
  try {
    return realpathSync(argv1) === realpathSync(fileURLToPath(moduleUrl));
  } catch {
    return false;
  }
}

if (isMainModule()) {
  main();
}

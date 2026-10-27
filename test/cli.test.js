// Tests for bin/cli.js: its pure argv/env-building helpers, and main()
// run as a real process (see the main() suite at the end).
//
// Importing bin/cli.js is safe here: its top-level side effects (the
// `spawn` call) only run inside `main()`, which is gated behind
// `isMainModule()` — false when this file, not bin/cli.js, is the
// process entry point (i.e. under `node --test`).

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { after, before, describe, test } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { buildProxyInvocation, isMainModule, resolveMcpRemoteEntry } from "../bin/cli.js";

test("buildProxyInvocation: OAuth path (no API key) omits --header entirely", () => {
  const invocation = buildProxyInvocation({
    mcpRemoteEntry: "/fake/node_modules/mcp-remote/dist/proxy.js",
    apiKey: "",
  });

  assert.equal(invocation.command, process.execPath);
  assert.deepEqual(invocation.args, [
    "/fake/node_modules/mcp-remote/dist/proxy.js",
    "https://mcp.sheetsdata.com/mcp",
  ]);
  assert.deepEqual(invocation.env, {});
});

test("buildProxyInvocation: API key is passed via env-var header interpolation, never inline", () => {
  const invocation = buildProxyInvocation({
    mcpRemoteEntry: "/fake/node_modules/mcp-remote/dist/proxy.js",
    apiKey: "sk-live-secret-value",
  });

  // The literal `${VAR}` placeholder goes on argv; the real secret
  // never does, so it can't leak via `ps`.
  assert.deepEqual(invocation.args, [
    "/fake/node_modules/mcp-remote/dist/proxy.js",
    "https://mcp.sheetsdata.com/mcp",
    "--header",
    "Authorization:${SHEETSDATA_AUTH_HEADER}",
  ]);
  assert.equal(invocation.env.SHEETSDATA_AUTH_HEADER, "Bearer sk-live-secret-value");
  assert.ok(
    invocation.args.every((a) => !a.includes("sk-live-secret-value")),
    "the raw API key must never appear in argv"
  );
});

test("buildProxyInvocation: no space after the header colon (Cursor/Windows arg-mangling workaround)", () => {
  const invocation = buildProxyInvocation({
    mcpRemoteEntry: "/fake/proxy.js",
    apiKey: "k",
  });
  const headerArg = invocation.args[invocation.args.indexOf("--header") + 1];
  assert.match(headerArg, /^Authorization:\$\{SHEETSDATA_AUTH_HEADER\}$/);
});

test("buildProxyInvocation: honors a custom url", () => {
  const invocation = buildProxyInvocation({
    mcpRemoteEntry: "/fake/proxy.js",
    apiKey: "",
    url: "https://example.test/mcp",
  });
  assert.equal(invocation.args[1], "https://example.test/mcp");
});

test("buildProxyInvocation: throws a helpful error when mcp-remote wasn't resolved", () => {
  assert.throws(
    () => buildProxyInvocation({ mcpRemoteEntry: null, apiKey: "" }),
    /mcp-remote is not installed/
  );
});

test("resolveMcpRemoteEntry: resolves dist/proxy.js when present", () => {
  const fakeRequire = {
    resolve(specifier) {
      if (specifier === "mcp-remote/dist/proxy.js") {
        return "/fake/node_modules/mcp-remote/dist/proxy.js";
      }
      const err = new Error(`Cannot find module '${specifier}'`);
      err.code = "MODULE_NOT_FOUND";
      throw err;
    },
  };
  assert.equal(resolveMcpRemoteEntry(fakeRequire), "/fake/node_modules/mcp-remote/dist/proxy.js");
});

test("resolveMcpRemoteEntry: falls back to dist/index.js when proxy.js is missing", () => {
  const fakeRequire = {
    resolve(specifier) {
      if (specifier === "mcp-remote/dist/index.js") {
        return "/fake/node_modules/mcp-remote/dist/index.js";
      }
      const err = new Error(`Cannot find module '${specifier}'`);
      err.code = "MODULE_NOT_FOUND";
      throw err;
    },
  };
  assert.equal(resolveMcpRemoteEntry(fakeRequire), "/fake/node_modules/mcp-remote/dist/index.js");
});

test("resolveMcpRemoteEntry: returns null when mcp-remote isn't installed at all", () => {
  const fakeRequire = {
    resolve(specifier) {
      const err = new Error(`Cannot find module '${specifier}'`);
      err.code = "MODULE_NOT_FOUND";
      throw err;
    },
  };
  assert.equal(resolveMcpRemoteEntry(fakeRequire), null);
});

test("resolveMcpRemoteEntry: rethrows unexpected (non-MODULE_NOT_FOUND) errors", () => {
  const fakeRequire = {
    resolve() {
      throw new Error("boom");
    },
  };
  assert.throws(() => resolveMcpRemoteEntry(fakeRequire), /boom/);
});

test("resolveMcpRemoteEntry: resolves the real, installed mcp-remote dependency", () => {
  // Not a mock — exercises the actual pinned dependency, so a broken
  // resolution path (e.g. an `exports` map added in a future
  // mcp-remote release that blocks subpath access) fails this test
  // instead of only failing at runtime for end users.
  const entry = resolveMcpRemoteEntry();
  assert.ok(entry, "expected mcp-remote to resolve from node_modules — did you run `npm ci`?");
  assert.ok(
    entry.endsWith("proxy.js") || entry.endsWith("index.js"),
    `unexpected resolved entry: ${entry}`
  );
});

test("isMainModule: recognises the entry point through an npm-style bin symlink", () => {
  // npm installs bins as symlinks; Node reports the *real* path in
  // import.meta.url but the *symlink* path in process.argv[1]. The
  // guard must still say "yes, run main()" or `npx @sheetsdata/mcp`
  // exits 0 having done nothing.
  const dir = mkdtempSync(join(tmpdir(), "sheetsdata-cli-"));
  try {
    const real = join(dir, "cli.js");
    writeFileSync(real, "");
    const link = join(dir, "sheetsdata-mcp");
    symlinkSync(real, link);
    const moduleUrl = pathToFileURL(real).href;

    assert.equal(isMainModule(link, moduleUrl), true, "symlinked bin");
    assert.equal(isMainModule(real, moduleUrl), true, "direct `node bin/cli.js`");
    assert.equal(isMainModule(join(dir, "test.js"), moduleUrl), false, "imported by another entry point");
    assert.equal(isMainModule(join(dir, "missing.js"), moduleUrl), false, "argv[1] that does not exist");
    assert.equal(isMainModule(undefined, moduleUrl), false, "no argv[1] (REPL / -e)");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// main() is exercised black-box: a copy of cli.js runs as a real process
// next to a fake mcp-remote, which resolveMcpRemoteEntry() finds the same
// way it finds the real one. The fake prints what it was launched with
// and exits with the code it is told to.
describe("main()", () => {
  const CLI_SOURCE = join(dirname(fileURLToPath(import.meta.url)), "..", "bin", "cli.js");
  const FAKE_MCP_REMOTE = `
process.stdout.write(JSON.stringify({
  args: process.argv.slice(2),
  authHeader: process.env.SHEETSDATA_AUTH_HEADER ?? null,
}));
process.exit(Number(process.env.FAKE_MCP_REMOTE_EXIT_CODE ?? 0));
`;
  let dir;
  let cli;

  before(() => {
    dir = mkdtempSync(join(tmpdir(), "sheetsdata-cli-main-"));
    writeFileSync(join(dir, "package.json"), JSON.stringify({ type: "module" }));
    mkdirSync(join(dir, "bin"));
    cli = join(dir, "bin", "cli.js");
    copyFileSync(CLI_SOURCE, cli);
    const fakePackage = join(dir, "node_modules", "mcp-remote");
    mkdirSync(join(fakePackage, "dist"), { recursive: true });
    writeFileSync(join(fakePackage, "package.json"), JSON.stringify({ name: "mcp-remote", version: "0.0.0-fake" }));
    writeFileSync(join(fakePackage, "dist", "proxy.js"), FAKE_MCP_REMOTE);
  });

  after(() => rmSync(dir, { recursive: true, force: true }));

  // Only PATH is inherited, so a SHEETSDATA_API_KEY in the developer's
  // own shell can't leak into these runs.
  function runCli(args = [], env = {}) {
    const result = spawnSync(process.execPath, [cli, ...args], {
      env: { PATH: process.env.PATH, ...env },
      encoding: "utf8",
    });
    assert.ok(result.stdout, `mcp-remote was never launched; stderr:\n${result.stderr}`);
    return { status: result.status, stderr: result.stderr, launched: JSON.parse(result.stdout) };
  }

  test("--api-key overrides SHEETSDATA_API_KEY", () => {
    const { status, launched } = runCli(["--api-key", "from-flag"], { SHEETSDATA_API_KEY: "from-env" });
    assert.equal(status, 0);
    assert.equal(launched.authHeader, "Bearer from-flag");
    assert.deepEqual(launched.args, ["https://mcp.sheetsdata.com/mcp", "--header", "Authorization:${SHEETSDATA_AUTH_HEADER}"]);
  });

  test("SHEETSDATA_API_KEY is used when --api-key is absent", () => {
    const { launched } = runCli([], { SHEETSDATA_API_KEY: "from-env" });
    assert.equal(launched.authHeader, "Bearer from-env");
  });

  test("--api-key without a value falls back to SHEETSDATA_API_KEY", () => {
    const { launched } = runCli(["--api-key"], { SHEETSDATA_API_KEY: "from-env" });
    assert.equal(launched.authHeader, "Bearer from-env");
  });



  test("no API key takes the OAuth path", () => {
    const { status, stderr, launched } = runCli();
    assert.equal(status, 0);
    assert.equal(launched.authHeader, null);
    assert.deepEqual(launched.args, ["https://mcp.sheetsdata.com/mcp"]);
    assert.match(stderr, /will use OAuth/);
  });

  test("mcp-remote's exit code becomes the CLI's exit code", () => {
    assert.equal(runCli([], { FAKE_MCP_REMOTE_EXIT_CODE: "0" }).status, 0);
    assert.equal(runCli([], { FAKE_MCP_REMOTE_EXIT_CODE: "3" }).status, 3);
  });
});

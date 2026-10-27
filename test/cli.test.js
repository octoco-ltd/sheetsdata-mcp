// Smoke tests for bin/cli.js's pure argv/env-building logic.
//
// Importing bin/cli.js is safe here: its top-level side effects (the
// `spawn` call) only run inside `main()`, which is gated behind
// `isMainModule()` — false when this file, not bin/cli.js, is the
// process entry point (i.e. under `node --test`).

import assert from "node:assert/strict";
import { mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { pathToFileURL } from "node:url";
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

// How both entry points, bin/cli.js (npx) and bundle/index.js (Claude
// Desktop), handle mcp-remote's lifetime: signals sent to the wrapper
// reach mcp-remote, and the wrapper's exit status reports how
// mcp-remote ended. Each runs as a real process next to a fake
// mcp-remote, laid out the way each finds the real one.
//
// POSIX only: on Windows a signal sent to the wrapper terminates it
// outright, so its handlers never run and forwarding cannot be observed.

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { after, before, describe, test } from "node:test";
import { fileURLToPath } from "node:url";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

// Says "ready" once its handlers are in place, reports the signal it
// receives and exits 7, so a test can tell the wrapper exited because
// mcp-remote did. It exits by itself after 10 s, so a wrapper that dies
// without forwarding cannot leave it running.
const FAKE_MCP_REMOTE = `
if (process.env.FAKE_MCP_REMOTE_SELF_KILL) process.kill(process.pid, "SIGKILL");
const deadline = setTimeout(() => process.exit(99), 10_000);
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    process.stdout.write("received " + signal + "\\n");
    process.exitCode = 7;
    clearTimeout(deadline);
  });
}
process.stdout.write("ready\\n");
`;

const ENTRY_POINTS = [
  { name: "bin/cli.js", source: join(REPO_ROOT, "bin", "cli.js"), path: ["bin", "cli.js"] },
  { name: "bundle/index.js", source: join(REPO_ROOT, "bundle", "index.js"), path: ["index.js"] },
];

describe("signals and exit status", { skip: process.platform === "win32" && "no POSIX signals on Windows" }, () => {
  let dir;

  // One directory serves both: bin/cli.js resolves mcp-remote through
  // node_modules from its parent, bundle/index.js from its own folder.
  before(() => {
    dir = mkdtempSync(join(tmpdir(), "sheetsdata-signals-"));
    writeFileSync(join(dir, "package.json"), JSON.stringify({ type: "module" }));
    for (const entry of ENTRY_POINTS) {
      mkdirSync(join(dir, ...entry.path.slice(0, -1)), { recursive: true });
      copyFileSync(entry.source, join(dir, ...entry.path));
    }
    const fakePackage = join(dir, "node_modules", "mcp-remote");
    mkdirSync(join(fakePackage, "dist"), { recursive: true });
    writeFileSync(join(fakePackage, "package.json"), JSON.stringify({ name: "mcp-remote", version: "0.0.0-fake" }));
    writeFileSync(join(fakePackage, "dist", "proxy.js"), FAKE_MCP_REMOTE);
  });

  after(() => rmSync(dir, { recursive: true, force: true }));

  function start(entry, env = {}) {
    const { SHEETSDATA_API_KEY: _key, ...inherited } = process.env;
    const wrapper = spawn(process.execPath, [join(dir, ...entry.path)], {
      env: { ...inherited, ...env },
      stdio: ["pipe", "pipe", "ignore"],
    });
    let stdout = "";
    const ready = new Promise((resolve) => {
      wrapper.stdout.setEncoding("utf8").on("data", (chunk) => {
        stdout += chunk;
        if (stdout.includes("ready\n")) resolve();
      });
    });
    const closed = once(wrapper, "close").then(([code, signal]) => ({ code, signal, stdout }));
    return { wrapper, ready, closed };
  }

  for (const entry of ENTRY_POINTS) {
    for (const signal of ["SIGINT", "SIGTERM"]) {
      test(`${entry.name}: ${signal} reaches mcp-remote, whose exit ends the wrapper`, { timeout: 15_000 }, async () => {
        const { wrapper, ready, closed } = start(entry);
        await ready;
        wrapper.kill(signal);
        const { code, signal: wrapperSignal, stdout } = await closed;
        assert.match(stdout, new RegExp(`received ${signal}\\n`));
        assert.deepEqual({ code, signal: wrapperSignal }, { code: 7, signal: null });
      });
    }

    test(`${entry.name}: mcp-remote killed by SIGKILL exits the wrapper with 137, not 0`, { timeout: 15_000 }, async () => {
      const { closed } = start(entry, { FAKE_MCP_REMOTE_SELF_KILL: "1" });
      const { code, signal } = await closed;
      assert.deepEqual({ code, signal }, { code: 137, signal: null });
    });
  }
});

#!/usr/bin/env node
/**
 * Print the CHANGELOG.md section for one version.
 *
 *   node scripts/release-notes.mjs X.Y.Z
 *
 * The release workflow uses the output as the GitHub Release body, and
 * CI runs it for package.json's version so a version bump without an
 * entry fails on the PR rather than at release time.
 */

import { readFileSync, realpathSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const CHANGELOG = join(dirname(fileURLToPath(import.meta.url)), "..", "CHANGELOG.md");

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * The body of the `## [version]` section of `changelog` (Keep a
 * Changelog headings: `## [1.3.3] - 2026-10-13`), without its heading.
 * Throws when the section is missing or empty.
 */
export function releaseNotes(changelog, version) {
  const heading = new RegExp(`^## \\[${escapeRegExp(version)}\\](?:\\s|$)`);
  const lines = changelog.split(/\r?\n/);
  const start = lines.findIndex((line) => heading.test(line));
  if (start === -1) {
    throw new Error(`CHANGELOG.md has no "## [${version}]" section`);
  }
  const end = lines.findIndex((line, i) => i > start && /^## /.test(line));
  const body = lines
    .slice(start + 1, end === -1 ? undefined : end)
    .join("\n")
    .trim();
  if (!body) {
    throw new Error(`CHANGELOG.md's "## [${version}]" section is empty`);
  }
  return body;
}

export function main(argv) {
  if (argv.length !== 1) {
    console.error("usage: node scripts/release-notes.mjs X.Y.Z");
    return 2;
  }
  try {
    process.stdout.write(`${releaseNotes(readFileSync(CHANGELOG, "utf8"), argv[0])}\n`);
    return 0;
  } catch (err) {
    console.error(err.message);
    return 1;
  }
}

function isMainModule() {
  try {
    return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (isMainModule()) {
  process.exitCode = main(process.argv.slice(2));
}

// Tests for scripts/release-notes.mjs, which turns a CHANGELOG.md
// section into the GitHub Release body.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { releaseNotes } from "../scripts/release-notes.mjs";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const CHANGELOG = `# Changelog

Intro text.

## [Unreleased]

## [1.10.0] - 2026-11-01

### Added

- Ten.

## [1.3.3] - 2026-10-13

### Fixed

- The fix.

## [1.3.2]

- Older.
`;

test("returns the section body without its heading, up to the next version", () => {
  assert.equal(releaseNotes(CHANGELOG, "1.3.3"), "### Fixed\n\n- The fix.");
  assert.equal(releaseNotes(CHANGELOG, "1.10.0"), "### Added\n\n- Ten.");
});

test("the last section runs to the end of the file", () => {
  assert.equal(releaseNotes(CHANGELOG, "1.3.2"), "- Older.");
});

test("versions match exactly: dots are not wildcards and prefixes don't match", () => {
  assert.throws(() => releaseNotes(CHANGELOG, "1.3"), /no "## \[1\.3\]" section/);
  assert.throws(() => releaseNotes(CHANGELOG, "1x3x3"), /no "## \[1x3x3\]" section/);
  assert.throws(() => releaseNotes(CHANGELOG, "1.0.0"), /no "## \[1\.0\.0\]" section/);
});

test("an empty section is an error, not an empty release body", () => {
  assert.throws(() => releaseNotes(CHANGELOG, "Unreleased"), /section is empty/);
});

test("CRLF line endings are handled", () => {
  assert.equal(releaseNotes(CHANGELOG.replace(/\n/g, "\r\n"), "1.3.3"), "### Fixed\n\n- The fix.");
});

test("the repo's CHANGELOG has an entry for package.json's version", () => {
  const { version } = JSON.parse(readFileSync(join(REPO_ROOT, "package.json"), "utf8"));
  const changelog = readFileSync(join(REPO_ROOT, "CHANGELOG.md"), "utf8");
  assert.ok(releaseNotes(changelog, version).length > 0);
});

#!/usr/bin/env bash
# Build the SheetsData DXT/MCPB bundle.
#
# Output: ``dist/sheetsdata-${VERSION}.mcpb`` — drag-and-drop into
# Claude Desktop to install.
#
# What it does:
#   1. Checks that every version field agrees (see
#      ``scripts/versions.mjs``) and reads the version from
#      ``manifest.json``.
#   2. Stages a clean ``dist/staging/`` directory.
#   3. Copies the manifest, icon, and bundle entry point.
#   4. Copies the committed ``bundle/package.json`` +
#      ``bundle/package-lock.json`` and runs ``npm ci --omit=dev``
#      inside ``staging/server/`` to materialise a frozen,
#      reproducible ``node_modules`` that ships with the bundle.
#      (Previously this script generated ``package.json`` on the fly
#      and ran ``npm install`` with no lockfile, so mcp-remote's
#      *transitive* deps — express, open, undici, strict-url-sanitise
#      — could float between builds even though mcp-remote itself was
#      pinned. See ``bundle/package.json``.)
#   5. Packs ``staging/`` into ``dist/sheetsdata-${VERSION}.mcpb``
#      with the official ``mcpb`` CLI (pinned in devDependencies),
#      which refuses a manifest Claude Desktop would reject (schema,
#      icon) before it writes the archive.
#
# Run with (after ``npm ci`` at the repo root, for ``mcpb``):
#   ./scripts/build-mcpb.sh
#
# CI builds the bundle on every PR; the ``release.yml`` workflow
# builds it again for a release tag and attaches it to the release.

set -euo pipefail

cd "$(dirname "$0")/.."

# Single source of truth for "do all the version fields agree" — see
# scripts/versions.mjs.
node scripts/versions.mjs check

MCPB="node_modules/.bin/mcpb"
if [ ! -x "${MCPB}" ]; then
  echo "error: ${MCPB} not found. Run \`npm ci\` at the repo root first." >&2
  exit 1
fi

VERSION=$(node -p "require('./manifest.json').version")

OUT_DIR="dist"
STAGE="${OUT_DIR}/staging"
ARTIFACT="${OUT_DIR}/sheetsdata-${VERSION}.mcpb"

rm -rf "${STAGE}"
mkdir -p "${STAGE}/server"

# Manifest + visual assets at bundle root.
cp manifest.json "${STAGE}/"
cp logo.png "${STAGE}/icon.png"

# Bundle entry point + its own committed package.json/lockfile. Kept
# as real files under version control (rather than generated inline)
# so the bundle's node_modules is reproducible — see bundle/package.json.
cp bundle/index.js "${STAGE}/server/index.js"
cp bundle/package.json "${STAGE}/server/package.json"
cp bundle/package-lock.json "${STAGE}/server/package-lock.json"

# ``npm ci`` (not ``install``) so the bundle is built byte-for-byte
# from the committed lockfile every time — no transitive-dependency
# float between builds or between machines.
( cd "${STAGE}/server" && npm ci --omit=dev --no-audit --no-fund --silent )

# Drop npm cruft that bloats the bundle. Deliberately does NOT prune
# by directory name (e.g. the old ``find -name test -prune -exec rm
# -rf`` for "test"/"tests" dirs): some packages ship runtime code
# under directory names like that, and pruning by name risks silently
# deleting code the bundle needs at runtime, producing a bundle that
# only breaks when a user hits that code path. Only prune by file
# extension, which is safe regardless of what's inside.
find "${STAGE}/server/node_modules" -name "*.md" -delete 2>/dev/null || true
find "${STAGE}/server/node_modules" -name "*.markdown" -delete 2>/dev/null || true
find "${STAGE}/server/node_modules" -type d -name ".github" -prune -exec rm -rf {} + 2>/dev/null || true

# Pack with the official CLI rather than a plain zip: it validates the
# staged manifest against the MCPB schema Claude Desktop uses, and
# checks that the icon it names exists, before writing the archive.
# (A hand-zipped bundle once shipped prompts without the `text` field
# that schema requires.)
rm -f "${ARTIFACT}"
"${MCPB}" pack "${STAGE}" "${ARTIFACT}"

# Surface the result.
SIZE=$(du -h "${ARTIFACT}" | cut -f1)
echo "Built ${ARTIFACT} (${SIZE})"
echo "Drag-and-drop into Claude Desktop to install, or attach to a GitHub release."

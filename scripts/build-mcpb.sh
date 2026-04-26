#!/usr/bin/env bash
# Build the SheetsData DXT/MCPB bundle.
#
# Output: ``dist/sheetsdata-${VERSION}.mcpb`` — drag-and-drop into
# Claude Desktop to install.
#
# What it does:
#   1. Reads the version from ``manifest.json``.
#   2. Stages a clean ``dist/staging/`` directory.
#   3. Copies the manifest, icon, and bundle entry point.
#   4. Runs ``npm install --omit=dev --omit=optional`` inside
#      ``staging/server/`` to materialise a frozen ``node_modules``
#      that ships with the bundle.
#   5. Zips ``staging/`` into ``dist/sheetsdata-${VERSION}.mcpb``.
#
# Run with:
#   ./scripts/build-mcpb.sh
#
# Or via the GitHub Actions workflow ``release-bundle.yml`` which
# attaches the .mcpb to every release tag.

set -euo pipefail

cd "$(dirname "$0")/.."

VERSION=$(node -p "require('./manifest.json').version")
PKG_VERSION=$(node -p "require('./package.json').version")

if [ "${VERSION}" != "${PKG_VERSION}" ]; then
  echo "manifest.json version (${VERSION}) does not match package.json version (${PKG_VERSION})" >&2
  echo "Bump both to the same version before building." >&2
  exit 1
fi

OUT_DIR="dist"
STAGE="${OUT_DIR}/staging"
ARTIFACT="${OUT_DIR}/sheetsdata-${VERSION}.mcpb"

rm -rf "${STAGE}"
mkdir -p "${STAGE}/server"

# Manifest + visual assets at bundle root.
cp manifest.json "${STAGE}/"
cp logo.png "${STAGE}/icon.png"

# Bundle entry point + a minimal package.json so ``npm install``
# resolves dependencies at the right scope. The bundled package.json
# only needs the runtime deps (mcp-remote); we trim everything else.
cp bundle/index.js "${STAGE}/server/index.js"

cat > "${STAGE}/server/package.json" <<EOF
{
  "name": "sheetsdata-mcp-bundle-runtime",
  "version": "${VERSION}",
  "private": true,
  "type": "module",
  "dependencies": {
    "mcp-remote": "$(node -p "require('./package.json').dependencies['mcp-remote']")"
  }
}
EOF

# Materialise frozen node_modules inside the bundle so the entry
# point can run without npm/npx/internet access at runtime.
( cd "${STAGE}/server" && npm install --omit=dev --omit=optional --no-audit --no-fund --silent )

# Drop npm cruft that bloats the bundle.
find "${STAGE}/server/node_modules" -name "*.md" -delete 2>/dev/null || true
find "${STAGE}/server/node_modules" -name "*.markdown" -delete 2>/dev/null || true
find "${STAGE}/server/node_modules" -type d -name "test" -prune -exec rm -rf {} + 2>/dev/null || true
find "${STAGE}/server/node_modules" -type d -name "tests" -prune -exec rm -rf {} + 2>/dev/null || true
find "${STAGE}/server/node_modules" -type d -name ".github" -prune -exec rm -rf {} + 2>/dev/null || true

# Zip into the canonical .mcpb name. Claude Desktop accepts .dxt and
# .mcpb interchangeably for now — the rename is for consistency with
# the spec.
( cd "${STAGE}" && zip -qr "../sheetsdata-${VERSION}.mcpb" . )

# Surface the result.
SIZE=$(du -h "${ARTIFACT}" | cut -f1)
echo "Built ${ARTIFACT} (${SIZE})"
echo "Drag-and-drop into Claude Desktop to install, or attach to a GitHub release."

# Releasing

One tag publishes a version everywhere. `.github/workflows/release.yml`
runs on a `vX.Y.Z` tag and:

1. **verify**: checks that every version field and the tag agree, runs
   the tests, and checks that CHANGELOG.md has the version's section;
2. **bundle**: builds `sheetsdata-X.Y.Z.mcpb` with the official `mcpb`
   packer (which validates the manifest) and creates the GitHub Release
   with the CHANGELOG section as its notes and the bundle attached;
3. **npm**: publishes `@sheetsdata/mcp` with a provenance statement;
4. **registry**: once npm serves the new version, publishes `server.json`
   to the [MCP Registry](https://registry.modelcontextprotocol.io).

The README's one-click Claude Desktop link points at the latest
release, so a release without its bundle breaks that install path.

## One-time setup

Nothing is stored as a secret; both registries trust this repository's
workflow through GitHub OIDC.

- **npm**: on npmjs.com, open `@sheetsdata/mcp` → *Settings* →
  *Trusted publishing*, choose *GitHub Actions* and enter organisation
  `octoco-ltd`, repository `sheetsdata-mcp`, workflow filename
  `release.yml`, no environment. A package admin has to do this once.
  Afterwards, *Publishing access* can be set to require two-factor
  authentication and disallow tokens, since CI no longer needs one.
- **MCP Registry**: nothing. `mcp-publisher login github-oidc` grants a
  workflow in the `octoco-ltd` organisation the `io.github.octoco-ltd/*`
  namespace.
- **GitHub Release**: nothing. The job uses the workflow's own token.

## Cutting a release

```bash
git switch -c release/vX.Y.Z origin/main
npm ci

# Every version field moves together (package.json and its lockfile,
# manifest.json, server.json, mcp.json, bundle/package.json and its
# lockfile). Don't edit them by hand or with sed: the lockfiles also
# hold dependency versions.
npm run set-version -- X.Y.Z

# Add a "## [X.Y.Z] - YYYY-MM-DD" section to CHANGELOG.md: it becomes
# the release notes, and the tests fail without it.

npm test
npm run build-mcpb   # the same build CI and the release run
```

Open a PR and merge it once CI is green. Then tag the merge commit:

```bash
git fetch origin main
git tag vX.Y.Z origin/main   # the commit whose package.json says X.Y.Z
git push origin vX.Y.Z
```

## When a job fails

Fix the cause and use *Re-run failed jobs* on the run. Each publishing
job skips a channel that already has the version: npm and the MCP
Registry check before publishing, and an existing GitHub Release only
gets the bundle (re)attached, keeping its notes.

- **npm `ENEEDAUTH` or `E404` on publish**: the trusted publisher above
  is missing or names a different workflow file.
- **registry times out waiting for npm**: the npm job did not publish,
  or npm is slow to serve the new version. Re-run once npm shows it
  (`npm view @sheetsdata/mcp@X.Y.Z mcpName`).
- **verify fails on the tag**: the tag is on a commit with a different
  version. Delete the tag (`git push origin :vX.Y.Z`) and tag the right
  commit; nothing has been published at that point.

A version can't be republished to npm or the registry. Fix forward with
the next patch version.

## Checking a release

```bash
npm view @sheetsdata/mcp@X.Y.Z version mcpName
curl -s "https://registry.modelcontextprotocol.io/v0.1/servers/io.github.octoco-ltd%2Fsheetsdata-mcp/versions/X.Y.Z" | jq .server.version
```

The release page should list `sheetsdata-X.Y.Z.mcpb`.

## Updating pinned tools

- **mcp-remote** (the proxy both the CLI and the bundle run): change
  `dependencies.mcp-remote` in `package.json` and `bundle/package.json`
  together, then run `npm install` at the root and in `bundle/` to
  update both lockfiles. `npm run check-versions` fails if the two pins
  differ.
- **mcpb** (the bundle packer): `npm install --save-dev --save-exact
  @anthropic-ai/mcpb@<version>`.
- **mcp-publisher**: set `MCP_PUBLISHER_VERSION` in `release.yml` and
  `MCP_PUBLISHER_SHA256` to the `mcp-publisher_linux_amd64.tar.gz` line
  of that release's `registry_<version>_checksums.txt`.

#!/usr/bin/env bash
# Release script: builds all publishable packages, verifies each one's `lib/`
# was actually emitted (regression guard against the v2.1.0 bug where the
# tarballs shipped without compiled JS), then runs `changeset publish`.
#
# Always run this via `corepack yarn release` (NOT `corepack yarn changeset
# publish` directly), so lib/ is guaranteed fresh before anything ships.
#
# Bypasses the `proto` shim by prepending nvm's npm to PATH — `changeset
# publish` shells out to `npm publish` per package, and the proto shim
# refuses without an explicit npm install.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

NPM_BIN="${NPM_BIN_OVERRIDE:-/Users/gre/.nvm/versions/node/v24.14.1/bin}"
if [ ! -x "$NPM_BIN/npm" ]; then
  echo "release.sh: npm not found at $NPM_BIN/npm" >&2
  echo "  set NPM_BIN_OVERRIDE to a directory containing a usable npm." >&2
  exit 1
fi
export PATH="$NPM_BIN:$PATH"

echo "==> yarn build (parallel topological)"
corepack yarn build

echo "==> verifying every publishable package has a populated lib/"
missing=0
for pkg_json in packages/*/package.json; do
  pkg_dir="$(dirname "$pkg_json")"
  is_private="$(jq -r '.private // false' "$pkg_json")"
  if [ "$is_private" = "true" ]; then continue; fi
  main="$(jq -r '.main // "lib/index.js"' "$pkg_json")"
  if [ ! -f "$pkg_dir/$main" ]; then
    echo "  MISSING: $pkg_dir/$main" >&2
    missing=$((missing + 1))
  fi
done
if [ "$missing" -gt 0 ]; then
  echo "release.sh: $missing publishable packages have no built artifact, aborting." >&2
  exit 1
fi
echo "  all good."

echo "==> changeset publish"
corepack yarn changeset publish "$@"

echo
echo "Don't forget: git push --follow-tags"

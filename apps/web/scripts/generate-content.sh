#!/usr/bin/env bash
# Generate all three granularity levels of content for the web app.
# Run from apps/web/ or the monorepo root will be detected automatically.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WEB_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
MONO_ROOT="$(cd "$WEB_DIR/../.." && pwd)"
CLI="$MONO_ROOT/packages/cli/dist/index.js"

if [ ! -f "$CLI" ]; then
  echo "CLI not built. Run: pnpm turbo build --filter=@lexbuild/cli"
  exit 1
fi

TITLES="${1:---all}"

echo "=== Generating section-level content ==="
node "$CLI" convert $TITLES -g section -o "$WEB_DIR/content/section" --link-style canonical

echo "=== Generating chapter-level content ==="
node "$CLI" convert $TITLES -g chapter -o "$WEB_DIR/content/chapter" --link-style canonical

echo "=== Generating title-level content ==="
node "$CLI" convert $TITLES -g title -o "$WEB_DIR/content/title" --link-style canonical

echo "=== Generating navigation JSON ==="
cd "$WEB_DIR" && pnpm exec tsx scripts/generate-nav.ts

echo "=== Generating search index ==="
cd "$WEB_DIR" && pnpm exec tsx scripts/generate-search-index.ts

echo "=== Generating sitemap ==="
cd "$WEB_DIR" && pnpm exec tsx scripts/generate-sitemap.ts

echo "=== Done ==="

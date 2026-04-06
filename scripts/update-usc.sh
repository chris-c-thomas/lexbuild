#!/usr/bin/env bash
# update-usc.sh — Check for new USC release point, download, convert, and deploy.
#
# Usage:
#   ./scripts/update-usc.sh                  # Check for new release point
#   ./scripts/update-usc.sh --force          # Force full reconvert
#   ./scripts/update-usc.sh --skip-deploy    # Local only (no VPS push)
#   ./scripts/update-usc.sh --deploy-only    # Push existing output + reindex
#   ./scripts/update-usc.sh --skip-highlights # Skip highlight generation
#
# Steps:
#   1. Check latest OLRC release point against stored checkpoint
#   2. Download all USC titles (bulk zip)
#   3. Convert all titles to Markdown (writeFileIfChanged preserves mtimes)
#   4. Generate highlights for changed sections (mtime-based, skippable)
#   5. Regenerate USC nav JSON
#   6. Regenerate sitemaps
#   7. Save new release point
#   8. Rsync content + nav + sitemaps to VPS
#   9. Incremental search index on VPS
#
# Requires:
#   - Built CLI: pnpm turbo build (or at least @lexbuild/usc + @lexbuild/cli)
#   - For deploy: SSH access to VPS, scripts/.deploy.env with VPS_HOST

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

# --- Load deploy config ---

if [ -f "$SCRIPT_DIR/.deploy.env" ]; then
  source "$SCRIPT_DIR/.deploy.env"
fi

CONTENT_DEST="${CONTENT_DEST:-/srv/lexbuild/content}"
NAV_DEST="${NAV_DEST:-/srv/lexbuild/nav}"

# --- Parse arguments ---

FORCE=false
SKIP_DEPLOY=false
DEPLOY_ONLY=false
SKIP_HIGHLIGHTS=false
LATEST=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --force)
      FORCE=true
      shift
      ;;
    --skip-deploy)
      SKIP_DEPLOY=true
      shift
      ;;
    --deploy-only)
      DEPLOY_ONLY=true
      shift
      ;;
    --skip-highlights)
      SKIP_HIGHLIGHTS=true
      shift
      ;;
    --help|-h)
      sed -n '2,/^$/{ s/^# //; s/^#$//; p }' "$0"
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      echo "Run with --help for usage."
      exit 1
      ;;
  esac
done

if [ "$SKIP_DEPLOY" = true ] && [ "$DEPLOY_ONLY" = true ]; then
  echo "Error: --skip-deploy and --deploy-only are mutually exclusive."
  exit 1
fi

CLI="node packages/cli/dist/index.js"
CHECKPOINT="downloads/usc/.usc-release-point"

# --- Preflight checks ---

if [ ! -f "packages/cli/dist/index.js" ]; then
  echo "Error: CLI not built. Run: pnpm turbo build"
  exit 1
fi

if [ "$SKIP_DEPLOY" = false ] && [ "$DEPLOY_ONLY" = false ] && [ -z "${VPS_HOST:-}" ]; then
  echo "Warning: VPS_HOST not set. Will run local steps only."
  echo "         Set VPS_HOST in scripts/.deploy.env to enable deploy."
  echo ""
  SKIP_DEPLOY=true
fi

if [ "$DEPLOY_ONLY" = true ] && [ -z "${VPS_HOST:-}" ]; then
  echo "Error: --deploy-only requires VPS_HOST. Set it in scripts/.deploy.env."
  exit 1
fi

# --- Step 1–7: Local pipeline (skip if --deploy-only) ---

if [ "$DEPLOY_ONLY" = false ]; then

  # Step 1: Check for new release point
  echo "--- Step 1/7: Checking OLRC release point"
  LATEST=$(node -e "
    import('${REPO_ROOT}/packages/usc/dist/index.js').then(m =>
      m.detectLatestReleasePoint()
    ).then(rp => {
      if (!rp) { console.error('Failed to detect release point'); process.exit(1); }
      process.stdout.write(rp.releasePoint);
    }).catch(e => { console.error(e.message); process.exit(1); });
  ")

  STORED=""
  if [ -f "$CHECKPOINT" ]; then
    STORED=$(cat "$CHECKPOINT")
  fi

  if [ "$FORCE" = false ] && [ "$LATEST" = "$STORED" ]; then
    echo "    USC is current (release point $LATEST). Nothing to do."
    exit 0
  fi

  if [ -n "$STORED" ] && [ "$LATEST" != "$STORED" ]; then
    echo "    New release point: $LATEST (was $STORED)"
  else
    echo "    Release point: $LATEST"
  fi
  echo ""

  # Step 2: Download
  echo "--- Step 2/7: Downloading USC titles"
  $CLI download-usc --all
  echo ""

  # Step 3: Convert
  echo "--- Step 3/7: Converting USC titles"
  $CLI convert-usc --all
  echo ""

  # Step 4: Highlights (optional)
  if [ "$SKIP_HIGHLIGHTS" = true ]; then
    echo "--- Step 4/7: Skipping highlights (--skip-highlights)"
  else
    echo "--- Step 4/7: Generating USC highlights"
    cd apps/astro
    npx tsx scripts/generate-highlights.ts --source usc
    cd "$REPO_ROOT"
  fi
  echo ""

  # Step 5: Nav
  echo "--- Step 5/7: Generating USC nav JSON"
  cd apps/astro
  npx tsx scripts/generate-nav.ts --source usc
  cd "$REPO_ROOT"
  echo ""

  # Step 6: Sitemaps
  echo "--- Step 6/7: Generating sitemaps"
  cd apps/astro
  npx tsx scripts/generate-sitemap.ts
  cd "$REPO_ROOT"
  echo ""

  # Step 7: Save checkpoint
  echo "--- Step 7/7: Saving USC checkpoint"
  mkdir -p "$(dirname "$CHECKPOINT")"
  echo -n "$LATEST" > "$CHECKPOINT"
  echo "    Release point $LATEST saved to $CHECKPOINT"
  echo ""
fi

# --- Step 8–9: Deploy to VPS (skip if --skip-deploy) ---

if [ "$SKIP_DEPLOY" = true ]; then
  echo "==> Local pipeline complete (--skip-deploy). Files ready in output/usc/"
  exit 0
fi

# Step 8: Rsync content + nav + sitemaps
echo "--- Step 8/9: Syncing to VPS"

if [ -d "output/usc" ]; then
  echo "    USC sections"
  rsync -avz --checksum output/usc/ "${VPS_HOST}:${CONTENT_DEST}/usc/sections/"
fi

if [ -d "apps/astro/public/nav" ]; then
  echo "    Nav JSON"
  rsync -avz --delete apps/astro/public/nav/ "${VPS_HOST}:${NAV_DEST}/"
  rsync -avz --delete apps/astro/public/nav/ "${VPS_HOST}:~/lexbuild/apps/astro/dist/client/nav/"
fi

SITEMAP_FILES=(apps/astro/public/sitemap*.xml)
[ -f apps/astro/public/robots.txt ] && SITEMAP_FILES+=(apps/astro/public/robots.txt)
if [ ${#SITEMAP_FILES[@]} -gt 0 ] && [ -e "${SITEMAP_FILES[0]}" ]; then
  echo "    Sitemaps"
  rsync -avz "${SITEMAP_FILES[@]}" "${VPS_HOST}:~/lexbuild/apps/astro/public/"
  rsync -avz "${SITEMAP_FILES[@]}" "${VPS_HOST}:~/lexbuild/apps/astro/dist/client/"
fi
echo ""

# Step 9: Incremental search index on VPS
echo "--- Step 9/9: Indexing USC documents on VPS"
ssh "$VPS_HOST" << 'REMOTE'
  set -euo pipefail
  source ~/.lexbuild-secrets
  cd ~/lexbuild/apps/astro
  MEILI_URL=http://127.0.0.1:7700 \
  MEILI_MASTER_KEY="$MEILI_MASTER_KEY" \
  pnpm dlx tsx scripts/index-search-incremental.ts /srv/lexbuild/content --source usc
REMOTE

echo ""
if [ -n "$LATEST" ]; then
  echo "==> USC update complete (release point $LATEST)"
else
  echo "==> USC deploy complete"
fi

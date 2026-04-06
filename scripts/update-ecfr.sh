#!/usr/bin/env bash
# update-ecfr.sh — Download, convert, and deploy updated eCFR titles.
#
# Usage:
#   ./scripts/update-ecfr.sh                     # Incremental: only changed titles
#   ./scripts/update-ecfr.sh --titles 1,17       # Explicit titles
#   ./scripts/update-ecfr.sh --all               # Force full reconvert
#   ./scripts/update-ecfr.sh --skip-deploy       # Local only (no VPS push)
#   ./scripts/update-ecfr.sh --deploy-only       # Push existing output + reindex
#   ./scripts/update-ecfr.sh --skip-highlights   # Skip highlight generation
#
# Steps:
#   1. Detect changed titles via eCFR API metadata
#   2. Download changed title XML from eCFR API
#   3. Convert changed titles to Markdown (writeFileIfChanged preserves mtimes)
#   4. Generate highlights for changed sections (mtime-based, skippable)
#   5. Regenerate eCFR nav JSON
#   6. Regenerate sitemaps
#   7. Save checkpoint
#   8. Rsync content + nav + sitemaps to VPS
#   9. Incremental search index on VPS
#
# Requires:
#   - Built CLI: pnpm turbo build (or at least @lexbuild/ecfr + @lexbuild/cli)
#   - For deploy: SSH access to VPS, scripts/.deploy.env with VPS_HOST
#   - For search: Meilisearch running on VPS (PM2-managed)

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

TITLES=""
ALL=false
SKIP_DEPLOY=false
DEPLOY_ONLY=false
SKIP_HIGHLIGHTS=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --titles)
      TITLES="$2"
      shift 2
      ;;
    --all)
      ALL=true
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

  # Step 1: Detect changed titles (unless --titles or --all specified)
  CURRENCY_DATE=""

  if [ -n "$TITLES" ]; then
    echo "==> eCFR update for titles: $TITLES"
  elif [ "$ALL" = true ]; then
    echo "==> eCFR full update (all titles)"
    TITLES="all"
  else
    echo "--- Step 1/7: Detecting changed eCFR titles"
    CHANGE_JSON=$(npx tsx scripts/ecfr-changed-titles.ts --json)
    TITLES=$(echo "$CHANGE_JSON" | node -e "
      const d = JSON.parse(require('fs').readFileSync('/dev/stdin','utf-8'));
      process.stdout.write(d.changedTitles.join(','));
    ")
    CURRENCY_DATE=$(echo "$CHANGE_JSON" | node -e "
      const d = JSON.parse(require('fs').readFileSync('/dev/stdin','utf-8'));
      process.stdout.write(d.currencyDate || '');
    ")

    if [ -z "$TITLES" ]; then
      echo "    No eCFR titles changed since last run. Nothing to do."
      exit 0
    fi
    echo "    Changed titles: $TITLES"
    echo ""
  fi

  # Build CLI download/convert args
  if [ "$TITLES" = "all" ]; then
    TITLE_ARG="--all"
  else
    TITLE_ARG="--titles $TITLES"
  fi

  CURRENCY_ARG=""
  if [ -n "$CURRENCY_DATE" ]; then
    CURRENCY_ARG="--currency-date $CURRENCY_DATE"
  fi

  # Step 2: Download
  echo "--- Step 2/7: Downloading eCFR titles ($TITLE_ARG)"
  $CLI download-ecfr $TITLE_ARG
  echo ""

  # Step 3: Convert
  echo "--- Step 3/7: Converting eCFR titles ($TITLE_ARG)"
  $CLI convert-ecfr $TITLE_ARG $CURRENCY_ARG
  echo ""

  # Step 4: Highlights (optional)
  if [ "$SKIP_HIGHLIGHTS" = true ]; then
    echo "--- Step 4/7: Skipping highlights (--skip-highlights)"
  else
    echo "--- Step 4/7: Generating eCFR highlights"
    cd apps/astro
    npx tsx scripts/generate-highlights.ts --source ecfr
    cd "$REPO_ROOT"
  fi
  echo ""

  # Step 5: Nav
  echo "--- Step 5/7: Generating eCFR nav JSON"
  cd apps/astro
  npx tsx scripts/generate-nav.ts --source ecfr
  cd "$REPO_ROOT"
  echo ""

  # Step 6: Sitemaps
  echo "--- Step 6/7: Generating sitemaps"
  cd apps/astro
  npx tsx scripts/generate-sitemap.ts
  cd "$REPO_ROOT"
  echo ""

  # Step 7: Save checkpoint
  echo "--- Step 7/7: Saving eCFR checkpoint"
  npx tsx scripts/ecfr-changed-titles.ts --save
  echo ""
fi

# --- Step 8–9: Deploy to VPS (skip if --skip-deploy) ---

if [ "$SKIP_DEPLOY" = true ]; then
  echo "==> Local pipeline complete (--skip-deploy). Files ready in output/ecfr/"
  exit 0
fi

# Step 8: Rsync content + nav + sitemaps
echo "--- Step 8/9: Syncing to VPS"

if [ -d "output/ecfr" ]; then
  echo "    eCFR sections"
  rsync -avz --checksum output/ecfr/ "${VPS_HOST}:${CONTENT_DEST}/ecfr/sections/"
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
echo "--- Step 9/9: Indexing eCFR documents on VPS"
ssh "$VPS_HOST" << 'REMOTE'
  set -euo pipefail
  source ~/.lexbuild-secrets
  cd ~/lexbuild/apps/astro
  MEILI_URL=http://127.0.0.1:7700 \
  MEILI_MASTER_KEY="$MEILI_MASTER_KEY" \
  pnpm dlx tsx scripts/index-search-incremental.ts /srv/lexbuild/content --source ecfr
REMOTE

echo ""
echo "==> eCFR update complete"

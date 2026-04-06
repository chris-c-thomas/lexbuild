#!/usr/bin/env bash
# update-fr.sh — Download, convert, and deploy new Federal Register documents.
#
# Usage:
#   ./scripts/update-fr.sh                  # Yesterday's documents (default)
#   ./scripts/update-fr.sh --days 3         # Last 3 days
#   ./scripts/update-fr.sh --from 2026-03-25 --to 2026-04-01  # Explicit date range
#   ./scripts/update-fr.sh --skip-deploy    # Local only (download + convert + generate, no VPS push)
#   ./scripts/update-fr.sh --deploy-only    # Push existing output + reindex (no download/convert)
#
# Steps:
#   1. Download FR documents via API (JSON + XML per document)
#   2. Convert new XML to Markdown (date-filtered, not full reconvert)
#   3. Regenerate FR nav JSON
#   4. Regenerate sitemaps
#   5. Rsync content + nav + sitemaps to VPS
#   6. Incremental search index on VPS (only new/changed FR docs)
#
# Requires:
#   - Built CLI: pnpm turbo build (or at least @lexbuild/fr + @lexbuild/cli)
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

DAYS=1
FROM=""
TO=""
SKIP_DEPLOY=false
DEPLOY_ONLY=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --days)
      DAYS="$2"
      shift 2
      ;;
    --from)
      FROM="$2"
      shift 2
      ;;
    --to)
      TO="$2"
      shift 2
      ;;
    --skip-deploy)
      SKIP_DEPLOY=true
      shift
      ;;
    --deploy-only)
      DEPLOY_ONLY=true
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

# Compute date range
if [ -n "$FROM" ]; then
  DATE_FROM="$FROM"
  DATE_TO="${TO:-$(date +%Y-%m-%d)}"
else
  # macOS date: -v-Nd for N days ago
  DATE_FROM="$(date -v-${DAYS}d +%Y-%m-%d)"
  DATE_TO="$(date +%Y-%m-%d)"
fi

CLI="node packages/cli/dist/index.js"

# --- Preflight checks ---

if [ ! -f "packages/cli/dist/index.js" ]; then
  echo "Error: CLI not built. Run: pnpm turbo build --filter=@lexbuild/fr --filter=@lexbuild/cli"
  exit 1
fi

if [ "$SKIP_DEPLOY" = false ] && [ "$DEPLOY_ONLY" = false ] && [ -z "${VPS_HOST:-}" ]; then
  echo "Warning: VPS_HOST not set. Will run local steps only (download + convert + generate)."
  echo "         Set VPS_HOST in scripts/.deploy.env to enable deploy."
  echo ""
  SKIP_DEPLOY=true
fi

if [ "$DEPLOY_ONLY" = true ] && [ -z "${VPS_HOST:-}" ]; then
  echo "Error: --deploy-only requires VPS_HOST. Set it in scripts/.deploy.env."
  exit 1
fi

# --- Step 1–4: Local pipeline (skip if --deploy-only) ---

if [ "$DEPLOY_ONLY" = false ]; then
  echo "==> FR update for $DATE_FROM to $DATE_TO"
  echo ""

  # Step 1: Download
  echo "--- Step 1/4: Downloading FR documents ($DATE_FROM to $DATE_TO)"
  $CLI download-fr --from "$DATE_FROM" --to "$DATE_TO"
  echo ""

  # Step 2: Convert (date-filtered — only converts files in the date range)
  echo "--- Step 2/4: Converting FR documents ($DATE_FROM to $DATE_TO)"
  $CLI convert-fr --all --from "$DATE_FROM" --to "$DATE_TO"
  echo ""

  # Step 3: Regenerate FR nav
  echo "--- Step 3/4: Generating FR nav JSON"
  cd apps/astro
  npx tsx scripts/generate-nav.ts --source fr
  cd "$REPO_ROOT"
  echo ""

  # Step 4: Regenerate sitemaps (full rebuild to update sitemap index)
  echo "--- Step 4/4: Generating sitemaps"
  cd apps/astro
  npx tsx scripts/generate-sitemap.ts
  cd "$REPO_ROOT"
  echo ""
fi

# --- Step 5–6: Deploy to VPS (skip if --skip-deploy) ---

if [ "$SKIP_DEPLOY" = true ]; then
  echo "==> Local pipeline complete (--skip-deploy). Files ready in output/fr/"
  exit 0
fi

# Step 5: Rsync content + nav + sitemaps
echo "--- Step 5/6: Syncing to VPS"

if [ -d "output/fr" ]; then
  echo "    FR documents"
  ssh "$VPS_HOST" "mkdir -p ${CONTENT_DEST}/fr/documents"
  # mtime+size comparison (not --checksum) — FR updates are additive, no need to hash 770k+ files
  rsync -avz output/fr/ "${VPS_HOST}:${CONTENT_DEST}/fr/documents/"
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

# Step 6: Incremental search index on VPS
echo "--- Step 6/6: Indexing new FR documents on VPS"
ssh "$VPS_HOST" << 'REMOTE'
  set -euo pipefail
  source ~/.lexbuild-secrets
  cd ~/lexbuild/apps/astro
  MEILI_URL=http://127.0.0.1:7700 \
  MEILI_MASTER_KEY="$MEILI_MASTER_KEY" \
  pnpm dlx tsx scripts/index-search-incremental.ts /srv/lexbuild/content --source fr
REMOTE

echo ""
echo "==> FR update complete ($DATE_FROM to $DATE_TO)"

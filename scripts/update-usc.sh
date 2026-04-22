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
#   3. Convert all titles to Markdown at every granularity (section, title, chapter)
#   4. Generate highlights for changed sections (mtime-based, skippable)
#   5. Regenerate USC nav JSON
#   6. Regenerate sitemaps
#   7. Save new release point
#   8. Rsync content (all granularities) + nav + sitemaps to VPS
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

  # Pipeline-start marker: used after convert to verify that downloaded XML
  # files produced corresponding Markdown output. Catches silent regressions
  # where download succeeds but convert writes nothing (mirror of the guard
  # in update-fr.sh).
  PIPELINE_MARKER="$(mktemp -t lexbuild-usc-update.XXXXXX)"
  trap 'rm -f "$PIPELINE_MARKER"' EXIT

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

  NEW_XML_COUNT=$(find downloads/usc -name "*.xml" -newer "$PIPELINE_MARKER" 2>/dev/null | wc -l | tr -d ' ')

  # Step 3: Convert at every granularity in a single parse. --granularities
  # emits section + title + chapter from one pass of the XML, writing each
  # to its own output dir. writeFileIfChanged preserves mtimes.
  # $CLI is intentionally unquoted so its embedded spaces word-split into
  # "node ... dist/index.js" args. shellcheck disable=SC2086
  echo "--- Step 3/7: Converting USC titles at all granularities"
  # shellcheck disable=SC2086
  $CLI convert-usc --all \
    --granularities section,title,chapter \
    --output ./output \
    --output-title ./output-title \
    --output-chapter ./output-chapter
  echo ""

  # Sanity check: if download fetched new XML, convert must produce new .md files.
  # writeFileIfChanged preserves mtimes on unchanged content, so a fresh release
  # point should always yield at least one new/modified .md.
  if [ "$NEW_XML_COUNT" -gt 0 ]; then
    NEW_MD_COUNT=$(find output/usc -name "*.md" -newer "$PIPELINE_MARKER" 2>/dev/null | wc -l | tr -d ' ')
    if [ "$NEW_MD_COUNT" -eq 0 ]; then
      echo "Error: download-usc added $NEW_XML_COUNT XML file(s) but convert-usc produced 0 new .md files." >&2
      echo "       Aborting before deploy to prevent publishing a stale sitemap." >&2
      exit 1
    fi
    echo "    Pipeline check: $NEW_XML_COUNT XML in → $NEW_MD_COUNT .md out"
    echo ""
  fi

  # Step 4: Highlights (optional)
  if [ "$SKIP_HIGHLIGHTS" = true ]; then
    echo "--- Step 4/7: Skipping highlights (--skip-highlights)"
  else
    echo "--- Step 4/7: Generating USC highlights"
    ( cd apps/astro && npx tsx scripts/generate-highlights.ts --source usc ) || exit 1
  fi
  echo ""

  # Step 5: Nav
  echo "--- Step 5/7: Generating USC nav JSON"
  ( cd apps/astro && npx tsx scripts/generate-nav.ts --source usc ) || exit 1
  echo ""

  # Step 6: Sitemaps. Skipped when LEXBUILD_DEFER_SITEMAP=1 (set by update.sh
  # to avoid regenerating the full sitemap index once per source).
  if [ "${LEXBUILD_DEFER_SITEMAP:-}" != "1" ]; then
    echo "--- Step 6/7: Generating sitemaps"
    ( cd apps/astro && npx tsx scripts/generate-sitemap.ts ) || exit 1
    echo ""
  else
    echo "--- Step 6/7: Skipping sitemap (deferred to update.sh)"
    echo ""
  fi

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
  # mtime+size comparison (not --checksum) — writeFileIfChanged preserves
  # mtimes on unchanged content, so rsync's default is sufficient and avoids
  # a full-content hash scan of ~60k files on every run.
  rsync -avz output/usc/ "${VPS_HOST}:${CONTENT_DEST}/usc/sections/"
fi

if [ -d "output-title/usc" ]; then
  echo "    USC titles"
  rsync -avz output-title/usc/ "${VPS_HOST}:${CONTENT_DEST}/usc/titles/"
fi

if [ -d "output-chapter/usc" ]; then
  echo "    USC chapters"
  rsync -avz output-chapter/usc/ "${VPS_HOST}:${CONTENT_DEST}/usc/chapters/"
fi

if [ -d "apps/astro/public/nav" ]; then
  echo "    Nav JSON"
  rsync -avz --delete apps/astro/public/nav/ "${VPS_HOST}:${NAV_DEST}/"
  rsync -avz --delete apps/astro/public/nav/ "${VPS_HOST}:~/lexbuild/apps/astro/dist/client/nav/"
fi

if [ "${LEXBUILD_DEFER_SITEMAP:-}" != "1" ]; then
  SITEMAP_FILES=(apps/astro/public/sitemap*.xml)
  [ -f apps/astro/public/robots.txt ] && SITEMAP_FILES+=(apps/astro/public/robots.txt)
  if [ ${#SITEMAP_FILES[@]} -gt 0 ] && [ -e "${SITEMAP_FILES[0]}" ]; then
    echo "    Sitemaps"
    rsync -avz "${SITEMAP_FILES[@]}" "${VPS_HOST}:~/lexbuild/apps/astro/public/"
    rsync -avz "${SITEMAP_FILES[@]}" "${VPS_HOST}:~/lexbuild/apps/astro/dist/client/"
  fi
fi
echo ""

# Step 9: Build search index locally in Docker, ship the data directory to VPS.
# Delegating to deploy.sh --search-docker --source usc avoids running heavy
# bulk upserts against the single production Meilisearch (caused PM2
# restart-storms under memory pressure). The deploy script handles: local
# Docker Meilisearch, incremental indexing, tar+scp of the LMDB data dir,
# and the atomic PM2 swap on the VPS.
echo "--- Step 9/9: Building and shipping search index via local Docker"
"$SCRIPT_DIR/deploy.sh" --search-docker --source usc

echo ""
if [ -n "$LATEST" ]; then
  echo "==> USC update complete (release point $LATEST)"
else
  echo "==> USC deploy complete"
fi

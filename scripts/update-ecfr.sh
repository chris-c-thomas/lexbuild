#!/usr/bin/env bash
# update-ecfr.sh — Download, convert, and deploy updated eCFR titles.
#
# Usage:
#   ./scripts/update-ecfr.sh                     # Incremental: only changed titles
#   ./scripts/update-ecfr.sh --titles 1,17       # Explicit titles (skip change-detection)
#   ./scripts/update-ecfr.sh --force             # Force reconvert all 50 titles
#   ./scripts/update-ecfr.sh --skip-deploy       # Local only (no VPS push, no search)
#   ./scripts/update-ecfr.sh --skip-search       # Skip search reindex (still rsync)
#   ./scripts/update-ecfr.sh --skip-highlights   # Skip highlight generation
#   ./scripts/update-ecfr.sh --deploy-only       # Push existing output + reindex
#   ./scripts/update-ecfr.sh --dry-run           # Print plan, exit 0
#
# Modes:
#   incremental  Default. ecfr-changed-titles.ts compares API metadata vs checkpoint.
#   bootstrap    No checkpoint at downloads/ecfr/.ecfr-titles-state.json.
#                ecfr-changed-titles.ts returns all titles; pipeline performs full bootstrap.
#   titles       Explicit --titles spec. Bypasses change-detection.
#   force        --force: download + convert all 50 titles regardless of checkpoint.
#
# Steps:
#   1. Detect changed titles via eCFR API metadata (or use --titles / --force).
#   2. Download changed title XML from eCFR API.
#   3. Convert changed titles to Markdown at all granularities (section, title, chapter, part).
#   4. Generate highlights for changed sections (mtime-based, skippable).
#   5. Regenerate eCFR nav JSON.
#   6. Regenerate sitemaps (deferred when LEXBUILD_DEFER_SITEMAP=1).
#   7. Save checkpoint.
#   8. Rsync content (all granularities) + nav + sitemaps to VPS.
#   9. Incremental search index via Docker.
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

ECFR_CHECKPOINT_PATH="$REPO_ROOT/downloads/ecfr/.ecfr-titles-state.json"

# --- Parse arguments ---

TITLES=""
FORCE=false
SKIP_DEPLOY=false
DEPLOY_ONLY=false
SKIP_HIGHLIGHTS=false
SKIP_SEARCH=false
DRY_RUN=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --titles)
      TITLES="$2"
      shift 2
      ;;
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
    --skip-search)
      SKIP_SEARCH=true
      shift
      ;;
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    --all)
      echo "Error: --all has been removed. Use --force instead." >&2
      echo "       ./scripts/update-ecfr.sh --force" >&2
      exit 1
      ;;
    --help|-h)
      awk 'NR==1{next} /^$/{exit} {sub(/^# ?/, ""); print}' "$0"
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      echo "Run with --help for usage." >&2
      exit 1
      ;;
  esac
done

if [ "$SKIP_DEPLOY" = true ] && [ "$DEPLOY_ONLY" = true ]; then
  echo "Error: --skip-deploy and --deploy-only are mutually exclusive." >&2
  exit 1
fi

if [ -n "$TITLES" ] && [ "$FORCE" = true ]; then
  echo "Error: --titles and --force are mutually exclusive." >&2
  exit 1
fi

# --- Resolve mode ---

MODE=""
if [ "$DEPLOY_ONLY" = true ]; then
  MODE="deploy-only"
elif [ "$FORCE" = true ]; then
  MODE="force"
elif [ -n "$TITLES" ]; then
  MODE="titles"
elif [ ! -f "$ECFR_CHECKPOINT_PATH" ]; then
  MODE="bootstrap"
else
  MODE="incremental"
fi

# --- Print plan and exit on --dry-run ---

print_plan() {
  echo "==> eCFR update plan"
  echo "    Mode:             $MODE"
  if [ -n "$TITLES" ]; then
    echo "    Titles:           $TITLES"
  fi
  echo "    Force:            $FORCE"
  echo "    Skip deploy:      $SKIP_DEPLOY"
  echo "    Skip search:      $SKIP_SEARCH"
  echo "    Skip highlights:  $SKIP_HIGHLIGHTS"
  echo "    Checkpoint:       $ECFR_CHECKPOINT_PATH"
  if [ -f "$ECFR_CHECKPOINT_PATH" ]; then
    echo "    Checkpoint exists: yes"
  else
    echo "    Checkpoint exists: no (bootstrap)"
  fi
}

if [ "$DRY_RUN" = true ]; then
  print_plan
  exit 0
fi

CLI="node packages/cli/dist/index.js"

# --- Preflight checks ---

if [ ! -f "packages/cli/dist/index.js" ]; then
  echo "Error: CLI not built. Run: pnpm turbo build" >&2
  exit 1
fi

if [ "$SKIP_DEPLOY" = false ] && [ "$DEPLOY_ONLY" = false ] && [ -z "${VPS_HOST:-}" ]; then
  echo "Warning: VPS_HOST not set. Will run local steps only."
  echo "         Set VPS_HOST in scripts/.deploy.env to enable deploy."
  echo ""
  SKIP_DEPLOY=true
fi

if [ "$DEPLOY_ONLY" = true ] && [ -z "${VPS_HOST:-}" ]; then
  echo "Error: --deploy-only requires VPS_HOST. Set it in scripts/.deploy.env." >&2
  exit 1
fi

# --- Step 1–7: Local pipeline (skip if --deploy-only) ---

if [ "$DEPLOY_ONLY" = false ]; then

  # Pipeline-start marker: used after convert to verify that downloaded XML
  # files produced corresponding Markdown output. Catches silent regressions
  # where download succeeds but convert writes nothing (mirror of the guard
  # in update-fr.sh).
  PIPELINE_MARKER="$(mktemp -t lexbuild-ecfr-update.XXXXXX)"
  trap 'rm -f "$PIPELINE_MARKER"' EXIT

  # Step 1: Detect titles to process
  CURRENCY_DATE=""

  case "$MODE" in
    titles)
      echo "==> eCFR update for titles: $TITLES"
      ;;
    force)
      echo "==> eCFR force update (all titles)"
      TITLES="all"
      ;;
    bootstrap)
      echo "==> eCFR bootstrap: no checkpoint at $ECFR_CHECKPOINT_PATH"
      echo "    Performing full first-run download (all titles)."
      TITLES="all"
      ;;
    incremental)
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
      ;;
  esac

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
  # $TITLE_ARG is intentionally unquoted so `--titles 1,17` word-splits into
  # two CLI args. shellcheck disable=SC2086
  echo "--- Step 2/7: Downloading eCFR titles ($TITLE_ARG)"
  # shellcheck disable=SC2086
  $CLI download-ecfr $TITLE_ARG
  echo ""

  NEW_XML_COUNT=$(find downloads/ecfr -name "*.xml" -newer "$PIPELINE_MARKER" 2>/dev/null | wc -l | tr -d ' ')

  # Step 3: Convert at every granularity in a single parse. --granularities
  # emits section + title + chapter + part from one pass of the XML, writing
  # each to its own output dir. writeFileIfChanged preserves mtimes.
  echo "--- Step 3/7: Converting eCFR titles ($TITLE_ARG) at all granularities"
  # shellcheck disable=SC2086
  $CLI convert-ecfr $TITLE_ARG $CURRENCY_ARG \
    --granularities section,title,chapter,part \
    --output ./output \
    --output-title ./output-title \
    --output-chapter ./output-chapter \
    --output-part ./output-part
  echo ""

  # Sanity check: if download fetched new XML, convert must produce new .md files.
  # writeFileIfChanged preserves mtimes on unchanged content, so a fresh download
  # should always yield at least one new/modified .md.
  if [ "$NEW_XML_COUNT" -gt 0 ]; then
    NEW_MD_COUNT=$(find output/ecfr -name "*.md" -newer "$PIPELINE_MARKER" 2>/dev/null | wc -l | tr -d ' ')
    if [ "$NEW_MD_COUNT" -eq 0 ]; then
      echo "Error: download-ecfr added $NEW_XML_COUNT XML file(s) but convert-ecfr produced 0 new .md files." >&2
      echo "       Aborting before deploy to prevent publishing a stale sitemap." >&2
      exit 1
    fi
    echo "    Pipeline check: $NEW_XML_COUNT XML in → $NEW_MD_COUNT .md out"
    echo ""
  fi

  # Guard against the title-granularity stub regression (pre-fix, each title
  # emitted ~300 bytes of frontmatter with no body). A healthy eCFR title
  # corpus is ~1.3GB across 49 titles; if we're under 10MB total, something
  # broke and we should not overwrite production with stubs.
  #
  # Skipped in `titles` mode: a single-title run only refreshes one file and
  # legitimately leaves the rest of output-title/ecfr untouched (preserved by
  # writeFileIfChanged), so total bytes there have no meaning for that run's
  # health. Force/incremental modes still get the check.
  if [ "$MODE" != "titles" ] && [ -d "output-title/ecfr" ]; then
    TITLE_BYTES=$(find output-title/ecfr -name "*.md" -type f -exec wc -c {} + 2>/dev/null | awk 'END {print $1}')
    TITLE_BYTES="${TITLE_BYTES:-0}"
    if [ "$TITLE_BYTES" -lt 10000000 ]; then
      echo "Error: output-title/ecfr/ total size is ${TITLE_BYTES} bytes (< 10 MB)." >&2
      echo "       Suspected title-granularity regression. Aborting before deploy." >&2
      exit 1
    fi
  fi

  # Step 4: Highlights (optional)
  if [ "$SKIP_HIGHLIGHTS" = true ]; then
    echo "--- Step 4/7: Skipping highlights (--skip-highlights)"
  else
    echo "--- Step 4/7: Generating eCFR highlights"
    ( cd apps/astro && npx tsx scripts/generate-highlights.ts --source ecfr ) || exit 1
  fi
  echo ""

  # Step 5: Nav
  echo "--- Step 5/7: Generating eCFR nav JSON"
  ( cd apps/astro && npx tsx scripts/generate-nav.ts --source ecfr ) || exit 1
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
  # mtime+size comparison (not --checksum) — writeFileIfChanged preserves
  # mtimes on unchanged content, so rsync's default is sufficient and avoids
  # a full-content hash scan of ~200k files on every run.
  rsync -avz output/ecfr/ "${VPS_HOST}:${CONTENT_DEST}/ecfr/sections/"
fi

if [ -d "output-title/ecfr" ]; then
  echo "    eCFR titles"
  rsync -avz output-title/ecfr/ "${VPS_HOST}:${CONTENT_DEST}/ecfr/titles/"
fi

if [ -d "output-chapter/ecfr" ]; then
  echo "    eCFR chapters"
  rsync -avz output-chapter/ecfr/ "${VPS_HOST}:${CONTENT_DEST}/ecfr/chapters/"
fi

if [ -d "output-part/ecfr" ]; then
  echo "    eCFR parts"
  rsync -avz output-part/ecfr/ "${VPS_HOST}:${CONTENT_DEST}/ecfr/parts/"
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
# Delegating to deploy.sh --search-docker --source ecfr avoids running heavy
# bulk upserts against the single production Meilisearch (caused PM2
# restart-storms under memory pressure). The deploy script handles: local
# Docker Meilisearch, incremental indexing, tar+scp of the LMDB data dir,
# and the atomic PM2 swap on the VPS.
if [ "$SKIP_SEARCH" = true ]; then
  echo "--- Skipping search index step (--skip-search)"
else
  echo "--- Step 9/9: Building and shipping search index via local Docker"
  "$SCRIPT_DIR/deploy.sh" --search-docker --source ecfr
fi

echo ""
echo "==> eCFR update complete"

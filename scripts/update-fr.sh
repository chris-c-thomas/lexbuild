#!/usr/bin/env bash
# update-fr.sh — Download, convert, and deploy new Federal Register documents.
#
# Usage:
#   ./scripts/update-fr.sh                          # Incremental from .fr-state.json
#   ./scripts/update-fr.sh --days 3                 # Last 3 days (writes checkpoint)
#   ./scripts/update-fr.sh --from 2026-03-25        # Explicit start (--to defaults to today)
#   ./scripts/update-fr.sh --from 2026-03-25 --to 2026-04-01
#   ./scripts/update-fr.sh --force --from 2026-01-01  # Force redownload (requires --from)
#   ./scripts/update-fr.sh --skip-deploy            # Local only (no rsync, no search)
#   ./scripts/update-fr.sh --skip-search            # Skip search reindex (still rsync)
#   ./scripts/update-fr.sh --deploy-only            # Push existing output + reindex
#   ./scripts/update-fr.sh --dry-run                # Print plan, exit 0
#   ./scripts/update-fr.sh -v / --verbose           # Pass --verbose through to convert-fr
#
# Modes:
#   incremental  Default. --from = lastDate from .fr-state.json, --to = today.
#   bootstrap    No checkpoint. Requires --from or --days from the caller.
#   window       --from / --to / --days specified explicitly. Writes checkpoint at end.
#   force        --force + --from. Redownloads and reconverts the window even if XML on disk.
#
# Checkpoint:
#   downloads/fr/.fr-state.json — { lastRun: ISO8601, lastDate: YYYY-MM-DD }
#
# Steps:
#   1. Resolve date range (mode-aware).
#   2. Download FR documents via API (JSON + XML per document).
#   3. Convert new XML to Markdown (date-filtered).
#   4. Regenerate FR nav JSON.
#   5. Regenerate sitemaps (deferred when LEXBUILD_DEFER_SITEMAP=1).
#   6. Write checkpoint (.fr-state.json).
#   7. Rsync content + nav + sitemaps to VPS (unless --skip-deploy).
#   8. Incremental search index via Docker (unless --skip-search or --skip-deploy).

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

CHECKPOINT_PATH="$REPO_ROOT/downloads/fr/.fr-state.json"

# --- Parse arguments ---

DAYS=""
FROM=""
TO=""
FORCE=false
SKIP_DEPLOY=false
DEPLOY_ONLY=false
SKIP_SEARCH=false
DRY_RUN=false
VERBOSE=false

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
    --skip-search)
      SKIP_SEARCH=true
      shift
      ;;
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    -v|--verbose)
      VERBOSE=true
      shift
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

if [ -n "$DAYS" ] && { [ -n "$FROM" ] || [ -n "$TO" ]; }; then
  echo "Error: --days is mutually exclusive with --from / --to." >&2
  exit 1
fi

# --- Resolve mode + date range ---

# read_checkpoint_date prints lastDate from .fr-state.json on stdout.
# Empty stdout means: file is missing OR malformed in some way. The two cases
# are distinguished for the user by emitting a Warning to stderr when the
# file exists but can't be parsed (so a corrupt checkpoint isn't surfaced as
# a misleading "no checkpoint" bootstrap-error). The path is passed via env
# rather than substituted into the JS source to avoid single-quote injection.
read_checkpoint_date() {
  if [ ! -f "$CHECKPOINT_PATH" ]; then
    return 0
  fi
  local result rc
  result=$(CHECKPOINT_PATH="$CHECKPOINT_PATH" node -e '
    try {
      const d = JSON.parse(require("fs").readFileSync(process.env.CHECKPOINT_PATH, "utf-8"));
      if (typeof d.lastDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d.lastDate)) {
        process.stdout.write(d.lastDate);
      } else {
        process.stderr.write("lastDate missing or wrong shape");
        process.exit(3);
      }
    } catch (e) {
      process.stderr.write(e.message);
      process.exit(3);
    }
  ' 2>&1)
  rc=$?
  if [ $rc -ne 0 ]; then
    echo "Warning: $CHECKPOINT_PATH exists but is malformed ($result). Treating as missing." >&2
    return 0
  fi
  printf '%s' "$result"
}

CHECKPOINT_DATE="$(read_checkpoint_date)"
TODAY="$(date +%Y-%m-%d)"

# Validate --force preconditions early
if [ "$FORCE" = true ] && [ -z "$FROM" ] && [ -z "$DAYS" ]; then
  if [ "$DRY_RUN" = true ]; then
    echo "==> FR update plan"
    echo "    Mode:           force (would error)"
    echo "    Reason:         --force on FR requires --from YYYY-MM-DD or --days N."
    echo "                    FR has no inherent 'all' (decades of documents)."
    exit 0
  fi
  echo "Error: --force on FR requires --from YYYY-MM-DD or --days N." >&2
  echo "       FR has no inherent 'all' (decades of documents). Specify a window." >&2
  exit 2
fi

# Determine mode
MODE=""
if [ "$DEPLOY_ONLY" = true ]; then
  MODE="deploy-only"
elif [ "$FORCE" = true ]; then
  MODE="force"
elif [ -n "$DAYS" ] || [ -n "$FROM" ]; then
  MODE="window"
elif [ -n "$CHECKPOINT_DATE" ]; then
  MODE="incremental"
else
  MODE="bootstrap"
fi

# Bootstrap requires explicit --from or --days. In --dry-run we still print the
# would-error plan so the orchestrator's multi-source preview stays informative.
if [ "$MODE" = "bootstrap" ]; then
  if [ "$DRY_RUN" = true ]; then
    echo "==> FR update plan"
    echo "    Mode:           bootstrap (would error)"
    echo "    Reason:         No checkpoint at $CHECKPOINT_PATH."
    echo "                    Run with --from YYYY-MM-DD or --days N to bootstrap."
    exit 0
  fi
  echo "Error: FR has no checkpoint at $CHECKPOINT_PATH." >&2
  echo "       Run with --from YYYY-MM-DD or --days N to bootstrap." >&2
  exit 2
fi

# Compute effective DATE_FROM / DATE_TO
if [ -n "$DAYS" ]; then
  DATE_FROM="$(date -v-${DAYS}d +%Y-%m-%d)"
  DATE_TO="${TO:-$TODAY}"
elif [ -n "$FROM" ]; then
  DATE_FROM="$FROM"
  DATE_TO="${TO:-$TODAY}"
elif [ "$MODE" = "incremental" ]; then
  DATE_FROM="$CHECKPOINT_DATE"
  DATE_TO="$TODAY"
fi

# --- Print plan and exit on --dry-run ---

print_plan() {
  echo "==> FR update plan"
  echo "    Mode:           $MODE"
  if [ "$MODE" != "deploy-only" ]; then
    echo "    Window:         $DATE_FROM → $DATE_TO"
  fi
  echo "    Force:          $FORCE"
  echo "    Skip deploy:    $SKIP_DEPLOY"
  echo "    Skip search:    $SKIP_SEARCH"
  echo "    Checkpoint:     $CHECKPOINT_PATH"
  if [ -n "$CHECKPOINT_DATE" ]; then
    echo "    Last run date:  $CHECKPOINT_DATE"
  else
    echo "    Last run date:  (none)"
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
  echo "Warning: VPS_HOST not set. Will run local steps only (download + convert + generate)."
  echo "         Set VPS_HOST in scripts/.deploy.env to enable deploy."
  echo ""
  SKIP_DEPLOY=true
fi

if [ "$DEPLOY_ONLY" = true ] && [ -z "${VPS_HOST:-}" ]; then
  echo "Error: --deploy-only requires VPS_HOST. Set it in scripts/.deploy.env." >&2
  exit 1
fi

# --- Steps 2–6: Local pipeline (skip if --deploy-only) ---

if [ "$DEPLOY_ONLY" = false ]; then
  echo "==> FR update ($MODE: $DATE_FROM → $DATE_TO)"
  echo ""

  # Pipeline-start marker: used after convert to verify that downloaded XML
  # files produced corresponding Markdown output. Catches silent regressions
  # where download succeeds but convert returns 0 docs (e.g., the date-filter
  # bug we hit on 2026-04-19 where mid-month --from excluded all files).
  PIPELINE_MARKER="$(mktemp -t lexbuild-fr-update.XXXXXX)"
  trap 'rm -f "$PIPELINE_MARKER"' EXIT

  # Step 2: Download
  echo "--- Step 2/8: Downloading FR documents ($DATE_FROM to $DATE_TO)"
  $CLI download-fr --from "$DATE_FROM" --to "$DATE_TO"
  echo ""

  NEW_XML_COUNT=$(find downloads/fr -name "*.xml" -newer "$PIPELINE_MARKER" 2>/dev/null | wc -l | tr -d ' ')

  # Step 3: Convert (date-filtered — only converts files in the date range)
  echo "--- Step 3/8: Converting FR documents ($DATE_FROM to $DATE_TO)"
  VERBOSE_ARG=""
  [ "$VERBOSE" = true ] && VERBOSE_ARG="--verbose"
  # shellcheck disable=SC2086
  $CLI convert-fr --all --from "$DATE_FROM" --to "$DATE_TO" $VERBOSE_ARG
  echo ""

  # Sanity check: downloaded XML must yield converted Markdown. writeFileIfChanged
  # preserves mtimes on unchanged content, so a genuinely new download from the
  # API should always produce at least one new/modified .md file.
  if [ "$NEW_XML_COUNT" -gt 0 ]; then
    NEW_MD_COUNT=$(find output/fr -name "*.md" -newer "$PIPELINE_MARKER" 2>/dev/null | wc -l | tr -d ' ')
    if [ "$NEW_MD_COUNT" -eq 0 ]; then
      echo "Error: download-fr added $NEW_XML_COUNT XML file(s) but convert-fr produced 0 new .md files." >&2
      echo "       This indicates a bug in the convert-fr pipeline (likely a date-filter mismatch)." >&2
      echo "       Aborting before deploy to prevent publishing a stale sitemap." >&2
      exit 1
    fi
    echo "    Pipeline check: $NEW_XML_COUNT XML in → $NEW_MD_COUNT .md out"
    echo ""
  fi

  # Step 4: Regenerate FR nav
  echo "--- Step 4/8: Generating FR nav JSON"
  ( cd apps/astro && npx tsx scripts/generate-nav.ts --source fr ) || exit 1
  echo ""

  # Step 5: Regenerate sitemaps (full rebuild to update sitemap index).
  # Skipped when LEXBUILD_DEFER_SITEMAP=1 (set by update.sh to avoid
  # regenerating the full sitemap index once per source).
  if [ "${LEXBUILD_DEFER_SITEMAP:-}" != "1" ]; then
    echo "--- Step 5/8: Generating sitemaps"
    ( cd apps/astro && npx tsx scripts/generate-sitemap.ts ) || exit 1
    echo ""
  else
    echo "--- Step 5/8: Skipping sitemap (deferred to update.sh)"
    echo ""
  fi

  # Step 6: Write checkpoint as the new resume point.
  #
  # New lastDate = max(CHECKPOINT_DATE, DATE_TO). Without the max guard, a
  # historical backfill (e.g. `--from 2020-01-01 --to 2020-12-31` on a machine
  # whose checkpoint is already 2026-04-20) would regress the resume cursor to
  # 2020-12-31 and trigger a multi-year redownload on the next default run.
  # Atomic write (tmp + rename) prevents a partial-write crash from corrupting
  # .fr-state.json into something read_checkpoint_date can't parse.
  #
  # Intentionally inside the DEPLOY_ONLY=false block: --deploy-only pushes
  # existing output without ingesting anything new, so we must not advance
  # the cursor past data we haven't actually downloaded.
  NEW_LAST_DATE="$DATE_TO"
  if [ -n "$CHECKPOINT_DATE" ] && [ "$CHECKPOINT_DATE" \> "$NEW_LAST_DATE" ]; then
    NEW_LAST_DATE="$CHECKPOINT_DATE"
  fi
  echo "--- Step 6/8: Writing FR checkpoint (lastDate=$NEW_LAST_DATE)"
  mkdir -p "$(dirname "$CHECKPOINT_PATH")"
  CHECKPOINT_PATH="$CHECKPOINT_PATH" NEW_LAST_DATE="$NEW_LAST_DATE" node -e '
    const fs = require("fs");
    const path = process.env.CHECKPOINT_PATH;
    const tmp = path + ".tmp." + process.pid;
    fs.writeFileSync(tmp, JSON.stringify({
      lastRun: new Date().toISOString(),
      lastDate: process.env.NEW_LAST_DATE,
    }, null, 2) + "\n");
    fs.renameSync(tmp, path);
  ' || { echo "Error: failed to write FR checkpoint to $CHECKPOINT_PATH" >&2; exit 1; }
  echo ""
fi

# --- Steps 7–8: Deploy to VPS (skip if --skip-deploy) ---

if [ "$SKIP_DEPLOY" = true ]; then
  echo "==> Local pipeline complete (--skip-deploy). Files ready in output/fr/"
  exit 0
fi

# Step 7: Rsync content + nav + sitemaps
echo "--- Step 7/8: Syncing to VPS"

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

# Step 8: Build search index locally in Docker, ship the data directory to VPS.
# Delegating to deploy.sh --search-docker --source fr avoids running heavy
# bulk upserts against the single production Meilisearch (caused PM2
# restart-storms under memory pressure). The deploy script handles: local
# Docker Meilisearch, incremental indexing, tar+scp of the LMDB data dir,
# and the atomic PM2 swap on the VPS.
if [ "$SKIP_SEARCH" = true ]; then
  echo "--- Step 8/8: Skipping search index step (--skip-search)"
else
  echo "--- Step 8/8: Building and shipping search index via local Docker"
  "$SCRIPT_DIR/deploy.sh" --search-docker --source fr
fi

echo ""
echo "==> FR update complete ($DATE_FROM → $DATE_TO)"

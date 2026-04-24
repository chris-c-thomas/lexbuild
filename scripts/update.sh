#!/usr/bin/env bash
# update.sh — Unified content update orchestrator for all sources.
#
# Default behavior:
#   ./scripts/update.sh        Update all sources (eCFR → FR → USC) incrementally
#                              from each source's last checkpoint. Painless.
#
# Common usage:
#   ./scripts/update.sh --source fr               Only FR, incremental
#   ./scripts/update.sh --source ecfr,fr          Multi-source, incremental
#   ./scripts/update.sh --source ecfr --titles 1,17    eCFR titles 1, 17 only
#   ./scripts/update.sh --source fr --days 7      FR last 7 days
#   ./scripts/update.sh --source usc --force      USC full redownload + reconvert
#   ./scripts/update.sh --force --from 2026-01-01 All sources, full rebuild (FR requires --from)
#   ./scripts/update.sh --skip-deploy             All sources incrementally, local only
#   ./scripts/update.sh --deploy-only             Push existing local output + reindex
#   ./scripts/update.sh --dry-run                 Print plan, exit 0
#
# Flags (logical groups):
#
#   SOURCE SELECTION
#     --source <list>         Comma-separated: usc, ecfr, fr, all (default: all)
#
#   MODE (mutually exclusive)
#     (default)               Incremental from each source's checkpoint
#     --force                 Full redownload + reconvert for selected source(s).
#                             FR force requires --from.
#     --deploy-only           Skip download/convert. Push existing output + reindex.
#
#   PIPELINE PHASE CONTROL
#     --skip-deploy           Local pipeline only (no rsync, no search reindex)
#     --skip-highlights       Skip highlight generation (USC, eCFR)
#     --skip-search           Skip search reindex (still rsync content/nav/sitemaps)
#
#   SOURCE-SPECIFIC SCOPING
#     --titles <spec>         eCFR/USC only. "1", "1-5", "1,3,8", "1-5,8,11"
#     --from <YYYY-MM-DD>     FR only. Override checkpoint-derived start date.
#     --to <YYYY-MM-DD>       FR only. Defaults to today.
#     --days <N>              FR only. Last N days. Mutually exclusive with --from/--to.
#
#   UTILITY
#     --dry-run               Print plan, exit 0. No network, no file writes.
#     -v, --verbose           Verbose output.
#     -h, --help              Show usage.
#
# Execution order: eCFR → FR → USC. Each source's sub-script handles its own
# change detection and early-exits if nothing's new. Sitemap regeneration is
# deferred to a single post-run step to avoid 3x redundant work.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# --- Parse arguments ---

SOURCES=""
FORCE=false
DEPLOY_ONLY=false
SKIP_DEPLOY=false
SKIP_HIGHLIGHTS=false
SKIP_SEARCH=false
TITLES=""
FROM=""
TO=""
DAYS=""
DRY_RUN=false
VERBOSE=false

# Migration helper for removed flags.
removed_flag() {
  local old="$1"
  local hint="$2"
  echo "Error: $old has been removed in the unified flag scheme." >&2
  echo "       Use: $hint" >&2
  exit 1
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --source)
      SOURCES="$2"
      shift 2
      ;;
    --force)
      FORCE=true
      shift
      ;;
    --deploy-only)
      DEPLOY_ONLY=true
      shift
      ;;
    --skip-deploy)
      SKIP_DEPLOY=true
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
    --titles)
      TITLES="$2"
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
    --days)
      DAYS="$2"
      shift 2
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

    # --- Migration errors for removed flags ---
    --ecfr-titles)
      removed_flag "--ecfr-titles" "./scripts/update.sh --source ecfr --titles $2"
      ;;
    --ecfr-all)
      removed_flag "--ecfr-all" "./scripts/update.sh --source ecfr --force"
      ;;
    --ecfr-skip-highlights)
      removed_flag "--ecfr-skip-highlights" "./scripts/update.sh --source ecfr --skip-highlights"
      ;;
    --fr-days)
      removed_flag "--fr-days" "./scripts/update.sh --source fr --days $2"
      ;;
    --fr-from)
      removed_flag "--fr-from" "./scripts/update.sh --source fr --from $2"
      ;;
    --fr-to)
      removed_flag "--fr-to" "./scripts/update.sh --source fr --to $2"
      ;;
    --usc-force)
      removed_flag "--usc-force" "./scripts/update.sh --source usc --force"
      ;;
    --usc-skip-highlights)
      removed_flag "--usc-skip-highlights" "./scripts/update.sh --source usc --skip-highlights"
      ;;

    *)
      echo "Unknown option: $1" >&2
      echo "Run with --help for usage." >&2
      exit 1
      ;;
  esac
done

# --- Validate ---

if [ "$SKIP_DEPLOY" = true ] && [ "$DEPLOY_ONLY" = true ]; then
  echo "Error: --skip-deploy and --deploy-only are mutually exclusive." >&2
  exit 1
fi

if [ "$FORCE" = true ] && [ "$DEPLOY_ONLY" = true ]; then
  echo "Error: --force and --deploy-only are mutually exclusive." >&2
  exit 1
fi

if [ -n "$DAYS" ] && { [ -n "$FROM" ] || [ -n "$TO" ]; }; then
  echo "Error: --days is mutually exclusive with --from / --to." >&2
  exit 1
fi

# Default: all sources
if [ -z "$SOURCES" ] || [ "$SOURCES" = "all" ]; then
  SOURCES="ecfr,fr,usc"
fi

# Validate source names
IFS=',' read -ra SOURCE_LIST <<< "$SOURCES"
for src in "${SOURCE_LIST[@]}"; do
  case "$src" in
    usc|ecfr|fr) ;;
    *)
      echo "Error: unknown source '$src'. Valid: usc, ecfr, fr, all." >&2
      exit 1
      ;;
  esac
done

should_run() {
  echo "$SOURCES" | grep -qw "$1"
}

# Flag/source compatibility checks.
if [ -n "$TITLES" ]; then
  if should_run "fr" && ! should_run "usc" && ! should_run "ecfr"; then
    echo "Error: --titles requires --source to include usc or ecfr." >&2
    exit 1
  fi
fi

if [ -n "$DAYS" ] || [ -n "$FROM" ] || [ -n "$TO" ]; then
  if ! should_run "fr"; then
    echo "Error: --days / --from / --to require --source to include fr." >&2
    exit 1
  fi
fi

# FR force requires explicit window.
if [ "$FORCE" = true ] && should_run "fr" && [ -z "$FROM" ] && [ -z "$DAYS" ]; then
  echo "Error: --force on FR requires --from YYYY-MM-DD or --days N." >&2
  echo "       FR has no inherent 'all' (decades of documents). Specify a window." >&2
  exit 2
fi

# When --force runs against all sources, do a single full search reindex at the
# end instead of three per-source incremental indexes. We achieve this by
# passing --skip-search to each sub-script and calling deploy.sh --search-docker
# (no --source) once after sub-scripts complete.
RUN_FULL_SEARCH_AFTER=false
if [ "$FORCE" = true ] && [ "$SKIP_SEARCH" = false ] && [ "$SKIP_DEPLOY" = false ] && [ "$DEPLOY_ONLY" = false ]; then
  # All three sources, force, want search → full rebuild
  if should_run "ecfr" && should_run "fr" && should_run "usc"; then
    RUN_FULL_SEARCH_AFTER=true
  fi
fi

# --- Print plan ---

print_plan() {
  echo "==> Update plan"
  echo "    Sources:           $SOURCES"
  if [ "$DEPLOY_ONLY" = true ]; then
    echo "    Mode:              deploy-only"
  elif [ "$FORCE" = true ]; then
    echo "    Mode:              force (full rebuild)"
  else
    echo "    Mode:              incremental"
  fi
  if [ -n "$TITLES" ]; then echo "    Titles:            $TITLES"; fi
  if [ -n "$DAYS" ];   then echo "    Days:              $DAYS"; fi
  if [ -n "$FROM" ];   then echo "    From:              $FROM"; fi
  if [ -n "$TO" ];     then echo "    To:                $TO"; fi
  echo "    Skip deploy:       $SKIP_DEPLOY"
  echo "    Skip search:       $SKIP_SEARCH"
  echo "    Skip highlights:   $SKIP_HIGHLIGHTS"
  if [ "$RUN_FULL_SEARCH_AFTER" = true ]; then
    echo "    Search strategy:   full reindex after sub-scripts (force on all sources)"
  fi
}

if [ "$DRY_RUN" = true ]; then
  print_plan
  echo ""
  echo "    (--dry-run: forwarding --dry-run to each sub-script for plan details)"
  echo ""
  # Run each sub-script's dry-run; don't let one source's "would-error" halt the
  # rest of the preview. set -e is inherited; use `|| true` to continue.
  for src in "${SOURCE_LIST[@]}"; do
    case "$src" in
      ecfr)
        # shellcheck disable=SC2086
        "$SCRIPT_DIR/update-ecfr.sh" --dry-run \
          $( [ -n "$TITLES" ] && echo "--titles $TITLES" ) \
          $( [ "$FORCE" = true ] && echo "--force" ) \
          $( [ "$SKIP_DEPLOY" = true ] && echo "--skip-deploy" ) \
          $( [ "$SKIP_SEARCH" = true ] && echo "--skip-search" ) \
          $( [ "$SKIP_HIGHLIGHTS" = true ] && echo "--skip-highlights" ) \
          $( [ "$DEPLOY_ONLY" = true ] && echo "--deploy-only" ) || true
        ;;
      fr)
        # shellcheck disable=SC2086
        "$SCRIPT_DIR/update-fr.sh" --dry-run \
          $( [ -n "$DAYS" ] && echo "--days $DAYS" ) \
          $( [ -n "$FROM" ] && echo "--from $FROM" ) \
          $( [ -n "$TO" ]   && echo "--to $TO" ) \
          $( [ "$FORCE" = true ] && echo "--force" ) \
          $( [ "$SKIP_DEPLOY" = true ] && echo "--skip-deploy" ) \
          $( [ "$SKIP_SEARCH" = true ] && echo "--skip-search" ) \
          $( [ "$DEPLOY_ONLY" = true ] && echo "--deploy-only" ) || true
        ;;
      usc)
        # shellcheck disable=SC2086
        "$SCRIPT_DIR/update-usc.sh" --dry-run \
          $( [ "$FORCE" = true ] && echo "--force" ) \
          $( [ "$SKIP_DEPLOY" = true ] && echo "--skip-deploy" ) \
          $( [ "$SKIP_SEARCH" = true ] && echo "--skip-search" ) \
          $( [ "$SKIP_HIGHLIGHTS" = true ] && echo "--skip-highlights" ) \
          $( [ "$DEPLOY_ONLY" = true ] && echo "--deploy-only" ) || true
        ;;
    esac
    echo ""
  done
  exit 0
fi

print_plan
echo ""

# --- Run sources ---

# Defer sitemap regeneration to a single post-run step below.
export LEXBUILD_DEFER_SITEMAP=1

# Load deploy config (for final sitemap rsync below)
if [ -f "$SCRIPT_DIR/.deploy.env" ]; then
  # shellcheck disable=SC1091
  source "$SCRIPT_DIR/.deploy.env"
fi

FAILED=""
SUCCEEDED=""

# When RUN_FULL_SEARCH_AFTER is true, suppress per-source search calls.
EFFECTIVE_SKIP_SEARCH="$SKIP_SEARCH"
if [ "$RUN_FULL_SEARCH_AFTER" = true ]; then
  EFFECTIVE_SKIP_SEARCH=true
fi

run_source() {
  local src="$1"
  local script="$2"
  shift 2
  local args=("$@")

  echo "===== ${src} Update ====="
  echo ""
  if "$script" "${args[@]}"; then
    SUCCEEDED="$SUCCEEDED $src"
    echo ""
  else
    local rc=$?
    echo ""
    echo "WARNING: $src update failed (exit code $rc)"
    FAILED="$FAILED $src"
    echo ""
  fi
}

build_common_args() {
  local args=()
  [ "$FORCE" = true ] && args+=(--force)
  [ "$SKIP_DEPLOY" = true ] && args+=(--skip-deploy)
  [ "$EFFECTIVE_SKIP_SEARCH" = true ] && args+=(--skip-search)
  [ "$SKIP_HIGHLIGHTS" = true ] && args+=(--skip-highlights)
  [ "$DEPLOY_ONLY" = true ] && args+=(--deploy-only)
  [ "$VERBOSE" = true ] && args+=(--verbose)
  printf '%s\n' "${args[@]}"
}

# eCFR
if should_run "ecfr"; then
  ECFR_ARGS=()
  [ -n "$TITLES" ] && ECFR_ARGS+=(--titles "$TITLES")
  while IFS= read -r a; do [ -n "$a" ] && ECFR_ARGS+=("$a"); done < <(build_common_args)
  run_source "eCFR" "$SCRIPT_DIR/update-ecfr.sh" "${ECFR_ARGS[@]}"
fi

# FR
if should_run "fr"; then
  FR_ARGS=()
  [ -n "$DAYS" ] && FR_ARGS+=(--days "$DAYS")
  [ -n "$FROM" ] && FR_ARGS+=(--from "$FROM")
  [ -n "$TO" ]   && FR_ARGS+=(--to   "$TO")
  while IFS= read -r a; do [ -n "$a" ] && FR_ARGS+=("$a"); done < <(build_common_args)
  # FR doesn't support --skip-highlights (no highlights step). Strip it.
  filtered_fr=()
  for arg in "${FR_ARGS[@]}"; do
    [ "$arg" = "--skip-highlights" ] && continue
    filtered_fr+=("$arg")
  done
  run_source "FR" "$SCRIPT_DIR/update-fr.sh" "${filtered_fr[@]}"
fi

# USC
if should_run "usc"; then
  USC_ARGS=()
  while IFS= read -r a; do [ -n "$a" ] && USC_ARGS+=("$a"); done < <(build_common_args)
  run_source "USC" "$SCRIPT_DIR/update-usc.sh" "${USC_ARGS[@]}"
fi

# --- Post-run: regenerate sitemap index once, covering all sources ---

if [ -n "$SUCCEEDED" ] && [ "$SKIP_DEPLOY" = false ]; then
  echo "===== Regenerating unified sitemap index ====="
  echo ""
  ( cd "$REPO_ROOT/apps/astro" && npx tsx scripts/generate-sitemap.ts ) || {
    echo "WARNING: sitemap regeneration failed"
    FAILED="$FAILED sitemap"
  }

  if [ -n "${VPS_HOST:-}" ]; then
    SITEMAP_FILES=("$REPO_ROOT/apps/astro/public"/sitemap*.xml)
    [ -f "$REPO_ROOT/apps/astro/public/robots.txt" ] && SITEMAP_FILES+=("$REPO_ROOT/apps/astro/public/robots.txt")
    if [ ${#SITEMAP_FILES[@]} -gt 0 ] && [ -e "${SITEMAP_FILES[0]}" ]; then
      echo "    Syncing sitemaps to VPS"
      rsync -avz "${SITEMAP_FILES[@]}" "${VPS_HOST}:~/lexbuild/apps/astro/public/" || FAILED="$FAILED sitemap-rsync"
      rsync -avz "${SITEMAP_FILES[@]}" "${VPS_HOST}:~/lexbuild/apps/astro/dist/client/" || FAILED="$FAILED sitemap-rsync"
    fi
  fi
  echo ""
fi

# --- Post-run: full search reindex (only when --force on all sources) ---

if [ "$RUN_FULL_SEARCH_AFTER" = true ] && [ -n "$SUCCEEDED" ]; then
  echo "===== Full search reindex (Docker) ====="
  echo ""
  if "$SCRIPT_DIR/deploy.sh" --search-docker; then
    echo ""
  else
    echo ""
    echo "WARNING: full search reindex failed"
    FAILED="$FAILED search-full"
    echo ""
  fi
fi

# --- Summary ---

if [ -n "$FAILED" ]; then
  echo "===== Update complete with failures:$FAILED ====="
  exit 1
else
  echo "===== All updates complete ====="
fi

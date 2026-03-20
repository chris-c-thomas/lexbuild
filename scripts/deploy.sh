#!/usr/bin/env bash
# deploy.sh — Deploy LexBuild Astro app to production VPS.
#
# Usage:
#   ./scripts/deploy.sh                # Deploy code only (git pull, build, reload)
#   ./scripts/deploy.sh --content      # Deploy code + rsync content from local output/
#   ./scripts/deploy.sh --content-only # Rsync content only, no code deploy
#   ./scripts/deploy.sh --remote       # Full pipeline on VPS (code + download + convert + build)
#
# Requires:
#   - SSH access to the VPS (key-based auth)
#   - ~/.lexbuild-secrets on VPS with MEILI_MASTER_KEY, MEILI_SEARCH_KEY, ENABLE_SEARCH
#   - For --content/--content-only: local output/ directories populated by the CLI converter
#   - For --remote: sufficient VPS resources (recommend 4 vCPU / 8+ GB RAM)
#
# What it does:
#   Code deploy:    git pull → pnpm install → generate .env.production → astro build → pm2 reload
#   Content deploy: rsync local output directories + nav JSON to VPS
#   Remote deploy:  code deploy + build CLI → download XML → convert all granularities →
#                   copy to content dirs → pipeline scripts → astro build → pm2 reload
#
# Notes:
#   --remote runs the entire pipeline on the VPS via SSH. This can take 30+ minutes
#   (download + convert + highlights). If your SSH connection is unreliable, consider
#   SSHing into the VPS manually and running the commands in a tmux session instead.

set -euo pipefail

# --- Configuration ---
# Set VPS_HOST in scripts/.deploy.env (gitignored) or as an env var:
#   VPS_HOST="ubuntu@your-ip"
#   CONTENT_DEST="/srv/lexbuild/content"
#   NAV_DEST="/srv/lexbuild/nav"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
if [ -f "$SCRIPT_DIR/.deploy.env" ]; then
  source "$SCRIPT_DIR/.deploy.env"
fi

if [ -z "${VPS_HOST:-}" ]; then
  echo "Error: VPS_HOST is not set."
  echo "Copy scripts/.deploy.env.example to scripts/.deploy.env and fill in your VPS address."
  exit 1
fi

CONTENT_DEST="${CONTENT_DEST:-/srv/lexbuild/content}"
NAV_DEST="${NAV_DEST:-/srv/lexbuild/nav}"

# --- Parse arguments ---

MODE="code" # code | content | content-only | remote

case "${1:-}" in
  --content)
    MODE="content"
    ;;
  --content-only)
    MODE="content-only"
    ;;
  --remote)
    MODE="remote"
    ;;
  --help|-h)
    sed -n '2,/^$/{ s/^# //; s/^#$//; p }' "$0"
    exit 0
    ;;
  "")
    ;; # default: code only
  *)
    echo "Unknown option: $1"
    echo "Usage: ./scripts/deploy.sh [--content | --content-only | --remote | --help]"
    exit 1
    ;;
esac

# --- Code deploy (used by: code, content, remote) ---

deploy_code() {
  echo "==> Deploying code to VPS..."

  ssh "$VPS_HOST" << 'REMOTE'
    set -euo pipefail
    cd ~/lexbuild

    echo "--- git pull"
    git pull

    echo "--- pnpm install"
    pnpm install --frozen-lockfile

    echo "--- Generating .env.production from secrets"
    source ~/.lexbuild-secrets
    cat > apps/astro/.env.production << EOF
CONTENT_DIR=/srv/lexbuild/content
NAV_DIR=/srv/lexbuild/nav
ENABLE_SEARCH=${ENABLE_SEARCH:-false}
MEILI_URL=http://127.0.0.1:7700
MEILI_SEARCH_KEY=${MEILI_SEARCH_KEY:-}
SITE_URL=https://lexbuild.dev
EOF

    echo "--- Building Astro app"
    pnpm turbo build:astro --filter=@lexbuild/web

    echo "--- Reloading PM2"
    pm2 reload lexbuild-astro --update-env
    echo "==> Code deploy complete"
REMOTE
}

# --- Content deploy via rsync (used by: content, content-only) ---

deploy_content_rsync() {
  echo "==> Deploying content to VPS via rsync..."

  RSYNC_OPTS=(-avz --delete --checksum)

  # Section-level (default output)
  if [ -d "output/usc" ]; then
    echo "--- Syncing USC sections"
    rsync "${RSYNC_OPTS[@]}" output/usc/ "${VPS_HOST}:${CONTENT_DEST}/usc/sections/"
  fi
  if [ -d "output/ecfr" ]; then
    echo "--- Syncing eCFR sections"
    rsync "${RSYNC_OPTS[@]}" output/ecfr/ "${VPS_HOST}:${CONTENT_DEST}/ecfr/sections/"
  fi

  # Title-level
  if [ -d "output-title/usc" ]; then
    echo "--- Syncing USC titles"
    rsync "${RSYNC_OPTS[@]}" output-title/usc/ "${VPS_HOST}:${CONTENT_DEST}/usc/titles/"
  fi
  if [ -d "output-title/ecfr" ]; then
    echo "--- Syncing eCFR titles"
    rsync "${RSYNC_OPTS[@]}" output-title/ecfr/ "${VPS_HOST}:${CONTENT_DEST}/ecfr/titles/"
  fi

  # Chapter-level
  if [ -d "output-chapter/usc" ]; then
    echo "--- Syncing USC chapters"
    rsync "${RSYNC_OPTS[@]}" output-chapter/usc/ "${VPS_HOST}:${CONTENT_DEST}/usc/chapters/"
  fi
  if [ -d "output-chapter/ecfr" ]; then
    echo "--- Syncing eCFR chapters"
    rsync "${RSYNC_OPTS[@]}" output-chapter/ecfr/ "${VPS_HOST}:${CONTENT_DEST}/ecfr/chapters/"
  fi

  # Part-level (eCFR only)
  if [ -d "output-part/ecfr" ]; then
    echo "--- Syncing eCFR parts"
    rsync "${RSYNC_OPTS[@]}" output-part/ecfr/ "${VPS_HOST}:${CONTENT_DEST}/ecfr/parts/"
  fi

  # Nav JSON
  if [ -d "apps/astro/public/nav" ]; then
    echo "--- Syncing nav JSON"
    rsync "${RSYNC_OPTS[@]}" apps/astro/public/nav/ "${VPS_HOST}:${NAV_DEST}/"
  fi

  echo "==> Content rsync complete (no PM2 restart needed)"
}

# --- Remote pipeline (used by: remote) ---

deploy_remote() {
  echo "==> Running full pipeline on VPS..."
  echo "    This will take 30+ minutes (download, convert, highlights, build)."
  echo ""

  ssh "$VPS_HOST" << 'REMOTE'
    set -euo pipefail
    cd ~/lexbuild

    echo "--- git pull"
    git pull

    echo "--- pnpm install"
    pnpm install --frozen-lockfile

    echo "--- Generating .env.production from secrets"
    source ~/.lexbuild-secrets
    cat > apps/astro/.env.production << EOF
CONTENT_DIR=/srv/lexbuild/content
NAV_DIR=/srv/lexbuild/nav
ENABLE_SEARCH=${ENABLE_SEARCH:-false}
MEILI_URL=http://127.0.0.1:7700
MEILI_SEARCH_KEY=${MEILI_SEARCH_KEY:-}
SITE_URL=https://lexbuild.dev
EOF

    echo "--- Building all packages (CLI + core + usc + ecfr)"
    pnpm turbo build

    CLI="node packages/cli/dist/index.js"

    # --- Download ---

    echo "--- Downloading USC XML"
    $CLI download-usc --all

    echo "--- Downloading eCFR XML"
    $CLI download-ecfr --all

    # --- Convert (all granularities) ---
    # Converters write to output/{usc,ecfr}/ under the -o directory.
    # We convert into the monorepo's output dirs, then copy to /srv/lexbuild/content/.

    echo "--- Converting USC (section granularity)"
    $CLI convert-usc --all

    echo "--- Converting USC (chapter granularity)"
    $CLI convert-usc --all -g chapter -o ./output-chapter

    echo "--- Converting USC (title granularity)"
    $CLI convert-usc --all -g title -o ./output-title

    echo "--- Converting eCFR (section granularity)"
    $CLI convert-ecfr --all

    echo "--- Converting eCFR (part granularity)"
    $CLI convert-ecfr --all -g part -o ./output-part

    echo "--- Converting eCFR (chapter granularity)"
    $CLI convert-ecfr --all -g chapter -o ./output-chapter

    echo "--- Converting eCFR (title granularity)"
    $CLI convert-ecfr --all -g title -o ./output-title

    # --- Copy to content directories ---
    # rsync with --delete ensures removed sections are cleaned up.
    # Local-to-local rsync is fast (no network).

    echo "--- Copying output to /srv/lexbuild/content/"

    rsync -a --delete output/usc/           /srv/lexbuild/content/usc/sections/
    rsync -a --delete output/ecfr/          /srv/lexbuild/content/ecfr/sections/
    rsync -a --delete output-title/usc/     /srv/lexbuild/content/usc/titles/
    rsync -a --delete output-title/ecfr/    /srv/lexbuild/content/ecfr/titles/
    rsync -a --delete output-chapter/usc/   /srv/lexbuild/content/usc/chapters/
    rsync -a --delete output-chapter/ecfr/  /srv/lexbuild/content/ecfr/chapters/
    rsync -a --delete output-part/ecfr/     /srv/lexbuild/content/ecfr/parts/

    # --- Pipeline scripts ---

    echo "--- Generating nav JSON"
    cd apps/astro
    pnpm dlx tsx scripts/generate-nav.ts /srv/lexbuild/content
    cp -r public/nav/* /srv/lexbuild/nav/

    echo "--- Generating Shiki highlights (this takes a while)"
    pnpm dlx tsx scripts/generate-highlights.ts /srv/lexbuild/content

    echo "--- Generating sitemap"
    pnpm dlx tsx scripts/generate-sitemap.ts /srv/lexbuild/content

    cd ~/lexbuild

    # --- Build and reload ---

    echo "--- Building Astro app"
    pnpm turbo build:astro --filter=@lexbuild/web

    echo "--- Reloading PM2"
    pm2 reload lexbuild-astro --update-env

    echo "==> Remote deploy complete"
REMOTE
}

# --- Main ---

case "$MODE" in
  code)
    deploy_code
    ;;
  content)
    deploy_code
    deploy_content_rsync
    ;;
  content-only)
    deploy_content_rsync
    ;;
  remote)
    deploy_remote
    ;;
esac

echo "Done."

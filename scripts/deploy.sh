#!/usr/bin/env bash
# deploy.sh — Deploy LexBuild Astro app to production VPS.
#
# Usage:
#   ./scripts/deploy.sh                # Deploy code only (git pull, build, reload)
#   ./scripts/deploy.sh --content      # Deploy code + rsync content from local output/
#   ./scripts/deploy.sh --content-only # Rsync content only, no code deploy
#   ./scripts/deploy.sh --remote       # Full pipeline on VPS (code + download + convert + build)
#   ./scripts/deploy.sh --search-dump  # Reindex locally, dump, upload to VPS, import
#   ./scripts/deploy.sh --search-push  # Dump existing local index, upload to VPS, import
#
# Requires:
#   - SSH access to the VPS (key-based auth)
#   - ~/.lexbuild-secrets on VPS with MEILI_MASTER_KEY, MEILI_SEARCH_KEY, ENABLE_SEARCH
#   - For --content/--content-only: local output/ directories populated by the CLI converter
#   - For --remote: sufficient VPS resources (recommend 4 vCPU / 8+ GB RAM)
#   - For --search-dump: local Meilisearch running, local content in output/ directories
#
# What it does:
#   Code deploy:    git pull → pnpm install → generate .env.production → astro build → pm2 reload
#   Content deploy: rsync local output directories + nav JSON to VPS
#   Remote deploy:  code deploy + build CLI → download XML → convert all granularities →
#                   copy to content dirs → pipeline scripts → astro build → pm2 reload
#   Search dump:    index content into local Meilisearch → create dump → scp to VPS →
#                   stop remote Meilisearch → import dump → restart
#
# Notes:
#   --remote runs the entire pipeline on the VPS via SSH. This can take 30+ minutes
#   (download + convert + highlights). If your SSH connection is unreliable, consider
#   SSHing into the VPS manually and running the commands in a tmux session instead.
#
#   --search-dump is useful when your local machine has more RAM than the VPS.
#   Indexing 281k+ docs is CPU/memory intensive — offload it to a beefy local machine,
#   then transfer the result. Requires Meilisearch running locally on port 7700.

set -euo pipefail

# --- Configuration ---
# Set VPS_HOST in scripts/.deploy.env (gitignored) or as an env var:
#   VPS_HOST="ubuntu@your-ip"
#   CONTENT_DEST="/srv/lexbuild/content"
#   NAV_DEST="/srv/lexbuild/nav"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
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

MODE="code" # code | content | content-only | remote | search-dump | search-push

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
  --search-dump)
    MODE="search-dump"
    ;;
  --search-push)
    MODE="search-push"
    ;;
  --help|-h)
    sed -n '2,/^$/{ s/^# //; s/^#$//; p }' "$0"
    exit 0
    ;;
  "")
    ;; # default: code only
  *)
    echo "Unknown option: $1"
    echo "Usage: ./scripts/deploy.sh [--content | --content-only | --remote | --search-dump | --search-push | --help]"
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
MEILI_URL=/api
MEILI_SEARCH_KEY=${MEILI_SEARCH_KEY:-}
SITE_URL=https://lexbuild.dev
EOF

    echo "--- Building Astro app"
    pnpm turbo build:astro --filter=@lexbuild/astro

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
MEILI_URL=/api
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
    pnpm turbo build:astro --filter=@lexbuild/astro

    echo "--- Reloading PM2"
    pm2 reload lexbuild-astro --update-env

    echo "==> Remote deploy complete"
REMOTE
}

# --- Search dump: index locally, transfer dump to VPS (used by: search-dump) ---

# --- Shared: verify local Meilisearch, create dump, transfer, import on VPS ---

check_local_meilisearch() {
  LOCAL_MEILI_URL="http://127.0.0.1:7700"
  echo "--- Checking local Meilisearch..."
  if ! curl -sf "$LOCAL_MEILI_URL/health" > /dev/null 2>&1; then
    echo "Error: Local Meilisearch is not running at $LOCAL_MEILI_URL"
    echo ""
    echo "Start it with:"
    echo "  meilisearch --db-path ~/.meilisearch/data.ms --env development"
    exit 1
  fi
  echo "--- Local Meilisearch is healthy"
}

dump_and_push() {
  LOCAL_MEILI_URL="http://127.0.0.1:7700"

  # --- Create dump ---

  echo "--- Creating Meilisearch dump..."
  DUMP_RESPONSE=$(curl -sf -X POST "$LOCAL_MEILI_URL/dumps")
  DUMP_TASK_UID=$(echo "$DUMP_RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin)['taskUid'])")

  echo "--- Waiting for dump task $DUMP_TASK_UID to complete..."
  while true; do
    TASK_STATUS=$(curl -sf "$LOCAL_MEILI_URL/tasks/$DUMP_TASK_UID" | python3 -c "import sys,json; print(json.load(sys.stdin)['status'])")
    case "$TASK_STATUS" in
      succeeded)
        DUMP_FILE=$(curl -sf "$LOCAL_MEILI_URL/tasks/$DUMP_TASK_UID" | python3 -c "import sys,json; d=json.load(sys.stdin)['details']; print(d.get('dumpUid',''))")
        echo "--- Dump created: $DUMP_FILE"
        break
        ;;
      failed)
        echo "Error: Dump task failed."
        curl -sf "$LOCAL_MEILI_URL/tasks/$DUMP_TASK_UID" | python3 -m json.tool
        exit 1
        ;;
      *)
        sleep 2
        ;;
    esac
  done

  # --- Find the dump file ---
  # Meilisearch stores dumps in {db-path}/dumps/

  DUMP_PATH=""
  for SEARCH_DIR in \
    "$HOME/dumps" \
    "$HOME/.meilisearch/data.ms/dumps" \
    "/opt/homebrew/var/meilisearch/data.ms/dumps" \
    "$HOME/data.ms/dumps"; do
    if [ -d "$SEARCH_DIR" ]; then
      LATEST=$(ls -t "$SEARCH_DIR"/*.dump 2>/dev/null | head -1)
      if [ -n "$LATEST" ]; then
        DUMP_PATH="$LATEST"
        break
      fi
    fi
  done

  if [ -z "$DUMP_PATH" ]; then
    echo "Error: Could not find dump file."
    echo "Check your Meilisearch --db-path for a dumps/ directory."
    exit 1
  fi

  echo "--- Found dump: $DUMP_PATH ($(du -h "$DUMP_PATH" | cut -f1))"

  # --- Transfer to VPS ---

  echo "--- Uploading dump to VPS..."
  scp "$DUMP_PATH" "${VPS_HOST}:/tmp/lexbuild-search.dump"

  # --- Import on VPS ---

  echo "--- Importing dump on VPS (stops Meilisearch temporarily)..."
  ssh "$VPS_HOST" << 'REMOTE'
    set -euo pipefail
    source ~/.lexbuild-secrets

    echo "--- Stopping Meilisearch"
    pm2 stop meilisearch

    echo "--- Clearing existing database for dump import..."
    rm -rf /var/lib/meilisearch/data
    mkdir -p /var/lib/meilisearch/data

    echo "--- Importing dump (this may take a few minutes)..."
    # --import-dump imports then keeps running as a server.
    # Run in background, wait for the "All documents successfully imported" log,
    # then kill it so PM2 can manage the process.
    /usr/local/bin/meilisearch \
      --import-dump /tmp/lexbuild-search.dump \
      --db-path /var/lib/meilisearch/data \
      --env production \
      --http-addr 127.0.0.1:7700 \
      --master-key "$MEILI_MASTER_KEY" &
    MEILI_PID=$!

    # Wait for import to complete (poll health endpoint)
    echo "--- Waiting for import to complete and server to be ready..."
    for i in $(seq 1 120); do
      if curl -sf http://127.0.0.1:7700/health > /dev/null 2>&1; then
        echo "--- Import complete, Meilisearch is responding."
        break
      fi
      sleep 5
    done

    # Kill the foreground Meilisearch process so PM2 can manage it
    kill "$MEILI_PID" 2>/dev/null || true
    wait "$MEILI_PID" 2>/dev/null || true
    sleep 1

    echo "--- Starting Meilisearch via PM2"
    pm2 start meilisearch
    sleep 3

    # Verify
    if curl -sf http://127.0.0.1:7700/health > /dev/null 2>&1; then
      DOC_COUNT=$(curl -sf http://127.0.0.1:7700/indexes/lexbuild/stats \
        -H "Authorization: Bearer ${MEILI_MASTER_KEY}" \
        | python3 -c "import sys,json; print(json.load(sys.stdin).get('numberOfDocuments', 'unknown'))")
      echo "--- Meilisearch healthy. Index has $DOC_COUNT documents."
    else
      echo "WARNING: Meilisearch health check failed. Check: pm2 logs meilisearch"
    fi

    rm -f /tmp/lexbuild-search.dump
    echo "==> Search dump import complete"
REMOTE
}

# --- Search dump: reindex locally, then dump + push (used by: search-dump) ---

deploy_search_dump() {
  echo "==> Reindexing locally and transferring dump to VPS..."

  check_local_meilisearch

  # The indexer expects {contentDir}/usc/sections/ and {contentDir}/ecfr/sections/
  # but local CLI output is at output/usc/ and output/ecfr/ (no sections/ level).
  # Create a temp content directory with symlinks to match the expected structure.

  TEMP_CONTENT="$REPO_ROOT/.search-dump-content"
  rm -rf "$TEMP_CONTENT"
  mkdir -p "$TEMP_CONTENT/usc" "$TEMP_CONTENT/ecfr"

  if [ -d "$REPO_ROOT/output/usc" ]; then
    ln -s "$REPO_ROOT/output/usc" "$TEMP_CONTENT/usc/sections"
  else
    echo "Error: output/usc not found. Run the converter first."
    rm -rf "$TEMP_CONTENT"
    exit 1
  fi

  if [ -d "$REPO_ROOT/output/ecfr" ]; then
    ln -s "$REPO_ROOT/output/ecfr" "$TEMP_CONTENT/ecfr/sections"
  else
    echo "Error: output/ecfr not found. Run the converter first."
    rm -rf "$TEMP_CONTENT"
    exit 1
  fi

  echo "--- Indexing content into local Meilisearch..."
  cd "$REPO_ROOT/apps/astro"
  pnpm dlx tsx scripts/index-search.ts "$TEMP_CONTENT"
  cd "$REPO_ROOT"

  rm -rf "$TEMP_CONTENT"

  dump_and_push
}

# --- Search push: dump existing local index + push (used by: search-push) ---

deploy_search_push() {
  echo "==> Dumping existing local index and transferring to VPS..."
  echo "    Skipping reindex — pushing whatever is currently in local Meilisearch."

  check_local_meilisearch
  dump_and_push
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
  search-dump)
    deploy_search_dump
    ;;
  search-push)
    deploy_search_push
    ;;
esac

echo "Done."

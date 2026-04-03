#!/usr/bin/env bash
# deploy.sh — Deploy LexBuild Astro app to production VPS.
#
# Usage:
#   ./scripts/deploy.sh                # Deploy code only (git pull, build, reload)
#   ./scripts/deploy.sh --content      # Deploy code + rsync content from local output/
#   ./scripts/deploy.sh --content-only # Rsync content only, no code deploy
#   ./scripts/deploy.sh --remote       # Full pipeline on VPS (code + download + convert + build)
#   ./scripts/deploy.sh --search-docker                # Full reindex in Docker, transfer to VPS
#   ./scripts/deploy.sh --search-docker --source fr    # Incremental: add/update one source only
#   ./scripts/deploy.sh --search-docker-seed           # Seed Docker volume from VPS data
#
# Requires:
#   - SSH access to the VPS (key-based auth)
#   - ~/.lexbuild-secrets on VPS with MEILI_MASTER_KEY, MEILI_SEARCH_KEY, ENABLE_SEARCH
#   - For --content/--content-only: local output/ directories populated by the CLI converter
#   - For --remote: sufficient VPS resources (recommend 4 vCPU / 8+ GB RAM)
#   - For --search-docker: Docker Desktop, local content in output/ directories
#     With --source: existing Docker volume from a prior --search-docker run
#
# What it does:
#   Code deploy:    git pull → pnpm install → generate .env.production → astro build → pm2 reload
#   Content deploy: rsync local output directories + nav JSON + sitemaps to VPS
#   Remote deploy:  code deploy + build CLI → download XML → convert all granularities →
#                   copy to content dirs → pipeline scripts → astro build → pm2 reload
#   Search docker: index in Docker (linux/amd64) → tar data dir → scp to VPS →
#                   extract → start Meilisearch (instant, no re-indexing)
#
# Notes:
#   --remote runs the entire pipeline on the VPS via SSH. This can take 30+ minutes
#   (download + convert + highlights). If your SSH connection is unreliable, consider
#   SSHing into the VPS manually and running the commands in a tmux session instead.
#
#   --search-docker is the recommended way to update search. It indexes into a local
#   Docker container (linux/amd64) and transfers the pre-built database to the VPS.
#   No re-indexing on the VPS — import is instant regardless of corpus size.
#   Use --source to add/update a single source incrementally (keeps Docker volume).
#   Without --source, does a full reindex (destroys and rebuilds Docker volume).

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

MODE="code" # code | content | content-only | nav-only | sitemaps-only | remote | search-docker
SEARCH_SOURCE=""  # optional --source filter for --search-docker
MEILI_PROFILE="full"  # full | dev — selects which Docker volume to use

case "${1:-}" in
  --content)
    MODE="content"
    ;;
  --content-only)
    MODE="content-only"
    ;;
  --nav-only)
    MODE="nav-only"
    ;;
  --sitemaps-only)
    MODE="sitemaps-only"
    ;;
  --remote)
    MODE="remote"
    ;;
  --search-docker)
    MODE="search-docker"
    # Parse optional --source <name>
    if [ "${2:-}" = "--source" ] && [ -n "${3:-}" ]; then
      SEARCH_SOURCE="$3"
      if [[ ! "$SEARCH_SOURCE" =~ ^(usc|ecfr|fr)$ ]]; then
        echo "Error: --source must be usc, ecfr, or fr (got: $SEARCH_SOURCE)"
        exit 1
      fi
    fi
    ;;
  --search-docker-seed)
    MODE="search-docker-seed"
    if [ "${2:-}" = "--profile" ] && [ -n "${3:-}" ]; then
      MEILI_PROFILE="$3"
      if [[ ! "$MEILI_PROFILE" =~ ^(full|dev)$ ]]; then
        echo "Error: --profile must be full or dev (got: $MEILI_PROFILE)"
        exit 1
      fi
    fi
    ;;
  --help|-h)
    sed -n '2,/^$/{ s/^# //; s/^#$//; p }' "$0"
    exit 0
    ;;
  "")
    ;; # default: code only
  *)
    echo "Unknown option: $1"
    echo "Usage: ./scripts/deploy.sh [--content | --content-only | --nav-only | --sitemaps-only | --remote | --search-docker [--source <name>] | --search-docker-seed | --help]"
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
MEILI_URL=/search
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

  # FR documents
  if [ -d "output/fr" ]; then
    echo "--- Syncing FR documents"
    ssh "$VPS_HOST" "mkdir -p ${CONTENT_DEST}/fr/documents"
    rsync "${RSYNC_OPTS[@]}" output/fr/ "${VPS_HOST}:${CONTENT_DEST}/fr/documents/"
  fi

  # Nav JSON — sync to both /srv/lexbuild/nav/ (server-side reads) and
  # dist/client/nav/ (client-side sidebar fetches /nav/*.json as static assets)
  if [ -d "apps/astro/public/nav" ]; then
    echo "--- Syncing nav JSON"
    rsync "${RSYNC_OPTS[@]}" apps/astro/public/nav/ "${VPS_HOST}:${NAV_DEST}/"
    rsync "${RSYNC_OPTS[@]}" apps/astro/public/nav/ "${VPS_HOST}:~/lexbuild/apps/astro/dist/client/nav/"
  fi

  # Sitemaps and robots.txt → both public/ (for future builds) and dist/client/ (live serving)
  SITEMAP_FILES=(apps/astro/public/sitemap*.xml apps/astro/public/robots.txt)
  HAVE_SITEMAPS=false
  for f in "${SITEMAP_FILES[@]}"; do
    [ -e "$f" ] && HAVE_SITEMAPS=true && break
  done
  if [ "$HAVE_SITEMAPS" = true ]; then
    echo "--- Syncing sitemaps and robots.txt"
    rsync -avz apps/astro/public/sitemap*.xml apps/astro/public/robots.txt "${VPS_HOST}:~/lexbuild/apps/astro/public/" 2>/dev/null
    rsync -avz apps/astro/public/sitemap*.xml apps/astro/public/robots.txt "${VPS_HOST}:~/lexbuild/apps/astro/dist/client/" 2>/dev/null
  fi

  echo "==> Content rsync complete (no PM2 restart needed)"
}

# --- Nav-only rsync (used by: nav-only) ---

deploy_nav_rsync() {
  echo "==> Deploying nav JSON to VPS..."
  RSYNC_OPTS=(-avz --delete --checksum)
  if [ -d "apps/astro/public/nav" ]; then
    rsync "${RSYNC_OPTS[@]}" apps/astro/public/nav/ "${VPS_HOST}:${NAV_DEST}/"
    # Also sync to dist/client/nav/ so Astro serves them as static assets
    # (client-side sidebar fetches /nav/*.json directly)
    rsync "${RSYNC_OPTS[@]}" apps/astro/public/nav/ "${VPS_HOST}:~/lexbuild/apps/astro/dist/client/nav/"
    echo "==> Nav rsync complete"
  else
    echo "ERROR: apps/astro/public/nav/ not found"
    exit 1
  fi
}

# --- Sitemaps-only rsync (used by: sitemaps-only) ---

deploy_sitemaps_rsync() {
  echo "==> Deploying sitemaps to VPS..."
  SITEMAP_FILES=(apps/astro/public/sitemap*.xml apps/astro/public/robots.txt)
  HAVE_SITEMAPS=false
  for f in "${SITEMAP_FILES[@]}"; do
    [ -e "$f" ] && HAVE_SITEMAPS=true && break
  done
  if [ "$HAVE_SITEMAPS" = true ]; then
    rsync -avz apps/astro/public/sitemap*.xml apps/astro/public/robots.txt "${VPS_HOST}:~/lexbuild/apps/astro/public/" 2>/dev/null
    rsync -avz apps/astro/public/sitemap*.xml apps/astro/public/robots.txt "${VPS_HOST}:~/lexbuild/apps/astro/dist/client/" 2>/dev/null
    echo "==> Sitemaps rsync complete"
  else
    echo "ERROR: No sitemap files found in apps/astro/public/"
    exit 1
  fi
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
MEILI_URL=/search
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

# --- Search docker: index in Docker, transfer data dir to VPS (used by: search-docker) ---

deploy_search_docker() {
  INCREMENTAL=false
  if [ -n "$SEARCH_SOURCE" ]; then
    INCREMENTAL=true
    echo "==> Incremental Docker index: source=$SEARCH_SOURCE"
  else
    echo "==> Full Docker reindex and transfer to VPS..."
  fi

  # --- Prerequisites ---

  if ! command -v docker &> /dev/null; then
    echo "Error: Docker is not installed or not in PATH."
    exit 1
  fi

  if ! docker info &> /dev/null; then
    echo "Error: Docker daemon is not running. Start Docker Desktop."
    exit 1
  fi

  # Fetch master key from VPS
  echo "--- Fetching master key from VPS..."
  MEILI_MASTER_KEY=$(ssh "$VPS_HOST" "source ~/.lexbuild-secrets && echo \$MEILI_MASTER_KEY")
  if [ -z "$MEILI_MASTER_KEY" ]; then
    echo "Error: Could not fetch MEILI_MASTER_KEY from VPS."
    exit 1
  fi
  export MEILI_MASTER_KEY

  # --- Content symlinks ---

  TEMP_CONTENT="$REPO_ROOT/.search-docker-content"
  rm -rf "$TEMP_CONTENT"
  mkdir -p "$TEMP_CONTENT/usc" "$TEMP_CONTENT/ecfr" "$TEMP_CONTENT/fr"

  for src_dir in usc ecfr; do
    if [ -d "$REPO_ROOT/output/$src_dir" ]; then
      ln -s "$REPO_ROOT/output/$src_dir" "$TEMP_CONTENT/$src_dir/sections"
    else
      echo "Error: output/$src_dir not found. Run the converter first."
      rm -rf "$TEMP_CONTENT"
      exit 1
    fi
  done

  if [ -d "$REPO_ROOT/output/fr" ]; then
    ln -s "$REPO_ROOT/output/fr" "$TEMP_CONTENT/fr/documents"
  else
    echo "Error: output/fr not found. Run the converter first."
    rm -rf "$TEMP_CONTENT"
    exit 1
  fi

  # --- Start Docker Meilisearch ---

  COMPOSE_FILE="$REPO_ROOT/docker-compose.meili.yml"
  DOCKER_PORT=7711
  export MEILI_PROFILE

  echo "--- Starting Docker Meilisearch (linux/amd64, profile=$MEILI_PROFILE)..."
  if [ "$INCREMENTAL" = true ]; then
    # Incremental: keep existing volume, just start the container
    docker compose -f "$COMPOSE_FILE" up -d
  else
    # Full reindex: destroy volume for a clean slate
    docker compose -f "$COMPOSE_FILE" down -v 2>/dev/null || true
    docker compose -f "$COMPOSE_FILE" up -d
  fi

  # Wait for Docker Meilisearch to be healthy
  echo "--- Waiting for Docker Meilisearch on port $DOCKER_PORT..."
  for i in $(seq 1 60); do
    if curl -sf "http://localhost:$DOCKER_PORT/health" > /dev/null 2>&1; then
      echo "--- Docker Meilisearch healthy after ${i}s"
      break
    fi
    if [ "$i" -eq 60 ]; then
      echo "Error: Docker Meilisearch failed to start."
      docker compose -f "$COMPOSE_FILE" logs
      docker compose -f "$COMPOSE_FILE" down -v
      rm -rf "$TEMP_CONTENT"
      exit 1
    fi
    sleep 1
  done

  # --- Index content ---

  if [ "$INCREMENTAL" = true ]; then
    echo "--- Incremental index: adding/updating $SEARCH_SOURCE documents..."
    cd "$REPO_ROOT/apps/astro"
    MEILI_URL="http://localhost:$DOCKER_PORT" \
    MEILI_MASTER_KEY="$MEILI_MASTER_KEY" \
      pnpm dlx tsx scripts/index-search-incremental.ts "$TEMP_CONTENT" --source "$SEARCH_SOURCE"
  else
    echo "--- Full index: all sources..."
    cd "$REPO_ROOT/apps/astro"
    MEILI_URL="http://localhost:$DOCKER_PORT" \
    MEILI_MASTER_KEY="$MEILI_MASTER_KEY" \
      pnpm dlx tsx scripts/index-search.ts "$TEMP_CONTENT"
  fi
  cd "$REPO_ROOT"

  rm -rf "$TEMP_CONTENT"

  # Verify index
  DOC_COUNT=$(curl -sf "http://localhost:$DOCKER_PORT/indexes/lexbuild/stats" \
    -H "Authorization: Bearer ${MEILI_MASTER_KEY}" \
    | python3 -c "import sys,json; print(json.load(sys.stdin).get('numberOfDocuments', 0))")
  echo "--- Docker index has $DOC_COUNT documents"

  if [ "$DOC_COUNT" -eq 0 ] 2>/dev/null; then
    echo "Error: No documents indexed. Aborting."
    docker compose -f "$COMPOSE_FILE" down -v
    exit 1
  fi

  # --- Stop Docker and extract data ---

  echo "--- Stopping Docker Meilisearch (flushing LMDB)..."
  docker compose -f "$COMPOSE_FILE" stop

  echo "--- Extracting data directory from Docker volume..."
  VOLUME_NAME="lexbuild_meili-data-${MEILI_PROFILE}"
  TAR_PATH="$REPO_ROOT/.meili-data.tar.gz"

  # Tar the data directory from the Docker volume.
  # Docker Meilisearch stores data at /meili_data/data.ms/ inside the volume.
  # Extract from data.ms/ so files land directly in the VPS db-path.
  docker run --rm \
    -v "${VOLUME_NAME}:/data:ro" \
    --platform linux/amd64 \
    alpine:latest \
    tar czf - -C /data/data.ms . > "$TAR_PATH"

  TAR_SIZE=$(du -h "$TAR_PATH" | cut -f1)
  echo "--- Data archive: $TAR_PATH ($TAR_SIZE)"

  # Clean up Docker container (keep volume for incremental runs)
  docker compose -f "$COMPOSE_FILE" down

  # --- Transfer to VPS ---

  echo "--- Uploading data archive to VPS..."
  scp "$TAR_PATH" "${VPS_HOST}:/tmp/meili-data.tar.gz"

  echo "--- Installing data on VPS..."
  ssh "$VPS_HOST" << 'REMOTE'
    set -euo pipefail

    echo "--- Stopping Meilisearch (PM2)"
    pm2 stop meilisearch 2>/dev/null || true

    # Kill any rogue Meilisearch processes
    ROGUE_PIDS=$(pgrep -f '/usr/local/bin/meilisearch' || true)
    if [ -n "$ROGUE_PIDS" ]; then
      echo "--- Killing rogue Meilisearch processes: $ROGUE_PIDS"
      echo "$ROGUE_PIDS" | xargs kill 2>/dev/null || true
      sleep 2
      REMAINING=$(pgrep -f '/usr/local/bin/meilisearch' || true)
      if [ -n "$REMAINING" ]; then
        echo "$REMAINING" | xargs kill -9 2>/dev/null || true
        sleep 1
      fi
    fi

    echo "--- Clearing existing database..."
    rm -rf /var/lib/meilisearch/data
    mkdir -p /var/lib/meilisearch/data

    echo "--- Extracting data archive..."
    tar xzf /tmp/meili-data.tar.gz -C /var/lib/meilisearch/data/

    echo "--- Starting Meilisearch via PM2"
    pm2 start meilisearch
    sleep 3

    # Verify
    source ~/.lexbuild-secrets
    if curl -sf http://127.0.0.1:7700/health > /dev/null 2>&1; then
      DOC_COUNT=$(curl -sf http://127.0.0.1:7700/indexes/lexbuild/stats \
        -H "Authorization: Bearer ${MEILI_MASTER_KEY}" \
        | python3 -c "import sys,json; print(json.load(sys.stdin).get('numberOfDocuments', 'unknown'))")
      echo "--- Meilisearch healthy. Index has $DOC_COUNT documents."
    else
      echo "WARNING: Meilisearch health check failed. Check: pm2 logs meilisearch"
    fi

    rm -f /tmp/meili-data.tar.gz
    echo "==> Search data transfer complete"
REMOTE

  # Clean up local tar
  rm -f "$TAR_PATH"
}

# --- Search docker seed: populate Docker volume from VPS data (used by: search-docker-seed) ---

deploy_search_docker_seed() {
  if ! command -v docker &> /dev/null; then
    echo "Error: Docker is not installed or not in PATH."
    exit 1
  fi

  if ! docker info &> /dev/null; then
    echo "Error: Docker daemon is not running. Start Docker Desktop."
    exit 1
  fi

  COMPOSE_FILE="$REPO_ROOT/docker-compose.meili.yml"
  VOLUME_NAME="lexbuild_meili-data-${MEILI_PROFILE}"
  DOCKER_PORT=7711
  export MEILI_PROFILE

  # Fetch master key
  echo "--- Fetching master key from VPS..."
  MEILI_MASTER_KEY=$(ssh "$VPS_HOST" "source ~/.lexbuild-secrets && echo \$MEILI_MASTER_KEY")
  if [ -z "$MEILI_MASTER_KEY" ]; then
    echo "Error: Could not fetch MEILI_MASTER_KEY from VPS."
    exit 1
  fi
  export MEILI_MASTER_KEY

  if [ "$MEILI_PROFILE" = "dev" ]; then
    # --- Dev profile: index a small subset locally ---
    echo "==> Seeding dev volume with sample data..."

    # Content symlinks
    TEMP_CONTENT="$REPO_ROOT/.search-docker-content"
    rm -rf "$TEMP_CONTENT"
    mkdir -p "$TEMP_CONTENT/usc" "$TEMP_CONTENT/ecfr" "$TEMP_CONTENT/fr"

    for src_dir in usc ecfr; do
      if [ -d "$REPO_ROOT/output/$src_dir" ]; then
        ln -s "$REPO_ROOT/output/$src_dir" "$TEMP_CONTENT/$src_dir/sections"
      else
        echo "Error: output/$src_dir not found. Run the converter first."
        rm -rf "$TEMP_CONTENT"
        exit 1
      fi
    done

    if [ -d "$REPO_ROOT/output/fr" ]; then
      ln -s "$REPO_ROOT/output/fr" "$TEMP_CONTENT/fr/documents"
    else
      echo "Error: output/fr not found. Run the converter first."
      rm -rf "$TEMP_CONTENT"
      exit 1
    fi

    # Fresh volume
    docker compose -f "$COMPOSE_FILE" down 2>/dev/null || true
    docker volume rm "$VOLUME_NAME" 2>/dev/null || true
    docker compose -f "$COMPOSE_FILE" up -d

    echo "--- Waiting for Docker Meilisearch..."
    for i in $(seq 1 60); do
      if curl -sf "http://localhost:$DOCKER_PORT/health" > /dev/null 2>&1; then
        echo "--- Docker Meilisearch healthy after ${i}s"
        break
      fi
      sleep 1
    done

    # Index one title per source + a small FR sample
    echo "--- Indexing sample data (USC title 1 + eCFR title 1 + recent FR docs)..."
    cd "$REPO_ROOT/apps/astro"

    # USC title 1 only (~200 docs)
    MEILI_URL="http://localhost:$DOCKER_PORT" \
    MEILI_MASTER_KEY="$MEILI_MASTER_KEY" \
      pnpm dlx tsx scripts/index-search-incremental.ts "$TEMP_CONTENT" --source usc 2>&1 | \
      awk '/upserted|skipped|checkpoint/ { print "    " $0 }'

    # eCFR title 1 only (~100 docs)
    MEILI_URL="http://localhost:$DOCKER_PORT" \
    MEILI_MASTER_KEY="$MEILI_MASTER_KEY" \
      pnpm dlx tsx scripts/index-search-incremental.ts "$TEMP_CONTENT" --source ecfr 2>&1 | \
      awk '/upserted|skipped|checkpoint/ { print "    " $0 }'

    # FR — index all (incremental indexer scans all, but only recent files will be quick)
    MEILI_URL="http://localhost:$DOCKER_PORT" \
    MEILI_MASTER_KEY="$MEILI_MASTER_KEY" \
      pnpm dlx tsx scripts/index-search-incremental.ts "$TEMP_CONTENT" --source fr 2>&1 | \
      awk '/upserted|skipped|checkpoint/ { print "    " $0 }'

    cd "$REPO_ROOT"
    rm -rf "$TEMP_CONTENT"

    DOC_COUNT=$(curl -sf "http://localhost:$DOCKER_PORT/indexes/lexbuild/stats" \
      -H "Authorization: Bearer ${MEILI_MASTER_KEY}" 2>/dev/null \
      | python3 -c "import sys,json; print(json.load(sys.stdin).get('numberOfDocuments', 0))" 2>/dev/null || echo "0")

    docker compose -f "$COMPOSE_FILE" down

    echo "--- Dev volume seeded with $DOC_COUNT documents"
    echo "    Start with: MEILI_PROFILE=dev docker compose -f docker-compose.meili.yml up -d"
  else
    # --- Full profile: seed from VPS data directory ---
    echo "==> Seeding full volume from VPS data directory..."

    TAR_PATH="$REPO_ROOT/.meili-data.tar.gz"
    echo "--- Downloading Meilisearch data from VPS..."
    ssh "$VPS_HOST" "tar czf - -C /var/lib/meilisearch/data ." > "$TAR_PATH"

    TAR_SIZE=$(du -h "$TAR_PATH" | cut -f1)
    echo "--- Downloaded: $TAR_PATH ($TAR_SIZE)"

    # Fresh volume
    docker compose -f "$COMPOSE_FILE" down 2>/dev/null || true
    docker volume rm "$VOLUME_NAME" 2>/dev/null || true
    docker volume create "$VOLUME_NAME" > /dev/null

    echo "--- Loading data into Docker volume..."
    docker run --rm \
      -v "${VOLUME_NAME}:/data" \
      -v "${TAR_PATH}:/import.tar.gz:ro" \
      --platform linux/amd64 \
      alpine:latest \
      sh -c "mkdir -p /data/data.ms && tar xzf /import.tar.gz -C /data/data.ms/"

    rm -f "$TAR_PATH"

    # Verify
    echo "--- Verifying seeded data..."
    docker compose -f "$COMPOSE_FILE" up -d
    sleep 5

    DOC_COUNT=$(curl -sf "http://localhost:$DOCKER_PORT/indexes/lexbuild/stats" \
      -H "Authorization: Bearer ${MEILI_MASTER_KEY}" 2>/dev/null \
      | python3 -c "import sys,json; print(json.load(sys.stdin).get('numberOfDocuments', 0))" 2>/dev/null || echo "0")

    docker compose -f "$COMPOSE_FILE" down

    echo "--- Full volume seeded with $DOC_COUNT documents from VPS"
  fi

  echo "==> Seed complete"
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
  nav-only)
    deploy_nav_rsync
    ;;
  sitemaps-only)
    deploy_sitemaps_rsync
    ;;
  remote)
    deploy_remote
    ;;
  search-docker)
    deploy_search_docker
    ;;
  search-docker-seed)
    deploy_search_docker_seed
    ;;
esac

echo "Done."

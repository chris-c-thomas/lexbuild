#!/usr/bin/env bash
# setup-secrets.sh — Initialize or update ~/.lexbuild-secrets on the VPS.
#
# Usage:
#   ./scripts/setup-secrets.sh          # Generate master key + retrieve search key
#   ./scripts/setup-secrets.sh --init   # Generate master key only (Meilisearch not yet running)
#   ./scripts/setup-secrets.sh --search # Retrieve search key only (Meilisearch already running)
#
# Requires:
#   - SSH access to the VPS (key-based auth)
#   - scripts/.deploy.env with VPS_HOST set
#   - For --search or default: Meilisearch running on the VPS (via PM2)
#
# What it does:
#   --init:   Generates a Meilisearch master key, writes ~/.lexbuild-secrets,
#             and configures ~/.zshenv to source it. Safe to re-run — preserves
#             an existing master key unless you delete the secrets file first.
#
#   --search: Connects to Meilisearch using the master key, retrieves the
#             auto-generated search-only API key, and updates ~/.lexbuild-secrets.
#
#   (default): Runs both --init and --search.
#
# After running, deploy with ./scripts/deploy.sh to regenerate .env.production.

set -euo pipefail

# --- Configuration (shared with deploy.sh) ---

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
if [ -f "$SCRIPT_DIR/.deploy.env" ]; then
  source "$SCRIPT_DIR/.deploy.env"
fi

if [ -z "${VPS_HOST:-}" ]; then
  echo "Error: VPS_HOST is not set."
  echo "Copy scripts/.deploy.env.example to scripts/.deploy.env and fill in your VPS address."
  exit 1
fi

# --- Parse arguments ---

DO_INIT=false
DO_SEARCH=false

case "${1:-}" in
  --init)
    DO_INIT=true
    ;;
  --search)
    DO_SEARCH=true
    ;;
  --help|-h)
    sed -n '2,/^$/{ s/^# //; s/^#$//; p }' "$0"
    exit 0
    ;;
  "")
    DO_INIT=true
    DO_SEARCH=true
    ;;
  *)
    echo "Unknown option: $1"
    echo "Usage: ./scripts/setup-secrets.sh [--init | --search | --help]"
    exit 1
    ;;
esac

# --- Init: generate master key and write secrets file ---

if [ "$DO_INIT" = true ]; then
  echo "==> Initializing secrets on VPS..."

  ssh "$VPS_HOST" << 'REMOTE'
    set -euo pipefail

    SECRETS_FILE="$HOME/.lexbuild-secrets"

    # Check if secrets file already exists with a master key
    if [ -f "$SECRETS_FILE" ] && grep -q 'MEILI_MASTER_KEY="..*"' "$SECRETS_FILE"; then
      EXISTING_KEY=$(grep MEILI_MASTER_KEY "$SECRETS_FILE" | cut -d'"' -f2)
      echo "--- Master key already exists (${EXISTING_KEY:0:8}...)"
      echo "    To regenerate, delete ~/.lexbuild-secrets and run again."
      echo "    WARNING: Changing the master key invalidates the Meilisearch database."
    else
      MASTER_KEY=$(openssl rand -hex 32)
      echo "--- Generated new master key (${MASTER_KEY:0:8}...)"

      cat > "$SECRETS_FILE" << EOF
export MEILI_MASTER_KEY="${MASTER_KEY}"
export MEILI_SEARCH_KEY=""
export ENABLE_SEARCH="true"
EOF
      chmod 600 "$SECRETS_FILE"
      echo "--- Wrote $SECRETS_FILE"
    fi

    # Ensure .zshenv sources the secrets file
    if ! grep -q 'lexbuild-secrets' "$HOME/.zshenv" 2>/dev/null; then
      echo '[ -f ~/.lexbuild-secrets ] && source ~/.lexbuild-secrets' >> "$HOME/.zshenv"
      echo "--- Added source line to ~/.zshenv"
    else
      echo "--- ~/.zshenv already sources secrets file"
    fi

    echo "==> Init complete"
REMOTE
fi

# --- Search: retrieve search-only API key from running Meilisearch ---

if [ "$DO_SEARCH" = true ]; then
  echo "==> Retrieving search key from Meilisearch..."

  ssh "$VPS_HOST" << 'REMOTE'
    set -euo pipefail

    SECRETS_FILE="$HOME/.lexbuild-secrets"

    # Load the master key
    if [ ! -f "$SECRETS_FILE" ]; then
      echo "Error: $SECRETS_FILE not found. Run with --init first."
      exit 1
    fi
    source "$SECRETS_FILE"

    if [ -z "${MEILI_MASTER_KEY:-}" ]; then
      echo "Error: MEILI_MASTER_KEY is empty. Run with --init first."
      exit 1
    fi

    # Check if Meilisearch is reachable
    echo "--- Checking Meilisearch health..."
    if ! curl -sf http://127.0.0.1:7700/health > /dev/null 2>&1; then
      echo "Error: Meilisearch is not reachable at http://127.0.0.1:7700"
      echo ""
      echo "Start it first:"
      echo "  cd ~/lexbuild"
      echo "  pm2 delete all"
      echo "  pm2 start apps/astro/ecosystem.config.cjs"
      echo "  pm2 save"
      echo ""
      echo "Then run: ./scripts/setup-secrets.sh --search"
      exit 1
    fi
    echo "--- Meilisearch is healthy"

    # Retrieve a search-capable API key.
    # Meilisearch v1.39+ has multiple keys with 'search' in actions:
    #   - "Default Search API Key" (search only)
    #   - "Default Chat API Key" (chatCompletions + search)
    # The Chat API Key works more reliably through Caddy's reverse proxy,
    # so we prefer it. Fall back to any key with search permissions.
    SEARCH_KEY=$(curl -sf http://127.0.0.1:7700/keys \
      -H "Authorization: Bearer ${MEILI_MASTER_KEY}" \
      | python3 -c "
import sys, json
keys = json.load(sys.stdin)['results']
# Prefer the Chat API Key (has both chatCompletions and search)
for k in keys:
    if 'chatCompletions' in k['actions'] and 'search' in k['actions']:
        print(k['key'])
        sys.exit(0)
# Fall back to any key with search
for k in keys:
    if 'search' in k['actions'] and '*' not in k['actions']:
        print(k['key'])
        sys.exit(0)
")

    if [ -z "${SEARCH_KEY:-}" ]; then
      echo "Error: Could not retrieve search key. Check pm2 logs meilisearch."
      exit 1
    fi

    echo "--- Retrieved search key (${SEARCH_KEY:0:8}...)"

    # Update the secrets file
    sed -i "s/^export MEILI_SEARCH_KEY=.*/export MEILI_SEARCH_KEY=\"${SEARCH_KEY}\"/" "$SECRETS_FILE"
    echo "--- Updated $SECRETS_FILE with search key"

    # Verify
    source "$SECRETS_FILE"
    echo ""
    echo "==> Secrets configured:"
    echo "    MEILI_MASTER_KEY=${MEILI_MASTER_KEY:0:8}..."
    echo "    MEILI_SEARCH_KEY=${MEILI_SEARCH_KEY:0:8}..."
    echo "    ENABLE_SEARCH=${ENABLE_SEARCH}"
    echo ""
    echo "Next: run ./scripts/deploy.sh to regenerate .env.production"
REMOTE
fi

echo "Done."

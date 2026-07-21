#!/usr/bin/env bash
# Starts the full MiniCloud suite (gateway + 7 microservices) on one VPS.
# All services share STORAGE_DIR as the single storage volume and the same secrets.
set -e
trap 'kill 0' EXIT

# Load .env if present (so secrets persist across restarts)
if [ -f .env ]; then set -a; . ./.env; set +a; fi

# Generate strong secrets ONCE for this session if not explicitly provided.
# (shared/lib.js also refuses to boot on insecure defaults as a safety net)
gen() { openssl rand -hex 32 2>/dev/null || head -c 32 /dev/urandom | xxd -p | tr -d '\n'; }
if [ -z "${JWT_SECRET:-}" ] || [ "${JWT_SECRET}" = "dev-secret-change-me" ] || [ "${JWT_SECRET}" = "change-me-in-prod" ]; then
  JWT_SECRET=$(gen)
fi
if [ -z "${VAULT_SECRET:-}" ] || [ "${VAULT_SECRET}" = "dev-vault-secret" ] || [ "${VAULT_SECRET}" = "change-me-in-prod" ]; then
  VAULT_SECRET=$(gen)
fi

export STORAGE_DIR="${STORAGE_DIR:-$PWD/storage}"
export JWT_SECRET
export VAULT_SECRET
export MAX_FILE_SIZE_MB="${MAX_FILE_SIZE_MB:-100}"
export DEFAULT_QUOTA_MB="${DEFAULT_QUOTA_MB:-100}"
# H-1: internal services (auth/files/notes/gallery/vault/bookmarks/admin) bind
# to 127.0.0.1 by default — only the gateway is meant to be reachable
# externally. Override BIND_HOST / GATEWAY_BIND_HOST only if you know you need to.

echo "Storage volume: $STORAGE_DIR"
node services/auth/index.js &       AUTH=$!
node services/files/index.js &      FILES=$!
node services/notes/index.js &      NOTES=$!
node services/gallery/index.js &    GALLERY=$!
node services/vault/index.js &      VAULT=$!
node services/bookmarks/index.js &  BOOKMARKS=$!
node services/admin/index.js &      ADMIN=$!
node gateway/index.js &             GW=$!
wait

#!/usr/bin/env bash
# Brings up onchain-invoice's local e2e stack (Hardhat → API + workers → Vite) the way
# its playwright.config.ts webServer entries do, then waits. This is what the QA CI job
# runs before handing the URL to magpi-test (attach mode, QD11).
# Usage: start-stack.sh <onchain-invoice root>
set -euo pipefail
ROOT="$(cd "${1:?usage: start-stack.sh <onchain-invoice root>}" && pwd)"
cd "$ROOT"
API_PORT="${E2E_API_PORT:-8080}"
UI_PORT="${E2E_UI_PORT:-5173}"
HARDHAT_PORT="${E2E_HARDHAT_PORT:-8545}"
LOGS="${STACK_LOGS:-$ROOT/magpi-tests/state/logs}"
mkdir -p "$LOGS"

wait_for() {
  local url="$1" timeout="$2" start
  start=$(date +%s)
  until curl -s -o /dev/null -m 5 -w '%{http_code}' "$url" | grep -qE '^[1-4]'; do
    if (( $(date +%s) - start > timeout )); then echo "timeout waiting for $url" >&2; exit 1; fi
    sleep 1
  done
}

pids=()
cleanup() { for pid in "${pids[@]}"; do kill -- "-$pid" 2>/dev/null || kill "$pid" 2>/dev/null || true; done; }
trap cleanup EXIT INT TERM

set -m
EVM_PRIVATE_KEY="" SWEEPER_PRIVATE_KEY="" npx hardhat node --port "$HARDHAT_PORT" --network e2eLocal >"$LOGS/hardhat.log" 2>&1 &
pids+=($!)
wait_for "http://127.0.0.1:$HARDHAT_PORT" 120
echo "hardhat up"

PORT="$API_PORT" E2E_API_PORT="$API_PORT" E2E_HARDHAT_PORT="$HARDHAT_PORT" HARDHAT_RPC_URL="http://127.0.0.1:$HARDHAT_PORT" \
  PERSIST_LOG_DIR="${PERSIST_LOG_DIR:-/tmp/tc-e2e-persist-logs}" TURNSTILE_SECRET="" TURNSTILE_SITE_KEY="" EVM_PRIVATE_KEY="" SWEEPER_PRIVATE_KEY="" \
  E2E_BUNDLER_TICK_PORT=18741 E2E_SWEEPER_TICK_PORT=18742 E2E_DEPLOYER_TICK_PORT=18743 \
  node ui/e2e/stack/boot.mjs >"$LOGS/api.log" 2>&1 &
pids+=($!)
wait_for "http://127.0.0.1:$API_PORT/api/health" 180
echo "api up"

VITE_DEV_PROXY_TARGET="http://127.0.0.1:$API_PORT" VITE_E2E_WEBAUTHN=1 \
  npx vite --config ui/vite.config.ts --host localhost --port "$UI_PORT" --strictPort >"$LOGS/vite.log" 2>&1 &
pids+=($!)
wait_for "http://localhost:$UI_PORT/" 120
echo "ui up: MAGPI_TEST_BASE_URL=http://localhost:$UI_PORT MAGPI_TEST_READY_URL=http://127.0.0.1:$API_PORT/api/health"
wait

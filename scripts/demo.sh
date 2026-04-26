#!/usr/bin/env bash
set -e

ROOT="/Users/arkoroy/Desktop/eth"

cleanup() {
  echo "Stopping all processes..."
  kill $AXL_PID $WEBHOOK_PID $NEXT_PID 2>/dev/null || true
  exit 0
}
trap cleanup SIGINT SIGTERM

# Kill any existing processes on required ports
lsof -ti:9002 | xargs kill -9 2>/dev/null || true
lsof -ti:4001 | xargs kill -9 2>/dev/null || true
lsof -ti:3000 | xargs kill -9 2>/dev/null || true

echo "Starting AXL node..."
cd "$ROOT/services/axl-node" && ./node -config node-config.json &
AXL_PID=$!
sleep 2

echo "Starting webhook receiver..."
cd "$ROOT" && npx tsx scripts/run-webhook-receiver.ts &
WEBHOOK_PID=$!
sleep 1

echo "Starting Next.js..."
cd "$ROOT/apps/web" && pnpm dev &
NEXT_PID=$!

echo ""
echo "═══════════════════════════════════════════════"
echo "  App running at http://localhost:3000"
echo "  Connect wallet to start swapping"
echo "  Press Ctrl+C to stop all processes"
echo "═══════════════════════════════════════════════"
echo ""

wait

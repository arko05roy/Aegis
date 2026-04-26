#!/bin/bash
# Start all Aegis services for full e2e flow
# Usage: ./scripts/start-all.sh

set -e

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

# Load env
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
fi

echo "╔════════════════════════════════════════════════════════════╗"
echo "║              AEGIS - Full Stack Startup                    ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Check prerequisites
echo "Checking prerequisites..."

if ! command -v pnpm &> /dev/null; then
  echo "❌ pnpm not found. Install with: npm install -g pnpm"
  exit 1
fi

if [ -z "$PRIVATE_KEY" ]; then
  echo "❌ PRIVATE_KEY not set in .env"
  exit 1
fi

echo "✅ Prerequisites OK"
echo ""

# Function to cleanup on exit
cleanup() {
  echo ""
  echo "Shutting down services..."
  kill $(jobs -p) 2>/dev/null || true
  exit 0
}
trap cleanup SIGINT SIGTERM

# 1. Start AXL node (if not already running)
echo "┌─ Starting AXL Node ─────────────────────────────────────────┐"
if curl -s http://127.0.0.1:9002/topology > /dev/null 2>&1; then
  echo "│ ✅ AXL already running on :9002"
else
  if [ -f "services/axl-node/node" ]; then
    cd services/axl-node
    ./node -config node-config.json &
    cd "$ROOT_DIR"
    sleep 2
    if curl -s http://127.0.0.1:9002/topology > /dev/null 2>&1; then
      echo "│ ✅ AXL started on :9002"
    else
      echo "│ ⚠️ AXL failed to start (continuing without it)"
    fi
  else
    echo "│ ⚠️ AXL node not built. Run: cd services/axl-node && make build"
  fi
fi
echo "└──────────────────────────────────────────────────────────────┘"
echo ""

# 2. Start Webhook Receiver
echo "┌─ Starting Webhook Receiver ─────────────────────────────────┐"
if curl -s http://127.0.0.1:4001/health > /dev/null 2>&1; then
  echo "│ ✅ Webhook receiver already running on :4001"
else
  npx ts-node scripts/run-webhook-receiver.ts &
  sleep 2
  if curl -s http://127.0.0.1:4001/health > /dev/null 2>&1; then
    echo "│ ✅ Webhook receiver started on :4001"
  else
    echo "│ ⚠️ Webhook receiver failed to start"
  fi
fi
echo "└──────────────────────────────────────────────────────────────┘"
echo ""

# 3. Start Agent Server
echo "┌─ Starting Agent Server ─────────────────────────────────────┐"
if curl -s http://127.0.0.1:4002/health > /dev/null 2>&1; then
  echo "│ ✅ Agent server already running on :4002"
else
  npx ts-node services/agent-server/index.ts &
  sleep 3
  if curl -s http://127.0.0.1:4002/health > /dev/null 2>&1; then
    echo "│ ✅ Agent server started on :4002"
  else
    echo "│ ⚠️ Agent server failed to start"
  fi
fi
echo "└──────────────────────────────────────────────────────────────┘"
echo ""

# 4. Start Next.js Web App
echo "┌─ Starting Web App ──────────────────────────────────────────┐"
cd apps/web
pnpm dev &
cd "$ROOT_DIR"
sleep 3
echo "│ ✅ Web app starting on :3000"
echo "└──────────────────────────────────────────────────────────────┘"
echo ""

echo "╔════════════════════════════════════════════════════════════╗"
echo "║  All services started!                                     ║"
echo "║                                                            ║"
echo "║  AXL Node:        http://127.0.0.1:9002                    ║"
echo "║  Webhook Receiver: http://127.0.0.1:4001                   ║"
echo "║  Agent Server:    http://127.0.0.1:4002                    ║"
echo "║  Web App:         http://localhost:3000                    ║"
echo "║                                                            ║"
echo "║  Press Ctrl+C to stop all services                         ║"
echo "╚════════════════════════════════════════════════════════════╝"

# Wait for all background jobs
wait

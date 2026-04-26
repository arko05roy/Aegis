#!/usr/bin/env bash
# scripts/demo-up.sh — starts all demo processes in tmux panes
set -euo pipefail

SESSION="aegis-demo"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

tmux kill-session -t "$SESSION" 2>/dev/null || true
tmux new-session -d -s "$SESSION" -n main -c "$ROOT"

# Pane 0: AXL node
tmux send-keys -t "$SESSION":main "cd services/axl-node && ./node -config node-config.json" C-m

# Pane 1: webhook receiver
tmux split-window -h -t "$SESSION":main -c "$ROOT"
tmux send-keys -t "$SESSION":main.1 "npx tsx scripts/run-webhook-receiver.ts" C-m

# Pane 2: Next.js dev server
tmux split-window -v -t "$SESSION":main.0 -c "$ROOT/apps/web"
tmux send-keys -t "$SESSION":main.2 "pnpm dev" C-m

# Pane 3: logs
tmux split-window -v -t "$SESSION":main.1 -c "$ROOT"
tmux send-keys -t "$SESSION":main.3 "echo 'Ready for demo. Open http://localhost:3000/demo'" C-m

tmux attach -t "$SESSION"

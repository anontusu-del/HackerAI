#!/usr/bin/env bash
# Auto-start Tender Intelligence Platform (TenderIntel PK) on Codespace boot:
#   PostgreSQL :5432, Redis :6379, FastAPI :8000, worker, Next.js :3000
set -e

ROOT="/workspaces/HackerAI/tender-intel"
VENV="$ROOT/.venv"
API_DIR="$ROOT/apps/api"
WEB_DIR="$ROOT/apps/web"
WORKER_DIR="$ROOT/apps/worker"
LOG_DIR="$ROOT/data"
mkdir -p "$LOG_DIR"

# 1) PostgreSQL (Debian system service, data dir /var/lib/postgresql/17/main)
if ! pg_isready -h 127.0.0.1 -p 5432 -q 2>/dev/null; then
  sudo service postgresql start >/dev/null 2>&1 || true
  sleep 2
  pg_isready -h 127.0.0.1 -p 5432 -q 2>/dev/null && echo "PostgreSQL ready" || echo "WARN: PostgreSQL not ready"
fi

# 2) Redis
if ! redis-cli -h 127.0.0.1 -p 6379 ping 2>/dev/null | grep -q PONG; then
  sudo service redis-server start >/dev/null 2>&1 || true
  sleep 1
fi

# 3) FastAPI backend :8000
if ! curl -s -o /dev/null --max-time 2 http://localhost:8000/health; then
  nohup "$VENV/bin/uvicorn" app.main:app --host 0.0.0.0 --port 8000 \
    --app-dir "$API_DIR" > "$LOG_DIR/api.log" 2>&1 &
  echo "TenderIntel API started on :8000"
fi

# 4) Worker (scheduled syncs + deadline alerts) — needs CWD = worker dir
if ! pgrep -f "worker.main" >/dev/null 2>&1; then
  (cd "$WORKER_DIR" && nohup "$VENV/bin/python" -m worker.main > "$LOG_DIR/worker.log" 2>&1 &)
  echo "TenderIntel worker started"
fi

# 5) Next.js web :3000 (build once if missing, then serve)
if ! curl -s -o /dev/null --max-time 2 http://localhost:3000; then
  if [ ! -d "$WEB_DIR/.next" ]; then
    (cd "$WEB_DIR" && npm run build > "$LOG_DIR/web-build.log" 2>&1)
  fi
  nohup npm run start --prefix "$WEB_DIR" > "$LOG_DIR/web.log" 2>&1 &
  echo "TenderIntel web started on :3000"
fi

echo "TenderIntel PK ready — web :3000, api :8000"


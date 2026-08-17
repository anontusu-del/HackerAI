#!/usr/bin/env bash
# TenderIntel PK watchdog — checks every 30s and restarts any dead service.
# Runs fully detached (setsid) so it survives terminal/session restarts.
ROOT="/workspaces/HackerAI/tender-intel"
VENV="$ROOT/.venv"
API_DIR="$ROOT/apps/api"
WEB_DIR="$ROOT/apps/web"
WORKER_DIR="$ROOT/apps/worker"
LOG_DIR="$ROOT/data"
mkdir -p "$LOG_DIR"

start_api() {
  setsid nohup "$VENV/bin/uvicorn" app.main:app --host 0.0.0.0 --port 8000 \
    --app-dir "$API_DIR" > "$LOG_DIR/api.log" 2>&1 < /dev/null &
  echo "$(date +%H:%M:%S) watchdog: restarted API" >> "$LOG_DIR/watchdog.log"
}

start_worker() {
  (cd "$WORKER_DIR" && setsid nohup "$VENV/bin/python" -m worker.main \
    > "$LOG_DIR/worker.log" 2>&1 < /dev/null &)
  echo "$(date +%H:%M:%S) watchdog: restarted worker" >> "$LOG_DIR/watchdog.log"
}

start_web() {
  setsid nohup npm run start --prefix "$WEB_DIR" \
    > "$LOG_DIR/web.log" 2>&1 < /dev/null &
  echo "$(date +%H:%M:%S) watchdog: restarted web" >> "$LOG_DIR/watchdog.log"
}

while true; do
  # PostgreSQL
  if ! pg_isready -h 127.0.0.1 -p 5432 -q 2>/dev/null; then
    sudo service postgresql start >/dev/null 2>&1 || true
    sleep 2
  fi
  # Redis
  if ! redis-cli -h 127.0.0.1 -p 6379 ping 2>/dev/null | grep -q PONG; then
    sudo service redis-server start >/dev/null 2>&1 || true
    sleep 1
  fi
  # FastAPI :8000
  if ! curl -s -o /dev/null --max-time 3 http://localhost:8000/health; then
    start_api
  fi
  # Worker
  if ! pgrep -f "worker.main" >/dev/null 2>&1; then
    start_worker
  fi
  # Next.js web :3000
  if ! curl -s -o /dev/null --max-time 3 http://localhost:3000; then
    start_web
  fi
  sleep 30
done


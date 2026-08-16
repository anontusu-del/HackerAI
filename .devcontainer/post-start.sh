#!/usr/bin/env bash
# Auto-start the GMB Pro Dashboard server every time the Codespace starts.
# Port 3000 is forwarded automatically and the browser tab opens by itself.
set -e
cd "$(dirname "$0")/../gmb-pro-dashboard"

if curl -s -o /dev/null --max-time 2 http://localhost:3000/api/config; then
  echo "GMB Pro Dashboard already running on port 3000."
else
  nohup node server.js > /tmp/gmb-server.log 2>&1 &
  echo "GMB Pro Dashboard started (PID $!) — http://localhost:3000"
fi


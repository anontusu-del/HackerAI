"""Worker configuration. Reuses the API package for models/db."""
from __future__ import annotations

import sys
from pathlib import Path

API_DIR = Path(__file__).resolve().parents[2] / "api"
if str(API_DIR) not in sys.path:
    sys.path.insert(0, str(API_DIR))

from app.config import get_settings  # noqa: E402

settings = get_settings()

FIXTURES_DIR = Path(__file__).resolve().parent / "connectors" / "fixtures"

SYNC_INTERVAL_MINUTES = 10
DEADLINE_ALERT_INTERVAL_MINUTES = 5
HEARTBEAT_INTERVAL_SECONDS = 30


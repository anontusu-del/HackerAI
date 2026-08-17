"""Worker package. Bootstraps sys.path so `app.*` (API package) resolves.

Any `import worker.*` executes this module first, guaranteeing the API
package is importable from the worker runtime before app models/db load.
"""
from __future__ import annotations

import sys
from pathlib import Path

API_DIR = Path(__file__).resolve().parents[2] / "api"
if str(API_DIR) not in sys.path:
    sys.path.insert(0, str(API_DIR))


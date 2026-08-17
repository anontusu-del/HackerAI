"""Tender Intelligence worker: scheduled syncs, deadline alerts, heartbeat.

Runs as a standalone process. Also listens on Redis pub/sub for manual
"sync now" triggers fired from the admin UI.
"""
from __future__ import annotations

import logging
import signal
import sys
import threading
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.interval import IntervalTrigger

API_DIR = Path(__file__).resolve().parents[2] / "api"
if str(API_DIR) not in sys.path:
    sys.path.insert(0, str(API_DIR))

from app.db import SessionLocal  # noqa: E402
from worker.config import (  # noqa: E402
    DEADLINE_ALERT_INTERVAL_MINUTES,
    HEARTBEAT_INTERVAL_SECONDS,
    SYNC_INTERVAL_MINUTES,
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
logger = logging.getLogger("tenderintel.worker")

from app.models import Alert, Source, Tender, Watchlist  # noqa: E402
from app.services.watchmatch import watchlist_matches  # noqa: E402
from worker.ingest import sync_all, sync_source  # noqa: E402


def job_sync_all() -> None:
    with SessionLocal() as db:
        try:
            totals = sync_all(db)
            logger.info("sync_all done: %s", totals)
        except Exception:
            logger.exception("sync_all job failed")


def job_sync_source(source_id: str) -> None:
    with SessionLocal() as db:
        source = db.get(Source, source_id)
        if not source:
            logger.warning("sync requested for unknown source %s", source_id)
            return
        if not source.enabled:
            logger.info("source %s disabled; skipping manual sync", source.slug)
            return
        try:
            res = sync_source(db, source, manual=True)
            logger.info("manual sync %s: %s", source.slug, res)
        except Exception:
            logger.exception("manual sync failed for %s", source_id)


def job_deadline_alerts() -> None:
    """Alert users when a watched tender is closing soon (before it closes)."""
    with SessionLocal() as db:
        now = datetime.now(timezone.utc)
        watchlists = db.query(Watchlist).filter(Watchlist.is_active.is_(True)).all()
        made = 0
        for w in watchlists:
            if not w.notify_deadline:
                continue
            horizon = now + timedelta(hours=w.deadline_hours or 72)
            conds = [
                Tender.status == "open",
                Tender.closing_at.is_not(None),
                Tender.closing_at > now,
                Tender.closing_at <= horizon,
            ]
            conds.extend(watchlist_matches(w))
            tenders = (
                db.query(Tender).filter(*conds).order_by(Tender.closing_at.asc()).limit(200)
            )
            for t in tenders:
                dup = db.query(Alert).filter(
                    Alert.watchlist_id == w.id,
                    Alert.tender_id == t.id,
                    Alert.kind == "deadline",
                    Alert.created_at > now - timedelta(hours=6),
                ).first()
                if dup:
                    continue
                hours_left = (t.closing_at - now).total_seconds() / 3600
                db.add(
                    Alert(
                        tenant_id=w.tenant_id,
                        user_id=w.user_id,
                        watchlist_id=w.id,
                        tender_id=t.id,
                        kind="deadline",
                        severity="critical" if hours_left <= 24 else "warning",
                        title=f"Closing soon ({hours_left:.0f}h): {t.reference_no}",
                        message=f"{t.title[:200]} — closes {t.closing_at.strftime('%d %b %Y %H:%M UTC')}",
                        payload={"tender_id": str(t.id), "watchlist_id": str(w.id), "hours_left": round(hours_left, 1)},
                    )
                )
                made += 1
        db.commit()
        if made:
            logger.info("deadline alerts created: %d", made)


def job_heartbeat() -> None:
    from app.api.deps import get_redis

    try:
        r = get_redis()
        r.set("ti:worker:heartbeat", datetime.now(timezone.utc).isoformat(), ex=120)
    except Exception as exc:
        logger.warning("heartbeat failed: %s", exc)


def redis_listener(stop_event: threading.Event) -> None:
    from app.api.deps import get_redis

    while not stop_event.is_set():
        try:
            r = get_redis()
            pubsub = r.pubsub()
            pubsub.subscribe("ti:sync")
            logger.info("listening for manual sync triggers on ti:sync")
            for message in pubsub.listen():
                if stop_event.is_set():
                    break
                if message["type"] != "message":
                    continue
                source_id = message["data"].decode() if isinstance(message["data"], bytes) else message["data"]
                logger.info("sync trigger received for %s", source_id)
                job_sync_source(source_id)
        except Exception as exc:
            logger.warning("redis listener error (retrying in 10s): %s", exc)
            stop_event.wait(10)


def main() -> None:
    scheduler = BackgroundScheduler(timezone="UTC")
    scheduler.add_job(
        job_sync_all,
        trigger=IntervalTrigger(minutes=SYNC_INTERVAL_MINUTES),
        id="sync_all",
        next_run_time=datetime.now(timezone.utc) + timedelta(seconds=5),
        max_instances=1,
        coalesce=True,
    )
    scheduler.add_job(
        job_deadline_alerts,
        trigger=IntervalTrigger(minutes=DEADLINE_ALERT_INTERVAL_MINUTES),
        id="deadline_alerts",
        next_run_time=datetime.now(timezone.utc) + timedelta(seconds=30),
        max_instances=1,
        coalesce=True,
    )
    scheduler.add_job(
        job_heartbeat,
        trigger=IntervalTrigger(seconds=HEARTBEAT_INTERVAL_SECONDS),
        id="heartbeat",
        max_instances=1,
        coalesce=True,
    )
    scheduler.start()
    logger.info("worker started: sync=%smin deadline=%smin heartbeat=%ss", SYNC_INTERVAL_MINUTES, DEADLINE_ALERT_INTERVAL_MINUTES, HEARTBEAT_INTERVAL_SECONDS)

    stop_event = threading.Event()
    listener = threading.Thread(target=redis_listener, args=(stop_event,), daemon=True)
    listener.start()

    def _shutdown(*_):
        logger.info("shutting down worker...")
        stop_event.set()
        scheduler.shutdown(wait=False)

    signal.signal(signal.SIGTERM, _shutdown)
    signal.signal(signal.SIGINT, _shutdown)

    try:
        while not stop_event.is_set():
            time.sleep(1)
    except KeyboardInterrupt:
        pass
    logger.info("worker stopped")


if __name__ == "__main__":
    main()




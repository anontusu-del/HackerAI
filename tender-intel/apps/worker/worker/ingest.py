"""Ingest pipeline: normalize, dedupe, diff, persist, alert.

Change detection is the heart of the platform: every sync compares the content
hash of each tender against the stored hash and records a structured, auditable
change trail (deadline moves, amendments, status flips, award disclosures).
"""
from __future__ import annotations

import json
import logging
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Alert, Award, ConnectorRun, Source, Tender, TenderChange, Watchlist
from app.services.watchmatch import watchlist_matches
from worker.connectors.base import content_hash
from worker.connectors.portals import get_connector

logger = logging.getLogger("tenderintel.ingest")

DIFF_FIELDS = [
    "title",
    "description",
    "reference_no",
    "agency",
    "department",
    "category",
    "province",
    "city",
    "tender_type",
    "procurement_method",
    "status",
    "published_at",
    "closing_at",
    "opening_at",
    "estimated_value",
    "currency",
    "bid_security",
    "validity_period",
    "contact_person",
    "contact_email",
    "contact_phone",
    "eligibility",
    "attachments",
    "bid_count",
    "bidder_names",
    "awardee_name",
    "award_amount",
    "award_date",
]


def build_tsv(t: Tender) -> None:
    from sqlalchemy import func as sa_func

    expr = sa_func.to_tsvector(
        "english",
        sa_func.concat_ws(
            " ",
            t.title or "",
            t.description or "",
            t.agency or "",
            t.department or "",
            t.reference_no or "",
            t.category or "",
        ),
    )
    t.search_tsv = expr  # type: ignore[assignment]


def _status_rollover(t: Tender, now: datetime) -> str | None:
    if t.status == "open" and t.closing_at and t.closing_at < now:
        return "closed"
    return None


def upsert_tender(db: Session, source: Source, data: dict, run_id) -> dict:
    external_id = data["external_id"]
    existing = db.scalar(
        select(Tender).where(Tender.source_id == source.id, Tender.external_id == external_id)
    )
    new_hash = content_hash(data)
    now = datetime.now(timezone.utc)

    if existing is None:
        tender = Tender(source_id=source.id, external_id=external_id, content_hash=new_hash)
        for field, value in data.items():
            if hasattr(tender, field):
                setattr(tender, field, value)
        build_tsv(tender)
        db.add(tender)
        db.flush()
        db.add(
            TenderChange(
                tender_id=tender.id,
                field="tender",
                old_value=None,
                new_value=tender.reference_no or tender.title,
                change_type="new",
                source_run_id=run_id,
                detected_at=now,
            )
        )
        _award_record(db, tender, run_id, now)
        _fire_alerts(db, tender, "new", [], run_id)
        return {"new": 1, "updated": 0, "changed": 0}

    if existing.content_hash == new_hash:
        existing.last_seen_at = now
        return {"new": 0, "updated": 0, "changed": 0}

    changes: list[tuple[str, str | None, str | None, str]] = []
    for field in DIFF_FIELDS:
        old_val = getattr(existing, field)
        new_val = data.get(field)
        if _values_differ(old_val, new_val):
            changes.append((field, _fmt(old_val), _fmt(new_val), "updated"))

    for field, value in data.items():
        if hasattr(existing, field):
            setattr(existing, field, value)
    existing.content_hash = new_hash
    existing.last_seen_at = now

    rolled = _status_rollover(existing, now)
    if rolled:
        existing.status = rolled
        changes.append(("status", "open", rolled, "closed"))

    build_tsv(existing)
    db.flush()

    for field, old_v, new_v, ctype in changes:
        db.add(
            TenderChange(
                tender_id=existing.id,
                field=field,
                old_value=old_v,
                new_value=new_v,
                change_type=ctype,
                source_run_id=run_id,
                detected_at=now,
            )
        )

    _award_record(db, existing, run_id, now)
    _fire_alerts(db, existing, "change", changes, run_id)
    return {"new": 0, "updated": 1, "changed": len(changes)}


def _values_differ(old, new) -> bool:
    if old is None and (new is None or new == ""):
        return False
    if isinstance(old, (list, dict)) or isinstance(new, (list, dict)):
        return str(old) != str(new)
    return str(old) != str(new)


def _fmt(value) -> str | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, (list, dict)):
        return json.dumps(value, default=str)[:2000]
    return str(value)[:2000]


def _award_record(db: Session, tender: Tender, run_id, now: datetime) -> None:
    if not tender.awardee_name:
        return
    exists = db.scalar(select(Award).where(Award.tender_id == tender.id, Award.awardee == tender.awardee_name))
    if exists:
        return
    db.add(
        Award(
            tender_id=tender.id,
            awardee=tender.awardee_name,
            awardee_org=tender.awardee_name,
            amount=tender.award_amount,
            currency=tender.currency,
            award_date=tender.award_date or now,
            basis="Lowest Evaluated Bidder",
            source_url=tender.source_url,
        )
    )
    db.add(
        TenderChange(
            tender_id=tender.id,
            field="awardee_name",
            old_value=None,
            new_value=tender.awardee_name,
            change_type="awarded",
            source_run_id=run_id,
            detected_at=now,
        )
    )
    _fire_alerts(db, tender, "award", [], run_id)


def _matches(db: Session, w: Watchlist, tender_id) -> bool:
    conds = watchlist_matches(w)
    if not conds:
        return True
    stmt = select(Tender.id).where(Tender.id == tender_id, *conds)
    return db.scalar(stmt) is not None


def _fire_alerts(db: Session, tender: Tender, kind: str, changes: list, run_id) -> None:
    watchlists = db.scalars(
        select(Watchlist).where(Watchlist.is_active.is_(True), Watchlist.tenant_id.is_not(None))
    ).all()

    for w in watchlists:
        if kind == "new" and not w.notify_new:
            continue
        if kind == "change" and not w.notify_change:
            continue
        if kind == "award" and not w.notify_change:
            continue
        if not _matches(db, w, tender.id):
            continue

        if kind == "new":
            title = f"New tender: {tender.title[:180]}"
            message = f"{tender.agency} | {tender.category} | closes {_fmt(tender.closing_at)}"
        elif kind == "change":
            desc = ", ".join(f"{f}: {o} → {n}" for f, o, n, _ in changes[:4])
            title = f"Tender updated: {tender.reference_no}"
            message = desc or "Content changed"
        else:  # award
            title = f"Award disclosed: {tender.reference_no}"
            message = f"Awarded to {tender.awardee_name} — {tender.currency} {tender.award_amount or 'n/a'}"

        dup = db.scalar(
            select(Alert).where(
                Alert.watchlist_id == w.id,
                Alert.tender_id == tender.id,
                Alert.kind == kind,
            )
        )
        if dup:
            continue
        db.add(
            Alert(
                tenant_id=w.tenant_id,
                user_id=w.user_id,
                watchlist_id=w.id,
                tender_id=tender.id,
                kind=kind,
                severity="warning" if kind in ("deadline", "change") else "info",
                title=title[:300],
                message=message,
                payload={"tender_id": str(tender.id), "watchlist_id": str(w.id), "kind": kind},
            )
        )


def sync_source(db: Session, source: Source, manual: bool = False) -> dict:
    now = datetime.now(timezone.utc)
    run = ConnectorRun(source_id=source.id, started_at=now, status="running")
    db.add(run)
    db.flush()
    result = {"found": 0, "new": 0, "updated": 0, "changed": 0, "error": None}
    try:
        connector = get_connector(source)
        tenders = connector.fetch_tenders()
        result["found"] = len(tenders)
        for data in tenders:
            stats = upsert_tender(db, source, data, run.id)
            result["new"] += stats["new"]
            result["updated"] += stats["updated"]
            result["changed"] += stats["changed"]
        db.commit()
        run.status = "success"
        run.finished_at = datetime.now(timezone.utc)
        run.items_found = result["found"]
        run.items_new = result["new"]
        run.items_updated = result["updated"]
        run.items_changed = result["changed"]
        source.status = "healthy"
        source.last_run_at = now
        source.last_success_at = now
        source.last_error = None
        source.last_items_found = result["found"]
        source.next_run_at = None
    except Exception as exc:
        logger.exception("[%s] sync failed", source.slug)
        db.rollback()
        run = db.get(ConnectorRun, run.id)
        if run:
            run.status = "error"
            run.finished_at = datetime.now(timezone.utc)
            run.error = str(exc)[:2000]
        source.status = "error"
        source.last_run_at = now
        source.last_error = str(exc)[:500]
        result["error"] = str(exc)
    db.commit()
    return result


def sync_all(db: Session) -> dict:
    sources = db.scalars(select(Source).where(Source.enabled.is_(True))).all()
    totals = {"sources": 0, "found": 0, "new": 0, "updated": 0, "changed": 0}
    for source in sources:
        try:
            res = sync_source(db, source)
            totals["sources"] += 1
            totals["found"] += res["found"]
            totals["new"] += res["new"]
            totals["updated"] += res["updated"]
            totals["changed"] += res["changed"]
        except Exception as exc:
            logger.exception("sync_all error for %s: %s", source.slug, exc)
    return totals


"""Tender search & filter builder over PostgreSQL full-text + structured filters."""
from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import asc, desc, func, or_
from sqlalchemy.orm import Session

from app.models import Tender


def build_tender_filters(
    q: Optional[str] = None,
    agencies: Optional[list[str]] = None,
    categories: Optional[list[str]] = None,
    provinces: Optional[list[str]] = None,
    statuses: Optional[list[str]] = None,
    types: Optional[list[str]] = None,
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    closing_after: Optional[datetime] = None,
    closing_before: Optional[datetime] = None,
    min_value: Optional[float] = None,
    max_value: Optional[float] = None,
    sources: Optional[list[str]] = None,
    reference: Optional[str] = None,
) -> list:
    conditions = []

    if q and q.strip():
        ts = select_tender_ids_matching(q.strip())
        conditions.append(
            or_(
                Tender.id.in_(ts),
                Tender.title.ilike(f"%{q.strip()}%"),
                Tender.reference_no.ilike(f"%{q.strip()}%"),
                Tender.agency.ilike(f"%{q.strip()}%"),
            )
        )

    if agencies:
        conditions.append(Tender.agency.in_(agencies))
    if categories:
        conditions.append(Tender.category.in_(categories))
    if provinces:
        conditions.append(Tender.province.in_(provinces))
    if statuses:
        conditions.append(Tender.status.in_(statuses))
    if types:
        conditions.append(Tender.tender_type.in_(types))
    if sources:
        conditions.append(Tender.source_id.in_(sources))
    if reference:
        conditions.append(Tender.reference_no.ilike(f"%{reference}%"))
    if date_from:
        conditions.append(Tender.published_at >= date_from)
    if date_to:
        conditions.append(Tender.published_at <= date_to)
    if closing_after:
        conditions.append(Tender.closing_at >= closing_after)
    if closing_before:
        conditions.append(Tender.closing_at <= closing_before)
    if min_value is not None:
        conditions.append(Tender.estimated_value >= min_value)
    if max_value is not None:
        conditions.append(Tender.estimated_value <= max_value)

    return conditions


def select_tender_ids_matching(q: str):
    return (
        Tender.__table__.select()
        .with_only_columns(Tender.__table__.c.id)
        .where(Tender.search_tsv.op("@@")(func.plainto_tsquery("english", q)))
    )


def apply_sort(stmt, sort: str):
    sort_map = {
        "newest": desc(Tender.published_at),
        "oldest": asc(Tender.published_at),
        "closing": asc(Tender.closing_at),
        "value_desc": desc(Tender.estimated_value),
        "value_asc": asc(Tender.estimated_value),
        "updated": desc(Tender.updated_at),
    }
    stmt = stmt.order_by(sort_map.get(sort, desc(Tender.published_at)))
    if sort != "closing":
        stmt = stmt.order_by(asc(Tender.closing_at))
    return stmt


def parse_dt(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except Exception:
        return None


def apply_limit(stmt, page: int, page_size: int):
    return stmt.offset((page - 1) * page_size).limit(page_size)


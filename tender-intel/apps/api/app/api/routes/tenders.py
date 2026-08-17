"""Tender search, detail, change history, facets and CSV export."""
from __future__ import annotations

import csv
import io
from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

from app.api.deps import cache_get_json, cache_set_json, get_current_user, get_db, get_redis
from app.api.routes._helpers import tender_to_detail
from app.models import Source, Tender, TenderChange, User
from app.schemas import ChangeOut, TenderDetailOut, TenderPage
from app.services.search import apply_limit, apply_sort, build_tender_filters, parse_dt

router = APIRouter(prefix="/tenders", tags=["tenders"])


@router.get("", response_model=TenderPage)
def list_tenders(
    q: str | None = None,
    agencies: str | None = Query(default=None),
    categories: str | None = Query(default=None),
    provinces: str | None = Query(default=None),
    statuses: str | None = Query(default=None),
    types: str | None = Query(default=None),
    sources: str | None = Query(default=None),
    date_from: str | None = None,
    date_to: str | None = None,
    closing_after: str | None = None,
    closing_before: str | None = None,
    min_value: float | None = None,
    max_value: float | None = None,
    reference: str | None = None,
    sort: str = "newest",
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    def _split(v: str | None):
        return [x.strip() for x in v.split(",")] if v else None

    conditions = build_tender_filters(
        q=q,
        agencies=_split(agencies),
        categories=_split(categories),
        provinces=_split(provinces),
        statuses=_split(statuses),
        types=_split(types),
        sources=_split(sources),
        date_from=parse_dt(date_from),
        date_to=parse_dt(date_to),
        closing_after=parse_dt(closing_after),
        closing_before=parse_dt(closing_before),
        min_value=min_value,
        max_value=max_value,
        reference=reference,
    )

    base = select(Tender).where(*conditions)
    total = db.scalar(select(func.count()).select_from(Tender).where(*conditions)) or 0
    stmt = apply_sort(base, sort)
    rows = db.scalars(apply_limit(stmt, page, page_size)).all()

    items = []
    for t in rows:
        dto = tender_to_detail(t)
        items.append(dto)
    return TenderPage(total=total, page=page, page_size=page_size, items=items)


@router.get("/facets")
def facets(db: Session = Depends(get_db), _user: User = Depends(get_current_user)):
    r = get_redis()
    cached = cache_get_json(r, "facets:v1")
    if cached:
        return cached

    def distinct(col):
        return [row[0] for row in db.execute(select(col).where(col != "").distinct().order_by(col)).all()]

    result = {
        "agencies": distinct(Tender.agency),
        "categories": distinct(Tender.category),
        "provinces": distinct(Tender.province),
        "statuses": distinct(Tender.status),
        "types": distinct(Tender.tender_type),
        "sources": [
            {"id": str(s.id), "slug": s.slug, "name": s.name}
            for s in db.scalars(select(Source).order_by(Source.name)).all()
        ],
    }
    cache_set_json(r, "facets:v1", result, ttl=300)
    return result


@router.get("/{tender_id}", response_model=TenderDetailOut)
def get_tender(tender_id: UUID, db: Session = Depends(get_db), _user: User = Depends(get_current_user)):
    tender = db.scalar(
        select(Tender).options(joinedload(Tender.changes), joinedload(Tender.documents)).where(Tender.id == tender_id)
    )
    if not tender:
        raise HTTPException(status_code=404, detail="Tender not found")
    return tender_to_detail(tender)


@router.get("/{tender_id}/changes", response_model=list[ChangeOut])
def get_changes(tender_id: UUID, db: Session = Depends(get_db), _user: User = Depends(get_current_user)):
    rows = db.scalars(
        select(TenderChange).where(TenderChange.tender_id == tender_id).order_by(TenderChange.detected_at.desc())
    ).all()
    return rows


@router.get("/export/csv")
def export_csv(
    q: str | None = None,
    agencies: str | None = None,
    categories: str | None = None,
    provinces: str | None = None,
    statuses: str | None = None,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    def _split(v: str | None):
        return [x.strip() for x in v.split(",")] if v else None

    conditions = build_tender_filters(
        q=q,
        agencies=_split(agencies),
        categories=_split(categories),
        provinces=_split(provinces),
        statuses=_split(statuses),
    )
    rows = db.scalars(select(Tender).where(*conditions).order_by(Tender.published_at.desc()).limit(5000)).all()

    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(
        [
            "Reference No", "Title", "Agency", "Department", "Category", "Province", "City",
            "Type", "Method", "Status", "Published", "Closing", "Est. Value (PKR)", "Bid Count",
            "Awardee", "Award Amount", "Award Date", "Source URL",
        ]
    )
    for t in rows:
        writer.writerow(
            [
                t.reference_no, t.title, t.agency, t.department, t.category, t.province, t.city,
                t.tender_type, t.procurement_method, t.status,
                t.published_at.isoformat() if t.published_at else "",
                t.closing_at.isoformat() if t.closing_at else "",
                str(t.estimated_value) if t.estimated_value is not None else "",
                t.bid_count or "",
                t.awardee_name or "",
                str(t.award_amount) if t.award_amount is not None else "",
                t.award_date.isoformat() if t.award_date else "",
                t.source_url,
            ]
        )
    now = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M")
    return StreamingResponse(
        io.BytesIO(buf.getvalue().encode("utf-8-sig")),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="tenders_export_{now}.csv"'},
    )


"""Analytics: summary cards, agency/category/province breakdowns, competitor stats."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Query
from sqlalchemy import case, cast, desc, func, select
from sqlalchemy.orm import Session

from app.api.deps import cache_get_json, cache_set_json, get_current_user, get_db, get_redis
from app.models import Award, Source, Tender, User, Watchlist, Alert
from app.schemas import AnalyticsSummary, CompetitorStat, SeriesPoint

router = APIRouter(prefix="/analytics", tags=["analytics"])


def _open_value(db: Session) -> float:
    v = db.scalar(
        select(func.coalesce(func.sum(Tender.estimated_value), 0)).where(
            Tender.status == "open", Tender.estimated_value.is_not(None)
        )
    )
    return float(v or 0)


@router.get("/summary", response_model=AnalyticsSummary)
def summary(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    now = datetime.now(timezone.utc)
    h24 = now + timedelta(hours=24)
    h72 = now + timedelta(hours=72)

    total = db.scalar(select(func.count()).select_from(Tender)) or 0
    open_t = db.scalar(select(func.count()).select_from(Tender).where(Tender.status == "open")) or 0
    c24 = (
        db.scalar(
            select(func.count())
            .select_from(Tender)
            .where(Tender.status == "open", Tender.closing_at.is_not(None), Tender.closing_at <= h24)
        )
        or 0
    )
    c72 = (
        db.scalar(
            select(func.count())
            .select_from(Tender)
            .where(Tender.status == "open", Tender.closing_at.is_not(None), Tender.closing_at <= h72)
        )
        or 0
    )
    awarded = db.scalar(select(func.count()).select_from(Tender).where(Tender.status == "awarded")) or 0
    sources = db.scalar(select(func.count()).select_from(Source).where(Source.enabled.is_(True))) or 0
    watchlists = db.scalar(select(func.count()).select_from(Watchlist).where(Watchlist.tenant_id == user.tenant_id)) or 0
    unread = db.scalar(select(func.count()).select_from(Alert).where(Alert.user_id == user.id, Alert.is_read.is_(False))) or 0

    return AnalyticsSummary(
        total_tenders=total,
        open_tenders=open_t,
        closing_24h=c24,
        closing_72h=c72,
        total_value_open=_open_value(db),
        awarded_count=awarded,
        sources_active=sources,
        total_watchlists=watchlists,
        unread_alerts=unread,
    )


@router.get("/by-agency", response_model=list[SeriesPoint])
def by_agency(limit: int = 12, db: Session = Depends(get_db), _user: User = Depends(get_current_user)):
    r = get_redis()
    cached = cache_get_json(r, "analytics:agency:v1")
    if cached:
        return cached
    rows = db.execute(
        select(Tender.agency, func.count(Tender.id), func.coalesce(func.sum(Tender.estimated_value), 0))
        .where(Tender.agency != "")
        .group_by(Tender.agency)
        .order_by(desc(func.count(Tender.id)))
        .limit(limit)
    ).all()
    out = [SeriesPoint(key=a, value=float(c), extra={"value_sum": float(v)}).model_dump() for a, c, v in rows]
    cache_set_json(r, "analytics:agency:v1", out, ttl=600)
    return out


@router.get("/by-category", response_model=list[SeriesPoint])
def by_category(db: Session = Depends(get_db), _user: User = Depends(get_current_user)):
    r = get_redis()
    cached = cache_get_json(r, "analytics:category:v1")
    if cached:
        return cached
    rows = db.execute(
        select(Tender.category, func.count(Tender.id))
        .where(Tender.category != "")
        .group_by(Tender.category)
        .order_by(desc(func.count(Tender.id)))
    ).all()
    out = [SeriesPoint(key=c, value=float(n)).model_dump() for c, n in rows]
    cache_set_json(r, "analytics:category:v1", out, ttl=600)
    return out


@router.get("/by-province", response_model=list[SeriesPoint])
def by_province(db: Session = Depends(get_db), _user: User = Depends(get_current_user)):
    rows = db.execute(
        select(Tender.province, func.count(Tender.id))
        .where(Tender.province != "")
        .group_by(Tender.province)
        .order_by(desc(func.count(Tender.id)))
    ).all()
    return [SeriesPoint(key=p, value=float(n)).model_dump() for p, n in rows]


@router.get("/value-trend", response_model=list[SeriesPoint])
def value_trend(days: int = Query(default=90, ge=7, le=365), db: Session = Depends(get_db), _user: User = Depends(get_current_user)):
    """Monthly sum of estimated value for tenders published in the last N days."""
    since = datetime.now(timezone.utc) - timedelta(days=days)
    month = func.date_trunc("month", Tender.published_at).label("month")
    rows = db.execute(
        select(month, func.coalesce(func.sum(Tender.estimated_value), 0))
        .where(Tender.published_at >= since, Tender.estimated_value.is_not(None))
        .group_by(month)
        .order_by(month)
    ).all()
    return [
        SeriesPoint(key=m.strftime("%Y-%m"), value=float(v)).model_dump() for m, v in rows
    ]


@router.get("/competitors", response_model=list[CompetitorStat])
def competitors(limit: int = 20, db: Session = Depends(get_db), _user: User = Depends(get_current_user)):
    """Competitor analytics from publicly disclosed post-award records."""
    r = get_redis()
    cached = cache_get_json(r, "analytics:competitors:v1")
    if cached:
        return cached
    rows = db.execute(
        select(
            Award.awardee,
            func.count(Award.id),
            func.coalesce(func.sum(Award.amount), 0),
            func.count(case((Tender.estimated_value.is_not(None), 1))),
        )
        .join(Tender, Tender.id == Award.tender_id)
        .group_by(Award.awardee)
        .order_by(desc(func.count(Award.id)))
        .limit(limit)
    ).all()
    total_awards = db.scalar(select(func.count()).select_from(Award)) or 1
    out = [
        CompetitorStat(
            name=awardee,
            wins=int(wins),
            total_value=float(value),
            win_rate=round((wins / total_awards) * 100, 2),
        ).model_dump()
        for awardee, wins, value, _ in rows
    ]
    cache_set_json(r, "analytics:competitors:v1", out, ttl=900)
    return out


@router.get("/win-rate-by-agency")
def win_rate_by_agency(db: Session = Depends(get_db), _user: User = Depends(get_current_user)):
    rows = db.execute(
        select(Tender.agency, Award.awardee, func.count(Award.id))
        .join(Award, Award.tender_id == Tender.id)
        .where(Tender.agency != "")
        .group_by(Tender.agency, Award.awardee)
        .order_by(Tender.agency, desc(func.count(Award.id)))
    ).all()
    out: dict[str, list] = {}
    for agency, awardee, n in rows:
        out.setdefault(agency, []).append({"awardee": awardee, "wins": int(n)})
    return out


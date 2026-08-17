"""Alerts feed: list, unread counts, mark read."""
from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy import and_, func, or_, select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models import Alert, User
from app.schemas import AlertOut

router = APIRouter(prefix="/alerts", tags=["alerts"])


@router.get("", response_model=list[AlertOut])
def list_alerts(
    unread_only: bool = False,
    limit: int = 100,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    stmt = (
        select(Alert)
        .where(
            or_(
                Alert.user_id == user.id,
                and_(Alert.user_id.is_(None), Alert.tenant_id == user.tenant_id),
            )
        )
        .order_by(Alert.created_at.desc())
        .limit(min(limit, 500))
    )
    if unread_only:
        stmt = stmt.where(Alert.is_read.is_(False))
    return db.scalars(stmt).all()


@router.get("/unread-count")
def unread_count(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    n = db.scalar(
        select(func.count())
        .select_from(Alert)
        .where(
            or_(
                Alert.user_id == user.id,
                and_(Alert.user_id.is_(None), Alert.tenant_id == user.tenant_id),
            ),
            Alert.is_read.is_(False),
        )
    ) or 0
    return {"unread": n}


@router.post("/{alert_id}/read", response_model=AlertOut)
def mark_read(alert_id: UUID, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    a = db.get(Alert, alert_id)
    if not a or not (
        a.user_id == user.id
        or (a.user_id is None and a.tenant_id == user.tenant_id)
    ):
        from fastapi import HTTPException

        raise HTTPException(status_code=404, detail="Alert not found")
    a.is_read = True
    db.commit()
    db.refresh(a)
    return a


@router.post("/mark-all-read")
def mark_all_read(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    rows = db.scalars(
        select(Alert).where(
            or_(
                Alert.user_id == user.id,
                and_(Alert.user_id.is_(None), Alert.tenant_id == user.tenant_id),
            ),
            Alert.is_read.is_(False),
        )
    ).all()
    for a in rows:
        a.is_read = True
    db.commit()
    return {"marked": len(rows)}



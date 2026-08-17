"""Watchlist CRUD with live matched-tender counting."""
from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import client_ip, get_current_user, get_db, write_audit
from app.models import Tender, User, Watchlist
from app.schemas import WatchlistIn, WatchlistOut, WatchlistPatch
from app.services.watchmatch import watchlist_matches

router = APIRouter(prefix="/watchlists", tags=["watchlists"])


def _to_out(db: Session, w: Watchlist) -> WatchlistOut:
    out = WatchlistOut.model_validate(w)
    out.matched_count = db.scalar(select(func.count()).select_from(Tender).where(*watchlist_matches(w))) or 0
    return out


@router.get("", response_model=list[WatchlistOut])
def list_watchlists(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    rows = db.scalars(
        select(Watchlist)
        .where(Watchlist.tenant_id == user.tenant_id)
        .order_by(Watchlist.created_at.desc())
    ).all()
    return [_to_out(db, w) for w in rows]


@router.post("", response_model=WatchlistOut, status_code=201)
def create_watchlist(
    payload: WatchlistIn, request: Request, db: Session = Depends(get_db), user: User = Depends(get_current_user)
):
    w = Watchlist(tenant_id=user.tenant_id, user_id=user.id, **payload.model_dump())
    db.add(w)
    db.flush()
    write_audit(db, user.id, user.tenant_id, "watchlist.create", "watchlist", str(w.id), ip=client_ip(request))
    db.commit()
    db.refresh(w)
    return _to_out(db, w)


@router.patch("/{watchlist_id}", response_model=WatchlistOut)
def update_watchlist(
    watchlist_id: UUID,
    payload: WatchlistPatch,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    w = db.get(Watchlist, watchlist_id)
    if not w or w.tenant_id != user.tenant_id:
        raise HTTPException(status_code=404, detail="Watchlist not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(w, k, v)
    write_audit(db, user.id, user.tenant_id, "watchlist.update", "watchlist", str(w.id), ip=client_ip(request))
    db.commit()
    db.refresh(w)
    return _to_out(db, w)


@router.delete("/{watchlist_id}", status_code=204)
def delete_watchlist(
    watchlist_id: UUID, request: Request, db: Session = Depends(get_db), user: User = Depends(get_current_user)
):
    w = db.get(Watchlist, watchlist_id)
    if not w or w.tenant_id != user.tenant_id:
        raise HTTPException(status_code=404, detail="Watchlist not found")
    write_audit(db, user.id, user.tenant_id, "watchlist.delete", "watchlist", str(w.id), ip=client_ip(request))
    db.delete(w)
    db.commit()


"""Admin: source registry, connector runs, audit logs, health, manual sync trigger."""
from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import (
    client_ip,
    get_current_user,
    get_db,
    get_redis,
    require_roles,
    write_audit,
)
from app.models import AuditLog, ConnectorRun, Source, Tender, User
from app.schemas import AuditOut, HealthOut, RunOut, SourceOut

router = APIRouter(prefix="/admin", tags=["admin"])

admin_only = require_roles("admin")


@router.get("/sources", response_model=list[SourceOut])
def list_sources(db: Session = Depends(get_db), _user: User = Depends(admin_only)):
    return db.scalars(select(Source).order_by(Source.slug)).all()


@router.post("/sources/{source_id}/toggle", response_model=SourceOut)
def toggle_source(
    source_id: UUID, request: Request, db: Session = Depends(get_db), user: User = Depends(admin_only)
):
    s = db.get(Source, source_id)
    if not s:
        raise HTTPException(status_code=404, detail="Source not found")
    s.enabled = not s.enabled
    write_audit(db, user.id, user.tenant_id, "source.toggle", "source", str(s.id), ip=client_ip(request))
    db.commit()
    db.refresh(s)
    return s


@router.post("/sources/{source_id}/sync")
def trigger_sync(source_id: UUID, request: Request, db: Session = Depends(get_db), user: User = Depends(admin_only)):
    """Publish a sync request to Redis; the worker picks it up immediately."""
    s = db.get(Source, source_id)
    if not s:
        raise HTTPException(status_code=404, detail="Source not found")
    r = get_redis()
    r.publish("ti:sync", str(s.id))
    write_audit(db, user.id, user.tenant_id, "source.sync_manual", "source", str(s.id), ip=client_ip(request))
    db.commit()
    return {"queued": True, "source": s.slug}


@router.get("/runs", response_model=list[RunOut])
def list_runs(limit: int = 50, db: Session = Depends(get_db), _user: User = Depends(admin_only)):
    rows = db.scalars(select(ConnectorRun).order_by(ConnectorRun.started_at.desc()).limit(min(limit, 200))).all()
    return rows


@router.get("/audit", response_model=list[AuditOut])
def list_audit(limit: int = 100, db: Session = Depends(get_db), _user: User = Depends(admin_only)):
    rows = db.scalars(select(AuditLog).order_by(AuditLog.created_at.desc()).limit(min(limit, 500))).all()
    return rows


@router.get("/health", response_model=HealthOut)
def health(db: Session = Depends(get_db), _user: User = Depends(get_current_user)):
    db_status = "ok"
    try:
        db.execute(select(1))
    except Exception as exc:  # pragma: no cover
        db_status = f"error: {exc}"

    r = get_redis()
    redis_status = "ok"
    try:
        r.ping()
    except Exception as exc:
        redis_status = f"error: {exc}"

    heartbeat = None
    try:
        heartbeat = r.get("ti:worker:heartbeat")
    except Exception:
        pass

    sources = db.scalars(select(Source).order_by(Source.slug)).all()
    pending = db.scalar(select(func.count()).select_from(Tender).where(Tender.status == "open")) or 0
    return HealthOut(
        status="ok" if db_status == "ok" and redis_status == "ok" else "degraded",
        database=db_status,
        redis=redis_status,
        worker_heartbeat=heartbeat,
        sources=[SourceOut.model_validate(s) for s in sources],
        pending_alerts=pending,
    )


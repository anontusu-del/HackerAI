"""Shared FastAPI dependencies: DB session, Redis, current user, RBAC, audit."""
from __future__ import annotations

import json
from typing import Callable, List
from uuid import UUID

import redis
from fastapi import Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.core.security import COOKIE_NAME, decode_token
from app.db import get_db
from app.models import AuditLog, User

settings = get_settings()

_redis_client: redis.Redis | None = None


def get_redis() -> redis.Redis:
    global _redis_client
    if _redis_client is None:
        _redis_client = redis.Redis.from_url(settings.REDIS_URL, decode_responses=True)
    return _redis_client


def _extract_token(request: Request) -> str | None:
    auth = request.headers.get("Authorization", "")
    if auth.lower().startswith("bearer "):
        return auth[7:].strip()
    return request.cookies.get(COOKIE_NAME)


DEFAULT_USER_EMAIL = "admin@tenderintel.pk"


def _default_user(db: Session) -> User:
    """No-login mode: requests without a valid session act as the seeded admin."""
    user = db.scalar(select(User).where(User.email == DEFAULT_USER_EMAIL))
    if user is None or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    return user


def get_current_user(request: Request, db: Session = Depends(get_db)) -> User:
    """Authenticate from token when present; otherwise fall back to the default
    admin so the dashboard works with no login at all (live demo mode)."""
    token = _extract_token(request)
    if token:
        payload = decode_token(token)
        if payload:
            user = db.get(User, UUID(payload["sub"]))
            if user and user.is_active:
                return user
    return _default_user(db)


def require_roles(*roles: str) -> Callable:
    """RBAC guard: at least one of the given roles."""

    def guard(user: User = Depends(get_current_user)) -> User:
        if user.role not in roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient privileges")
        return user

    return guard


def write_audit(
    db: Session,
    user_id: UUID | None,
    tenant_id: UUID | None,
    action: str,
    entity: str = "",
    entity_id: str | None = None,
    details: dict | None = None,
    ip: str = "",
) -> None:
    db.add(
        AuditLog(
            user_id=user_id,
            tenant_id=tenant_id,
            action=action,
            entity=entity,
            entity_id=str(entity_id) if entity_id else None,
            details=details or {},
            ip=ip,
        )
    )


def client_ip(request: Request) -> str:
    fwd = request.headers.get("x-forwarded-for", "")
    if fwd:
        return fwd.split(",")[0].strip()
    return request.client.host if request.client else ""


def cache_get_json(r: redis.Redis, key: str):
    raw = r.get(key)
    if raw is None:
        return None
    try:
        return json.loads(raw)
    except Exception:
        return None


def cache_set_json(r: redis.Redis, key: str, value, ttl: int = 60) -> None:
    try:
        r.setex(key, ttl, json.dumps(value, default=str))
    except Exception:
        pass




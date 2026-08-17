"""Authentication: tenant registration, login, session, logout."""
from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import client_ip, get_current_user, get_db, write_audit
from app.core.security import (
    COOKIE_NAME,
    cookie_max_age,
    create_access_token,
    hash_password,
    verify_password,
)
from app.models import Tenant, User
from app.schemas import LoginRequest, LoginResponse, RegisterRequest, UserOut

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=LoginResponse, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest, request: Request, db: Session = Depends(get_db)):
    tenant = db.scalar(select(Tenant).where(Tenant.slug == payload.tenant_slug))
    if tenant:
        raise HTTPException(status_code=409, detail="Tenant slug already taken")

    existing = db.scalar(select(User).where(User.email == payload.email))
    if existing:
        raise HTTPException(status_code=409, detail="Email already registered")

    tenant = Tenant(name=payload.tenant_name, slug=payload.tenant_slug)
    db.add(tenant)
    db.flush()

    user = User(
        tenant_id=tenant.id,
        email=payload.email.lower(),
        full_name=payload.full_name,
        password_hash=hash_password(payload.password),
        role="admin",
    )
    db.add(user)
    db.flush()

    write_audit(db, user.id, tenant.id, "auth.register", "user", str(user.id), ip=client_ip(request))
    db.commit()

    token = create_access_token(str(user.id), str(tenant.id), user.role)
    response = Response(status_code=status.HTTP_201_CREATED)
    response.set_cookie(
        COOKIE_NAME,
        token,
        max_age=cookie_max_age(),
        httponly=True,
        secure=False,
        samesite="lax",
        path="/",
    )
    response.headers["Location"] = "/"
    return response


@router.post("/login", response_model=LoginResponse)
def login(payload: LoginRequest, request: Request, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.email == payload.email.lower()))
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account disabled")
    if not user.tenant.is_active:
        raise HTTPException(status_code=403, detail="Tenant disabled")

    user.last_login_at = datetime.now(timezone.utc)
    write_audit(db, user.id, user.tenant_id, "auth.login", "user", str(user.id), ip=client_ip(request))
    db.commit()

    token = create_access_token(str(user.id), str(user.tenant_id), user.role)
    response = Response()
    response.set_cookie(
        COOKIE_NAME,
        token,
        max_age=cookie_max_age(),
        httponly=True,
        secure=False,
        samesite="lax",
        path="/",
    )
    response.media_type = "application/json"
    import orjson

    body = orjson.dumps(
        LoginResponse(
            user=UserOut.model_validate(user),
            tenant_name=user.tenant.name,
        ).model_dump(mode="json")
    )
    response.body = body
    return response


@router.post("/logout")
def logout():
    response = Response()
    response.delete_cookie(COOKIE_NAME, path="/")
    return {"ok": True}


@router.get("/me", response_model=LoginResponse)
def me(user: User = Depends(get_current_user)):
    return LoginResponse(user=UserOut.model_validate(user), tenant_name=user.tenant.name)


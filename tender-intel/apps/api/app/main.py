"""Tender Intelligence Platform — API entrypoint."""
from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import get_settings
from app.db import Base, engine
from app.models import (  # noqa: F401  (register models with Base)
    Alert,
    AuditLog,
    Award,
    ConnectorRun,
    Source,
    Tender,
    TenderChange,
    TenderDocument,
    Tenant,
    User,
    Watchlist,
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
logger = logging.getLogger("tenderintel.api")

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    logger.info("Database schema ready")
    yield


app = FastAPI(
    title="Tender Intelligence Platform API",
    version="1.0.0",
    description="Aggregated public procurement intelligence: EPADS, Punjab e-Procurement, PPRA and more.",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_origin_regex=r"https://.*\.(app|preview)\.github\.dev$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", tags=["system"])
def health():
    return {"status": "ok", "app": settings.APP_NAME, "version": "1.0.0"}


@app.get("/", tags=["system"], include_in_schema=False)
def root():
    return {
        "app": settings.APP_NAME,
        "version": "1.0.0",
        "message": "This is the TenderIntel PK API. Use the web dashboard on port 3000 to log in.",
        "docs": "/docs",
        "health": "/health",
    }


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    logger.exception("Unhandled error on %s %s", request.method, request.url.path)
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})


from app.api.routes import admin, alerts, analytics, auth, tenders, watchlists  # noqa: E402

app.include_router(auth.router, prefix=settings.API_V1_PREFIX)
app.include_router(tenders.router, prefix=settings.API_V1_PREFIX)
app.include_router(watchlists.router, prefix=settings.API_V1_PREFIX)
app.include_router(alerts.router, prefix=settings.API_V1_PREFIX)
app.include_router(analytics.router, prefix=settings.API_V1_PREFIX)
app.include_router(admin.router, prefix=settings.API_V1_PREFIX)




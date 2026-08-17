"""Pydantic request/response schemas."""
from __future__ import annotations

from datetime import datetime
from typing import Any, List, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field


# ---------- Auth ----------
class RegisterRequest(BaseModel):
    tenant_name: str = Field(min_length=2, max_length=200)
    tenant_slug: str = Field(min_length=2, max_length=80, pattern=r"^[a-z0-9-]+$")
    full_name: str = Field(min_length=2, max_length=200)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    email: EmailStr
    full_name: str
    role: str
    tenant_id: UUID
    created_at: datetime


class LoginResponse(BaseModel):
    user: UserOut
    tenant_name: str


# ---------- Tenders ----------
class AttachmentOut(BaseModel):
    name: str = ""
    url: str = ""
    size: int = 0
    type: str = ""


class TenderListOut(BaseModel):
    id: UUID
    source_id: UUID
    external_id: str
    title: str
    reference_no: str
    agency: str
    category: str
    province: str
    city: str
    tender_type: str
    status: str
    published_at: Optional[datetime] = None
    closing_at: Optional[datetime] = None
    estimated_value: Optional[float] = None
    currency: str
    bid_count: Optional[int] = None
    awardee_name: Optional[str] = None
    source_slug: str = ""


class TenderDetailOut(TenderListOut):
    description: Optional[str] = None
    department: str
    sub_category: str
    country: str
    procurement_method: str
    opening_at: Optional[datetime] = None
    bid_security: Optional[str] = None
    validity_period: Optional[str] = None
    contact_person: str
    contact_email: str
    contact_phone: str
    eligibility: Optional[str] = None
    attachments: List[AttachmentOut] = []
    document_downloads: int = 0
    bidder_names: List[str] = []
    opening_minutes_url: str
    award_amount: Optional[float] = None
    award_date: Optional[datetime] = None
    ai_summary: Optional[str] = None
    source_url: str
    first_seen_at: datetime
    updated_at: datetime
    changes_count: int = 0
    documents: List[dict] = []


class TenderPage(BaseModel):
    total: int
    page: int
    page_size: int
    items: List[TenderDetailOut]


class ChangeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    field: str
    old_value: Optional[str] = None
    new_value: Optional[str] = None
    change_type: str
    detected_at: datetime


class SourceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    slug: str
    name: str
    base_url: str
    connector_type: str
    enabled: bool
    fixture_mode: bool
    fetch_interval_minutes: int
    status: str
    last_run_at: Optional[datetime] = None
    last_success_at: Optional[datetime] = None
    next_run_at: Optional[datetime] = None
    last_error: Optional[str] = None
    last_items_found: int


class RunOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    source_id: UUID
    started_at: datetime
    finished_at: Optional[datetime] = None
    status: str
    items_found: int
    items_new: int
    items_updated: int
    items_changed: int
    error: Optional[str] = None


# ---------- Watchlists ----------
class WatchlistIn(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    keywords: List[str] = []
    agencies: List[str] = []
    categories: List[str] = []
    provinces: List[str] = []
    min_value: Optional[float] = None
    max_value: Optional[float] = None
    statuses: List[str] = []
    notify_new: bool = True
    notify_change: bool = True
    notify_deadline: bool = True
    deadline_hours: int = 72


class WatchlistPatch(BaseModel):
    name: Optional[str] = None
    keywords: Optional[List[str]] = None
    agencies: Optional[List[str]] = None
    categories: Optional[List[str]] = None
    provinces: Optional[List[str]] = None
    min_value: Optional[float] = None
    max_value: Optional[float] = None
    statuses: Optional[List[str]] = None
    notify_new: Optional[bool] = None
    notify_change: Optional[bool] = None
    notify_deadline: Optional[bool] = None
    deadline_hours: Optional[int] = None
    is_active: Optional[bool] = None


class WatchlistOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    keywords: List[str]
    agencies: List[str]
    categories: List[str]
    provinces: List[str]
    min_value: Optional[float] = None
    max_value: Optional[float] = None
    statuses: List[str]
    notify_new: bool
    notify_change: bool
    notify_deadline: bool
    deadline_hours: int
    is_active: bool
    created_at: datetime
    matched_count: int = 0


class AlertOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    watchlist_id: Optional[UUID] = None
    tender_id: Optional[UUID] = None
    kind: str
    severity: str
    title: str
    message: str
    payload: dict
    is_read: bool
    created_at: datetime


# ---------- Analytics ----------
class StatCard(BaseModel):
    label: str
    value: Any
    delta: Optional[float] = None


class AnalyticsSummary(BaseModel):
    total_tenders: int
    open_tenders: int
    closing_24h: int
    closing_72h: int
    total_value_open: float
    awarded_count: int
    sources_active: int
    total_watchlists: int
    unread_alerts: int


class SeriesPoint(BaseModel):
    key: str
    value: float
    extra: Optional[dict] = None


class CompetitorStat(BaseModel):
    name: str
    wins: int
    total_value: float
    avg_discount: Optional[float] = None
    win_rate: float


class AuditOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user_id: Optional[UUID] = None
    action: str
    entity: str
    entity_id: Optional[str] = None
    details: dict
    ip: str
    created_at: datetime


class HealthOut(BaseModel):
    status: str
    database: str
    redis: str
    worker_heartbeat: Optional[str] = None
    sources: List[SourceOut]
    pending_alerts: int = 0
    version: str = "1.0.0"



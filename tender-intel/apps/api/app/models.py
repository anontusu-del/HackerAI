"""Domain models for the Tender Intelligence Platform.

Normalized, deduplicated procurement intelligence across all connected
public sources (EPADS, Punjab e-Procurement, PPRA, ...). Only legally/publicly
disclosed information is stored: notices, deadlines, amendments, documents,
and post-opening / post-award bidder information.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB, TSVECTOR, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


def _uuid() -> uuid.UUID:
    return uuid.uuid4()


def _now() -> datetime:
    return datetime.now(timezone.utc)


class Tenant(Base):
    __tablename__ = "tenants"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    slug: Mapped[str] = mapped_column(String(80), unique=True, nullable=False, index=True)
    plan: Mapped[str] = mapped_column(String(40), default="enterprise")
    settings: Mapped[dict] = mapped_column(JSONB, default=dict)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, onupdate=_now)

    users: Mapped[list["User"]] = relationship(back_populates="tenant")


class User(Base):
    __tablename__ = "users"
    __table_args__ = (UniqueConstraint("tenant_id", "email", name="uq_user_tenant_email"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id"), index=True)
    email: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str] = mapped_column(String(200), nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(20), default="analyst")  # admin | analyst | viewer
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)

    tenant: Mapped["Tenant"] = relationship(back_populates="users")


class Source(Base):
    """Registry of connected public procurement data sources."""

    __tablename__ = "sources"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    slug: Mapped[str] = mapped_column(String(80), unique=True, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    base_url: Mapped[str] = mapped_column(String(500), nullable=False)
    listing_path: Mapped[str] = mapped_column(String(500), default="")
    connector_type: Mapped[str] = mapped_column(String(40), default="html-table")  # html-table | json-api
    country_code: Mapped[str] = mapped_column(String(5), default="PK")
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    fixture_mode: Mapped[bool] = mapped_column(Boolean, default=True)
    fetch_interval_minutes: Mapped[int] = mapped_column(Integer, default=30)
    status: Mapped[str] = mapped_column(String(20), default="never_run")  # healthy|degraded|error|never_run
    last_run_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_success_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    next_run_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_error: Mapped[str | None] = mapped_column(Text, nullable=True)
    last_items_found: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)

    tenders: Mapped[list["Tender"]] = relationship(back_populates="source")


class Tender(Base):
    """Normalized tender record. Global (shared across tenants); access is RBAC-gated."""

    __tablename__ = "tenders"
    __table_args__ = (
        UniqueConstraint("source_id", "external_id", name="uq_tender_source_external"),
        Index("ix_tender_search_tsv", "search_tsv", postgresql_using="gin"),
        Index("ix_tender_closing", "closing_at"),
        Index("ix_tender_status", "status"),
        Index("ix_tender_agency", "agency"),
        Index("ix_tender_category", "category"),
        Index("ix_tender_province", "province"),
        Index("ix_tender_published", "published_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    source_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("sources.id"), index=True)
    external_id: Mapped[str] = mapped_column(String(200), nullable=False)
    source_url: Mapped[str] = mapped_column(String(800), default="")

    title: Mapped[str] = mapped_column(String(600), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    reference_no: Mapped[str] = mapped_column(String(200), default="", index=True)
    agency: Mapped[str] = mapped_column(String(300), default="", index=True)
    department: Mapped[str] = mapped_column(String(300), default="")
    category: Mapped[str] = mapped_column(String(120), default="", index=True)
    sub_category: Mapped[str] = mapped_column(String(120), default="")
    province: Mapped[str] = mapped_column(String(80), default="")
    city: Mapped[str] = mapped_column(String(120), default="")
    country: Mapped[str] = mapped_column(String(5), default="PK")
    tender_type: Mapped[str] = mapped_column(String(30), default="goods")  # works|goods|services|consultancy
    procurement_method: Mapped[str] = mapped_column(String(80), default="Open Competitive Bidding")
    status: Mapped[str] = mapped_column(String(20), default="open", index=True)  # open|closed|awarded|cancelled|postponed

    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    closing_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    opening_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    estimated_value: Mapped[float | None] = mapped_column(Numeric(18, 2), nullable=True)
    currency: Mapped[str] = mapped_column(String(8), default="PKR")
    bid_security: Mapped[str | None] = mapped_column(String(300), nullable=True)
    validity_period: Mapped[str | None] = mapped_column(String(120), nullable=True)

    contact_person: Mapped[str] = mapped_column(String(200), default="")
    contact_email: Mapped[str] = mapped_column(String(255), default="")
    contact_phone: Mapped[str] = mapped_column(String(80), default="")
    eligibility: Mapped[str | None] = mapped_column(Text, nullable=True)

    attachments: Mapped[list] = mapped_column(JSONB, default=list)  # [{name,url,size,type}]
    document_downloads: Mapped[int] = mapped_column(Integer, default=0)  # public counter when exposed
    bid_count: Mapped[int | None] = mapped_column(Integer, nullable=True)  # public after opening
    bidder_names: Mapped[list] = mapped_column(JSONB, default=list)  # public after opening (minutes)
    opening_minutes_url: Mapped[str] = mapped_column(String(800), default="")

    # Post-award public record
    awardee_name: Mapped[str | None] = mapped_column(String(300), nullable=True)
    award_amount: Mapped[float | None] = mapped_column(Numeric(18, 2), nullable=True)
    award_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    ai_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    summary_model: Mapped[str | None] = mapped_column(String(80), nullable=True)

    content_hash: Mapped[str] = mapped_column(String(64), default="")
    raw_json: Mapped[dict] = mapped_column(JSONB, default=dict)
    search_tsv: Mapped[str | None] = mapped_column(TSVECTOR, nullable=True)

    first_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    last_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, onupdate=_now)

    source: Mapped["Source"] = relationship(back_populates="tenders")
    changes: Mapped[list["TenderChange"]] = relationship(
        back_populates="tender", cascade="all, delete-orphan", order_by="TenderChange.detected_at"
    )
    documents: Mapped[list["TenderDocument"]] = relationship(
        back_populates="tender", cascade="all, delete-orphan"
    )
    awards: Mapped[list["Award"]] = relationship(back_populates="tender", cascade="all, delete-orphan")


class TenderChange(Base):
    """Change-detection trail per tender (amendments, deadline moves, status changes)."""

    __tablename__ = "tender_changes"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    tender_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenders.id"), index=True)
    field: Mapped[str] = mapped_column(String(80), nullable=False)
    old_value: Mapped[str | None] = mapped_column(Text, nullable=True)
    new_value: Mapped[str | None] = mapped_column(Text, nullable=True)
    change_type: Mapped[str] = mapped_column(String(30), default="updated")  # new|updated|closed|awarded|cancelled
    source_run_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    detected_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)

    tender: Mapped["Tender"] = relationship(back_populates="changes")


class TenderDocument(Base):
    __tablename__ = "tender_documents"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    tender_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenders.id"), index=True)
    name: Mapped[str] = mapped_column(String(500), nullable=False)
    url: Mapped[str] = mapped_column(String(1000), default="")
    doc_type: Mapped[str] = mapped_column(String(40), default="bidding-document")
    pages: Mapped[int | None] = mapped_column(Integer, nullable=True)
    text_excerpt: Mapped[str | None] = mapped_column(Text, nullable=True)
    ocr_used: Mapped[bool] = mapped_column(Boolean, default=False)
    extracted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    tender: Mapped["Tender"] = relationship(back_populates="documents")


class Award(Base):
    """Public post-award records for competitor / historical analytics."""

    __tablename__ = "awards"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    tender_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenders.id"), index=True)
    awardee: Mapped[str] = mapped_column(String(300), nullable=False)
    awardee_org: Mapped[str] = mapped_column(String(300), default="")
    amount: Mapped[float | None] = mapped_column(Numeric(18, 2), nullable=True)
    currency: Mapped[str] = mapped_column(String(8), default="PKR")
    award_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    basis: Mapped[str] = mapped_column(String(200), default="Lowest Evaluated Bidder")
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    source_url: Mapped[str] = mapped_column(String(800), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)

    tender: Mapped["Tender"] = relationship(back_populates="awards")


class Watchlist(Base):
    __tablename__ = "watchlists"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id"), index=True)
    user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    keywords: Mapped[list] = mapped_column(JSONB, default=list)
    agencies: Mapped[list] = mapped_column(JSONB, default=list)
    categories: Mapped[list] = mapped_column(JSONB, default=list)
    provinces: Mapped[list] = mapped_column(JSONB, default=list)
    min_value: Mapped[float | None] = mapped_column(Numeric(18, 2), nullable=True)
    max_value: Mapped[float | None] = mapped_column(Numeric(18, 2), nullable=True)
    statuses: Mapped[list] = mapped_column(JSONB, default=list)
    notify_new: Mapped[bool] = mapped_column(Boolean, default=True)
    notify_change: Mapped[bool] = mapped_column(Boolean, default=True)
    notify_deadline: Mapped[bool] = mapped_column(Boolean, default=True)
    deadline_hours: Mapped[int] = mapped_column(Integer, default=72)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, onupdate=_now)


class Alert(Base):
    __tablename__ = "alerts"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id"), index=True)
    user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True, index=True)
    watchlist_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    tender_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    kind: Mapped[str] = mapped_column(String(30), default="new")  # new|change|deadline|award
    severity: Mapped[str] = mapped_column(String(20), default="info")  # info|warning|critical
    title: Mapped[str] = mapped_column(String(300), nullable=False)
    message: Mapped[str] = mapped_column(Text, default="")
    payload: Mapped[dict] = mapped_column(JSONB, default=dict)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, index=True)


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    tenant_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True, index=True)
    user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True, index=True)
    action: Mapped[str] = mapped_column(String(80), nullable=False)
    entity: Mapped[str] = mapped_column(String(80), default="")
    entity_id: Mapped[str | None] = mapped_column(String(120), nullable=True)
    details: Mapped[dict] = mapped_column(JSONB, default=dict)
    ip: Mapped[str] = mapped_column(String(64), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)


class ConnectorRun(Base):
    __tablename__ = "connector_runs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    source_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("sources.id"), index=True)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="running")  # running|success|error
    items_found: Mapped[int] = mapped_column(Integer, default=0)
    items_new: Mapped[int] = mapped_column(Integer, default=0)
    items_updated: Mapped[int] = mapped_column(Integer, default=0)
    items_changed: Mapped[int] = mapped_column(Integer, default=0)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)




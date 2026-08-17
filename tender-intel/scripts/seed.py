"""Seed the platform: demo tenant, RBAC users, source registry, watchlists.

Run: python scripts/seed.py
"""
from __future__ import annotations

import sys
from pathlib import Path

API_DIR = Path(__file__).resolve().parents[1] / "apps" / "api"
sys.path.insert(0, str(API_DIR))

from sqlalchemy import select  # noqa: E402

from app.core.security import hash_password  # noqa: E402
from app.db import Base, SessionLocal, engine  # noqa: E402
from app.models import Source, Tenant, User, Watchlist  # noqa: E402

SOURCES = [
    {
        "slug": "epads",
        "name": "EPADS (Federal) — epads.gov.pk",
        "base_url": "https://epads.gov.pk",
        "listing_path": "Home/TenderList",
        "connector_type": "html-table",
        "fixture_mode": True,
        "fetch_interval_minutes": 30,
    },
    {
        "slug": "punjab-ep",
        "name": "Punjab e-Procurement — ep.punjab.gov.pk",
        "base_url": "https://ep.punjab.gov.pk",
        "listing_path": "ptn/searchPublicTenders",
        "connector_type": "html-table",
        "fixture_mode": True,
        "fetch_interval_minutes": 30,
    },
    {
        "slug": "ppra",
        "name": "PPRA — ppra.gov.pk",
        "base_url": "https://ppra.gov.pk",
        "listing_path": "tender-notices/",
        "connector_type": "html-table",
        "fixture_mode": True,
        "fetch_interval_minutes": 60,
    },
]


def main() -> None:
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        tenant = db.scalar(select(Tenant).where(Tenant.slug == "tenderintel-demo"))
        if not tenant:
            tenant = Tenant(name="TenderIntel Demo Co.", slug="tenderintel-demo", plan="enterprise")
            db.add(tenant)
            db.flush()
            print("+ tenant tenderintel-demo")

        users = [
            ("admin@tenderintel.pk", "Asif Raza (Admin)", "admin"),
            ("analyst@tenderintel.pk", "Sana Malik (Analyst)", "analyst"),
            ("viewer@tenderintel.pk", "Bilal Ahmed (Viewer)", "viewer"),
        ]
        for email, name, role in users:
            exists = db.scalar(select(User).where(User.email == email))
            if not exists:
                db.add(
                    User(
                        tenant_id=tenant.id,
                        email=email,
                        full_name=name,
                        password_hash=hash_password("Admin@12345"),
                        role=role,
                    )
                )
                print(f"+ user {email} ({role})")

        for spec in SOURCES:
            exists = db.scalar(select(Source).where(Source.slug == spec["slug"]))
            if not exists:
                db.add(Source(**spec))
                print(f"+ source {spec['slug']}")

        watchlists = [
            {
                "name": "Road & Highway Works (Federal)",
                "keywords": ["road", "highway", "construction"],
                "agencies": ["National Highway Authority (NHA)", "Khyber Pakhtunkhwa Highway Authority"],
                "categories": ["Works"],
                "provinces": [],
                "min_value": 50_000_000,
                "max_value": None,
                "statuses": ["open"],
                "deadline_hours": 72,
            },
            {
                "name": "Punjab IT & Software",
                "keywords": ["software", "IT", "portal", "digital"],
                "agencies": ["Punjab Information Technology Board (PITB)"],
                "categories": ["Services"],
                "provinces": ["Punjab"],
                "min_value": None,
                "max_value": 200_000_000,
                "statuses": ["open"],
                "deadline_hours": 48,
            },
            {
                "name": "Energy & Power Sector",
                "keywords": ["solar", "power", "electric", "grid"],
                "agencies": [],
                "categories": ["Works", "Goods"],
                "provinces": [],
                "min_value": 10_000_000,
                "max_value": None,
                "statuses": ["open"],
                "deadline_hours": 96,
            },
        ]
        for spec in watchlists:
            exists = db.scalar(
                select(Watchlist).where(Watchlist.name == spec["name"], Watchlist.tenant_id == tenant.id)
            )
            if not exists:
                db.add(Watchlist(tenant_id=tenant.id, user_id=None, **spec))
                print(f"+ watchlist {spec['name']}")

        db.commit()
        print("Seed complete.")
    finally:
        db.close()


if __name__ == "__main__":
    main()


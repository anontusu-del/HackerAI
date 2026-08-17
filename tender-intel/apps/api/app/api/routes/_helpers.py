"""Shared serialization helpers for tender responses."""
from __future__ import annotations

from app.models import Tender
from app.schemas import TenderDetailOut


def tender_to_detail(t: Tender) -> TenderDetailOut:
    return TenderDetailOut(
        id=t.id,
        source_id=t.source_id,
        external_id=t.external_id,
        title=t.title,
        reference_no=t.reference_no,
        agency=t.agency,
        category=t.category,
        province=t.province,
        city=t.city,
        tender_type=t.tender_type,
        status=t.status,
        published_at=t.published_at,
        closing_at=t.closing_at,
        estimated_value=float(t.estimated_value) if t.estimated_value is not None else None,
        currency=t.currency,
        bid_count=t.bid_count,
        awardee_name=t.awardee_name,
        source_slug=t.source.slug if t.source else "",
        description=t.description,
        department=t.department,
        sub_category=t.sub_category,
        country=t.country,
        procurement_method=t.procurement_method,
        opening_at=t.opening_at,
        bid_security=t.bid_security,
        validity_period=t.validity_period,
        contact_person=t.contact_person,
        contact_email=t.contact_email,
        contact_phone=t.contact_phone,
        eligibility=t.eligibility,
        attachments=t.attachments or [],
        document_downloads=t.document_downloads or 0,
        bidder_names=t.bidder_names or [],
        opening_minutes_url=t.opening_minutes_url or "",
        award_amount=float(t.award_amount) if t.award_amount is not None else None,
        award_date=t.award_date,
        ai_summary=t.ai_summary,
        source_url=t.source_url,
        first_seen_at=t.first_seen_at,
        updated_at=t.updated_at,
        changes_count=len(t.changes) if t.changes is not None else 0,
        documents=[
            {"id": str(d.id), "name": d.name, "url": d.url, "doc_type": d.doc_type, "pages": d.pages}
            for d in (t.documents or [])
        ],
    )


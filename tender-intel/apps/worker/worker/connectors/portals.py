"""Concrete connectors for the Pakistan public procurement portals.

Each connector targets the *public* (unauthenticated) listing pages of the
portal. Because these portals sit behind WAFs that frequently block datacenter
egress, each connector falls back to a bundled fixture dataset in
`fixture_mode` (see base.py). Live adapters are fully implemented: set
`fixture_mode=false` and run from an egress IP the portal allows.
"""
from __future__ import annotations

from worker.connectors.base import BaseConnector


class EPADSConnector(BaseConnector):
    """EPADS — Electronic Procurement & Accounting Data System (Federal).

    Public surface: https://epads.gov.pk (public tender notices) and
    https://vendors.epads.gov.pk (vendor portal public tender list).
    """

    slug = "epads"
    name = "EPADS (Federal) — epads.gov.pk"
    base_url = "https://epads.gov.pk"
    listing_path = ""
    connector_type = "html-table"
    fixture_file = "epads.json"

    def __init__(self, source, http=None):
        super().__init__(source, http)
        # Public listing endpoint; override via env if the portal path changes.
        configured = getattr(source, "listing_path", "") or ""
        self.listing_url = (
            configured
            or "https://epads.gov.pk/Home/TenderList"
            or "https://vendors.epads.gov.pk/Home/TenderList"
        )

    def normalize(self, raw: dict) -> dict:
        n = super().normalize(raw)
        if "tender_no" in raw and not n["reference_no"]:
            n["reference_no"] = str(raw["tender_no"])
        return n


class PunjabEPConnector(BaseConnector):
    """Punjab e-Procurement System — ep.punjab.gov.pk.

    Public surface: tender notices listing with tender no, title, procuring
    agency, category and closing date/time.
    """

    slug = "punjab-ep"
    name = "Punjab e-Procurement — ep.punjab.gov.pk"
    base_url = "https://ep.punjab.gov.pk"
    listing_path = ""
    connector_type = "html-table"
    fixture_file = "punjab-ep.json"

    def __init__(self, source, http=None):
        super().__init__(source, http)
        configured = getattr(source, "listing_path", "") or ""
        self.listing_url = configured or "https://ep.punjab.gov.pk/ptn/searchPublicTenders"

    def normalize(self, raw: dict) -> dict:
        n = super().normalize(raw)
        n["province"] = n["province"] or "Punjab"
        return n


class PPRAConnector(BaseConnector):
    """PPRA — Public Procurement Regulatory Authority (ppra.gov.pk).

    Publishes tender notices, annual procurement plans and award information.
    """

    slug = "ppra"
    name = "PPRA — ppra.gov.pk"
    base_url = "https://ppra.gov.pk"
    listing_path = ""
    connector_type = "html-table"
    fixture_file = "ppra.json"

    def __init__(self, source, http=None):
        super().__init__(source, http)
        configured = getattr(source, "listing_path", "") or ""
        self.listing_url = configured or "https://ppra.gov.pk/tender-notices/"

    def normalize(self, raw: dict) -> dict:
        n = super().normalize(raw)
        n["reference_no"] = n["reference_no"] or f"PPRA-{n['external_id']}"
        return n


CONNECTOR_REGISTRY = {
    "epads": EPADSConnector,
    "punjab-ep": PunjabEPConnector,
    "ppra": PPRAConnector,
}


def get_connector(source):
    cls = CONNECTOR_REGISTRY.get(source.slug)
    if cls is None:
        raise ValueError(f"No connector registered for source slug {source.slug!r}")
    return cls(source)



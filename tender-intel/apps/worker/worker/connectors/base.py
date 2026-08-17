"""Connector framework.

A connector fetches publicly disclosed tender data from a procurement portal,
normalizes it into the platform schema and feeds the ingest pipeline.

Design notes
------------
- Live HTTP adapters target the *public* (unauthenticated) listing pages of each
  portal. Many government portals sit behind WAFs that block datacenter IPs; the
  `fixture_mode` flag makes connectors fall back to bundled, realistic fixture
  data so the pipeline can be developed, tested and demoed anywhere. In
  production you run with `fixture_mode=false` from a network the portal allows
  (residential/office egress), or via an approved API/data feed.
- Only legally/publicly disclosed information is captured. Sealed bid contents
  are never requested or stored.
"""
from __future__ import annotations

import hashlib
import json
import logging
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import httpx
from bs4 import BeautifulSoup

logger = logging.getLogger("tenderintel.connectors")

FIXTURES_DIR = Path(__file__).resolve().parent / "fixtures"

BROWSER_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/126.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
}

COLUMN_KEYWORDS = {
    "reference_no": ["ref", "reference", "tender no", "tender#", "no."],
    "title": ["title", "description", "subject", "name"],
    "agency": ["agency", "department", "procuring", "entity", "organization", "owner"],
    "closing_at": ["closing", "last date", "deadline", "due", "submission"],
    "published_at": ["publish", "issue", "posted", "date of publication"],
    "opening_at": ["opening", "bid opening"],
    "category": ["category", "type", "nature"],
    "province": ["province", "location", "region"],
    "estimated_value": ["estimated cost", "cost", "value", "amount"],
    "contact_email": ["email"],
    "contact_phone": ["phone", "tel", "contact no"],
}

_HEADER_ALIASES = {
    "estimated_cost": "estimated_value",
    "cost": "estimated_value",
    "value": "estimated_value",
    "last_date_of_submission": "closing_at",
    "last_date": "closing_at",
    "due_date": "closing_at",
    "deadline": "closing_at",
    "publishing_date": "published_at",
    "issue_date": "published_at",
    "location": "province",
}


def clean_text(value: Any) -> str:
    if value is None:
        return ""
    text = re.sub(r"\s+", " ", str(value)).strip()
    return text


def parse_date(value: Any) -> datetime | None:
    if not value:
        return None
    text = clean_text(value)
    for fmt in (
        "%d-%m-%Y %H:%M",
        "%d/%m/%Y %H:%M",
        "%Y-%m-%d %H:%M",
        "%d-%m-%Y",
        "%d/%m/%Y",
        "%Y-%m-%d",
        "%d %b %Y %H:%M",
        "%d %b %Y",
        "%b %d, %Y",
        "%d-%b-%Y",
    ):
        try:
            dt = datetime.strptime(text, fmt)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            return dt
        except ValueError:
            continue
    return None


def parse_number(value: Any) -> float | None:
    if value is None:
        return None
    text = clean_text(value).replace(",", "").replace("PKR", "").replace("Rs.", "").strip()
    m = re.search(r"[\d.]+", text)
    if not m:
        return None
    try:
        return float(m.group(0))
    except ValueError:
        return None


def content_hash(payload: dict) -> str:
    blob = json.dumps(payload, sort_keys=True, default=str).encode("utf-8")
    return hashlib.sha256(blob).hexdigest()


class BaseConnector:
    slug: str = "base"
    name: str = "Base Connector"
    base_url: str = ""
    listing_path: str = ""
    connector_type: str = "html-table"
    fixture_file: str = ""

    def __init__(self, source, http: httpx.Client | None = None):
        self.source = source
        self.http = http or httpx.Client(headers=BROWSER_HEADERS, timeout=httpx.Timeout(25.0, connect=10.0), follow_redirects=True)
        self.listing_url = (self.source.base_url.rstrip("/") + "/" + self.source.listing_path.lstrip("/")).rstrip("/")

    # ---- live fetching -------------------------------------------------
    def fetch_html(self, url: str | None = None) -> str | None:
        try:
            resp = self.http.get(url or self.listing_url)
            if resp.status_code == 200 and resp.text:
                return resp.text
            logger.warning("[%s] HTTP %s from %s", self.slug, resp.status_code, url or self.listing_url)
            return None
        except Exception as exc:
            logger.warning("[%s] fetch error: %s", self.slug, exc)
            return None

    def fetch_json(self, url: str | None = None) -> list[dict] | None:
        try:
            resp = self.http.get(url or self.listing_url)
            if resp.status_code == 200:
                data = resp.json()
                if isinstance(data, dict):
                    data = data.get("data") or data.get("results") or data.get("tenders") or []
                return data if isinstance(data, list) else None
            return None
        except Exception as exc:
            logger.warning("[%s] json fetch error: %s", self.slug, exc)
            return None

    # ---- HTML table heuristics ----------------------------------------
    def parse_html_tables(self, html: str) -> list[dict]:
        """Extract tender-like rows from any HTML table whose headers match known keywords."""
        soup = BeautifulSoup(html, "lxml")
        results: list[dict] = []
        for table in soup.find_all("table"):
            rows = table.find_all("tr")
            if len(rows) < 2:
                continue
            header_cells = rows[0].find_all(["th", "td"])
            headers = [clean_text(c.get_text()) for c in header_cells]
            if not headers or not any(self._hits(headers)):
                continue
            mapping: dict[int, str] = {}
            for idx, h in enumerate(headers):
                key = self._map_header(h)
                if key:
                    mapping[idx] = key
            if not mapping:
                continue
            for tr in rows[1:]:
                cells = tr.find_all(["td", "th"])
                if not cells:
                    continue
                row: dict[str, Any] = {}
                link = tr.find("a", href=True)
                if link:
                    row["source_url"] = self._absolute(link["href"])
                for idx, key in mapping.items():
                    if idx < len(cells):
                        row[key] = clean_text(cells[idx].get_text())
                if row.get("title") or row.get("reference_no"):
                    results.append(row)
        return results

    def _hits(self, headers: list[str]) -> bool:
        hay = " ".join(headers).lower()
        return any(any(k in hay for k in kws) for kws in COLUMN_KEYWORDS.values())

    def _map_header(self, header: str) -> str | None:
        h = header.lower().strip()
        for alias, key in _HEADER_ALIASES.items():
            if h == alias or h.startswith(alias):
                return key
        for key, kws in COLUMN_KEYWORDS.items():
            if any(k in h for k in kws):
                return key
        return None

    def _absolute(self, href: str) -> str:
        if href.startswith("http"):
            return href
        return self.source.base_url.rstrip("/") + "/" + href.lstrip("/")

    # ---- normalization -------------------------------------------------
    def normalize(self, raw: dict) -> dict:
        """Map a raw row to the platform tender schema (override per source)."""
        closing = parse_date(raw.get("closing_at"))
        published = parse_date(raw.get("published_at"))
        opening = parse_date(raw.get("opening_at"))
        external_id = raw.get("external_id") or raw.get("reference_no") or raw.get("tender_no") or ""
        title = raw.get("title") or raw.get("description") or "Untitled Tender"
        if not external_id:
            external_id = content_hash(raw)[:16]

        normalized = {
            "source_id": str(self.source.id),
            "external_id": external_id,
            "source_url": raw.get("source_url", ""),
            "title": clean_text(title)[:600],
            "description": clean_text(raw.get("description") or raw.get("details") or ""),
            "reference_no": clean_text(raw.get("reference_no") or external_id)[:200],
            "agency": clean_text(raw.get("agency") or raw.get("department") or "")[:300],
            "department": clean_text(raw.get("department") or "")[:300],
            "category": clean_text(raw.get("category") or "Other")[:120],
            "sub_category": clean_text(raw.get("sub_category") or "")[:120],
            "province": clean_text(raw.get("province") or raw.get("location") or "Pakistan")[:80],
            "city": clean_text(raw.get("city") or "")[:120],
            "country": "PK",
            "tender_type": clean_text(raw.get("tender_type") or raw.get("type") or "goods")[:30],
            "procurement_method": clean_text(raw.get("procurement_method") or "Open Competitive Bidding")[:80],
            "status": "open",
            "published_at": published,
            "closing_at": closing,
            "opening_at": opening,
            "estimated_value": parse_number(raw.get("estimated_value")) if raw.get("estimated_value") else None,
            "currency": "PKR",
            "bid_security": clean_text(raw.get("bid_security") or "")[:300] or None,
            "validity_period": clean_text(raw.get("validity_period") or "")[:120] or None,
            "contact_person": clean_text(raw.get("contact_person") or "")[:200],
            "contact_email": clean_text(raw.get("contact_email") or "")[:255],
            "contact_phone": clean_text(raw.get("contact_phone") or "")[:80],
            "eligibility": clean_text(raw.get("eligibility") or "") or None,
            "attachments": raw.get("attachments") or [],
            "document_downloads": int(raw.get("document_downloads") or 0),
            "bid_count": int(raw["bid_count"]) if raw.get("bid_count") else None,
            "bidder_names": raw.get("bidder_names") or [],
            "opening_minutes_url": raw.get("opening_minutes_url") or "",
            "awardee_name": clean_text(raw.get("awardee_name") or "") or None,
            "award_amount": parse_number(raw.get("award_amount")) if raw.get("award_amount") else None,
            "award_date": parse_date(raw.get("award_date")),
            "raw_json": raw,
        }
        return normalized

    # ---- fixtures ------------------------------------------------------
    def load_fixture(self) -> list[dict]:
        path = FIXTURES_DIR / self.fixture_file
        if not path.exists():
            logger.warning("[%s] fixture file missing: %s", self.slug, path)
            return []
        with path.open("r", encoding="utf-8") as fh:
            return json.load(fh)

    # ---- orchestration -------------------------------------------------
    def fetch_tenders(self) -> list[dict]:
        """Return normalized tenders. Fixture mode when enabled or live fails."""
        if self.source.fixture_mode:
            logger.info("[%s] fixture mode: loading %s", self.slug, self.fixture_file)
            return [self.normalize(r) for r in self.load_fixture()]

        if self.connector_type == "json-api":
            raw = self.fetch_json()
            if raw:
                return [self.normalize(r) for r in raw]
        else:
            html = self.fetch_html()
            if html:
                raw_rows = self.parse_html_tables(html)
                if raw_rows:
                    return [self.normalize(r) for r in raw_rows]

        logger.warning("[%s] live fetch failed/unavailable; falling back to fixture", self.slug)
        return [self.normalize(r) for r in self.load_fixture()]



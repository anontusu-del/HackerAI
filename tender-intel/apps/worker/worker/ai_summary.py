"""AI summaries for tenders.

Two providers:
1. `rule` — deterministic, offline, zero-cost summary built from structured fields
   (always available).
2. `llm` — OpenAI-compatible chat completions when LLM_API_KEY is configured.
"""
from __future__ import annotations

import logging

from app.config import get_settings
from app.models import Tender

logger = logging.getLogger("tenderintel.ai")

PROMPT = """You are a procurement intelligence analyst. Summarize this public tender in 5 bullet points for a contractor deciding whether to bid: key scope, agency, estimated value, deadlines, eligibility requirements, bid security, and risks/notes. Keep each bullet under 25 words. Use plain text bullets starting with "- ".
Tender JSON: {payload}"""


def summarize_tender(t: Tender) -> tuple[str, str]:
    """Return (summary, model_used)."""
    settings = get_settings()
    if settings.LLM_API_KEY:
        try:
            summary = _llm_summary(t, settings)
            if summary:
                return summary, settings.LLM_MODEL
        except Exception as exc:
            logger.warning("LLM summary failed, falling back to rule-based: %s", exc)
    return _rule_summary(t), "rule-based"


def _rule_summary(t: Tender) -> str:
    lines = []
    lines.append(f"- {t.tender_type.title()} procurement by {t.agency or 'n/a'} — {t.category}.")
    if t.description:
        lines.append(f"- Scope: {t.description[:220]}")
    if t.estimated_value is not None:
        lines.append(f"- Estimated value: {t.currency} {t.estimated_value:,.0f}.")
    if t.closing_at:
        lines.append(f"- Deadline: {t.closing_at.strftime('%d %b %Y %H:%M UTC')} (status: {t.status}).")
    if t.bid_security:
        lines.append(f"- Bid security: {t.bid_security}.")
    if t.eligibility:
        lines.append(f"- Eligibility: {t.eligibility[:180]}")
    if t.bid_count is not None:
        lines.append(f"- Publicly disclosed bid count after opening: {t.bid_count}.")
    if t.awardee_name:
        lines.append(f"- Awarded to {t.awardee_name} ({t.currency} {t.award_amount or 'n/a'}).")
    lines.append("- Monitor amendments and deadline changes in the change trail.")
    return "\n".join(lines)


def _llm_summary(t: Tender, settings) -> str | None:
    import httpx

    import orjson

    payload = {
        "title": t.title,
        "reference_no": t.reference_no,
        "agency": t.agency,
        "category": t.category,
        "tender_type": t.tender_type,
        "estimated_value": t.estimated_value,
        "currency": t.currency,
        "closing_at": t.closing_at.isoformat() if t.closing_at else None,
        "status": t.status,
        "bid_security": t.bid_security,
        "eligibility": t.eligibility,
        "description": (t.description or "")[:1500],
    }
    base = (settings.LLM_BASE_URL or "https://api.openai.com/v1").rstrip("/")
    resp = httpx.post(
        f"{base}/chat/completions",
        headers={"Authorization": f"Bearer {settings.LLM_API_KEY}"},
        json={
            "model": settings.LLM_MODEL,
            "messages": [{"role": "user", "content": PROMPT.format(payload=orjson.dumps(payload).decode())}],
            "temperature": 0.3,
            "max_tokens": 500,
        },
        timeout=30.0,
    )
    resp.raise_for_status()
    content = resp.json()["choices"][0]["message"]["content"]
    return content.strip()[:4000]


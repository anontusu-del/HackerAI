"""Watchlist -> Tender SQL predicates (shared by API and worker)."""
from __future__ import annotations

from sqlalchemy import or_
from sqlalchemy.sql.elements import ColumnElement

from app.models import Tender, Watchlist


def watchlist_matches(w: Watchlist) -> list[ColumnElement]:
    conds: list = []

    if w.statuses:
        conds.append(Tender.status.in_(w.statuses))
    if w.agencies:
        conds.append(Tender.agency.in_(w.agencies))
    if w.categories:
        conds.append(Tender.category.in_(w.categories))
    if w.provinces:
        conds.append(Tender.province.in_(w.provinces))
    if w.min_value is not None:
        conds.append(Tender.estimated_value >= w.min_value)
    if w.max_value is not None:
        conds.append(Tender.estimated_value <= w.max_value)
    if w.keywords:
        kw_conds = []
        for k in w.keywords:
            k = k.strip()
            if not k:
                continue
            kw_conds.append(
                or_(
                    Tender.title.ilike(f"%{k}%"),
                    Tender.description.ilike(f"%{k}%"),
                    Tender.agency.ilike(f"%{k}%"),
                    Tender.reference_no.ilike(f"%{k}%"),
                )
            )
        if kw_conds:
            conds.append(or_(*kw_conds))
    return conds


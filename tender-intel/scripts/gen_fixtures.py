"""Generate realistic public-tender fixture datasets for the three connectors.

Run: python scripts/gen_fixtures.py
Output: apps/worker/worker/connectors/fixtures/{epads,punjab,ppra}.json

The fixtures model *publicly disclosed* information only (notices, deadlines,
amendments, documents, post-opening bid counts, post-award records).
"""
from __future__ import annotations

import json
import random
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

random.seed(20240817)

FIXTURES = Path(__file__).resolve().parents[1] / "apps" / "worker" / "worker" / "connectors" / "fixtures"
FIXTURES.mkdir(parents=True, exist_ok=True)

AGENCIES = {
    "Federal": [
        ("National Highway Authority (NHA)", "Works"),
        ("Water and Power Development Authority (WAPDA)", "Works"),
        ("Pakistan Public Works Department", "Works"),
        ("Pakistan Railways", "Goods"),
        ("Pakistan Post Office Department", "Goods"),
        ("Ministry of IT & Telecom", "Services"),
        ("Pakistan Navy (Naval Works)", "Works"),
        ("Karachi Port Trust", "Goods"),
        ("National Disaster Management Authority", "Goods"),
        ("Pakistan Bureau of Statistics", "Services"),
        ("Cantonment Board Peshawar", "Works"),
        ("Pakistan Telecommunication Authority", "Services"),
        ("Khyber Pakhtunkhwa Highway Authority", "Works"),
        ("Pakistan Air Force", "Goods"),
    ],
    "Punjab": [
        ("Lahore Development Authority (LDA)", "Works"),
        ("Punjab Housing & Town Planning Agency (PHATA)", "Works"),
        ("Punjab Irrigation Department", "Works"),
        ("Punjab Food Department", "Goods"),
        ("Punjab Information Technology Board (PITB)", "Services"),
        ("Water and Sanitation Agency (WASA) Lahore", "Works"),
        ("Parks and Horticulture Authority (PHA) Lahore", "Works"),
        ("Punjab Health Department", "Goods"),
        ("Traffic Engineering & Transport Planning Agency (TEPA)", "Services"),
        ("University of the Punjab", "Services"),
        ("Punjab Educational Endowment Fund", "Services"),
        ("Punjab Agriculture Department", "Goods"),
        ("Rawalpindi Development Authority", "Works"),
        ("Punjab Energy Department", "Services"),
        ("Punjab Mass Transit Authority", "Services"),
    ],
    "Sindh": [
        ("Sindh Infrastructure Development Company", "Works"),
        ("Sindh Education Foundation", "Services"),
        ("Sindh Solid Waste Management Board", "Services"),
        ("Hyderabad Municipal Corporation", "Works"),
        ("Sindh Public Health Engineering Department", "Works"),
    ],
    "KPK": [
        ("Khyber Pakhtunkhwa P&D Department", "Services"),
        ("KPK Communication & Works Department", "Works"),
        ("Peshawar Development Authority", "Works"),
        ("KPK Elementary & Secondary Education Dept", "Goods"),
    ],
    "Balochistan": [
        ("Balochistan P&D Department", "Works"),
        ("Quetta Development Authority", "Works"),
        ("Balochistan Health Department", "Goods"),
    ],
    "Other": [
        ("Capital Development Authority (CDA) Islamabad", "Works"),
        ("Islamabad Electric Supply Company (IESCO)", "Goods"),
        ("Gujranwala Electric Power Company (GEPCO)", "Goods"),
        ("Sui Southern Gas Company (SSGC)", "Works"),
        ("National Transmission & Despatch Company (NTDC)", "Works"),
        ("Pakistan Civil Aviation Authority", "Services"),
        ("National Database & Registration Authority (NADRA)", "Services"),
        ("Higher Education Commission (HEC)", "Services"),
    ],
}

WORKS_ITEMS = [
    ("Construction of {n} km dual carriageway", "Road infrastructure"),
    ("Rehabilitation and improvement of {n} km road section", "Road infrastructure"),
    ("Construction of {n}-storey {b} block", "Building works"),
    ("Design and construction of storm water drainage system", "Drainage"),
    ("Construction of {b} sewerage treatment plant capacity {c} MGD", "Water & sanitation"),
    ("Up-gradation of {b} irrigation canal ({n} km)", "Irrigation"),
    ("Construction of flyover at {city}", "Urban infrastructure"),
    ("Construction of boundary wall and security post at {b}", "Building works"),
    ("Restoration works of flood affected roads in {city}", "Road infrastructure"),
    ("Construction of {b} primary school building", "Building works"),
    ("Construction of district headquarters hospital {b}", "Health infrastructure"),
    ("Solarization of {b} with net-metering", "Energy"),
    ("Construction of {b} sports complex", "Sports infrastructure"),
    ("Up-gradation of water supply scheme {b}", "Water & sanitation"),
]

GOODS_ITEMS = [
    ("Procurement of {n} metric tons of {item}", "Commodities"),
    ("Supply and delivery of {n} vehicles ({item})", "Vehicles"),
    ("Procurement of medical equipment for {b}", "Medical equipment"),
    ("Supply of IT equipment and accessories", "IT equipment"),
    ("Procurement of {item} laboratory equipment", "Lab equipment"),
    ("Procurement of {n} computers with software licensing", "IT equipment"),
    ("Supply and installation of {b} at {city}", "Installation"),
    ("Procurement of spare parts for {item}", "Spare parts"),
    ("Procurement of stationery and office supplies", "Office supplies"),
    ("Procurement of {item} for {b}", "Commodities"),
    ("Procurement of {n} air-conditioners", "Electrical"),
    ("Supply of safety equipment and PPE", "Safety equipment"),
    ("Procurement of fertilizers and seeds", "Agriculture inputs"),
    ("Procurement of printing and publishing services", "Printing"),
]

SERVICES_ITEMS = [
    ("Third-party validation of {b}", "Audit & validation"),
    ("Consultancy services for feasibility study of {b}", "Consultancy"),
    ("Annual maintenance contract for {b} at {city}", "Maintenance"),
    ("Development of {b} web portal and mobile application", "Software development"),
    ("Security services for {b}", "Security services"),
    ("Cleaning and janitorial services for {b}", "Facility services"),
    ("Vehicle hiring services for {b}", "Transport services"),
    ("Survey and mapping services for {b}", "Survey"),
    ("Digitalization and document management services", "Document management"),
    ("Pre-audit of development projects of {b}", "Audit & validation"),
    ("Consultancy for project management of {b}", "Consultancy"),
    ("Building condition assessment and audit", "Facility services"),
]

ITEM_NAMES = ["wheat", "rice", "cement", "steel bars", "lubricants", "furniture", "generators", "UPS systems", "laboratory reagents", "diesel", "polymer pipes", "street lights", "water pumps", "x-ray machines", "ventilators", "school furniture", "fire tenders", "transmission towers", "solar panels", "cable (copper/aluminum)", "transformer oil", "printing paper", "uniforms", "desktops", "laptops", "servers", "network switches", "CCTV cameras", "biometric devices", "ambulances"]

BUILDINGS = ["Civil Secretariat", "General Hospital", "Technical Training Center", "District Court Complex", "Public Library", "Warehouse", "Office Complex", "Hostel", "Research Laboratory", "Community Center", "Grid Station", "Bus Terminal", "Cattle Market", "Cold Storage", "Police Station", "Fire Station"]

CITIES = {
    "Punjab": ["Lahore", "Rawalpindi", "Faisalabad", "Multan", "Gujranwala", "Sialkot", "Bahawalpur", "Sargodha", "Sheikhupura", "Dera Ghazi Khan", "Sahiwal", "Okara"],
    "Sindh": ["Karachi", "Hyderabad", "Sukkur", "Larkana", "Mirpurkhas", "Nawabshah", "Thatta"],
    "KPK": ["Peshawar", "Mardan", "Abbottabad", "Swat", "Kohat", "Bannu", "Dera Ismail Khan", "Charsadda"],
    "Balochistan": ["Quetta", "Khuzdar", "Gwadar", "Turbat", "Zhob", "Sibi"],
    "Islamabad": ["Islamabad"],
    "Federal": ["Islamabad", "Karachi", "Peshawar", "Quetta", "Multan", "Lahore", "Hyderabad", "Gwadar"],
    "Other": ["Islamabad", "Lahore", "Karachi", "Rawalpindi", "Faisalabad", "Peshawar", "Quetta"],
}

CONTRACTORS = [
    "Habib Construction Services (Pvt) Ltd", "ZKB Engineers & Builders", "NLC (National Logistics Cell)",
    "FWO (Frontier Works Organization)", "Sachal Engineering Works", "Descon Engineering Limited",
    "Izhar Construction (Pvt) Ltd", "M/s Nadeem & Company", "Al-Noor Builders", "Bina-e-Karachi (Pvt) Ltd",
    "Sui Northern Gas Pipelines Ltd", "K-Electric (SEPCO JV)", "Punjab Constructions Ltd",
    "Siddiqsons Limited", "Techno Engineering Services", "Saindak Metals Ltd", "Wah Nobel Group",
    "The Indus Group", "Maple Leaf Cement Projects", "Qaisar & Brothers", "Ghani Ghee & Chemicals",
    "National Engineering Services Pakistan (NESPAK)", "Associated Consulting Engineers (ACE)",
    "Hazara Construction Company", "Mansha Brothers (Pvt) Ltd", "Shahzad Dredging & Marine",
]

TENDER_TYPES = {
    "Works": "works",
    "Goods": "goods",
    "Services": "services",
}

METHODS = ["Open Competitive Bidding", "Single Stage Two Envelope", "Sealed Quotation", "Limited Bidding", "Two Stage Bidding", "EPRA - e-Procurement"]

REF_PREFIX = {
    "epads": ["TS-", "EP-", "FED-"],
    "punjab-ep": ["PEP-", "PB-", "TEN-"],
    "ppra": ["PPRA-", "NTP-"],
}


def pick(seq):
    return random.choice(seq)


def make_tender(source: str, idx: int, now: datetime) -> dict:
    region = pick(list(AGENCIES.keys()))
    agency, sector = pick(AGENCIES[region])
    city = pick(CITIES[region])
    days_published = random.randint(1, 45)
    published = now - timedelta(days=days_published)
    closing = published + timedelta(days=random.randint(14, 60))
    category_pool = {
        "Works": WORKS_ITEMS,
        "Goods": GOODS_ITEMS,
        "Services": SERVICES_ITEMS,
    }
    items = category_pool[sector]
    if sector == "Works":
        template, sub = pick(items)
        title = template.format(n=random.choice([1, 2, 3, 5, 8, 12, 20, 35, 50, 75]), b=pick(BUILDINGS), c=random.choice([2, 5, 10, 15]), city=city)
        ttype = "works"
    elif sector == "Goods":
        template, sub = pick(items)
        title = template.format(n=random.choice([5, 10, 25, 50, 100, 200, 500]), item=pick(ITEM_NAMES), b=pick(BUILDINGS), city=city)
        ttype = "goods"
    else:
        template, sub = pick(items)
        title = template.format(b=pick(BUILDINGS), city=city)
        ttype = "services"

    value = random.choice([2_500_000, 5_000_000, 12_000_000, 25_000_000, 48_000_000, 95_000_000, 180_000_000, 350_000_000, 750_000_000, 1_400_000_000, 2_800_000_000, 5_500_000_000])
    if random.random() < 0.25:
        value = None

    ref = f"{pick(REF_PREFIX[source])}{random.randint(100, 999)}{random.randint(10, 99)}/{now.year % 100}"
    doc_count = random.randint(1, 5)
    attachments = [
        {
            "name": f"{ref} - Bidding Document.pdf" if i == 0 else f"{ref} - Annexure {i}.pdf",
            "url": f"https://{source}.gov.pk/documents/{ref}/{i}",
            "size": random.randint(150_000, 4_500_000),
            "type": "application/pdf",
        }
        for i in range(doc_count)
    ]

    tender = {
        "external_id": ref,
        "tender_no": ref,
        "reference_no": ref,
        "title": title,
        "description": f"Procurement of {sub.lower()} services/goods for {agency} in {city}. Detailed specifications are provided in the bidding document. This is a public notice under applicable procurement rules.",
        "agency": agency,
        "department": agency,
        "category": sector,
        "sub_category": sub,
        "province": region if region != "Other" else pick(["Islamabad", "Punjab", "Sindh"]),
        "city": city,
        "tender_type": ttype,
        "procurement_method": pick(METHODS),
        "published_at": published.strftime("%Y-%m-%d %H:%M"),
        "closing_at": closing.strftime("%Y-%m-%d %H:%M"),
        "opening_at": (closing + timedelta(minutes=30)).strftime("%Y-%m-%d %H:%M"),
        "estimated_value": value,
        "currency": "PKR",
        "bid_security": f"{random.choice([1_000_000, 2_500_000, 5_000_000, 10_000_000, 25_000_000]):,} PKR",
        "validity_period": f"{random.choice([60, 90, 120, 180])} days",
        "contact_person": pick(["Director (Procurement)", "Additional Director (Contracts)", "Chief Engineer", "Project Director", "Deputy Director (Works)"]),
        "contact_email": f"procurement@{agency.lower().replace(' ', '').replace('(', '').replace(')', '')[:24]}pk",
        "contact_phone": f"0{random.choice([42, 51, 21, 91, 61, 92])}-{random.randint(1000000, 9999999)}",
        "eligibility": "Registered contractors/firms with valid NTN, Active Taxpayer status and relevant experience. PSQCA/PEC registration as applicable.",
        "attachments": attachments,
        "document_downloads": random.randint(0, 120),
        "source_url": f"https://{source}.gov.pk/tender-detail/{ref}",
        "opening_minutes_url": f"https://{source}.gov.pk/minutes/{ref}" if random.random() < 0.2 else "",
    }

    # Post-opening / post-award public disclosure simulation
    if closing < now:
        tender["status_override"] = "awarded" if random.random() < 0.7 else "closed"
        tender["bid_count"] = random.randint(3, 25)
        tender["bidder_names"] = random.sample(CONTRACTORS, min(random.randint(2, 6), len(CONTRACTORS)))
        if tender["status_override"] == "awarded":
            tender["awardee_name"] = pick(CONTRACTORS)
            tender["award_amount"] = round(value * random.uniform(0.86, 0.99), 2) if value else None
            tender["award_date"] = (closing + timedelta(days=random.randint(10, 50))).strftime("%Y-%m-%d")
    elif (closing - now).days <= 3:
        tender["status_override"] = "open"
        # simulated amendment published on ~1/4 of near-deadline tenders
        if random.random() < 0.25:
            tender["closing_at"] = (closing + timedelta(days=random.randint(2, 10))).strftime("%Y-%m-%d %H:%M")
            tender["amended"] = True

    return tender


def main() -> None:
    now = datetime.now(timezone.utc)
    counts = {"epads": 42, "punjab-ep": 46, "ppra": 34}
    for source, count in counts.items():
        tenders = []
        seen = set()
        idx = 0
        while len(tenders) < count:
            t = make_tender(source, idx, now)
            idx += 1
            key = t["external_id"]
            if key in seen:
                continue
            seen.add(key)
            status = t.pop("status_override", "open")
            amended = t.pop("amended", False)
            t["status"] = status
            if amended:
                t["description"] += "\n[Amendment-01] Submission deadline extended per addendum."
            tenders.append(t)
        out = FIXTURES / f"{source}.json"
        out.write_text(json.dumps(tenders, indent=2, ensure_ascii=False), encoding="utf-8")
        print(f"wrote {out} ({len(tenders)} tenders)")


if __name__ == "__main__":
    main()


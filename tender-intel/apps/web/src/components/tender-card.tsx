"use client";

import Link from "next/link";
import Countdown from "@/components/countdown";
import { Badge, statusTone } from "@/components/ui";
import { formatDateTime, formatPKR } from "@/lib/format";
import { Tender } from "@/lib/types";

export default function TenderCard({ tender }: { tender: Tender }) {
  return (
    <Link
      href={`/tenders/${tender.id}`}
      className="block rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 transition-colors hover:border-sky-500/40 hover:bg-[var(--card-hover)]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Badge tone={statusTone(tender.status)}>{tender.status}</Badge>
            <span className="font-mono text-xs text-[var(--muted)]">{tender.reference_no}</span>
          </div>
          <h3 className="mt-2 line-clamp-2 font-medium leading-snug">{tender.title}</h3>
        </div>
        <Countdown target={tender.closing_at} compact />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs text-[var(--muted)] sm:grid-cols-4">
        <div>
          <div className="uppercase tracking-wider opacity-70">Agency</div>
          <div className="truncate text-slate-300">{tender.agency}</div>
        </div>
        <div>
          <div className="uppercase tracking-wider opacity-70">Category</div>
          <div className="text-slate-300">{tender.category}</div>
        </div>
        <div>
          <div className="uppercase tracking-wider opacity-70">Location</div>
          <div className="text-slate-300">
            {tender.city}
            {tender.province ? `, ${tender.province}` : ""}
          </div>
        </div>
        <div>
          <div className="uppercase tracking-wider opacity-70">Est. Value</div>
          <div className="text-slate-300">{formatPKR(tender.estimated_value)}</div>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-[var(--border)] pt-2.5 text-xs text-[var(--muted)]">
        <span>
          Closes <span className="text-slate-300">{formatDateTime(tender.closing_at)}</span>
        </span>
        <span className="font-mono uppercase">{tender.source_slug}</span>
      </div>
    </Link>
  );
}


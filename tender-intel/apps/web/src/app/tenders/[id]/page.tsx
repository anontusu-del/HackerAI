"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import Countdown from "@/components/countdown";
import Shell from "@/components/shell";
import { Badge, Card, EmptyState, Spinner, statusTone } from "@/components/ui";
import { api } from "@/lib/api";
import { formatDate, formatDateTime, formatPKR, timeAgo } from "@/lib/format";
import { ChangeOut, Tender } from "@/lib/types";

function Field({ label, value }: { label: string; value?: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[#0e1830] px-3 py-2.5">
      <div className="text-[10px] font-medium uppercase tracking-wider text-[var(--muted)]">{label}</div>
      <div className="mt-1 text-sm text-slate-200">{value || "—"}</div>
    </div>
  );
}

export default function TenderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [tender, setTender] = useState<Tender | null>(null);
  const [changes, setChanges] = useState<ChangeOut[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      api.get<Tender>(`/tenders/${id}`),
      api.get<ChangeOut[]>(`/tenders/${id}/changes`),
    ])
      .then(([t, c]) => {
        setTender(t);
        setChanges(c);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load tender"));
  }, [id]);

  if (error) {
    return (
      <Shell>
        <EmptyState title="Tender not found" hint={error} />
      </Shell>
    );
  }
  if (!tender) {
    return (
      <Shell>
        <Spinner label="Loading tender…" />
      </Shell>
    );
  }

  return (
    <Shell>
      <Link href="/tenders" className="text-sm text-[var(--muted)] hover:text-[var(--primary)]">
        ← All tenders
      </Link>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 max-w-3xl">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={statusTone(tender.status)}>{tender.status}</Badge>
            <Badge tone="info">{tender.category}</Badge>
            <Badge>{tender.province || tender.country}</Badge>
            <span className="font-mono text-xs text-[var(--muted)]">{tender.reference_no}</span>
          </div>
          <h1 className="mt-3 text-2xl font-semibold leading-tight">{tender.title}</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {tender.agency} · {tender.city} · {tender.procurement_method}
          </p>
        </div>
        <Card className="text-center">
          <div className="text-xs uppercase tracking-wider text-[var(--muted)]">Time to closing</div>
          <div className="mt-3">
            <Countdown target={tender.closing_at} />
          </div>
          <div className="mt-2 text-xs text-[var(--muted)]">{formatDateTime(tender.closing_at)}</div>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <h2 className="mb-3 font-semibold">Overview</h2>
            <p className="whitespace-pre-line text-sm leading-relaxed text-slate-300">
              {tender.description || "No description published."}
            </p>
            <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3">
              <Field label="Est. value" value={formatPKR(tender.estimated_value)} />
              <Field label="Published" value={formatDateTime(tender.published_at)} />
              <Field label="Bid opening" value={formatDateTime(tender.opening_at)} />
              <Field label="Bid security" value={tender.bid_security} />
              <Field label="Validity" value={tender.validity_period} />
              <Field label="Downloads" value={tender.document_downloads} />
            </div>
          </Card>

          {tender.ai_summary ? (
            <Card className="border-sky-500/30">
              <div className="mb-2 flex items-center gap-2">
                <h2 className="font-semibold">✨ AI Summary</h2>
                <Badge tone="info">generated</Badge>
              </div>
              <p className="whitespace-pre-line text-sm leading-relaxed text-slate-300">{tender.ai_summary}</p>
            </Card>
          ) : null}

          <Card>
            <h2 className="mb-3 font-semibold">📄 Documents ({tender.documents.length})</h2>
            {tender.documents.length === 0 ? (
              <div className="py-6 text-center text-sm text-[var(--muted)]">
                No documents extracted for this tender yet.
              </div>
            ) : (
              <div className="space-y-2">
                {tender.documents.map((d) => (
                  <div key={d.id} className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border)] px-3 py-2.5">
                    <div className="min-w-0">
                      <div className="truncate text-sm">{d.name}</div>
                      <div className="text-xs text-[var(--muted)]">
                        {d.doc_type}
                        {d.pages ? ` · ${d.pages} pages` : ""}
                        {d.ocr_used ? " · OCR" : ""}
                        {d.text_excerpt ? ` · "${d.text_excerpt.slice(0, 120)}…"` : ""}
                      </div>
                    </div>
                    {d.url ? (
                      <a
                        href={d.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-md border border-[var(--border)] px-2.5 py-1 text-xs text-sky-400 hover:bg-[var(--card-hover)]"
                      >
                        Open ↗
                      </a>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card>
            <h2 className="mb-3 font-semibold">🕓 Change history ({changes.length})</h2>
            {changes.length === 0 ? (
              <div className="py-6 text-center text-sm text-[var(--muted)]">No amendments or changes detected yet.</div>
            ) : (
              <div className="space-y-0">
                {changes.map((c, i) => (
                  <div key={c.id} className="relative border-l border-[var(--border)] pb-5 pl-5 last:pb-0">
                    {i < changes.length - 1 ? (
                      <span className="absolute -left-[5px] top-1 h-2.5 w-2.5 rounded-full bg-[var(--primary)]" />
                    ) : (
                      <span className="absolute -left-[5px] top-1 h-2.5 w-2.5 rounded-full bg-emerald-400" />
                    )}
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={c.change_type === "new" ? "success" : c.change_type === "awarded" ? "info" : c.change_type === "cancelled" ? "danger" : "warning"}>
                        {c.change_type}
                      </Badge>
                      <span className="text-xs font-mono text-[var(--muted)]">{c.field}</span>
                      <span className="text-[11px] text-[var(--muted)]">{timeAgo(c.detected_at)}</span>
                    </div>
                    <div className="mt-1.5 text-sm text-slate-300">
                      {c.old_value ? (
                        <>
                          <span className="text-red-400 line-through decoration-red-400/50">{c.old_value.slice(0, 160)}</span>
                          <span className="mx-1.5 text-[var(--muted)]">→</span>
                        </>
                      ) : null}
                      <span className="text-emerald-400">{c.new_value?.slice(0, 200)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <h2 className="mb-3 font-semibold">💰 Value & bids</h2>
            <div className="space-y-2.5 text-sm">
              <div className="flex justify-between">
                <span className="text-[var(--muted)]">Est. value</span>
                <span className="font-medium">{formatPKR(tender.estimated_value)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--muted)]">Bids received</span>
                <span>{tender.bid_count ?? "not opened"}</span>
              </div>
              {tender.awardee_name ? (
                <>
                  <div className="flex justify-between">
                    <span className="text-[var(--muted)]">Awarded to</span>
                    <span className="font-medium text-emerald-400">{tender.awardee_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--muted)]">Award amount</span>
                    <span>{formatPKR(tender.award_amount)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--muted)]">Award date</span>
                    <span>{formatDate(tender.award_date)}</span>
                  </div>
                </>
              ) : null}
            </div>
          </Card>

          <Card>
            <h2 className="mb-3 font-semibold">🏢 Procurement entity</h2>
            <div className="space-y-3 text-sm">
              <div>
                <div className="text-xs text-[var(--muted)]">Contact person</div>
                <div>{tender.contact_person || "—"}</div>
              </div>
              <div>
                <div className="text-xs text-[var(--muted)]">Email</div>
                <div>{tender.contact_email || "—"}</div>
              </div>
              <div>
                <div className="text-xs text-[var(--muted)]">Phone</div>
                <div>{tender.contact_phone || "—"}</div>
              </div>
              <div>
                <div className="text-xs text-[var(--muted)]">Eligibility</div>
                <div className="mt-0.5 text-xs text-slate-300">{tender.eligibility || "—"}</div>
              </div>
            </div>
          </Card>

          <Card>
            <h2 className="mb-3 font-semibold">🔗 Source</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-[var(--muted)]">Portal</span>
                <span className="font-mono text-xs uppercase">{tender.source_slug}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--muted)]">First seen</span>
                <span>{timeAgo(tender.first_seen_at)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--muted)]">Last updated</span>
                <span>{timeAgo(tender.updated_at)}</span>
              </div>
              {tender.source_url ? (
                <a
                  href={tender.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 block rounded-lg border border-[var(--border)] px-3 py-2 text-center text-xs text-sky-400 hover:bg-[var(--card-hover)]"
                >
                  View original notice ↗
                </a>
              ) : null}
            </div>
          </Card>

          {tender.bidder_names && tender.bidder_names.length > 0 ? (
            <Card>
              <h2 className="mb-1 font-semibold">🤝 Bidders (public record)</h2>
              <p className="mb-3 text-xs text-[var(--muted)]">
                Disclosed after public bid opening, per PPRA transparency rules.
              </p>
              <ul className="space-y-1.5 text-sm">
                {tender.bidder_names.map((b, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-sky-400" />
                    {b}
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
        </div>
      </div>
    </Shell>
  );
}


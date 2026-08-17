"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import Countdown from "@/components/countdown";
import Shell from "@/components/shell";
import { Badge, Card, PageHeader, Spinner, StatCard } from "@/components/ui";
import { api } from "@/lib/api";
import { formatDateTime, formatPKR, timeAgo } from "@/lib/format";
import { AlertItem, AnalyticsSummary, Tender } from "@/lib/types";

export default function DashboardPage() {
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [closing, setClosing] = useState<Tender[]>([]);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [sources, setSources] = useState<{ slug: string; status: string; last_run_at?: string | null }[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      api.get<AnalyticsSummary>("/analytics/summary"),
      api.get<Tender[]>("/tenders?sort=closing&statuses=open&page_size=6"),
      api.get<AlertItem[]>("/alerts?limit=6"),
      api.get<{ sources: { slug: string; status: string; last_run_at?: string | null }[] }>("/admin/health"),
    ])
      .then(([s, c, a, h]) => {
        setSummary(s);
        setClosing(c);
        setAlerts(a);
        setSources(h.sources);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load dashboard"));
  }, []);

  if (error) return <Shell><div className="text-red-400">{error}</div></Shell>;
  if (!summary) return <Shell><Spinner label="Loading dashboard…" /></Shell>;

  return (
    <Shell>
      <PageHeader
        title="Dashboard"
        subtitle={`Live intelligence across ${summary.sources_active} connected public procurement sources · last refresh ${new Date().toLocaleTimeString()}`}
        actions={
          <Link
            href="/tenders"
            className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-slate-950 hover:bg-sky-300"
          >
            Browse tenders →
          </Link>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Open tenders" value={summary.open_tenders} sub={`${summary.total_tenders} total tracked`} tone="info" />
        <StatCard label="Closing in 24h" value={summary.closing_24h} sub="action required" tone={summary.closing_24h > 10 ? "danger" : "warning"} />
        <StatCard label="Closing in 72h" value={summary.closing_72h} sub="watch closely" tone="warning" />
        <StatCard label="Open pipeline value" value={formatPKR(summary.total_value_open)} sub="PKR across open tenders" tone="success" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold">⏳ Closing soonest</h2>
            <Link href="/tenders?sort=closing_at" className="text-xs text-[var(--primary)] hover:underline">
              View all
            </Link>
          </div>
          <div className="space-y-3">
            {closing.length === 0 && <div className="py-8 text-center text-sm text-[var(--muted)]">No open tenders with deadlines.</div>}
            {closing.map((t) => (
              <Link
                key={t.id}
                href={`/tenders/${t.id}`}
                className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border)] px-3 py-2.5 transition-colors hover:bg-[var(--card-hover)]"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{t.title}</div>
                  <div className="mt-0.5 truncate text-xs text-[var(--muted)]">
                    {t.agency} · {formatPKR(t.estimated_value)}
                  </div>
                </div>
                <Countdown target={t.closing_at} />
              </Link>
            ))}
          </div>
        </Card>

        <Card>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold">🔔 Recent alerts</h2>
            <Link href="/alerts" className="text-xs text-[var(--primary)] hover:underline">
              All alerts ({summary.unread_alerts} unread)
            </Link>
          </div>
          <div className="space-y-3">
            {alerts.length === 0 && (
              <div className="py-8 text-center text-sm text-[var(--muted)]">
                No alerts yet. Watchlists generate alerts for new tenders, changes and deadlines.
              </div>
            )}
            {alerts.map((a) => (
              <div key={a.id} className="rounded-lg border border-[var(--border)] px-3 py-2.5">
                <div className="flex items-center justify-between gap-2">
                  <Badge tone={a.severity === "critical" ? "danger" : a.severity === "warning" ? "warning" : "info"}>
                    {a.kind}
                  </Badge>
                  <span className="text-[11px] text-[var(--muted)]">{timeAgo(a.created_at)}</span>
                </div>
                <div className="mt-1.5 text-sm font-medium leading-snug">{a.title}</div>
                <div className="mt-0.5 line-clamp-2 text-xs text-[var(--muted)]">{a.message}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="mt-6">
        <Card>
          <h2 className="mb-3 font-semibold">Connected sources</h2>
          <div className="grid gap-3 text-sm sm:grid-cols-3">
            {sources.map((s) => (
              <SourceLine key={s.slug} label={s.slug} detail={s.status} lastRun={s.last_run_at} tone={s.status === "healthy" ? "success" : "danger"} />
            ))}
          </div>
          <p className="mt-3 text-xs text-[var(--muted)]">
            All sources currently run in fixture mode (live portals block datacenter egress). Production: set
            fixture_mode=false on an allowed network.
          </p>
        </Card>
      </div>
    </Shell>
  );
}

function SourceLine({ label, detail, lastRun, tone }: { label: string; detail: string; lastRun?: string | null; tone: "success" | "warning" | "danger" }) {
  const dot = tone === "success" ? "bg-emerald-400" : tone === "warning" ? "bg-amber-400" : "bg-red-400";
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[#0e1830] px-4 py-3">
      <div className="flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full ${dot}`} />
        <span className="font-medium">{label}</span>
      </div>
      <div className="mt-1 text-xs text-[var(--muted)]">{detail}</div>
      <div className="mt-0.5 text-xs text-[var(--muted)]">last sync {timeAgo(lastRun)}</div>
    </div>
  );
}




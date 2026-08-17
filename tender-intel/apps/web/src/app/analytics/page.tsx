"use client";

import { ReactNode, useEffect, useState } from "react";
import Shell from "@/components/shell";
import { Card, PageHeader, Spinner, StatCard } from "@/components/ui";
import { api } from "@/lib/api";
import { formatCompact, formatPKR, shortAgency } from "@/lib/format";
import { AnalyticsSummary, CompetitorStat, SeriesPoint } from "@/lib/types";

const W = 600;
const H = 220;
const PAD = { l: 48, r: 12, t: 16, b: 44 };

function BarChart({ data, fmt, color = "#38bdf8" }: { data: SeriesPoint[]; fmt: (v: number) => string; color?: string }) {
  const [hover, setHover] = useState<number | null>(null);
  if (data.length === 0) return <div className="py-10 text-center text-sm text-[var(--muted)]">No data</div>;
  const max = Math.max(...data.map((d) => d.value), 1);
  const n = data.length;
  const bw = (W - PAD.l - PAD.r) / Math.max(n, 1);
  const barW = Math.min(42, bw * 0.62);
  return (
    <div className="overflow-x-auto">
      <svg width={W} height={H} className="min-w-[560px]">
        {[0, 0.25, 0.5, 0.75, 1].map((t) => {
          const y = PAD.t + (H - PAD.t - PAD.b) * (1 - t);
          return (
            <g key={t}>
              <line x1={PAD.l} x2={W - PAD.r} y1={y} y2={y} stroke="#1e2b47" strokeDasharray="3 4" />
              <text x={PAD.l - 8} y={y + 4} textAnchor="end" fontSize={10} fill="#64748b">
                {fmt(max * t)}
              </text>
            </g>
          );
        })}
        {data.map((d, i) => {
          const x = PAD.l + i * bw + (bw - barW) / 2;
          const h = ((d.value / max) * (H - PAD.t - PAD.b)) || 2;
          const y = H - PAD.b - h;
          const label = (d.key?.length > 14 ? d.key.slice(0, 12) + "…" : d.key) || "—";
          return (
            <g key={i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              <rect x={x} y={y} width={barW} height={h} rx={3} fill={hover === i ? "#7dd3fc" : color} opacity={hover === i ? 1 : 0.85} />
              <text x={x + barW / 2} y={H - PAD.b + 14} textAnchor="middle" fontSize={9.5} fill="#94a3b8">
                {label}
              </text>
              {hover === i ? (
                <text x={x + barW / 2} y={Math.max(y - 6, 12)} textAnchor="middle" fontSize={10} fill="#e2e8f0" fontWeight={600}>
                  {fmt(d.value)}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function LineChart({ data, fmt }: { data: SeriesPoint[]; fmt: (v: number) => string }) {
  const [hover, setHover] = useState<number | null>(null);
  if (data.length < 2) return <div className="py-10 text-center text-sm text-[var(--muted)]">Not enough data</div>;
  const max = Math.max(...data.map((d) => d.value), 1);
  const n = data.length;
  const iw = W - PAD.l - PAD.r;
  const ih = H - PAD.t - PAD.b;
  const pts = data.map((d, i) => ({
    x: PAD.l + (n === 1 ? iw / 2 : (i / (n - 1)) * iw),
    y: PAD.t + ih - (d.value / max) * ih,
    ...d,
  }));
  const path = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  return (
    <div className="overflow-x-auto">
      <svg width={W} height={H} className="min-w-[560px]">
        {[0, 0.5, 1].map((t) => {
          const y = PAD.t + ih * (1 - t);
          return (
            <g key={t}>
              <line x1={PAD.l} x2={W - PAD.r} y1={y} y2={y} stroke="#1e2b47" strokeDasharray="3 4" />
              <text x={PAD.l - 8} y={y + 4} textAnchor="end" fontSize={10} fill="#64748b">
                {fmt(max * t)}
              </text>
            </g>
          );
        })}
        <path d={path} fill="none" stroke="#38bdf8" strokeWidth={2} />
        {pts.map((p, i) => (
          <g key={i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
            <circle cx={p.x} cy={p.y} r={hover === i ? 5 : 3.5} fill={hover === i ? "#7dd3fc" : "#38bdf8"} />
            <text x={p.x} y={H - PAD.b + 14} textAnchor="middle" fontSize={9.5} fill="#94a3b8">
              {p.key}
            </text>
            {hover === i ? (
              <text x={p.x} y={Math.max(p.y - 8, 12)} textAnchor="middle" fontSize={10} fill="#e2e8f0" fontWeight={600}>
                {fmt(p.value)}
              </text>
            ) : null}
          </g>
        ))}
      </svg>
    </div>
  );
}

function ChartCard({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <Card>
      <h2 className="font-semibold">{title}</h2>
      {hint ? <p className="mb-3 mt-0.5 text-xs text-[var(--muted)]">{hint}</p> : null}
      <div className="mt-3">{children}</div>
    </Card>
  );
}

export default function AnalyticsPage() {
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [agency, setAgency] = useState<SeriesPoint[]>([]);
  const [category, setCategory] = useState<SeriesPoint[]>([]);
  const [province, setProvince] = useState<SeriesPoint[]>([]);
  const [trend, setTrend] = useState<SeriesPoint[]>([]);
  const [competitors, setCompetitors] = useState<CompetitorStat[]>([]);
  const [winRate, setWinRate] = useState<Record<string, { awardee: string; wins: number }[]>>({});
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      api.get<AnalyticsSummary>("/analytics/summary"),
      api.get<SeriesPoint[]>("/analytics/by-agency"),
      api.get<SeriesPoint[]>("/analytics/by-category"),
      api.get<SeriesPoint[]>("/analytics/by-province"),
      api.get<SeriesPoint[]>("/analytics/value-trend?days=90"),
      api.get<CompetitorStat[]>("/analytics/competitors"),
      api.get<Record<string, { awardee: string; wins: number }[]>>("/analytics/win-rate-by-agency"),
    ])
      .then(([s, a, c, p, t, comp, wr]) => {
        setSummary(s);
        setAgency(a);
        setCategory(c);
        setProvince(p);
        setTrend(t);
        setCompetitors(comp);
        setWinRate(wr);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load analytics"));
  }, []);

  if (error) {
    return (
      <Shell>
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</div>
      </Shell>
    );
  }
  if (!summary) {
    return (
      <Shell>
        <Spinner label="Loading analytics…" />
      </Shell>
    );
  }

  const topAgencies = [...agency].sort((a, b) => b.value - a.value).slice(0, 8);

  return (
    <Shell>
      <PageHeader title="Analytics" subtitle="Aggregate insights across all ingested public procurement notices and award disclosures." />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total tenders" value={summary.total_tenders} sub={`${summary.sources_active} sources active`} />
        <StatCard label="Open tenders" value={summary.open_tenders} tone="success" />
        <StatCard label="Closing in 24h / 72h" value={summary.closing_24h} tone="warning" sub={`${summary.closing_72h} in 72 hours`} />
        <StatCard label="Open pipeline value" value={formatPKR(summary.total_value_open)} sub={`${summary.awarded_count} awarded to date`} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <ChartCard title="New tenders by source agency" hint="Top 8 agencies by volume of published notices.">
          <BarChart data={topAgencies} fmt={(v) => v.toLocaleString()} />
        </ChartCard>
        <ChartCard title="Tenders by category" hint="Goods, Works, Services and consultancies.">
          <BarChart data={category} fmt={(v) => v.toLocaleString()} color="#a78bfa" />
        </ChartCard>
        <ChartCard title="Tenders by province" hint="Geographic distribution of procurement activity.">
          <BarChart data={province} fmt={(v) => v.toLocaleString()} color="#34d399" />
        </ChartCard>
        <ChartCard title="Estimated value trend" hint="Sum of estimated values of published notices over the last 90 days.">
          <LineChart data={trend} fmt={formatCompact} />
        </ChartCard>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card>
          <h2 className="font-semibold">🏆 Top competitors</h2>
          <p className="mb-3 mt-0.5 text-xs text-[var(--muted)]">Firms by disclosed award wins and total awarded value.</p>
          {competitors.length === 0 ? (
            <div className="py-8 text-center text-sm text-[var(--muted)]">No award disclosures yet — awards appear after bid evaluation.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)] text-xs uppercase tracking-wider text-[var(--muted)]">
                    <th className="pb-2 pr-3 font-medium">Firm</th>
                    <th className="pb-2 pr-3 text-right font-medium">Wins</th>
                    <th className="pb-2 pr-3 text-right font-medium">Total value</th>
                    <th className="pb-2 text-right font-medium">Win rate</th>
                  </tr>
                </thead>
                <tbody>
                  {competitors.map((c, i) => (
                    <tr key={i} className="border-b border-[var(--border)]/50 last:border-0">
                      <td className="py-2.5 pr-3 font-medium">{c.name}</td>
                      <td className="py-2.5 pr-3 text-right tabular-nums">{c.wins}</td>
                      <td className="py-2.5 pr-3 text-right tabular-nums">{formatPKR(c.total_value)}</td>
                      <td className="py-2.5 text-right tabular-nums text-emerald-400">
                        {c.win_rate != null ? `${(c.win_rate * 100).toFixed(1)}%` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card>
          <h2 className="font-semibold">🥇 Awards by agency</h2>
          <p className="mb-3 mt-0.5 text-xs text-[var(--muted)]">Public award disclosures grouped by procuring agency.</p>
          {Object.keys(winRate).length === 0 ? (
            <div className="py-8 text-center text-sm text-[var(--muted)]">No award disclosures yet.</div>
          ) : (
            <div className="max-h-96 space-y-4 overflow-y-auto pr-1">
              {Object.entries(winRate).map(([agencyName, rows]) => (
                <div key={agencyName}>
                  <div className="mb-1.5 text-xs font-medium text-[var(--muted)]">{shortAgency(agencyName)}</div>
                  <div className="flex flex-wrap gap-1.5">
                    {rows.slice(0, 5).map((r, i) => (
                      <span key={i} className="rounded-md border border-[var(--border)] bg-[#0e1830] px-2 py-1 text-xs">
                        {r.awardee} <span className="font-semibold text-emerald-400">×{r.wins}</span>
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </Shell>
  );
}


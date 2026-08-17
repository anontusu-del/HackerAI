"use client";

import { useEffect, useState } from "react";
import Shell from "@/components/shell";
import { Badge, Button, Card, PageHeader, Spinner } from "@/components/ui";
import { api } from "@/lib/api";
import { formatDateTime, timeAgo } from "@/lib/format";
import { AuditEntry, ConnectorRun, HealthStatus } from "@/lib/types";

function HealthDot({ ok }: { ok: boolean }) {
  return <span className={`inline-block h-2 w-2 rounded-full ${ok ? "bg-emerald-400" : "bg-red-400"} animate-pulse`} />;
}

export default function AdminPage() {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [runs, setRuns] = useState<ConnectorRun[]>([]);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [error, setError] = useState("");
  const [syncing, setSyncing] = useState<string | null>(null);

  async function load() {
    const [h, r, a] = await Promise.all([
      api.get<HealthStatus>("/admin/health"),
      api.get<ConnectorRun[]>("/admin/runs?limit=20"),
      api.get<AuditEntry[]>("/admin/audit?limit=15"),
    ]);
    setHealth(h);
    setRuns(r);
    setAudit(a);
  }

  useEffect(() => {
    load().catch((e) => setError(e instanceof Error ? e.message : "Failed to load admin data (admin role required)"));
    const id = setInterval(() => load().catch(() => {}), 20000);
    return () => clearInterval(id);
  }, []);

  async function syncNow(sourceId: string) {
    setSyncing(sourceId);
    try {
      await api.post(`/admin/sources/${sourceId}/sync`);
      await new Promise((r) => setTimeout(r, 3000));
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sync failed");
    } finally {
      setSyncing(null);
    }
  }

  async function toggle(sourceId: string) {
    await api.post(`/admin/sources/${sourceId}/toggle`);
    await load();
  }

  if (error && !health) {
    return (
      <Shell>
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</div>
      </Shell>
    );
  }
  if (!health) {
    return (
      <Shell>
        <Spinner label="Loading source health…" />
      </Shell>
    );
  }

  const heartbeat = health.worker_heartbeat;
  const workerOk = !!heartbeat && Date.now() - new Date(heartbeat).getTime() < 90_000;

  return (
    <Shell>
      <PageHeader
        title="Source Health"
        subtitle="Connector pipeline, worker heartbeat, sync runs and audit trail."
        actions={<Badge tone={health.status === "ok" ? "success" : "danger"}>{health.status.toUpperCase()}</Badge>}
      />

      {error ? <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</div> : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-[var(--muted)]">
            <HealthDot ok={health.database === "ok"} /> Database
          </div>
          <div className={`mt-2 text-xl font-semibold ${health.database === "ok" ? "text-emerald-400" : "text-red-400"}`}>
            {health.database}
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-[var(--muted)]">
            <HealthDot ok={health.redis === "ok"} /> Redis
          </div>
          <div className={`mt-2 text-xl font-semibold ${health.redis === "ok" ? "text-emerald-400" : "text-red-400"}`}>
            {health.redis}
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-[var(--muted)]">
            <HealthDot ok={workerOk} /> Worker
          </div>
          <div className="mt-2 text-xl font-semibold text-slate-200">{workerOk ? "alive" : "no heartbeat"}</div>
          <div className="mt-1 text-xs text-[var(--muted)]">{heartbeat ? `last beat ${timeAgo(heartbeat)}` : "waiting for first beat"}</div>
        </Card>
        <Card>
          <div className="text-xs font-medium uppercase tracking-wider text-[var(--muted)]">Open tenders tracked</div>
          <div className="mt-2 text-xl font-semibold text-sky-400 tabular-nums">{health.pending_alerts}</div>
          <div className="mt-1 text-xs text-[var(--muted)]">v{health.version}</div>
        </Card>
      </div>

      <h2 className="mb-3 mt-8 font-semibold">Connectors</h2>
      <div className="grid gap-4 lg:grid-cols-3">
        {health.sources.map((s) => (
          <Card key={s.id}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="font-semibold">{s.name}</div>
                <div className="font-mono text-[11px] text-[var(--muted)]">{s.base_url}</div>
              </div>
              <Badge tone={s.enabled ? "success" : "default"}>{s.enabled ? "enabled" : "disabled"}</Badge>
            </div>
            <div className="mt-3 space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-[var(--muted)]">Status</span>
                <span className="flex items-center gap-1.5">
                  <HealthDot ok={s.status === "healthy"} /> {s.status}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--muted)]">Last run</span>
                <span>{s.last_run_at ? timeAgo(s.last_run_at) : "never"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--muted)]">Last success</span>
                <span>{s.last_success_at ? timeAgo(s.last_success_at) : "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--muted)]">Items found</span>
                <span className="tabular-nums">{s.last_items_found}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--muted)]">Mode</span>
                <span>{s.fixture_mode ? "fixture" : "live HTTP"}</span>
              </div>
            </div>
            {s.last_error ? (
              <div className="mt-3 rounded-md border border-red-500/30 bg-red-500/10 px-2.5 py-1.5 text-xs text-red-400">{s.last_error}</div>
            ) : null}
            <div className="mt-4 flex gap-2">
              <Button variant="ghost" onClick={() => syncNow(s.id)} disabled={syncing === s.id || !s.enabled} className="flex-1">
                {syncing === s.id ? "Syncing…" : "Sync now"}
              </Button>
              <Button variant="ghost" onClick={() => toggle(s.id)}>
                {s.enabled ? "Pause" : "Resume"}
              </Button>
            </div>
          </Card>
        ))}
      </div>

      <h2 className="mb-3 mt-8 font-semibold">Recent sync runs</h2>
      <Card>
        {runs.length === 0 ? (
          <div className="py-8 text-center text-sm text-[var(--muted)]">No connector runs recorded yet — first sync runs shortly after worker start.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] text-xs uppercase tracking-wider text-[var(--muted)]">
                  <th className="pb-2 pr-3 font-medium">Source</th>
                  <th className="pb-2 pr-3 font-medium">Started</th>
                  <th className="pb-2 pr-3 text-right font-medium">Found</th>
                  <th className="pb-2 pr-3 text-right font-medium">New</th>
                  <th className="pb-2 pr-3 text-right font-medium">Updated</th>
                  <th className="pb-2 pr-3 text-right font-medium">Changed</th>
                  <th className="pb-2 font-medium">Result</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((r) => (
                  <tr key={r.id} className="border-b border-[var(--border)]/50 last:border-0">
                    <td className="py-2.5 pr-3 font-mono text-xs uppercase">{r.source_id.slice(0, 8)}</td>
                    <td className="py-2.5 pr-3 tabular-nums text-[var(--muted)]">{formatDateTime(r.started_at)}</td>
                    <td className="py-2.5 pr-3 text-right tabular-nums">{r.items_found}</td>
                    <td className="py-2.5 pr-3 text-right tabular-nums text-emerald-400">{r.items_new}</td>
                    <td className="py-2.5 pr-3 text-right tabular-nums">{r.items_updated}</td>
                    <td className="py-2.5 pr-3 text-right tabular-nums text-amber-400">{r.items_changed}</td>
                    <td className="py-2.5">
                      <Badge tone={r.status === "success" ? "success" : r.status === "running" ? "info" : "danger"}>{r.status}</Badge>
                      {r.error ? <span className="ml-2 text-xs text-red-400">{r.error.slice(0, 60)}</span> : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <h2 className="mb-3 mt-8 font-semibold">Audit trail</h2>
      <Card>
        {audit.length === 0 ? (
          <div className="py-8 text-center text-sm text-[var(--muted)]">No audit events yet.</div>
        ) : (
          <div className="space-y-2.5">
            {audit.map((a) => (
              <div key={a.id} className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-mono text-xs text-[var(--muted)]">{timeAgo(a.created_at)}</span>
                <Badge tone="info">{a.action}</Badge>
                <span className="text-slate-400">{a.entity}</span>
                <span className="font-mono text-[11px] text-[var(--muted)]">{a.entity_id?.slice(0, 8)}</span>
                {a.ip ? <span className="ml-auto font-mono text-[11px] text-[var(--muted)]">{a.ip}</span> : null}
              </div>
            ))}
          </div>
        )}
      </Card>
    </Shell>
  );
}



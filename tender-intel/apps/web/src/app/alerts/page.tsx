"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import Shell from "@/components/shell";
import { Badge, Button, Card, EmptyState, PageHeader, Spinner } from "@/components/ui";
import { api } from "@/lib/api";
import { timeAgo } from "@/lib/format";
import { AlertItem } from "@/lib/types";

const KIND_LABEL: Record<string, { label: string; tone: "info" | "success" | "warning" | "danger" }> = {
  new_tender: { label: "New tender", tone: "success" },
  deadline: { label: "Deadline", tone: "warning" },
  amendment: { label: "Amendment", tone: "info" },
  award: { label: "Award", tone: "success" },
  cancelled: { label: "Cancelled", tone: "danger" },
  system: { label: "System", tone: "danger" },
};

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    try {
      const q = unreadOnly ? "?unread_only=true" : "";
      setAlerts(await api.get<AlertItem[]>(`/alerts${q}`));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load alerts");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [unreadOnly]);

  async function markRead(a: AlertItem) {
    await api.post(`/alerts/${a.id}/read`);
    setAlerts((prev) => prev.map((x) => (x.id === a.id ? { ...x, is_read: true } : x)));
  }

  async function markAll() {
    await api.post("/alerts/mark-all-read");
    setAlerts((prev) => prev.map((x) => ({ ...x, is_read: true })));
  }

  const unread = alerts.filter((a) => !a.is_read).length;

  return (
    <Shell>
      <PageHeader
        title="Alerts"
        subtitle="Real-time notifications from your watchlists — new tenders, amendments, deadline proximity and award disclosures."
        actions={
          <>
            <Button variant={unreadOnly ? "primary" : "ghost"} onClick={() => setUnreadOnly((v) => !v)}>
              {unreadOnly ? "All alerts" : "Unread only"}
            </Button>
            <Button variant="ghost" onClick={markAll} disabled={unread === 0}>
              Mark all read
            </Button>
          </>
        }
      />

      {error ? <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</div> : null}

      {loading ? (
        <Spinner label="Loading alerts…" />
      ) : alerts.length === 0 ? (
        <Card>
          <EmptyState
            title={unreadOnly ? "No unread alerts 🎉" : "No alerts yet"}
            hint="Alerts appear here automatically when the worker detects matching tenders, amendments, or approaching deadlines. Create a watchlist to get started."
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {alerts.map((a) => {
            const kind = KIND_LABEL[a.kind] ?? { label: a.kind, tone: "info" as const };
            const sev =
              a.severity === "high" ? "danger" : a.severity === "medium" ? "warning" : "default";
            return (
              <Card key={a.id} className={`flex items-start gap-4 ${a.is_read ? "opacity-60" : ""}`}>
                <div className="mt-1.5 flex items-center gap-3">
                  <span className={`h-2.5 w-2.5 rounded-full ${a.is_read ? "bg-slate-600" : "animate-pulse bg-sky-400"}`} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={kind.tone}>{kind.label}</Badge>
                    <Badge tone={sev}>{a.severity}</Badge>
                    {a.watchlist_id ? <Badge>watchlist</Badge> : null}
                    <span className="text-[11px] text-[var(--muted)]">{timeAgo(a.created_at)}</span>
                  </div>
                  <div className="mt-1.5 font-medium">{a.title}</div>
                  <div className="mt-1 text-sm text-slate-400">{a.message}</div>
                  <div className="mt-2.5 flex items-center gap-3">
                    {a.tender_id ? (
                      <Link href={`/tenders/${a.tender_id}`} className="text-xs font-medium text-sky-400 hover:text-sky-300">
                        View tender →
                      </Link>
                    ) : null}
                    {!a.is_read ? (
                      <button onClick={() => markRead(a)} className="text-xs text-[var(--muted)] hover:text-slate-300">
                        Mark read
                      </button>
                    ) : null}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </Shell>
  );
}


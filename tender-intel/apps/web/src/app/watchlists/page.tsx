"use client";

import { FormEvent, useEffect, useState } from "react";
import Shell from "@/components/shell";
import { Badge, Button, Card, EmptyState, Input, PageHeader, Spinner } from "@/components/ui";
import { api } from "@/lib/api";
import { Facets, Watchlist } from "@/lib/types";

const EMPTY = {
  name: "",
  keywords: "",
  agencies: "",
  categories: "",
  provinces: "",
  min_value: "",
  max_value: "",
  deadline_hours: "72",
};

export default function WatchlistsPage() {
  const [lists, setLists] = useState<Watchlist[]>([]);
  const [facets, setFacets] = useState<Facets | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    const [w, f] = await Promise.all([api.get<Watchlist[]>("/watchlists"), api.get<Facets>("/tenders/facets")]);
    setLists(w);
    setFacets(f);
  }

  useEffect(() => {
    load().catch((e) => setError(e instanceof Error ? e.message : "Failed to load watchlists"));
  }, []);

  function split(v: string): string[] {
    return v
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }

  async function create(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api.post("/watchlists", {
        name: form.name,
        keywords: split(form.keywords),
        agencies: form.agencies ? [form.agencies] : [],
        categories: form.categories ? split(form.categories) : [],
        provinces: form.provinces ? split(form.provinces) : [],
        min_value: form.min_value ? Number(form.min_value) : null,
        max_value: form.max_value ? Number(form.max_value) : null,
        statuses: ["open"],
        notify_new: true,
        notify_change: true,
        notify_deadline: true,
        deadline_hours: Number(form.deadline_hours) || 72,
      });
      setForm(EMPTY);
      setShowForm(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create watchlist");
    } finally {
      setBusy(false);
    }
  }

  async function remove(w: Watchlist) {
    if (!confirm(`Delete watchlist "${w.name}"?`)) return;
    await api.del(`/watchlists/${w.id}`);
    await load();
  }

  return (
    <Shell>
      <PageHeader
        title="Watchlists"
        subtitle="Automated monitoring rules — new tenders, amendments, deadline proximity and award disclosures are pushed as alerts."
        actions={
          <Button onClick={() => setShowForm((v) => !v)}>{showForm ? "Cancel" : "+ New watchlist"}</Button>
        }
      />

      {error ? <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</div> : null}

      {showForm ? (
        <Card className="mb-6 border-sky-500/30">
          <h2 className="mb-4 font-semibold">New watchlist</h2>
          <form onSubmit={create} className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-[var(--muted)]">Name *</label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. NHA Highway Projects" required />
            </div>
            <div className="md:col-span-2">
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-[var(--muted)]">
                Keywords (comma separated) — matched against title, description, agency
              </label>
              <Input value={form.keywords} onChange={(e) => setForm({ ...form, keywords: e.target.value })} placeholder="road, highway, bridge, N-70" />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-[var(--muted)]">Agency</label>
              <select
                value={form.agencies}
                onChange={(e) => setForm({ ...form, agencies: e.target.value })}
                className="w-full rounded-lg border border-[var(--border)] bg-[#0e1830] px-3 py-2 text-sm outline-none"
              >
                <option value="">Any agency</option>
                {facets?.agencies.map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-[var(--muted)]">Categories</label>
              <Input value={form.categories} onChange={(e) => setForm({ ...form, categories: e.target.value })} placeholder="Works, Goods" />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-[var(--muted)]">Provinces</label>
              <Input value={form.provinces} onChange={(e) => setForm({ ...form, provinces: e.target.value })} placeholder="Punjab, KPK" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-[var(--muted)]">Min PKR</label>
                <Input type="number" value={form.min_value} onChange={(e) => setForm({ ...form, min_value: e.target.value })} placeholder="10,000,000" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-[var(--muted)]">Max PKR</label>
                <Input type="number" value={form.max_value} onChange={(e) => setForm({ ...form, max_value: e.target.value })} />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-[var(--muted)]">Deadline alert (hrs)</label>
                <Input type="number" value={form.deadline_hours} onChange={(e) => setForm({ ...form, deadline_hours: e.target.value })} />
              </div>
            </div>
            <div className="md:col-span-2">
              <Button type="submit" disabled={busy}>{busy ? "Creating…" : "Create watchlist"}</Button>
            </div>
          </form>
        </Card>
      ) : null}

      {lists.length === 0 ? (
        <Card>
          <EmptyState
            title="No watchlists yet"
            hint="Create a watchlist to get alerts the moment a matching tender is published, amended, or approaches its closing deadline."
          />
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {lists.map((w) => (
            <Card key={w.id}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold">{w.name}</h3>
                  <div className="mt-1 text-xs text-[var(--muted)]">
                    {w.matched_count} tenders currently match · deadline alert {w.deadline_hours}h before closing
                  </div>
                </div>
                <Badge tone={w.is_active ? "success" : "default"}>{w.is_active ? "active" : "paused"}</Badge>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {w.keywords.map((k) => <Badge key={k} tone="info">⌕ {k}</Badge>)}
                {w.agencies.map((a) => <Badge key={a}>{a}</Badge>)}
                {w.categories.map((c) => <Badge key={c}>{c}</Badge>)}
                {w.provinces.map((p) => <Badge key={p}>{p}</Badge>)}
                {w.min_value != null && <Badge>≥ {w.min_value.toLocaleString()}</Badge>}
                {w.max_value != null && <Badge>≤ {w.max_value.toLocaleString()}</Badge>}
              </div>
              <div className="mt-4 flex gap-2">
                <Button variant="ghost" href={`/tenders?q=${encodeURIComponent(w.name)}`}>View matches</Button>
                <Button variant="danger" onClick={() => remove(w)}>Delete</Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </Shell>
  );
}


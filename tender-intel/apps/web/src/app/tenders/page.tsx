"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Shell from "@/components/shell";
import TenderCard from "@/components/tender-card";
import { api, apiText } from "@/lib/api";
import { Badge, Button, EmptyState, Input, PageHeader, Select, Spinner } from "@/components/ui";
import { Facets, TenderPage } from "@/lib/types";

function download(name: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export default function TendersPage() {
  return (
    <Suspense
      fallback={
        <Shell>
          <Spinner label="Loading tenders…" />
        </Shell>
      }
    >
      <TendersContent />
    </Suspense>
  );
}

function TendersContent() {
  const searchParams = useSearchParams();
  const [data, setData] = useState<TenderPage | null>(null);
  const [facets, setFacets] = useState<Facets | null>(null);
  const [q, setQ] = useState(searchParams.get("q") || "");
  const [agency, setAgency] = useState(searchParams.get("agency") || "");
  const [category, setCategory] = useState(searchParams.get("category") || "");
  const [province, setProvince] = useState(searchParams.get("province") || "");
  const [status, setStatus] = useState(searchParams.get("status") || "");
  const [source, setSource] = useState(searchParams.get("source") || "");
  const [sort, setSort] = useState(searchParams.get("sort") || "newest");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(12);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const params = useMemo(
    () =>
      new URLSearchParams({
        page: String(page),
        page_size: String(pageSize),
        sort,
        ...(q ? { q } : {}),
        ...(agency ? { agencies: agency } : {}),
        ...(category ? { categories: category } : {}),
        ...(province ? { provinces: province } : {}),
        ...(status ? { statuses: status } : {}),
        ...(source ? { sources: source } : {}),
      }),
    [page, pageSize, sort, q, agency, category, province, status, source]
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [t, f] = await Promise.all([
        api.get<TenderPage>(`/tenders?${params}`),
        api.get<Facets>("/tenders/facets"),
      ]);
      setData(t);
      setFacets(f);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [params]);

  useEffect(() => {
    load();
  }, [load]);

  function resetFilters() {
    setQ("");
    setAgency("");
    setCategory("");
    setProvince("");
    setStatus("");
    setSource("");
    setSort("newest");
    setPage(1);
  }

  async function exportCsv() {
    setExporting(true);
    try {
      const csv = await apiText(`/tenders/export/csv?${params}`);
      download(`tenders-${new Date().toISOString().slice(0, 10)}.csv`, csv, "text/csv;charset=utf-8");
    } catch (e) {
      alert(e instanceof Error ? e.message : "Export failed");
    } finally {
      setExporting(false);
    }
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / pageSize)) : 1;

  return (
    <Shell>
      <PageHeader
        title="Tenders"
        subtitle={`${data ? `${data.total} publicly disclosed tenders` : "Searching…"} · EPADS · Punjab e-Procurement · PPRA`}
        actions={
          <Button onClick={exportCsv} disabled={exporting}>
            {exporting ? "Exporting…" : "⬇ Export CSV"}
          </Button>
        }
      />

      <div className="mb-4 grid gap-3 md:grid-cols-2 lg:grid-cols-7">
        <Input
          className="lg:col-span-2"
          placeholder="Search title, agency, reference…"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
        />
        <Select value={source} onChange={(e) => { setSource(e.target.value); setPage(1); }}>
          <option value="">All sources</option>
          {facets?.sources.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </Select>
        <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="">All statuses</option>
          {facets?.statuses.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </Select>
        <Select value={category} onChange={(e) => { setCategory(e.target.value); setPage(1); }}>
          <option value="">All categories</option>
          {facets?.categories.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </Select>
        <Select value={province} onChange={(e) => { setProvince(e.target.value); setPage(1); }}>
          <option value="">All provinces</option>
          {facets?.provinces.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </Select>
        <Select value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="newest">Newest first</option>
          <option value="closing">Closing soonest</option>
          <option value="value_desc">Highest value</option>
          <option value="value_asc">Lowest value</option>
        </Select>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <Select className="min-w-56" value={agency} onChange={(e) => { setAgency(e.target.value); setPage(1); }}>
          <option value="">All procuring agencies ({facets?.agencies.length || 0})</option>
          {facets?.agencies.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </Select>
        {(q || agency || category || province || status || source) && (
          <Button variant="ghost" onClick={resetFilters}>✕ Clear filters</Button>
        )}
      </div>

      {loading ? (
        <Spinner label="Loading tenders…" />
      ) : data && data.items.length > 0 ? (
        <>
          <div className="grid gap-4 xl:grid-cols-2">
            {data.items.map((t) => (
              <TenderCard key={t.id} tender={t} />
            ))}
          </div>

          <div className="mt-6 flex items-center justify-between">
            <span className="text-sm text-[var(--muted)]">
              Page {data.page} of {totalPages} · {data.total} results
            </span>
            <div className="flex gap-2">
              <Button variant="ghost" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                ← Prev
              </Button>
              <Button variant="ghost" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                Next →
              </Button>
            </div>
          </div>
        </>
      ) : (
        <EmptyState
          title="No tenders match your filters"
          hint="Try broadening the search, or clearing agency/category filters."
        />
      )}

      <div className="mt-8 rounded-lg border border-[var(--border)] bg-[#0e1830] px-4 py-3 text-xs text-[var(--muted)]">
        <Badge tone="info">Data governance</Badge>{" "}
        This dashboard only stores publicly disclosed information — notices, deadlines, amendments and documents.
        Sealed bid contents and bidder identities of unopened tenders are confidential under PPRA rules and are
        never fetched or stored. Bidder details appear only after public bid-opening / award disclosure.
      </div>
    </Shell>
  );
}




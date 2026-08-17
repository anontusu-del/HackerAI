"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { User } from "@/lib/types";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: "▦" },
  { href: "/tenders", label: "Tenders", icon: "📄" },
  { href: "/watchlists", label: "Watchlists", icon: "👁" },
  { href: "/alerts", label: "Alerts", icon: "🔔" },
  { href: "/analytics", label: "Analytics", icon: "📊" },
  { href: "/admin", label: "Source Health", icon: "🛰" },
];

export default function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    api.get<User>("/auth/me").then((u) => setUser(u)).catch(() => {});
    const loadUnread = () =>
      api
        .get<{ unread: number }>("/alerts/unread-count")
        .then((r) => setUnread(r.unread))
        .catch(() => {});
    loadUnread();
    const id = setInterval(loadUnread, 60000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex min-h-screen">
      <aside className="fixed inset-y-0 left-0 z-30 flex w-60 flex-col border-r border-[var(--border)] bg-[#0d1526]">
        <Link href="/dashboard" className="flex items-center gap-2.5 border-b border-[var(--border)] px-5 py-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--primary)] text-lg font-bold text-slate-950">
            TI
          </div>
          <div>
            <div className="text-sm font-semibold leading-tight">TenderIntel PK</div>
            <div className="text-[11px] text-[var(--muted)]">Public Procurement Intelligence</div>
          </div>
        </Link>

        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {NAV.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                  active
                    ? "bg-[var(--primary-soft)] font-medium text-[var(--primary)]"
                    : "text-slate-300 hover:bg-[var(--card-hover)]"
                }`}
              >
                <span className="w-5 text-center">{item.icon}</span>
                {item.label}
                {item.href === "/alerts" && unread > 0 ? (
                  <span className="ml-auto rounded-full bg-red-500/20 px-2 py-0.5 text-xs font-semibold text-red-400">
                    {unread}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-[var(--border)] p-4">
          {user ? (
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-sky-500/15 text-sm font-semibold text-sky-400">
                {user.full_name
                  .split(" ")
                  .map((p) => p[0])
                  .slice(0, 2)
                  .join("")}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{user.full_name}</div>
                <div className="truncate text-[11px] text-[var(--muted)]">
                  {user.role} · {user.email}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-xs text-[var(--muted)]">Live mode — admin session</div>
          )}
        </div>
      </aside>

      <main className="ml-60 flex-1 px-8 py-8">{children}</main>
    </div>
  );
}


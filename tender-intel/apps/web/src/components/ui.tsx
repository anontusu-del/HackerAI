"use client";

import Link from "next/link";
import { ReactNode } from "react";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-[var(--border)] bg-[var(--card)] p-5 ${className}`}>{children}</div>
  );
}

export function Badge({
  children,
  tone = "default",
}: {
  children: ReactNode;
  tone?: "default" | "success" | "warning" | "danger" | "info";
}) {
  const tones: Record<string, string> = {
    default: "bg-slate-700/50 text-slate-300 border-slate-600",
    success: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
    warning: "bg-amber-500/10 text-amber-400 border-amber-500/30",
    danger: "bg-red-500/10 text-red-400 border-red-500/30",
    info: "bg-sky-500/10 text-sky-400 border-sky-500/30",
  };
  return (
    <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${tones[tone]}`}>
      {children}
    </span>
  );
}

export function statusTone(status: string): "success" | "warning" | "danger" | "info" | "default" {
  switch (status) {
    case "open":
      return "success";
    case "closed":
      return "default";
    case "awarded":
      return "info";
    case "cancelled":
      return "danger";
    default:
      return "default";
  }
}

export function Button({
  children,
  onClick,
  variant = "primary",
  type = "button",
  disabled,
  href,
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "ghost" | "danger";
  type?: "button" | "submit";
  disabled?: boolean;
  href?: string;
  className?: string;
}) {
  const base =
    "inline-flex items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed";
  const variants: Record<string, string> = {
    primary: "bg-[var(--primary)] text-slate-950 hover:bg-sky-300",
    ghost: "border border-[var(--border)] text-slate-300 hover:bg-[var(--card-hover)]",
    danger: "bg-red-500/15 text-red-400 border border-red-500/30 hover:bg-red-500/25",
  };
  const cls = `${base} ${variants[variant]} ${className}`;
  if (href) {
    return (
      <Link href={href} className={cls}>
        {children}
      </Link>
    );
  }
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={cls}>
      {children}
    </button>
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full rounded-lg border border-[var(--border)] bg-[#0e1830] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-slate-500 outline-none focus:border-sky-500/60 focus:ring-1 focus:ring-sky-500/40 ${props.className || ""}`}
    />
  );
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`rounded-lg border border-[var(--border)] bg-[#0e1830] px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-sky-500/60 ${props.className || ""}`}
    />
  );
}

export function StatCard({
  label,
  value,
  sub,
  tone = "default",
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: "default" | "success" | "warning" | "danger" | "info";
}) {
  const accents: Record<string, string> = {
    default: "text-[var(--foreground)]",
    success: "text-emerald-400",
    warning: "text-amber-400",
    danger: "text-red-400",
    info: "text-sky-400",
  };
  return (
    <Card>
      <div className="text-xs font-medium uppercase tracking-wider text-[var(--muted)]">{label}</div>
      <div className={`mt-2 text-2xl font-semibold tabular-nums ${accents[tone]}`}>{value}</div>
      {sub ? <div className="mt-1 text-xs text-[var(--muted)]">{sub}</div> : null}
    </Card>
  );
}

export function Spinner({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-[var(--muted)]">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-sky-500 border-t-transparent" />
      <span className="text-sm">{label}</span>
    </div>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
      <div className="text-3xl">🗂️</div>
      <div className="font-medium text-[var(--foreground)]">{title}</div>
      {hint ? <div className="max-w-md text-sm text-[var(--muted)]">{hint}</div> : null}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-[var(--muted)]">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}


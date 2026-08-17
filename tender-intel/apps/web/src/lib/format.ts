export function formatPKR(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  const n = Number(value);
  if (!isFinite(n)) return "—";
  return "Rs " + n.toLocaleString("en-PK", { maximumFractionDigits: 0 });
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso).getTime();
  if (isNaN(d)) return "—";
  const s = Math.floor((Date.now() - d) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export interface CountdownParts {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  totalMs: number;
  overdue: boolean;
}

export function countdown(targetIso: string | null | undefined): CountdownParts {
  const now = Date.now();
  if (!targetIso) return { days: 0, hours: 0, minutes: 0, seconds: 0, totalMs: 0, overdue: true };
  const target = new Date(targetIso).getTime();
  if (isNaN(target)) return { days: 0, hours: 0, minutes: 0, seconds: 0, totalMs: 0, overdue: true };
  const totalMs = target - now;
  const abs = Math.abs(totalMs);
  return {
    days: Math.floor(abs / 86400000),
    hours: Math.floor((abs % 86400000) / 3600000),
    minutes: Math.floor((abs % 3600000) / 60000),
    seconds: Math.floor((abs % 60000) / 1000),
    totalMs,
    overdue: totalMs < 0,
  };
}

export function formatCompact(value: number): string {
  const n = Number(value);
  if (!isFinite(n)) return "—";
  if (Math.abs(n) >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1).replace(/\.0$/, "") + "B";
  if (Math.abs(n) >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (Math.abs(n) >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
  return n.toLocaleString();
}

export function shortAgency(name: string | null | undefined): string {
  if (!name) return "—";
  const words = name.split(/\s+/).filter(Boolean);
  if (words.length <= 2 || name.length <= 24) return name;
  const skip = new Set(["of", "the", "and", "for", "&", "in", "development", "authority", "department", "company", "limited", "private", "pvt"]);
  const initials = words.filter((w) => !skip.has(w.toLowerCase())).map((w) => w[0].toUpperCase()).join("");
  return initials.length >= 2 ? initials : name;
}

export function closingLabel(iso: string | null | undefined): string {
  if (!iso) return "No deadline";
  const c = countdown(iso);
  if (c.overdue) return "Closed";
  if (c.days >= 1) return `${c.days}d ${c.hours}h left`;
  if (c.hours >= 1) return `${c.hours}h ${c.minutes}m left`;
  return `${c.minutes}m ${c.seconds}s left`;
}



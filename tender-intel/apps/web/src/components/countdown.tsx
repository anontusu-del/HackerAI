"use client";

import { useEffect, useState } from "react";
import { countdown, CountdownParts } from "@/lib/format";

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function Part({ value, unit }: { value: number; unit: string }) {
  return (
    <span className="inline-flex flex-col items-center rounded-lg border border-[var(--border)] bg-[#0e1830] px-2 py-1">
      <span className="text-sm font-semibold tabular-nums leading-none">{pad(value)}</span>
      <span className="mt-0.5 text-[9px] uppercase tracking-wider text-[var(--muted)]">{unit}</span>
    </span>
  );
}

export default function Countdown({ target, compact = false }: { target?: string | null; compact?: boolean }) {
  const [parts, setParts] = useState<CountdownParts>(() => countdown(target));

  useEffect(() => {
    setParts(countdown(target));
    const id = setInterval(() => setParts(countdown(target)), 1000);
    return () => clearInterval(id);
  }, [target]);

  if (!target || parts.overdue) {
    return <span className="text-xs font-medium text-[var(--muted)]">Closed</span>;
  }

  const urgent = parts.days === 0 && parts.hours < 12;
  const color = urgent ? "text-red-400" : "text-[var(--foreground)]";

  if (compact) {
    return (
      <span className={`text-xs font-medium tabular-nums ${color}`}>
        {parts.days > 0 ? `${parts.days}d ` : ""}
        {pad(parts.hours)}:{pad(parts.minutes)}:{pad(parts.seconds)} left
      </span>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      {parts.days > 0 && <Part value={parts.days} unit="days" />}
      <Part value={parts.hours} unit="hrs" />
      <Part value={parts.minutes} unit="min" />
      <Part value={parts.seconds} unit="sec" />
    </div>
  );
}


"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Button, Input } from "@/components/ui";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("admin@tenderintel.pk");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api.post("/auth/login", { email, password });
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setBusy(false);
    }
  }

  function fillDemo(pw: string) {
    setPassword(pw);
    setError("");
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--primary)] text-2xl font-bold text-slate-950">
            TI
          </div>
          <h1 className="mt-4 text-2xl font-semibold">TenderIntel PK</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Enterprise Tender Intelligence · Pakistan Public Procurement
          </p>
        </div>

        <form
          onSubmit={submit}
          className="space-y-4 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6"
        >
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-[var(--muted)]">
              Email
            </label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-[var(--muted)]">
              Password
            </label>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>

          {error ? (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
              {error}
            </div>
          ) : null}

          <Button type="submit" disabled={busy} className="w-full">
            {busy ? "Signing in…" : "Sign in"}
          </Button>

          <div className="rounded-lg border border-[var(--border)] bg-[#0e1830] p-3 text-xs text-[var(--muted)]">
            <div className="mb-1.5 font-medium text-slate-300">Demo accounts (password: Admin@12345)</div>
            <div className="space-y-1">
              <button type="button" onClick={() => fillDemo("Admin@12345")} className="block hover:text-sky-400">
                admin@tenderintel.pk — Administrator
              </button>
              <button type="button" onClick={() => fillDemo("Admin@12345")} className="block hover:text-sky-400">
                analyst@tenderintel.pk — Analyst
              </button>
              <button type="button" onClick={() => fillDemo("Admin@12345")} className="block hover:text-sky-400">
                viewer@tenderintel.pk — Viewer
              </button>
            </div>
          </div>
        </form>

        <p className="mt-4 text-center text-sm text-[var(--muted)]">
          New tenant?{" "}
          <Link href="/register" className="font-medium text-[var(--primary)] hover:underline">
            Create an organisation
          </Link>
        </p>
      </div>
    </div>
  );
}


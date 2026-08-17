"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Button, Input } from "@/components/ui";

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    tenant_name: "",
    tenant_slug: "",
    full_name: "",
    email: "",
    password: "",
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api.post("/auth/register", form);
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md">
        <h1 className="mb-1 text-2xl font-semibold">Create your organisation</h1>
        <p className="mb-6 text-sm text-[var(--muted)]">
          A new tenant workspace is provisioned and the first account becomes its administrator.
        </p>

        <form onSubmit={submit} className="space-y-4 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6">
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-[var(--muted)]">
              Organisation name
            </label>
            <Input
              value={form.tenant_name}
              onChange={(e) => set("tenant_name", e.target.value)}
              placeholder="Al-Noor Construction Co."
              required
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-[var(--muted)]">
              Slug (a-z, 0-9, dashes)
            </label>
            <Input
              value={form.tenant_slug}
              onChange={(e) => set("tenant_slug", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
              placeholder="alnoor-construction"
              required
              pattern="[a-z0-9-]+"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-[var(--muted)]">
              Your name
            </label>
            <Input value={form.full_name} onChange={(e) => set("full_name", e.target.value)} required />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-[var(--muted)]">
              Work email
            </label>
            <Input
              type="email"
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
              required
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-[var(--muted)]">
              Password (min 8 chars)
            </label>
            <Input
              type="password"
              value={form.password}
              onChange={(e) => set("password", e.target.value)}
              minLength={8}
              required
            />
          </div>

          {error ? (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
              {error}
            </div>
          ) : null}

          <Button type="submit" disabled={busy} className="w-full">
            {busy ? "Creating…" : "Create tenant & sign in"}
          </Button>
        </form>

        <p className="mt-4 text-center text-sm text-[var(--muted)]">
          Already registered?{" "}
          <Link href="/login" className="font-medium text-[var(--primary)] hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}


// Same-origin by default: Next.js rewrites /api/* to the FastAPI backend,
// which works from any forwarded URL (localhost, GitHub Codespaces, etc.)
// without CORS issues. Override with NEXT_PUBLIC_API_URL if the API is hosted elsewhere.
const API_BASE = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/$/, "");

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };
  if (options.body && typeof options.body !== "string") {
    headers["Content-Type"] = "application/json";
    options = { ...options, body: JSON.stringify(options.body) };
  }
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
    credentials: "include",
  });
  if (res.status === 401) {
    if (typeof window !== "undefined") window.location.href = "/login";
    throw new ApiError(401, "Not authenticated");
  }
  if (!res.ok) {
    let detail = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (body?.detail) detail = typeof body.detail === "string" ? body.detail : JSON.stringify(body.detail);
    } catch {
      /* ignore */
    }
    throw new ApiError(res.status, detail);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: object) => request<T>(path, { method: "POST", body: body as BodyInit }),
  patch: <T>(path: string, body?: object) => request<T>(path, { method: "PATCH", body: body as BodyInit }),
  put: <T>(path: string, body?: object) => request<T>(path, { method: "PUT", body: body as BodyInit }),
  del: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};

export async function apiText(path: string): Promise<string> {
  const res = await fetch(`${API_BASE}${path}`, { credentials: "include" });
  if (!res.ok) throw new ApiError(res.status, "Download failed");
  return res.text();
}





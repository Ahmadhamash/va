/**
 * Backend API client - proxies requests to the FastAPI backend.
 * In production, the backend is accessible at /api/* through Caddy reverse proxy.
 */

const BACKEND_BASE = process.env.BACKEND_URL || "http://backend:8000";

interface FetchOptions {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
  token?: string;
}

export async function backendFetch(path: string, opts: FetchOptions = {}) {
  const url = `${BACKEND_BASE}/api${path}`;
  const isFormData = typeof FormData !== "undefined" && opts.body instanceof FormData;
  const isUrlEncoded = typeof URLSearchParams !== "undefined" && opts.body instanceof URLSearchParams;
  const headers: Record<string, string> = {
    ...(!isFormData
      ? { "Content-Type": isUrlEncoded ? "application/x-www-form-urlencoded" : "application/json" }
      : {}),
    ...(opts.headers || {}),
  };
  if (opts.token) {
    headers["Authorization"] = `Bearer ${opts.token}`;
  }

  const res = await fetch(url, {
    method: opts.method || "GET",
    headers,
    body: opts.body ? (typeof opts.body === "string" || isFormData || isUrlEncoded ? opts.body as any : JSON.stringify(opts.body)) : undefined,
    cache: "no-store",
  });

  return res;
}

export function getTokenFromRequest(request: Request): string | null {
  const authHeader = request.headers.get("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice(7);
  }
  const cookies = request.headers.get("Cookie") || "";
  const match = cookies.match(/token=([^;]+)/);
  return match ? match[1] : null;
}

"use client";

export type BackendUser = {
  id: string;
  username: string;
  email: string;
  business_name: string | null;
  ai_persona: string | null;
  role: string;
  is_active: boolean;
  created_at: string;
  email_verified: boolean;
  ai_credit_balance: number;
};

type RequestOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
  auth?: boolean;
};

const TOKEN_KEY = "masar_backend_token";

export class ApiError extends Error {
  status: number;
  detail: unknown;

  constructor(status: number, detail: unknown) {
    super(typeof detail === "string" ? detail : `API request failed with ${status}`);
    this.status = status;
    this.detail = detail;
  }
}

function apiBase() {
  const configured = process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, "");
  if (configured) return configured;
  return process.env.NODE_ENV === "development" ? "http://localhost:8000/api" : "/api";
}

function apiUrl(path: string) {
  return `${apiBase()}${path.startsWith("/") ? path : `/${path}`}`;
}

export function getToken() {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null) {
  if (typeof window === "undefined") return;
  if (token) window.localStorage.setItem(TOKEN_KEY, token);
  else window.localStorage.removeItem(TOKEN_KEY);
}

function notifyUnauthorized() {
  if (typeof window === "undefined") return;
  setToken(null);
  window.dispatchEvent(new Event("backend-unauthorized"));
}

async function parseResponse(response: Response) {
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return response.json();
  }
  return response.text();
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers = new Headers(options.headers);
  const hasBody = options.body !== undefined;
  const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData;

  if (hasBody && !isFormData && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  if (options.auth !== false) {
    const token = getToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(apiUrl(path), {
    ...options,
    headers,
    credentials: "include",
    body: hasBody ? (isFormData ? (options.body as BodyInit) : JSON.stringify(options.body)) : undefined
  });

  if (!response.ok) {
    const detail = await parseResponse(response).catch(() => response.statusText);
    if (response.status === 401 && options.auth !== false) notifyUnauthorized();
    throw new ApiError(response.status, typeof detail === "object" && detail !== null && "detail" in detail ? detail.detail : detail);
  }

  if (response.status === 204) return undefined as T;
  return parseResponse(response) as Promise<T>;
}

export async function login(username: string, password: string) {
  const token = await apiRequest<{ access_token: string }>("/auth/login", {
    method: "POST",
    auth: false,
    body: { username, password }
  });
  setToken(token.access_token);
  return token;
}

export async function register(payload: {
  username: string;
  email: string;
  password: string;
  business_name?: string;
  business_type?: string;
}) {
  const token = await apiRequest<{ access_token: string }>("/auth/register", {
    method: "POST",
    auth: false,
    body: payload
  });
  setToken(token.access_token);
  return token;
}

export function logout() {
  setToken(null);
}

import axios from "axios";

function resolveApiOrigin() {
  const configured = (import.meta.env.VITE_API_URL || "").replace(/\/+$/, "");
  const fallback = import.meta.env.DEV ? "http://localhost:8000" : "";
  const origin = configured || fallback;

  if (!import.meta.env.DEV && typeof window !== "undefined") {
    if (!origin) return window.location.origin;

    try {
      const url = new URL(origin, window.location.origin);
      if (url.protocol === "http:" && url.hostname === window.location.hostname) {
        return window.location.origin;
      }
      if (url.protocol === "http:") {
        url.protocol = "https:";
      }
      return url.toString().replace(/\/+$/, "");
    } catch {
      return window.location.origin;
    }
  }

  if (
    typeof window !== "undefined" &&
    window.location.protocol === "https:" &&
    origin.startsWith("http://")
  ) {
    try {
      const url = new URL(origin);
      url.protocol = "https:";
      return url.toString().replace(/\/+$/, "");
    } catch {
      return window.location.origin;
    }
  }

  return origin;
}

const apiOrigin = resolveApiOrigin();
const baseURL = `${apiOrigin}/api`;

const api = axios.create({ baseURL });

const TOKEN_KEY = "ai_assistant_token";

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response && error.response.status === 401) {
      // Only clear token and redirect if the request actually carried a token
      // (avoids nuking the session on spurious 401s from unauthenticated requests)
      const hadToken = error.config && error.config.headers && error.config.headers.Authorization;
      if (hadToken) {
        setToken(null);
        if (window.location.pathname !== "/login") {
          window.location.href = "/login";
        }
      }
    }
    return Promise.reject(error);
  }
);

export const API_BASE = baseURL;
export default api;

"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useAuthStore } from "@/store/use-auth-store";

const PUBLIC_PATHS = ["/login", "/", "/reset-password"];

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

function roleHome(role?: string) {
  if (role === "admin") return "/admin";
  if (role === "support_agent") return "/support";
  return "/dashboard";
}

async function fetchMe(token: string) {
  const res = await fetch("/api/auth/me", {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) return null;
  return res.json();
}

async function refreshToken() {
  const res = await fetch("/api/auth/refresh", {
    method: "POST",
    credentials: "include",
    cache: "no-store",
  });
  if (!res.ok) return null;
  const data = await res.json();
  return typeof data.access_token === "string" ? data.access_token : null;
}

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { token, user, setAuth, logout, setLoading } = useAuthStore();
  const [hydrated, setHydrated] = useState(false);
  const publicPath = isPublicPath(pathname);

  useEffect(() => {
    setHydrated(useAuthStore.persist.hasHydrated());
    const unsub = useAuthStore.persist.onFinishHydration(() => setHydrated(true));
    return unsub;
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    let cancelled = false;

    async function checkAuth() {
      setLoading(true);
      let activeToken = token;
      let activeUser = null;

      if (activeToken) {
        activeUser = await fetchMe(activeToken);
      }

      if (!activeUser) {
        activeToken = await refreshToken();
        if (activeToken) {
          activeUser = await fetchMe(activeToken);
        }
      }

      if (cancelled) return;

      if (activeToken && activeUser) {
        const current = useAuthStore.getState();
        if (
          current.token !== activeToken ||
          !current.user ||
          current.user.id !== activeUser.id ||
          current.user.role !== activeUser.role
        ) {
          setAuth(activeToken, activeUser);
        }
        setLoading(false);
        if (pathname === "/login") {
          router.replace(roleHome(activeUser.role));
        }
        return;
      }

      logout();
      setLoading(false);
      if (!publicPath) {
        router.replace("/login");
      }
    }

    checkAuth();
    return () => {
      cancelled = true;
    };
  }, [hydrated, token, pathname, publicPath, router, setAuth, logout, setLoading]);

  if (!hydrated || (!publicPath && !user && !token)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink-950">
        <Loader2 className="h-8 w-8 animate-spin text-emeraldx-400" />
      </div>
    );
  }

  return <>{children}</>;
}

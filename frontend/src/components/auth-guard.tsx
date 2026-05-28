"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuthStore } from "@/store/use-auth-store";
import { Loader2 } from "lucide-react";

const PUBLIC_PATHS = ["/login", "/"];

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { token, user, loading, setAuth, logout, setLoading } = useAuthStore();

  useEffect(() => {
    async function checkAuth() {
      const storedToken = localStorage.getItem("masarjo_token");
      if (!storedToken) {
        setLoading(false);
        if (!PUBLIC_PATHS.includes(pathname)) {
          router.push("/login");
        }
        return;
      }

      try {
        const res = await fetch("/api/auth/me", {
          headers: { Authorization: "Bearer " + storedToken },
        });
        if (res.ok) {
          const userData = await res.json();
          setAuth(storedToken, userData);
        } else {
          logout();
          if (!PUBLIC_PATHS.includes(pathname)) {
            router.push("/login");
          }
        }
      } catch {
        setLoading(false);
      }
    }

    if (!user && token) {
      checkAuth();
    } else if (!token) {
      setLoading(false);
      if (!PUBLIC_PATHS.includes(pathname)) {
        router.push("/login");
      }
    } else {
      setLoading(false);
    }
  }, [token, user, pathname, router, setAuth, logout, setLoading]);

  if (loading && !PUBLIC_PATHS.includes(pathname)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink-950">
        <Loader2 className="h-8 w-8 animate-spin text-emeraldx-400" />
      </div>
    );
  }

  return <>{children}</>;
}

"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "react-hot-toast";
import { useEffect, useRef, useState } from "react";
import { directionForLanguage, useLanguageStore, type Language } from "@/store/use-language-store";
import { useAuthStore } from "@/store/use-auth-store";

function LanguageHydrator() {
  const { language, setLanguage } = useLanguageStore();

  useEffect(() => {
    const stored = window.localStorage.getItem("chatter-language");
    if (stored === "ar" || stored === "en") {
      setLanguage(stored as Language);
    }
  }, [setLanguage]);

  useEffect(() => {
    const dir = directionForLanguage(language);
    document.documentElement.lang = language;
    document.documentElement.dir = dir;
    document.body.dir = dir;
    window.localStorage.setItem("chatter-language", language);
  }, [language]);

  return null;
}

function AuthQuerySynchronizer({ queryClient }: { queryClient: QueryClient }) {
  const userId = useAuthStore((state) => state.user?.id ?? null);
  const previousUserId = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    if (previousUserId.current !== undefined && previousUserId.current !== userId) {
      queryClient.clear();
    }
    previousUserId.current = userId;
  }, [queryClient, userId]);

  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 1000 * 60, // 1 minute
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <AuthQuerySynchronizer queryClient={queryClient} />
      <LanguageHydrator />
      {children}
      <Toaster 
        position="top-center" 
        toastOptions={{
          className: "text-right font-medium text-sm border border-white/10",
          style: {
            background: "var(--toast-bg, #16161a)",
            color: "var(--toast-fg, #fff)",
            borderColor: "var(--toast-border, rgba(255, 255, 255, 0.10))",
          },
          success: {
            iconTheme: {
              primary: "#34d399",
              secondary: "#16161a",
            }
          }
        }} 
      />
    </QueryClientProvider>
  );
}

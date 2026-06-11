"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "react-hot-toast";
import { useEffect, useState } from "react";
import { directionForLanguage, useLanguageStore, type Language } from "@/store/use-language-store";

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
      <LanguageHydrator />
      {children}
      <Toaster 
        position="top-center" 
        toastOptions={{
          className: "text-right font-medium text-sm border border-white/10",
          style: {
            background: "#16161a",
            color: "#fff",
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

"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "react-hot-toast";
import { useState } from "react";

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

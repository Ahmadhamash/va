"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="grid min-h-screen place-items-center bg-[#0d0d10] px-4 text-white">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/[0.045] p-6 text-center">
        <AlertTriangle className="mx-auto mb-4 h-10 w-10 text-amber-300" />
        <h1 className="text-xl font-semibold">حدث خطأ غير متوقع</h1>
        <p className="mt-2 text-sm leading-6 text-white/60">
          لم نتمكن من عرض هذه الصفحة حاليا
        </p>
        <Button className="mt-5" onClick={() => reset()}>
          <RefreshCw className="h-4 w-4" />
          إعادة المحاولة
        </Button>
      </div>
    </main>
  );
}

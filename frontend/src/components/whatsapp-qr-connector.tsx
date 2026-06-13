"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, Clock3, MessageCircle, QrCode, RefreshCw, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/store/use-auth-store";
import { useLanguageStore } from "@/store/use-language-store";
import { cn } from "@/lib/utils";

type OpenWAState = {
  configured: boolean;
  connected: boolean;
  status: string;
  qr_code: string | null;
  session_id: string;
  session_name: string;
  refresh_after_seconds: number;
};

function statusLabel(status: string, connected: boolean, isRtl: boolean) {
  if (connected) return isRtl ? "متصل" : "Connected";
  if (status === "qr_ready") return isRtl ? "بانتظار المسح" : "Waiting for scan";
  if (status === "initializing") return isRtl ? "جاري التجهيز" : "Preparing";
  if (status === "authenticated") return isRtl ? "جاري التثبيت" : "Finalizing";
  if (status === "failed") return isRtl ? "يحتاج تحديث" : "Needs refresh";
  return isRtl ? "جاهز للربط" : "Ready to link";
}

export function WhatsAppQrConnector({ className }: { className?: string }) {
  const token = useAuthStore((state) => state.token);
  const language = useLanguageStore((state) => state.language);
  const isRtl = language === "ar";

  const [state, setState] = useState<OpenWAState | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadState = useCallback(
    async (mode: "status" | "start" | "refresh" = "status") => {
      if (!token) return;
      if (mode === "refresh") setRefreshing(true);
      if (mode === "start") setLoading(true);
      setError(null);

      try {
        const endpoint =
          mode === "refresh"
            ? "/api/openwa/session/refresh"
            : mode === "start"
              ? "/api/openwa/session/start"
              : "/api/openwa/session";
        const res = await fetch(endpoint, {
          method: mode === "status" ? "GET" : "POST",
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data.detail || data.error || "OpenWA request failed");
        }
        setState(data);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : isRtl
              ? "تعذر تحميل رمز واتساب."
              : "Could not load WhatsApp QR.",
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [isRtl, token],
  );

  useEffect(() => {
    loadState("start");
  }, [loadState]);

  useEffect(() => {
    if (!token || state?.connected) return;
    const seconds = Math.max(8, Math.min(25, state?.refresh_after_seconds || 15));
    const timer = window.setInterval(() => {
      loadState("status");
    }, seconds * 1000);
    return () => window.clearInterval(timer);
  }, [loadState, state?.connected, state?.refresh_after_seconds, token]);

  const label = useMemo(
    () => statusLabel(state?.status || "created", Boolean(state?.connected), isRtl),
    [isRtl, state?.connected, state?.status],
  );

  return (
    <section className={cn("rounded-3xl border border-emerald-400/15 bg-emerald-500/[0.055] p-5", className)}>
      <div className={cn("grid gap-5 lg:grid-cols-[1fr_280px]", isRtl ? "text-right" : "text-left")}>
        <div className="space-y-4">
          <div className={cn("flex flex-wrap items-start justify-between gap-4", isRtl ? "flex-row" : "flex-row-reverse")}>
            <div
              className={cn(
                "inline-flex items-center gap-2 rounded-2xl border px-3 py-2 text-xs font-semibold",
                state?.connected
                  ? "border-emerald-300/25 bg-emerald-400/12 text-emerald-200"
                  : "border-amber-300/20 bg-amber-400/10 text-amber-200",
              )}
            >
              {state?.connected ? <CheckCircle2 className="h-4 w-4" /> : <Clock3 className="h-4 w-4" />}
              {label}
            </div>
            <div>
              <div className={cn("flex items-center gap-2", isRtl ? "justify-end" : "justify-start flex-row-reverse")}>
                <h2 className="text-xl font-semibold text-white">{isRtl ? "ربط واتساب مباشر" : "Direct WhatsApp Link"}</h2>
                <MessageCircle className="h-5 w-5 text-emerald-300" />
              </div>
              <p className="mt-2 max-w-2xl text-sm leading-7 text-white/55">
                {isRtl
                  ? "امسح الرمز من واتساب، وسيبدأ البوت باستقبال الرسائل والرد عليها من نفس الحساب."
                  : "Scan the QR from WhatsApp to let the bot receive and reply from this account."}
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {[
              { icon: Smartphone, text: isRtl ? "الأجهزة المرتبطة" : "Linked devices" },
              { icon: QrCode, text: isRtl ? "رمز حي ومتجدد" : "Live QR" },
              { icon: CheckCircle2, text: isRtl ? "Webhook جاهز" : "Webhook ready" },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.text} className="flex items-center gap-2 rounded-2xl bg-black/15 px-3 py-2 text-xs text-white/65">
                  <Icon className="h-4 w-4 text-emerald-300" />
                  <span>{item.text}</span>
                </div>
              );
            })}
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-2xl border border-amber-300/20 bg-amber-400/10 px-3 py-2 text-sm text-amber-200">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className={cn("flex flex-wrap gap-3", isRtl ? "justify-start" : "justify-end")}>
            <Button
              type="button"
              variant="secondary"
              disabled={loading || refreshing || state?.connected}
              onClick={() => loadState("refresh")}
            >
              <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
              {refreshing ? (isRtl ? "جاري التحديث" : "Refreshing") : isRtl ? "تحديث الرمز" : "Refresh QR"}
            </Button>
          </div>
        </div>

        <div className="mx-auto w-full max-w-[280px]">
          <div className="grid aspect-square place-items-center rounded-2xl border border-white/10 bg-white p-3 shadow-2xl shadow-black/25">
            {state?.connected ? (
              <div className="grid h-full w-full place-items-center rounded-xl bg-emerald-50 text-center text-emerald-700">
                <CheckCircle2 className="mx-auto mb-2 h-12 w-12" />
                <div className="text-sm font-bold">{isRtl ? "تم الربط" : "Connected"}</div>
              </div>
            ) : state?.qr_code ? (
              <img src={state.qr_code} alt="WhatsApp QR" className="h-full w-full object-contain" />
            ) : (
              <div className="grid h-full w-full place-items-center rounded-xl bg-slate-100 text-center text-slate-500">
                <RefreshCw className={cn("mx-auto mb-2 h-8 w-8", loading && "animate-spin")} />
                <div className="text-xs font-semibold">{isRtl ? "جاري تجهيز الرمز" : "Preparing QR"}</div>
              </div>
            )}
          </div>
          {!state?.connected && (
            <div className="mt-3 text-center text-xs leading-5 text-white/45">
              {isRtl ? "يتحدث تلقائياً كل عدة ثواني." : "Auto-refreshes every few seconds."}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

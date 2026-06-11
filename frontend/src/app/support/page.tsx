"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Inbox, RotateCcw, UserCheck } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { GradientCard } from "@/components/gradient-card";
import { useAuthStore } from "@/store/use-auth-store";

type Handoff = {
  id: string;
  session_id: string;
  user_id: string;
  reason: string;
  reason_details?: string | null;
  priority: string;
  status: string;
  raw_status?: string;
  ai_summary?: string | null;
  ai_suggested_reply?: string | null;
  created_at?: string | null;
};

export default function SupportPage() {
  const { token, user } = useAuthStore();
  const [handoffs, setHandoffs] = useState<Handoff[]>([]);
  const [notice, setNotice] = useState("");
  const [loadingId, setLoadingId] = useState<string | null>(null);

  async function loadHandoffs() {
    if (!token) return;
    const res = await fetch("/api/handoff", {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (res.ok) {
      setHandoffs(await res.json());
    }
  }

  useEffect(() => {
    loadHandoffs();
  }, [token]);

  async function postAction(id: string, action: "assign" | "resolve", body: Record<string, unknown>) {
    if (!token) return;
    setLoadingId(id);
    setNotice("");
    try {
      const res = await fetch(`/api/handoff/${id}/${action}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || data.error || "تعذر تنفيذ الإجراء.");
      setNotice(action === "assign" ? "تم استلام المحادثة." : "تم تحديث حالة المحادثة.");
      await loadHandoffs();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "صار خطأ أثناء تنفيذ الإجراء.");
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <AppShell title="مركز الموظفين" subtitle="المحادثات التي تحتاج تدخل بشري من فريق المنصة.">
      {notice && (
        <div className="mb-6 rounded-2xl border border-primary-400/20 bg-primary-500/10 px-4 py-3 text-sm text-primary-400">
          {notice}
        </div>
      )}

      <GradientCard>
        <div className="mb-5 flex items-center justify-between">
          <span className="text-xs text-white/40">{user?.role === "support_agent" ? "قائمتي" : "كل المحادثات"}</span>
          <h2 className="flex items-center gap-2 text-xl font-semibold text-white">
            <Inbox className="h-5 w-5 text-primary-400" />
            التحويل البشري
          </h2>
        </div>

        {handoffs.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/12 py-12 text-center text-sm text-white/45">
            ما في محادثات محولة حالياً.
          </div>
        ) : (
          <div className="grid gap-3 xl:grid-cols-2">
            {handoffs.map((handoff) => (
              <div key={handoff.id} className="rounded-2xl border border-white/10 bg-white/[0.035] p-4 text-right">
                <div className="flex items-start justify-between gap-3">
                  <span className="rounded-full bg-white/8 px-2 py-1 text-xs text-white/55">{handoff.status}</span>
                  <div>
                    <h3 className="font-semibold text-white">{handoff.reason}</h3>
                    <p className="mt-1 text-xs text-white/40">{handoff.reason_details || "بدون تفاصيل إضافية"}</p>
                  </div>
                </div>

                {handoff.ai_summary && (
                  <p className="mt-4 rounded-xl bg-black/20 p-3 text-sm leading-7 text-white/60">{handoff.ai_summary}</p>
                )}

                {handoff.ai_suggested_reply && (
                  <div className="mt-3 rounded-xl border border-cyanx-400/15 bg-cyanx-500/10 p-3">
                    <div className="mb-1 text-xs text-cyanx-400">اقتراح الذكاء</div>
                    <p className="text-sm leading-7 text-white/65">{handoff.ai_suggested_reply}</p>
                  </div>
                )}

                <div className="mt-4 flex flex-wrap justify-end gap-2">
                  <Button size="sm" variant="secondary" disabled={loadingId === handoff.id} onClick={() => postAction(handoff.id, "assign", { method: "manual" })}>
                    <UserCheck className="h-4 w-4" />
                    استلام
                  </Button>
                  <Button size="sm" variant="secondary" disabled={loadingId === handoff.id} onClick={() => postAction(handoff.id, "resolve", { return_to_ai: true })}>
                    <RotateCcw className="h-4 w-4" />
                    رجع للذكاء
                  </Button>
                  <Button size="sm" disabled={loadingId === handoff.id} onClick={() => postAction(handoff.id, "resolve", { return_to_ai: false })}>
                    <CheckCircle2 className="h-4 w-4" />
                    إغلاق
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </GradientCard>
    </AppShell>
  );
}

"use client";

import { AppShell } from "@/components/app-shell";
import { GradientCard } from "@/components/gradient-card";
import { GitBranch, Zap, Plus, Settings2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";

export default function WorkflowsPage() {
  const { data: workflows = [], isLoading } = useQuery({
    queryKey: ["workflows"],
    queryFn: async () => {
      const res = await apiClient.get("/workflows");
      return res.data.workflows || [];
    },
  });

  return (
    <AppShell title="الأتمتة ومسارات العمل" subtitle="أنشئ ردود تلقائية وتسلسلات بناءً على كلمات مفتاحية أو أحداث معينة.">
      <div className="space-y-6">
        <div className="flex justify-end">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            إنشاء مسار عمل جديد
          </Button>
        </div>

        <GradientCard>
          <div className="space-y-4">
            {isLoading ? (
              <div className="text-center py-8 text-white/50">جاري التحميل...</div>
            ) : workflows.length === 0 ? (
              <div className="text-center py-12 text-white/50 border border-dashed border-white/10 rounded-3xl bg-white/[0.02]">
                <GitBranch className="h-8 w-8 mx-auto mb-3 text-white/20" />
                لا توجد مسارات عمل مفعّلة حالياً.
              </div>
            ) : (
              workflows.map((wf: any) => (
                <div key={wf.id} className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-white/10 bg-white/5 p-5 transition hover:bg-white/10">
                  <div className="flex items-center gap-4">
                    <div className="grid h-12 w-12 place-items-center rounded-2xl bg-emeraldx-500/10 text-emeraldx-400">
                      <Zap className="h-6 w-6" />
                    </div>
                    <div>
                      <div className="font-semibold text-white">{wf.name}</div>
                      <div className="text-xs text-white/50 mt-1">المحفز: {wf.trigger} • {wf.steps_count} خطوات</div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button className="rounded-full bg-white/10 p-2 text-white/60 hover:bg-white/20 hover:text-white">
                      <Settings2 className="h-4 w-4" />
                    </button>
                    <button className="rounded-full bg-red-500/10 p-2 text-red-400 hover:bg-red-500 hover:text-white">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
            
            {/* Mock Data for visual demonstration since API might be empty */}
            {workflows.length === 0 && (
              <>
                <div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-white/10 bg-white/5 p-5">
                  <div className="flex items-center gap-4">
                    <div className="grid h-12 w-12 place-items-center rounded-2xl bg-amber-500/10 text-amber-400">
                      <Zap className="h-6 w-6" />
                    </div>
                    <div>
                      <div className="font-semibold text-white flex items-center gap-2">
                        رسالة الترحيب الأولى 
                        <span className="bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full text-[10px]">جاهز كعينة</span>
                      </div>
                      <div className="text-xs text-white/50 mt-1">المحفز: أول رسالة من العميل • خطوتين</div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <div className="bg-emeraldx-500/20 text-emeraldx-400 px-3 py-1.5 rounded-full text-xs font-semibold">مفعّل</div>
                  </div>
                </div>
              </>
            )}
          </div>
        </GradientCard>
      </div>
    </AppShell>
  );
}

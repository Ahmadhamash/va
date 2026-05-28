"use client";

import { useState, useEffect } from "react";
import { Clock3, MessageCircle, TrendingUp, UserCheck, Calendar, Zap, Heart, ShieldAlert, Award, Loader2 } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { GradientCard } from "@/components/gradient-card";
import { MetricCard } from "@/components/metric-card";
import { useAuthStore } from "@/store/use-auth-store";
import { cn } from "@/lib/utils";

export default function AnalyticsPage() {
  const [analyticsData, setAnalyticsData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { token } = useAuthStore();

  useEffect(() => {
    async function loadAnalytics() {
      if (!token) return;
      try {
        const res = await fetch("/api/analytics", {
          headers: { Authorization: "Bearer " + token }
        });
        const data = await res.json();
        if (data.ok && data.analytics) {
          setAnalyticsData(data.analytics);
        }
      } catch (err) {
        console.error("Failed to load analytics", err);
      } finally {
        setLoading(false);
      }
    }
    loadAnalytics();
  }, [token]);

  if (loading) {
    return (
      <AppShell title="التحليلات والأداء" subtitle="بيانات وإحصائيات فورية توضح فاعلية الذكاء الاصطناعي وتوفير الجهد البشري.">
        <div className="flex h-96 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-emeraldx-400" />
        </div>
      </AppShell>
    );
  }

  // Fallback if data is unavailable
  const data = analyticsData || {
    conversations: 0,
    aiResolved: 0,
    aiRate: "0%",
    handoffs: 0,
    avgResponseTime: "0 ث",
    deflectionCount: "0 رسالة موفرة",
    dailyStats: [{ name: "اليوم", value: 0 }],
    mostAsked: [{ topic: "لا توجد أسئلة كافية", count: 0, percentage: 0 }],
    channelMix: [{ name: "لا توجد قنوات نشطة", value: 0, count: 0 }],
    sentiment: { positive: 100, neutral: 0, negative: 0 },
    handoffReasons: [{ reason: "لا توجد تحويلات", value: 0 }]
  };

  const maxDailyValue = Math.max(...data.dailyStats.map((d: any) => d.value));

  return (
    <AppShell title="التحليلات والأداء" subtitle="بيانات وإحصائيات فورية حقيقية 100% من واقع محادثات وجلسات النظام الفعلية.">
      <div className="space-y-6">
        {/* Date Selector Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 bg-white/[0.02] border border-white/5 p-3 rounded-3xl">
          <div className="flex items-center gap-2 text-white/50 text-xs text-right md:order-last">
            <Calendar className="h-4 w-4" />
            <span>نطاق التحليل النشط (بيانات حية ومباشرة)</span>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              className="rounded-full px-4 py-2 text-xs font-semibold bg-emeraldx-500 text-ink-950 shadow-glow"
            >
              قاعدة البيانات الحالية
            </button>
          </div>
        </div>

        {/* Metric Cards Grid */}
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="إجمالي المحادثات" value={data.conversations.toLocaleString()} hint="مستمر" icon={MessageCircle} />
          <MetricCard label="حُلت تلقائياً بالذكاء" value={data.aiResolved.toLocaleString()} hint={data.aiRate} icon={Zap} />
          <MetricCard label="التحويل للموظفين" value={data.handoffs.toLocaleString()} hint="نشط" icon={UserCheck} />
          <MetricCard label="سرعة استجابة الوكيل" value={data.avgResponseTime} hint="فوري" icon={Clock3} />
        </div>

        {/* Detailed Metrics Charts & Statistics */}
        <div className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
          
          {/* Main Chart Column: Peak Hours or Daily Volume */}
          <div className="space-y-6">
            <GradientCard className="rounded-3xl border border-white/10 bg-white/[0.025]">
              <div className="mb-6 flex items-center justify-between">
                <div className="text-right">
                  <h2 className="text-lg font-bold text-white">نشاط وحجم المحادثات الفعلي</h2>
                  <p className="mt-1 text-xs text-white/45">مخطط بياني حقيقي يمثل المحادثات مقسمة حسب أيام الأسبوع.</p>
                </div>
                <TrendingUp className="h-5 w-5 text-emeraldx-400" />
              </div>
              
              {/* Premium Bar Chart Graphic */}
              <div className="flex h-64 items-end justify-between gap-3 pt-6 px-4 border-b border-white/5">
                {data.dailyStats.map((item: any) => {
                  const percentage = maxDailyValue > 0 ? (item.value / maxDailyValue) * 100 : 0;
                  return (
                    <div key={item.name} className="flex flex-col items-center flex-1 group">
                      <div className="relative w-full flex justify-center">
                        {/* Hover Tooltip */}
                        <div className="absolute bottom-full mb-2 bg-emeraldx-500 text-ink-950 text-[10px] font-bold px-2 py-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap shadow-glow">
                          {item.value} محادثة
                        </div>
                      </div>
                      <div className="w-full bg-white/5 rounded-t-xl overflow-hidden h-44 flex items-end">
                        <div
                          className="w-full bg-gradient-to-t from-cyanx-400 to-emeraldx-400 group-hover:from-cyanx-300 group-hover:to-emeraldx-300 transition-all duration-500 rounded-t-xl"
                          style={{ height: `${percentage || 5}%` }}
                        />
                      </div>
                      <span className="text-[11px] text-white/50 mt-3 text-center truncate w-full">{item.name}</span>
                    </div>
                  );
                })}
              </div>
            </GradientCard>

            {/* AI Performance Insight Cards */}
            <div className="grid gap-6 md:grid-cols-2">
              <GradientCard className="rounded-3xl border border-white/10 bg-white/[0.025] text-right">
                <div className="flex items-center gap-2 justify-end mb-4">
                  <span className="font-bold text-sm text-white">تحليل رضا العملاء (CSAT)</span>
                  <Heart className="h-4.5 w-4.5 text-red-400 animate-pulse" />
                </div>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-xs mb-1.5">
                      <span className="text-white/40">إيجابي ({data.sentiment.positive}%)</span>
                      <span className="text-emeraldx-400 font-bold">راضي ومستفيد</span>
                    </div>
                    <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                      <div className="h-full bg-emeraldx-500 rounded-full" style={{ width: `${data.sentiment.positive}%` }} />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-xs mb-1.5">
                      <span className="text-white/40">محايد ({data.sentiment.neutral}%)</span>
                      <span className="text-amber-400 font-bold">طبيعي</span>
                    </div>
                    <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                      <div className="h-full bg-amber-500 rounded-full" style={{ width: `${data.sentiment.neutral}%` }} />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-xs mb-1.5">
                      <span className="text-white/40">سلبي ({data.sentiment.negative}%)</span>
                      <span className="text-red-400 font-bold">بحاجة لمتابعة</span>
                    </div>
                    <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                      <div className="h-full bg-red-500 rounded-full" style={{ width: `${data.sentiment.negative}%` }} />
                    </div>
                  </div>
                </div>
              </GradientCard>

              <GradientCard className="rounded-3xl border border-white/10 bg-white/[0.025] text-right">
                <div className="flex items-center gap-2 justify-end mb-4">
                  <span className="font-bold text-sm text-white">أسباب تحويل العملاء الأكثر شيوعاً</span>
                  <ShieldAlert className="h-4.5 w-4.5 text-amber-400" />
                </div>
                <div className="space-y-3">
                  {data.handoffReasons.map((item: any, index: number) => (
                    <div key={index} className="flex items-center justify-between text-xs border-b border-white/5 pb-2 last:border-0 last:pb-0">
                      <span className="font-bold text-white">{item.value}%</span>
                      <span className="text-white/60">{item.reason}</span>
                    </div>
                  ))}
                </div>
              </GradientCard>
            </div>
          </div>

          {/* Right Info Column: Top Questions & Channel Breakdown */}
          <div className="space-y-6">
            
            {/* Top Questions Card */}
            <GradientCard className="rounded-3xl border border-white/10 bg-white/[0.025]">
              <h2 className="text-lg font-bold text-white text-right">المواضيع والأسئلة الأكثر شيوعاً</h2>
              <p className="text-[11px] text-white/45 text-right mt-1">الأسئلة التي قادت لتحويل بشري وقاعدة البيانات ترصدها.</p>
              <div className="mt-5 space-y-3">
                {data.mostAsked.map((item: any) => (
                  <div key={item.topic} className="flex items-center justify-between rounded-2xl bg-white/[0.035] border border-white/5 px-4 py-3 text-right">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-white/35">({item.count} محادثة)</span>
                      <span className="text-xs font-semibold text-emeraldx-400">%{item.percentage}</span>
                    </div>
                    <span className="text-xs text-white/80 font-medium">{item.topic}</span>
                  </div>
                ))}
              </div>
            </GradientCard>

            {/* Channels Card */}
            <GradientCard className="rounded-3xl border border-white/10 bg-white/[0.025]">
              <h2 className="text-lg font-bold text-white text-right">توزيع القنوات المتصلة</h2>
              <p className="text-[11px] text-white/45 text-right mt-1">نسبة المحادثات الفعلية القادمة من القنوات المختلفة المتصلة.</p>
              <div className="mt-5 space-y-4">
                {data.channelMix.map((item: any) => (
                  <div key={item.name} className="text-right">
                    <div className="mb-2 flex items-center justify-between text-xs">
                      <span className="text-white/40">({item.count} محادثة)</span>
                      <span className="font-semibold text-white">{item.name} · {item.value}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-white/5">
                      <div className="h-full rounded-full bg-gradient-to-l from-violetrx-500 to-emeraldx-400" style={{ width: `${item.value}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </GradientCard>

            {/* AI report summary */}
            <div className="rounded-3xl border border-emeraldx-400/10 bg-emeraldx-500/5 p-5 text-right flex items-start gap-3">
              <div className="flex-1">
                <h4 className="text-xs font-bold text-emeraldx-400 flex items-center justify-end gap-1.5 mb-1">
                  <span>تقرير كفاءة الوكيل</span>
                  <Award className="h-4 w-4" />
                </h4>
                <p className="text-[11px] leading-5 text-white/60">
                  حقق الوكيل الذكي وفراً حقيقياً بنسبة تعادل <b>{data.aiRate}</b> من إجمالي عبء خدمة العملاء، معالِجاً <b>{data.deflectionCount}</b> وتوفيرها على فريق الدعم البشري.
                </p>
              </div>
            </div>

          </div>

        </div>
      </div>
    </AppShell>
  );
}

"use client";

import { useState, useEffect } from "react";
import { Clock3, MessageCircle, TrendingUp, UserCheck, Calendar, Zap, Heart, ShieldAlert, Award, Loader2 } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { GradientCard } from "@/components/gradient-card";
import { MetricCard } from "@/components/metric-card";
import { useAuthStore } from "@/store/use-auth-store";
import { cn } from "@/lib/utils";
import { useLanguageStore } from "@/store/use-language-store";

export default function AnalyticsPage() {
  const [analyticsData, setAnalyticsData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { token } = useAuthStore();
  const language = useLanguageStore((state) => state.language);
  const isRtl = language === "ar";

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
      <AppShell 
        title={isRtl ? "التحليلات والأداء" : "Analytics & Performance"} 
        subtitle={isRtl ? "بيانات وإحصائيات فورية توضح فاعلية الذكاء الاصطناعي وتوفير الجهد البشري." : "Live metrics that show AI effectiveness and saved human effort."}
      >
        <div className="flex h-96 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary-400" />
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
    avgResponseTime: isRtl ? "0 ث" : "0 s",
    deflectionCount: isRtl ? "0 رسالة موفرة" : "0 saved messages",
    dailyStats: [{ name: isRtl ? "اليوم" : "Today", value: 0 }],
    mostAsked: [{ topic: isRtl ? "لا توجد أسئلة كافية" : "Not enough questions yet", count: 0, percentage: 0 }],
    channelMix: [{ name: isRtl ? "لا توجد قنوات نشطة" : "No active channels", value: 0, count: 0 }],
    sentiment: { positive: 100, neutral: 0, negative: 0 },
    handoffReasons: [{ reason: isRtl ? "لا توجد تحويلات" : "No handoffs yet", value: 0 }]
  };

  const maxDailyValue = Math.max(...data.dailyStats.map((d: any) => d.value));

  return (
    <AppShell 
      title={isRtl ? "التحليلات والأداء" : "Analytics & Performance"} 
      subtitle={isRtl ? "بيانات وإحصائيات فورية حقيقية 100% من واقع محادثات وجلسات النظام الفعلية." : "100% real-time statistics from actual conversations and system sessions."}
    >
      <div className="space-y-6 rtl:text-right ltr:text-left">
        {/* Date Selector Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 bg-white/[0.02] border border-white/5 p-3 rounded-3xl">
          <div className="flex items-center gap-2 text-white/50 text-xs rtl:text-right ltr:text-left order-first md:order-last">
            <Calendar className="h-4 w-4" />
            <span>{isRtl ? "نطاق التحليل النشط (بيانات حية ومباشرة)" : "Active analysis range (live data)"}</span>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              className="rounded-full px-4 py-2 text-xs font-semibold bg-primary-500 text-ink-950 shadow-glow"
            >
              {isRtl ? "قاعدة البيانات الحالية" : "Current Database"}
            </button>
          </div>
        </div>

        {/* Metric Cards Grid */}
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard label={isRtl ? "إجمالي المحادثات" : "Total Conversations"} value={data.conversations.toLocaleString()} hint={isRtl ? "مستمر" : "Ongoing"} icon={MessageCircle} />
          <MetricCard label={isRtl ? "حُلت تلقائياً بالذكاء" : "Auto-resolved by AI"} value={data.aiResolved.toLocaleString()} hint={data.aiRate} icon={Zap} />
          <MetricCard label={isRtl ? "التحويل للموظفين" : "Handoff to Staff"} value={data.handoffs.toLocaleString()} hint={isRtl ? "نشط" : "Active"} icon={UserCheck} />
          <MetricCard label={isRtl ? "سرعة استجابة الوكيل" : "Agent Response Time"} value={data.avgResponseTime} hint={isRtl ? "فوري" : "Instant"} icon={Clock3} />
        </div>

        {/* Detailed Metrics Charts & Statistics */}
        <div className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
          
          {/* Main Chart Column: Peak Hours or Daily Volume */}
          <div className="space-y-6">
            <GradientCard className="rounded-3xl border border-white/10 bg-white/[0.025]">
              <div className="mb-6 flex items-center justify-between">
                <div className="rtl:text-right ltr:text-left">
                  <h2 className="text-lg font-bold text-white">{isRtl ? "نشاط وحجم المحادثات الفعلي" : "Actual Chat Volume & Activity"}</h2>
                  <p className="mt-1 text-xs text-white/45">{isRtl ? "مخطط بياني حقيقي يمثل المحادثات مقسمة حسب أيام الأسبوع." : "Real-time chart representing chats grouped by days of the week."}</p>
                </div>
                <TrendingUp className="h-5 w-5 text-primary-400" />
              </div>
              
              {/* Premium Bar Chart Graphic */}
              <div className="flex h-64 items-end justify-between gap-3 pt-6 px-4 border-b border-white/5">
                {data.dailyStats.map((item: any) => {
                  const percentage = maxDailyValue > 0 ? (item.value / maxDailyValue) * 100 : 0;
                  return (
                    <div key={item.name} className="flex flex-col items-center flex-1 group">
                      <div className="relative w-full flex justify-center">
                        {/* Hover Tooltip */}
                        <div className="absolute bottom-full mb-2 bg-primary-500 text-ink-950 text-[10px] font-bold px-2 py-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap shadow-glow">
                          {item.value} {isRtl ? "محادثة" : "chats"}
                        </div>
                      </div>
                      <div className="w-full bg-white/5 rounded-t-xl overflow-hidden h-44 flex items-end">
                        <div
                          className="w-full bg-gradient-to-t from-cyanx-400 to-primary-400 group-hover:from-cyanx-300 group-hover:to-primary-300 transition-all duration-500 rounded-t-xl"
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
              <GradientCard className="rounded-3xl border border-white/10 bg-white/[0.025] rtl:text-right ltr:text-left">
                <div className="flex items-center gap-2 justify-end mb-4 rtl:justify-end ltr:justify-start">
                  <span className="font-bold text-sm text-white">{isRtl ? "تحليل رضا العملاء (CSAT)" : "Customer Satisfaction (CSAT)"}</span>
                  <Heart className="h-4.5 w-4.5 text-red-400 animate-pulse" />
                </div>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-xs mb-1.5">
                      <span className="text-white/40">{isRtl ? `إيجابي (${data.sentiment.positive}%)` : `Positive (${data.sentiment.positive}%)`}</span>
                      <span className="text-primary-400 font-bold">{isRtl ? "راضي ومستفيد" : "Satisfied"}</span>
                    </div>
                    <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                      <div className="h-full bg-primary-500 rounded-full" style={{ width: `${data.sentiment.positive}%` }} />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-xs mb-1.5">
                      <span className="text-white/40">{isRtl ? `محايد (${data.sentiment.neutral}%)` : `Neutral (${data.sentiment.neutral}%)`}</span>
                      <span className="text-amber-400 font-bold">{isRtl ? "طبيعي" : "Neutral"}</span>
                    </div>
                    <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                      <div className="h-full bg-amber-500 rounded-full" style={{ width: `${data.sentiment.neutral}%` }} />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-xs mb-1.5">
                      <span className="text-white/40">{isRtl ? `سلبي (${data.sentiment.negative}%)` : `Negative (${data.sentiment.negative}%)`}</span>
                      <span className="text-red-400 font-bold">{isRtl ? "بحاجة لمتابعة" : "Needs Attention"}</span>
                    </div>
                    <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                      <div className="h-full bg-red-500 rounded-full" style={{ width: `${data.sentiment.negative}%` }} />
                    </div>
                  </div>
                </div>
              </GradientCard>

              <GradientCard className="rounded-3xl border border-white/10 bg-white/[0.025] rtl:text-right ltr:text-left">
                <div className="flex items-center gap-2 justify-end mb-4 rtl:justify-end ltr:justify-start">
                  <span className="font-bold text-sm text-white">{isRtl ? "أسباب تحويل العملاء الأكثر شيوعاً" : "Most Common Handoff Reasons"}</span>
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
              <h2 className="text-lg font-bold text-white rtl:text-right ltr:text-left">{isRtl ? "المواضيع والأسئلة الأكثر شيوعاً" : "Most Frequently Asked Topics"}</h2>
              <p className="text-[11px] text-white/45 rtl:text-right ltr:text-left mt-1">{isRtl ? "الأسئلة التي قادت لتحويل بشري وقاعدة البيانات ترصدها." : "Questions that led to human handoff monitored by the system."}</p>
              <div className="mt-5 space-y-3">
                {data.mostAsked.map((item: any) => (
                  <div key={item.topic} className="flex items-center justify-between rounded-2xl bg-white/[0.035] border border-white/5 px-4 py-3 rtl:text-right ltr:text-left">
                    <div className="flex items-center gap-1.5 order-last md:order-first">
                      <span className="text-[10px] text-white/35">({item.count} {isRtl ? "محادثة" : "chats"})</span>
                      <span className="text-xs font-semibold text-primary-400">%{item.percentage}</span>
                    </div>
                    <span className="text-xs text-white/80 font-medium">{item.topic}</span>
                  </div>
                ))}
              </div>
            </GradientCard>

            {/* Channels Card */}
            <GradientCard className="rounded-3xl border border-white/10 bg-white/[0.025]">
              <h2 className="text-lg font-bold text-white rtl:text-right ltr:text-left">{isRtl ? "توزيع القنوات المتصلة" : "Connected Channels Breakdown"}</h2>
              <p className="text-[11px] text-white/45 rtl:text-right ltr:text-left mt-1">{isRtl ? "نسبة المحادثات الفعلية القادمة من القنوات المختلفة المتصلة." : "Percentage of actual conversations coming from connected channels."}</p>
              <div className="mt-5 space-y-4">
                {data.channelMix.map((item: any) => (
                  <div key={item.name} className="rtl:text-right ltr:text-left">
                    <div className="mb-2 flex items-center justify-between text-xs">
                      <span className="text-white/40">({item.count} {isRtl ? "محادثة" : "chats"})</span>
                      <span className="font-semibold text-white">{item.name} · {item.value}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-white/5">
                      <div className="h-full rounded-full bg-gradient-to-l from-violetrx-500 to-primary-400" style={{ width: `${item.value}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </GradientCard>

            {/* AI report summary */}
            <div className="rounded-3xl border border-primary-400/10 bg-primary-500/5 p-5 rtl:text-right ltr:text-left flex items-start gap-3">
              <div className="flex-1 rtl:text-right ltr:text-left">
                <h4 className="text-xs font-bold text-primary-400 flex items-center justify-end gap-1.5 mb-1 rtl:justify-end ltr:justify-start">
                  <span>{isRtl ? "تقرير كفاءة الوكيل" : "Agent Efficiency Report"}</span>
                  <Award className="h-4 w-4" />
                </h4>
                <p className="text-[11px] leading-5 text-white/60">
                  {isRtl ? (
                    <>
                      حقق الوكيل الذكي وفراً حقيقياً بنسبة تعادل <b>{data.aiRate}</b> من إجمالي عبء خدمة العملاء، معالِجاً <b>{data.deflectionCount}</b> وتوفيرها على فريق الدعم البشري.
                    </>
                  ) : (
                    <>
                      The smart agent achieved a real savings of <b>{data.aiRate}</b> of the total customer service load, processing <b>{data.deflectionCount}</b> and saving them for the human support team.
                    </>
                  )}
                </p>
              </div>
            </div>

          </div>

        </div>
      </div>
    </AppShell>
  );
}


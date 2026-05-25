import { BarChart3, Clock3, MessageCircle, TrendingUp, UserCheck } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { GradientCard } from "@/components/gradient-card";
import { MetricCard } from "@/components/metric-card";
const analyticsData = {
  conversationsToday: 184,
  aiResolved: 137,
  handoffs: 16,
  avgResponseTime: "3.9 ث",
  peakHours: [
    { hour: "10 ص", conversations: 18 },
    { hour: "12 م", conversations: 31 },
    { hour: "2 م", conversations: 22 },
    { hour: "6 م", conversations: 42 },
    { hour: "9 م", conversations: 35 }
  ],
  mostAsked: ["الأسعار", "طريقة الربط", "إنستغرام DM", "التحويل البشري"],
  channelMix: [
    { name: "واتساب", value: 68 },
    { name: "فيسبوك", value: 22 },
    { name: "إنستغرام", value: 10 }
  ]
};

export default function AnalyticsPage() {
  const max = Math.max(...analyticsData.peakHours.map((item) => item.conversations));
  return (
    <AppShell title="التحليلات" subtitle="أرقام سهلة تفهم منها أداء خدمة العملاء بدون تعقيد.">
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="محادثات اليوم" value={String(analyticsData.conversationsToday)} hint="+24%" icon={MessageCircle} />
          <MetricCard label="حلها الذكاء" value={String(analyticsData.aiResolved)} hint="74%" icon={BarChart3} />
          <MetricCard label="تحويل بشري" value={String(analyticsData.handoffs)} hint="آمن" icon={UserCheck} />
          <MetricCard label="متوسط الرد" value={analyticsData.avgResponseTime} hint="سريع" icon={Clock3} />
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <GradientCard>
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-white">أوقات الذروة</h2>
                <p className="mt-1 text-sm text-white/45">بيانات تجريبية لعرض شكل التحليلات.</p>
              </div>
              <TrendingUp className="h-5 w-5 text-emeraldx-400" />
            </div>
            <div className="space-y-4">
              {analyticsData.peakHours.map((item) => (
                <div key={item.hour} className="grid grid-cols-[58px_1fr_44px] items-center gap-3">
                  <span className="text-sm text-white/48">{item.hour}</span>
                  <div className="h-3 rounded-full bg-white/8">
                    <div
                      className="h-full rounded-full bg-gradient-to-l from-emeraldx-500 to-cyanx-400"
                      style={{ width: `${(item.conversations / max) * 100}%` }}
                    />
                  </div>
                  <span className="text-sm font-semibold text-white">{item.conversations}</span>
                </div>
              ))}
            </div>
          </GradientCard>

          <div className="space-y-6">
            <GradientCard>
              <h2 className="text-xl font-semibold text-white">أكثر الأسئلة</h2>
              <div className="mt-5 space-y-3">
                {analyticsData.mostAsked.map((question, index) => (
                  <div key={question} className="flex items-center justify-between rounded-3xl bg-white/[0.055] px-4 py-3">
                    <span className="text-sm text-white/68">{question}</span>
                    <span className="text-xs font-semibold text-emeraldx-400">#{index + 1}</span>
                  </div>
                ))}
              </div>
            </GradientCard>

            <GradientCard>
              <h2 className="text-xl font-semibold text-white">توزيع القنوات</h2>
              <div className="mt-5 space-y-4">
                {analyticsData.channelMix.map((item) => (
                  <div key={item.name}>
                    <div className="mb-2 flex items-center justify-between text-sm">
                      <span className="text-white/65">{item.name}</span>
                      <span className="font-semibold text-white">{item.value}%</span>
                    </div>
                    <div className="h-3 rounded-full bg-white/8">
                      <div className="h-full rounded-full bg-gradient-to-l from-violetrx-500 to-emeraldx-500" style={{ width: `${item.value}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </GradientCard>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

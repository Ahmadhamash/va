import { ArrowLeft, CircleCheck, Facebook, Instagram, MessageCircle, ShieldCheck, Webhook, Code, Trash2, Plus } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { GradientCard } from "@/components/gradient-card";
import { StatusBadge } from "@/components/status-badge";
import type { ChannelConnection, ChannelProvider } from "@/lib/types";

const channelIcons: Record<string, typeof MessageCircle> = {
  WHATSAPP: MessageCircle,
  FACEBOOK: Facebook,
  MESSENGER: Facebook,
  INSTAGRAM: Instagram,
  WEBHOOK: Webhook,
  WIDGET: Code
};

const platformNames: Record<string, string> = {
  WHATSAPP: "واتساب",
  FACEBOOK: "فيسبوك",
  MESSENGER: "ماسنجر",
  INSTAGRAM: "إنستغرام",
  WEBHOOK: "ويب هوك",
  WIDGET: "ويدجت"
};

export function ChannelConnectionCard({
  channels,
  onDelete
}: {
  channels: ChannelConnection[];
  onDelete?: (channelId: string) => void;
}) {
  const connectedCount = channels.filter(c => c.status === "CONNECTED").length;
  const hasChannels = channels.length > 0;

  return (
    <GradientCard className="border-emeraldx-400/20">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="grid h-14 w-14 place-items-center rounded-3xl bg-emeraldx-500 text-ink-950 shadow-glow">
              <MessageCircle className="h-7 w-7" />
            </div>
            <div>
              <div className={`flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-semibold ${connectedCount > 0 ? "bg-emeraldx-500/10 text-emeraldx-400" : "bg-amber-500/10 text-amber-400"}`}>
                <CircleCheck className="h-3 w-3" />
                {connectedCount > 0 ? `${connectedCount} قناة متصلة` : "لا توجد قنوات متصلة"}
              </div>
              <h3 className="text-xl font-semibold text-white">اربط قنوات العملاء</h3>
              <p className="mt-1 max-w-2xl text-sm leading-7 text-white/58">
                واتساب، فيسبوك، وإنستغرام من لوحة واحدة. قم بربط قنواتك الرسمية لتفعيل ردود الوكيل الذكي وإدارة محادثات العملاء.
              </p>
            </div>
          </div>
        </div>
        <Link href="/onboarding">
          <Button>
            <Plus className="h-4 w-4" />
            ابدأ الربط الرسمي
          </Button>
        </Link>
      </div>

      {hasChannels ? (
        <div className="mt-6 grid gap-3 lg:grid-cols-3">
          {channels.map((channel) => {
            const Icon = channelIcons[channel.provider] || MessageCircle;
            const isConfigured = channel.status === "CONNECTED";
            return (
              <div key={channel.id} className={`rounded-3xl border p-4 ${isConfigured ? "border-emeraldx-400/20 bg-emeraldx-500/5" : "border-white/10 bg-white/[0.055]"}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="grid h-11 w-11 place-items-center rounded-2xl bg-white/8 text-emeraldx-400">
                    <Icon className="h-5 w-5" />
                  </div>
                  <StatusBadge status={channel.status} />
                </div>
                <div className="mt-4 text-base font-semibold text-white">
                  {platformNames[channel.provider] || channel.provider}
                </div>
                <div className="mt-1 text-xs text-white/40">
                  {channel.handle}
                </div>
                <div className="mt-4 flex items-center justify-between gap-3 text-xs font-semibold">
                  <span className={`flex items-center gap-1.5 ${isConfigured ? "text-emeraldx-400" : "text-amber-400"}`}>
                    <CircleCheck className="h-3.5 w-3.5" />
                    {isConfigured ? "مفعّل" : "بحاجة إعداد"}
                  </span>
                  <button
                    type="button"
                    onClick={() => onDelete?.(channel.id)}
                    className="rounded-full bg-red-500/10 px-3 py-1.5 text-red-400 transition hover:bg-red-500 hover:text-white"
                    title="حذف القناة"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="mt-6 flex flex-col items-center justify-center rounded-3xl border border-dashed border-white/15 bg-white/[0.025] py-10 text-center">
          <MessageCircle className="h-10 w-10 text-white/20 mb-3" />
          <p className="text-sm text-white/45">لا توجد قنوات مرتبطة حتى الآن</p>
          <p className="mt-1 text-xs text-white/30">اضغط &quot;ابدأ الربط الرسمي&quot; لإضافة أول قناة</p>
        </div>
      )}

      <div className="mt-5 flex flex-wrap gap-3">
        {["رسائل العملاء فقط", "تكامل رسمي قابل للتوصيل", "تحويل بشري عند الحساسية"].map((item) => (
          <div key={item} className="flex items-center gap-2 rounded-2xl bg-white/7 px-3 py-2 text-sm text-white/68">
            <ShieldCheck className="h-4 w-4 text-cyanx-400" />
            {item}
          </div>
        ))}
      </div>
    </GradientCard>
  );
}

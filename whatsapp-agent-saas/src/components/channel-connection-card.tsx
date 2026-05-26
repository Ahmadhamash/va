import { useState } from "react";
import { 
  ArrowLeft, 
  CircleCheck, 
  Facebook, 
  Instagram, 
  MessageCircle, 
  ShieldCheck, 
  Webhook, 
  Code, 
  Trash2, 
  Plus, 
  Copy, 
  ChevronDown, 
  ChevronUp 
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { GradientCard } from "@/components/gradient-card";
import { StatusBadge } from "@/components/status-badge";
import type { ChannelConnection } from "@/lib/types";

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

  const [expandedChannelId, setExpandedChannelId] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const getAbsoluteWebhookUrl = (channel: any) => {
    if (typeof window === "undefined") return "";
    const base = window.location.origin;
    const path = channel.endpoints?.callback_url || `/api/webhooks/meta/${channel.public_id}`;
    return `${base}${path}`;
  };

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
        <div className="mt-6 space-y-4">
          <div className="grid gap-3 lg:grid-cols-3">
            {channels.map((channel) => {
              const anyChannel = channel as any;
              const Icon = channelIcons[channel.provider] || MessageCircle;
              const isConfigured = channel.status === "CONNECTED";
              const isExpanded = expandedChannelId === channel.id;

              return (
                <div key={channel.id} className="space-y-3">
                  <div className={`rounded-3xl border p-4 transition ${isConfigured ? "border-emeraldx-400/20 bg-emeraldx-500/5" : "border-white/10 bg-white/[0.055]"}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="grid h-11 w-11 place-items-center rounded-2xl bg-white/8 text-emeraldx-400">
                        <Icon className="h-5 w-5" />
                      </div>
                      <StatusBadge status={channel.status} />
                    </div>
                    <div className="mt-4 text-base font-semibold text-white text-right">
                      {platformNames[channel.provider] || channel.provider}
                    </div>
                    <div className="mt-1 text-xs text-white/40 text-right">
                      {anyChannel.credentials?.phone_number_id ? `معرف الرقم: ${anyChannel.credentials.phone_number_id}` : "تم التهيئة ببيانات معتمدة"}
                    </div>
                    <div className="mt-4 flex items-center justify-between gap-3 text-xs font-semibold">
                      <span className={`flex items-center gap-1.5 ${isConfigured ? "text-emeraldx-400" : "text-amber-400"}`}>
                        <CircleCheck className="h-3.5 w-3.5" />
                        {isConfigured ? "مفعّل" : "بحاجة إعداد"}
                      </span>
                      
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setExpandedChannelId(isExpanded ? null : channel.id)}
                          className="rounded-full bg-white/8 px-3 py-1.5 text-white/70 transition hover:bg-white/12 flex items-center gap-1"
                          title="تفاصيل الويب هوك"
                        >
                          {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                          <span>إعدادات الويب هوك</span>
                        </button>
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
                  </div>

                  {/* Webhook Settings Expanded view */}
                  {isExpanded && (
                    <div className="rounded-3xl border border-white/10 bg-white/[0.02] p-4 text-right space-y-3 animate-in fade-in duration-200">
                      <div className="text-xs font-bold text-white/80">تفاصيل الويب هوك لـ Meta Developers:</div>
                      
                      <div className="space-y-1">
                        <span className="text-[10px] text-white/40 block">Callback URL (رابط الاستقبال)</span>
                        <div className="flex items-center justify-between rounded-xl bg-black/20 border border-white/5 px-2.5 py-1.5 text-[11px] font-mono">
                          <button
                            type="button"
                            onClick={() => handleCopy(getAbsoluteWebhookUrl(anyChannel), channel.id + "_url")}
                            className="text-cyanx-400 hover:text-cyanx-300 text-[9px] font-bold"
                          >
                            {copiedKey === channel.id + "_url" ? "✓ تم النسخ" : "نسخ"}
                          </button>
                          <span className="text-white/70 select-all overflow-x-auto whitespace-nowrap scrollbar-none">{getAbsoluteWebhookUrl(anyChannel)}</span>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <span className="text-[10px] text-white/40 block">Verify Token (رمز التحقق)</span>
                        <div className="flex items-center justify-between rounded-xl bg-black/20 border border-white/5 px-2.5 py-1.5 text-[11px] font-mono">
                          <button
                            type="button"
                            onClick={() => handleCopy(anyChannel.credentials?.verify_token || "verify_token", channel.id + "_token")}
                            className="text-cyanx-400 hover:text-cyanx-300 text-[9px] font-bold"
                          >
                            {copiedKey === channel.id + "_token" ? "✓ تم النسخ" : "نسخ"}
                          </button>
                          <span className="text-white/70 select-all">{anyChannel.credentials?.verify_token || "verify_token"}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
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

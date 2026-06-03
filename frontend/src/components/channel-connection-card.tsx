import { useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Code,
  Copy,
  ExternalLink,
  Facebook,
  Instagram,
  MessageCircle,
  Plus,
  ShieldCheck,
  Trash2,
  Webhook,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { GradientCard } from "@/components/gradient-card";
import { StatusBadge } from "@/components/status-badge";
import type { ChannelConnection } from "@/lib/types";
import { useAuthStore } from "@/store/use-auth-store";

const channelIcons: Record<string, typeof MessageCircle> = {
  WHATSAPP: MessageCircle,
  FACEBOOK: Facebook,
  MESSENGER: Facebook,
  INSTAGRAM: Instagram,
  WEBHOOK: Webhook,
  WIDGET: Code,
};

const platformNames: Record<string, string> = {
  WHATSAPP: "واتساب",
  FACEBOOK: "فيسبوك",
  MESSENGER: "Messenger",
  INSTAGRAM: "Instagram",
  WEBHOOK: "Webhook",
  WIDGET: "Widget",
};

const directConnectCards = [
  {
    platform: "messenger",
    title: "Facebook Messenger",
    description: "اربط الصفحة من Meta OAuth ونجهز التوكن والويبهوك قدر الإمكان.",
    icon: Facebook,
  },
  {
    platform: "instagram",
    title: "Instagram",
    description: "اربط حساب Instagram Professional المرتبط بصفحة فيسبوك.",
    icon: Instagram,
  },
] as const;

function endpointUrl(channel: any) {
  if (typeof window === "undefined") return "";
  const endpoints = channel.endpoints || {};
  const path =
    endpoints.callback_url ||
    endpoints.inbound_url ||
    endpoints.message_url ||
    endpoints.script_url ||
    `/api/webhooks/meta/${channel.public_id}`;
  return `${window.location.origin}${path}`;
}

export function ChannelConnectionCard({
  channels,
  onDelete,
}: {
  channels: ChannelConnection[];
  onDelete?: (channelId: string) => void;
}) {
  const token = useAuthStore((s) => s.token);
  const [expandedChannelId, setExpandedChannelId] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [connectingPlatform, setConnectingPlatform] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "ok" | "warn"; text: string } | null>(null);

  const connectedCount = useMemo(
    () => channels.filter((channel) => channel.status === "CONNECTED").length,
    [channels],
  );

  const handleCopy = async (text: string, key: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const startMetaOAuth = async (platform: "messenger" | "instagram") => {
    if (!token) return;
    setConnectingPlatform(platform);
    setMessage(null);
    try {
      const res = await fetch(`/api/integrations/meta/start?platform=${platform}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.detail || data.error || "تعذر بدء الربط المباشر.");
      }
      if (!data.configured) {
        setMessage({
          type: "warn",
          text:
            data.reason ||
            "ربط Meta المباشر يحتاج META_APP_ID و META_APP_SECRET و redirect URI عام. الخيار اليدوي جاهز تحت.",
        });
        return;
      }
      window.location.href = data.auth_url;
    } catch (error) {
      setMessage({
        type: "warn",
        text: error instanceof Error ? error.message : "صار خطأ أثناء تجهيز ربط Meta.",
      });
    } finally {
      setConnectingPlatform(null);
    }
  };

  return (
    <GradientCard className="border-emeraldx-400/20">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="grid h-14 w-14 place-items-center rounded-2xl bg-emeraldx-500 text-white shadow-glow">
            <MessageCircle className="h-7 w-7" />
          </div>
          <div className="text-right">
            <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-emeraldx-500/10 px-2 py-1 text-xs font-semibold text-emeraldx-400">
              <CheckCircle2 className="h-3.5 w-3.5" />
              {connectedCount > 0 ? `${connectedCount} قناة متصلة` : "جاهز للربط"}
            </div>
            <h3 className="text-xl font-semibold text-white">قنوات العملاء</h3>
            <p className="mt-1 max-w-2xl text-sm leading-7 text-white/58">
              Messenger و Instagram صار إلهم Flow مباشر داخل المنصة قدر ما تسمح Meta. والربط اليدوي باقي موجود لكل قناة.
            </p>
          </div>
        </div>

        <Link href="/onboarding">
          <Button>
            <Plus className="h-4 w-4" />
            ربط يدوي
          </Button>
        </Link>
      </div>

      <div className="mt-6 grid gap-3 md:grid-cols-2">
        {directConnectCards.map((card) => {
          const Icon = card.icon;
          const isLoading = connectingPlatform === card.platform;
          return (
            <div key={card.platform} className="rounded-2xl border border-white/10 bg-white/[0.045] p-4 text-right">
              <div className="flex items-start justify-between gap-3">
                <div className="grid h-11 w-11 place-items-center rounded-2xl bg-emeraldx-500/12 text-emeraldx-400">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold text-white">{card.title}</h4>
                  <p className="mt-1 text-xs leading-6 text-white/50">{card.description}</p>
                </div>
              </div>
              <Button
                type="button"
                size="sm"
                className="mt-4 w-full"
                disabled={isLoading}
                onClick={() => startMetaOAuth(card.platform)}
              >
                <ExternalLink className="h-4 w-4" />
                {isLoading ? "جاري التجهيز..." : "ربط مباشر من Meta"}
              </Button>
            </div>
          );
        })}
      </div>

      {message && (
        <div
          className={`mt-4 flex items-start gap-3 rounded-2xl border px-4 py-3 text-right text-sm ${
            message.type === "ok"
              ? "border-emeraldx-400/20 bg-emeraldx-500/10 text-emeraldx-400"
              : "border-amber-400/20 bg-amber-500/10 text-amber-300"
          }`}
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{message.text}</span>
        </div>
      )}

      <div className="mt-6 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm text-white/45">الإعداد اليدوي والقنوات الحالية</span>
          <span className="text-xs text-white/32">WhatsApp / Messenger / Instagram / Widget / Webhook</span>
        </div>

        {channels.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/15 bg-white/[0.025] py-10 text-center">
            <MessageCircle className="mb-3 h-10 w-10 text-white/20" />
            <p className="text-sm text-white/45">لسه ما في قنوات مربوطة.</p>
            <p className="mt-1 text-xs text-white/30">استخدم الربط المباشر، أو افتح الربط اليدوي لإضافة قناة.</p>
          </div>
        ) : (
          <div className="grid gap-3 lg:grid-cols-3">
            {channels.map((channel) => {
              const anyChannel = channel as any;
              const Icon = channelIcons[channel.provider] || MessageCircle;
              const isExpanded = expandedChannelId === channel.id;
              const verifyToken = anyChannel.credentials?.verify_token || "verify_token";
              const url = endpointUrl(anyChannel);

              return (
                <div key={channel.id} className="space-y-3">
                  <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="grid h-11 w-11 place-items-center rounded-2xl bg-white/8 text-emeraldx-400">
                        <Icon className="h-5 w-5" />
                      </div>
                      <StatusBadge status={channel.status} />
                    </div>

                    <div className="mt-4 text-right">
                      <div className="text-base font-semibold text-white">
                        {platformNames[channel.provider] || channel.provider}
                      </div>
                      <div className="mt-1 text-xs text-white/40">
                        {anyChannel.configured_keys?.length
                          ? `${anyChannel.configured_keys.length} إعداد محفوظ`
                          : "بانتظار بيانات الربط"}
                      </div>
                    </div>

                    <div className="mt-4 flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => setExpandedChannelId(isExpanded ? null : channel.id)}
                        className="inline-flex items-center gap-1 rounded-full bg-white/8 px-3 py-1.5 text-xs font-semibold text-white/70 transition hover:bg-white/12"
                      >
                        {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                        الإعدادات
                      </button>
                      <button
                        type="button"
                        onClick={() => onDelete?.(channel.id)}
                        className="rounded-full bg-red-500/10 px-3 py-1.5 text-red-400 transition hover:bg-red-500 hover:text-white"
                        aria-label="حذف القناة"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.025] p-4 text-right">
                      <div className="text-xs font-bold text-white/80">
                        {channel.provider === "WIDGET" ? "تفاصيل تركيب الـ Widget" : "تفاصيل الويبهوك"}
                      </div>

                      <div className="space-y-1">
                        <span className="block text-[11px] text-white/40">الرابط</span>
                        <div className="flex items-center gap-2 rounded-xl border border-white/5 bg-black/20 px-2.5 py-2 text-[11px]">
                          <button
                            type="button"
                            onClick={() => handleCopy(url, `${channel.id}_url`)}
                            className="text-cyanx-400 transition hover:text-cyanx-300"
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </button>
                          <span className="min-w-0 flex-1 select-all overflow-x-auto whitespace-nowrap font-mono text-white/70">
                            {copiedKey === `${channel.id}_url` ? "تم النسخ" : url}
                          </span>
                        </div>
                      </div>

                      {channel.provider !== "WEBHOOK" && channel.provider !== "WIDGET" && (
                        <div className="space-y-1">
                          <span className="block text-[11px] text-white/40">Verify Token</span>
                          <div className="flex items-center gap-2 rounded-xl border border-white/5 bg-black/20 px-2.5 py-2 text-[11px]">
                            <button
                              type="button"
                              onClick={() => handleCopy(verifyToken, `${channel.id}_token`)}
                              className="text-cyanx-400 transition hover:text-cyanx-300"
                            >
                              <Copy className="h-3.5 w-3.5" />
                            </button>
                            <span className="min-w-0 flex-1 select-all overflow-x-auto whitespace-nowrap font-mono text-white/70">
                              {copiedKey === `${channel.id}_token` ? "تم النسخ" : verifyToken}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        {["ربط مباشر عند توفر Meta permissions", "خيار يدوي دائم", "تحويل بشري عند الحاجة"].map((item) => (
          <div key={item} className="flex items-center gap-2 rounded-2xl bg-white/7 px-3 py-2 text-sm text-white/68">
            <ShieldCheck className="h-4 w-4 text-cyanx-400" />
            {item}
          </div>
        ))}
      </div>
    </GradientCard>
  );
}

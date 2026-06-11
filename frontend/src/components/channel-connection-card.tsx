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
import { useLanguageStore } from "@/store/use-language-store";

const channelIcons: Record<string, typeof MessageCircle> = {
  WHATSAPP: MessageCircle,
  FACEBOOK: Facebook,
  MESSENGER: Facebook,
  INSTAGRAM: Instagram,
  WEBHOOK: Webhook,
  WIDGET: Code,
};

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
  const language = useLanguageStore((state) => state.language);
  const isRtl = language === "ar";

  const [expandedChannelId, setExpandedChannelId] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [connectingPlatform, setConnectingPlatform] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "ok" | "warn"; text: string } | null>(null);

  const connectedCount = useMemo(
    () => channels.filter((channel) => channel.status === "CONNECTED").length,
    [channels],
  );

  const directConnectCards = useMemo(() => [
    {
      platform: "messenger" as const,
      title: isRtl ? "فيسبوك ماسنجر" : "Facebook Messenger",
      description: isRtl
        ? "اربط الصفحة من Meta OAuth ونجهز التوكن والويبهوك قدر الإمكان."
        : "Connect the page via Meta OAuth to setup token and webhooks automatically.",
      icon: Facebook,
    },
    {
      platform: "instagram" as const,
      title: isRtl ? "إنستغرام" : "Instagram",
      description: isRtl
        ? "اربط حساب Instagram Professional المرتبط بصفحة فيسبوك."
        : "Connect the Instagram Professional account linked to a Facebook page.",
      icon: Instagram,
    },
  ], [isRtl]);

  const platformNames = useMemo<Record<string, string>>(() => ({
    WHATSAPP: isRtl ? "واتساب" : "WhatsApp",
    FACEBOOK: isRtl ? "فيسبوك" : "Facebook",
    MESSENGER: isRtl ? "ماسنجر" : "Messenger",
    INSTAGRAM: isRtl ? "إنستغرام" : "Instagram",
    WEBHOOK: isRtl ? "ويبهوك" : "Webhook",
    WIDGET: isRtl ? "ويدجت موقع" : "Widget",
  }), [isRtl]);

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
        throw new Error(data.detail || data.error || (isRtl ? "تعذر بدء الربط المباشر." : "Could not initialize direct connect."));
      }
      if (!data.configured) {
        setMessage({
          type: "warn",
          text:
            data.reason || (isRtl
              ? "ربط Meta المباشر يحتاج META_APP_ID و META_APP_SECRET و redirect URI عام. الخيار اليدوي جاهز تحت."
              : "Meta Direct Connect requires META_APP_ID, META_APP_SECRET and a public redirect URI. Manual setup is available below."),
        });
        return;
      }
      window.location.href = data.auth_url;
    } catch (error) {
      setMessage({
        type: "warn",
        text: error instanceof Error ? error.message : (isRtl ? "صار خطأ أثناء تجهيز ربط Meta." : "An error occurred during Meta setup."),
      });
    } finally {
      setConnectingPlatform(null);
    }
  };

  const footerItems = useMemo(() => isRtl 
    ? ["ربط مباشر عند توفر Meta permissions", "خيار يدوي دائم", "تحويل بشري عند الحاجة"]
    : ["Direct connect with Meta permissions", "Manual integration fallback", "Human handoff when needed"],
    [isRtl]
  );

  return (
    <GradientCard className="border-primary-400/20">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="grid h-14 w-14 place-items-center rounded-2xl bg-primary-500 text-white shadow-glow">
            <MessageCircle className="h-7 w-7" />
          </div>
          <div className="rtl:text-right ltr:text-left">
            <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-primary-500/10 px-2 py-1 text-xs font-semibold text-primary-400">
              <CheckCircle2 className="h-3.5 w-3.5" />
              {connectedCount > 0 
                ? (isRtl ? `${connectedCount} قنوات متصلة` : `${connectedCount} Connected Channels`) 
                : (isRtl ? "جاهز للربط" : "Ready to Connect")}
            </div>
            <h3 className="text-xl font-semibold text-white">
              {isRtl ? "قنوات العملاء" : "Customer Channels"}
            </h3>
            <p className="mt-1 max-w-2xl text-sm leading-7 text-white/58">
              {isRtl
                ? "Messenger و Instagram صار إلهم Flow مباشر داخل المنصة قدر ما تسمح Meta. والربط اليدوي باقي موجود لكل قناة."
                : "Messenger and Instagram now have a direct Meta flow inside the platform. Webhook manual configuration is still supported."}
            </p>
          </div>
        </div>

        <Link href="/onboarding">
          <Button>
            <Plus className="h-4 w-4" />
            {isRtl ? "ربط يدوي" : "Manual Connection"}
          </Button>
        </Link>
      </div>

      <div className="mt-6 grid gap-3 md:grid-cols-2">
        {directConnectCards.map((card) => {
          const Icon = card.icon;
          const isLoading = connectingPlatform === card.platform;
          return (
            <div key={card.platform} className="rounded-2xl border border-white/10 bg-white/[0.045] p-4 rtl:text-right ltr:text-left">
              <div className="flex items-start gap-3">
                <div className="grid h-11 w-11 place-items-center rounded-2xl bg-primary-500/12 text-primary-400 shrink-0">
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
                {isLoading 
                  ? (isRtl ? "جاري التجهيز..." : "Preparing...") 
                  : (isRtl ? "ربط مباشر من Meta" : "Direct Meta Connection")}
              </Button>
            </div>
          );
        })}
      </div>

      {message && (
        <div
          className={`mt-4 flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm rtl:text-right ltr:text-left ${
            message.type === "ok"
              ? "border-primary-400/20 bg-primary-500/10 text-primary-400"
              : "border-amber-400/20 bg-amber-500/10 text-amber-300"
          }`}
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{message.text}</span>
        </div>
      )}

      <div className="mt-6 space-y-4">
        <div className="flex items-center justify-between gap-3 text-xs sm:text-sm">
          <span className="text-white/45">{isRtl ? "الإعداد اليدوي والقنوات الحالية" : "Manual Setup & Current Channels"}</span>
          <span className="text-[10px] sm:text-xs text-white/32">WhatsApp / Messenger / Instagram / Widget / Webhook</span>
        </div>

        {channels.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/15 bg-white/[0.025] py-10 text-center">
            <MessageCircle className="mb-3 h-10 w-10 text-white/20" />
            <p className="text-sm text-white/45">{isRtl ? "لسه ما في قنوات مربوطة." : "No channels connected yet."}</p>
            <p className="mt-1 text-xs text-white/30">
              {isRtl ? "استخدم الربط المباشر، أو افتح الربط اليدوي لإضافة قناة." : "Use Meta direct connection or configure custom webhooks."}
            </p>
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
                      <div className="grid h-11 w-11 place-items-center rounded-2xl bg-white/8 text-primary-400">
                        <Icon className="h-5 w-5" />
                      </div>
                      <StatusBadge status={channel.status} />
                    </div>

                    <div className="mt-4 rtl:text-right ltr:text-left">
                      <div className="text-base font-semibold text-white">
                        {platformNames[channel.provider] || channel.provider}
                      </div>
                      <div className="mt-1 text-xs text-white/40">
                        {anyChannel.configured_keys?.length
                          ? (isRtl ? `${anyChannel.configured_keys.length} إعداد محفوظ` : `${anyChannel.configured_keys.length} settings configured`)
                          : (isRtl ? "بانتظار بيانات الربط" : "Awaiting credentials")}
                      </div>
                    </div>

                    <div className="mt-4 flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => setExpandedChannelId(isExpanded ? null : channel.id)}
                        className="inline-flex items-center gap-1 rounded-full bg-white/8 px-3 py-1.5 text-xs font-semibold text-white/70 transition hover:bg-white/12"
                      >
                        {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                        {isRtl ? "الإعدادات" : "Settings"}
                      </button>
                      <button
                        type="button"
                        onClick={() => onDelete?.(channel.id)}
                        className="rounded-full bg-red-500/10 px-3 py-1.5 text-red-400 transition hover:bg-red-500 hover:text-white"
                        aria-label={isRtl ? "حذف القناة" : "Delete channel"}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.025] p-4 rtl:text-right ltr:text-left">
                      <div className="text-xs font-bold text-white/80">
                        {channel.provider === "WIDGET" 
                          ? (isRtl ? "تفاصيل تركيب الـ Widget" : "Widget Embedding Details") 
                          : (isRtl ? "تفاصيل الويبهوك" : "Webhook URL Details")}
                      </div>

                      <div className="space-y-1">
                        <span className="block text-[11px] text-white/40">{isRtl ? "الرابط" : "URL"}</span>
                        <div className="flex items-center gap-2 rounded-xl border border-white/5 bg-black/20 px-2.5 py-2 text-[11px] ltr:flex-row-reverse">
                          <button
                            type="button"
                            onClick={() => handleCopy(url, `${channel.id}_url`)}
                            className="text-cyanx-400 transition hover:text-cyanx-300"
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </button>
                          <span className="min-w-0 flex-1 select-all overflow-x-auto whitespace-nowrap font-mono text-white/70">
                            {copiedKey === `${channel.id}_url` ? (isRtl ? "تم النسخ" : "Copied") : url}
                          </span>
                        </div>
                      </div>

                      {channel.provider !== "WEBHOOK" && channel.provider !== "WIDGET" && (
                        <div className="space-y-1">
                          <span className="block text-[11px] text-white/40">Verify Token</span>
                          <div className="flex items-center gap-2 rounded-xl border border-white/5 bg-black/20 px-2.5 py-2 text-[11px] ltr:flex-row-reverse">
                            <button
                              type="button"
                              onClick={() => handleCopy(verifyToken, `${channel.id}_token`)}
                              className="text-cyanx-400 transition hover:text-cyanx-300"
                            >
                              <Copy className="h-3.5 w-3.5" />
                            </button>
                            <span className="min-w-0 flex-1 select-all overflow-x-auto whitespace-nowrap font-mono text-white/70">
                              {copiedKey === `${channel.id}_token` ? (isRtl ? "تم النسخ" : "Copied") : verifyToken}
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

      <div className="mt-5 flex flex-wrap gap-3 rtl:justify-start ltr:justify-end">
        {footerItems.map((item) => (
          <div key={item} className="flex items-center gap-2 rounded-2xl bg-white/7 px-3 py-2 text-xs sm:text-sm text-white/68">
            <ShieldCheck className="h-4 w-4 text-cyanx-400" />
            {item}
          </div>
        ))}
      </div>
    </GradientCard>
  );
}

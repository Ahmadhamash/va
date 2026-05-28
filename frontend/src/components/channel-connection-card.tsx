import { useState, useEffect } from "react";
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
  ChevronUp,
  ExternalLink
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
  const { token, user, setAuth } = useAuthStore();
  const isChatwootActive = !!user?.chatwoot_account_id;
  const [connectionMode, setConnectionMode] = useState<"chatwoot" | "manual">("chatwoot");
  const [provisioning, setProvisioning] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (user?.chatwoot_account_id) {
      setConnectionMode("chatwoot");
    } else {
      setConnectionMode("manual");
    }
  }, [user]);

  const handleProvisionChatwoot = async () => {
    if (!token) return;
    setProvisioning(true);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/integrations/chatwoot/provision", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setAuth(token, data.user);
        setConnectionMode("chatwoot");
      } else {
        setErrorMsg(data.error || "فشل تفعيل حساب Chatwoot.");
      }
    } catch (err) {
      console.error(err);
      setErrorMsg("حدث خطأ أثناء الاتصال بالخادم.");
    } finally {
      setProvisioning(false);
    }
  };

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

  const showChatwootView = isChatwootActive && connectionMode === "chatwoot";

  return (
    <GradientCard className="border-border">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="grid h-14 w-14 place-items-center rounded-3xl bg-brand text-white shadow-glow">
              <MessageCircle className="h-7 w-7" />
            </div>
            <div>
              {showChatwootView ? (
                <div className="flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-semibold bg-brand/10 text-brand">
                  <CircleCheck className="h-3 w-3" />
                  ربط Chatwoot مفعّل تلقائياً
                </div>
              ) : (
                <div className={`flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-semibold ${connectedCount > 0 ? "bg-brand/10 text-brand" : "bg-amber-500/10 text-amber-500"}`}>
                  <CircleCheck className="h-3 w-3" />
                  {connectedCount > 0 ? `${connectedCount} قناة متصلة` : "لا توجد قنوات متصلة"}
                </div>
              )}
              <h3 className="text-xl font-semibold text-primary">
                {showChatwootView ? "قنوات الاتصال الموحدة" : "اربط قنوات العملاء"}
              </h3>
              <p className="mt-1 max-w-2xl text-sm leading-7 text-secondary text-right">
                {showChatwootView 
                  ? "تتم إدارة قنواتك (واتساب، فيسبوك، إنستجرام) عبر لوحة تحكم Chatwoot ومزامنتها تلقائياً مع وكيل الذكاء الاصطناعي الخاص بنا."
                  : "واتساب، فيسبوك، وإنستغرام من لوحة واحدة. قم بربط قنواتك الرسمية لتفعيل ردود الوكيل الذكي وإدارة محادثات العملاء."
                }
              </p>
            </div>
          </div>
        </div>
        {showChatwootView ? (
          <a
            href={`${process.env.NEXT_PUBLIC_CHATWOOT_URL || "https://chat.masarjo.com"}/app/accounts/${user.chatwoot_account_id}/dashboard`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-2xl bg-brand px-5 py-3 text-sm font-bold text-white transition hover:scale-[1.02] active:scale-[0.98] shadow-glow"
          >
            <span>لوحة تحكم Chatwoot</span>
            <ExternalLink className="h-4 w-4" />
          </a>
        ) : (
          <Link href="/onboarding">
            <Button>
              <Plus className="h-4 w-4" />
              ابدأ الربط الرسمي
            </Button>
          </Link>
        )}
      </div>

      {isChatwootActive && (
        <div className="flex justify-end mt-4 mb-2">
          <div className="inline-flex rounded-2xl bg-surface-hover p-1 border border-border">
            <button
              type="button"
              onClick={() => setConnectionMode("manual")}
              className={`rounded-xl px-3 py-1.5 text-[10px] font-bold transition ${
                connectionMode === "manual"
                  ? "bg-brand text-white shadow-glow"
                  : "text-muted hover:text-primary"
              }`}
            >
              الربط اليدوي المباشر (Meta)
            </button>
            <button
              type="button"
              onClick={() => setConnectionMode("chatwoot")}
              className={`rounded-xl px-3 py-1.5 text-[10px] font-bold transition ${
                connectionMode === "chatwoot"
                  ? "bg-brand text-white shadow-glow"
                  : "text-muted hover:text-primary"
              }`}
            >
              الربط التلقائي (Chatwoot)
            </button>
          </div>
        </div>
      )}

      {!isChatwootActive && (
        <div className="mt-6 rounded-3xl border border-brand/20 bg-brand/5 p-5 text-right space-y-4 animate-in fade-in">
          <div className="flex flex-row-reverse items-center justify-between gap-4">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-brand text-white shadow-glow">
              <MessageCircle className="h-5 w-5" />
            </div>
            <div className="flex-1 pr-3">
              <h4 className="text-sm font-bold text-primary">تفعيل لوحة Chatwoot الموحدة (موصى به)</h4>
              <p className="text-xs text-muted mt-1">احصل على صندوق وارد موحد لإدارة جميع محادثات عملائك من مكان واحد.</p>
            </div>
          </div>
          <div className="text-xs leading-6 text-secondary">
            من خلال تفعيل Chatwoot، يمكنك قراءة والرد على رسائل واتساب وفيسبوك وإنستجرام، وتعيين المحادثات لموظفي خدمة العملاء، مع بقاء الرد الآلي الذكي فعالاً.
          </div>
          {errorMsg && (
            <div className="text-xs text-red-400 bg-red-500/10 rounded-2xl px-3 py-2 border border-red-500/20">
              {errorMsg}
            </div>
          )}
          <div className="flex justify-end pt-2">
            <Button 
              size="sm" 
              onClick={handleProvisionChatwoot} 
              disabled={provisioning}
              className="flex items-center gap-2"
            >
              {provisioning ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-ink-950" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>جاري التفعيل...</span>
                </>
              ) : (
                <span>تفعيل وتجهيز لوحة Chatwoot الخاصة بك</span>
              )}
            </Button>
          </div>
        </div>
      )}

      {showChatwootView && (
        <div className="mt-6 rounded-3xl border border-brand/20 bg-brand/5 p-6 text-right space-y-4">
          <div className="flex flex-row-reverse items-center justify-between gap-4">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-brand/10 text-brand">
              <MessageCircle className="h-6 w-6" />
            </div>
            <div className="flex-1 pr-4">
              <h4 className="text-base font-bold text-primary">حالة الاتصال الموحد (Omnichannel Link)</h4>
              <p className="text-xs text-muted mt-1">حساب Chatwoot رقم: {user?.chatwoot_account_id}</p>
            </div>
          </div>
          <div className="text-sm leading-6 text-secondary font-medium">
            مساحة عملك على Chatwoot متصلة بنجاح مع وكيل الذكاء الاصطناعي. أي رسائل واردة إلى قنواتك هناك سيتم معالجتها والرد عليها تلقائياً.
          </div>
          <div className="flex gap-2 justify-end">
            <a
              href={`${process.env.NEXT_PUBLIC_CHATWOOT_URL || "https://chat.masarjo.com"}/app/accounts/${user?.chatwoot_account_id}/dashboard`}
              target="_blank"
              rel="noreferrer"
              className="text-xs font-semibold text-cyanx-400 hover:text-cyanx-300 underline inline-flex items-center gap-1"
            >
              <span>إدارة صناديق الوارد والقنوات في Chatwoot</span>
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>
      )}

      {hasChannels && (!isChatwootActive || connectionMode === "manual") && (
        <div className="mt-6 space-y-4">
          {isChatwootActive && (
            <h4 className="text-sm font-bold text-secondary mb-2">القنوات التقليدية المربوطة يدوياً:</h4>
          )}
          <div className="grid gap-3 lg:grid-cols-3">
            {channels.map((channel) => {
              const anyChannel = channel as any;
              const Icon = channelIcons[channel.provider] || MessageCircle;
              const isConfigured = channel.status === "CONNECTED";
              const isExpanded = expandedChannelId === channel.id;

              return (
                <div key={channel.id} className="space-y-3">
                  <div className={`rounded-3xl border p-4 transition ${isConfigured ? "border-brand/20 bg-brand/5" : "border-border bg-surface-hover"}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="grid h-11 w-11 place-items-center rounded-2xl bg-brand/10 text-brand">
                        <Icon className="h-5 w-5" />
                      </div>
                      <StatusBadge status={channel.status} />
                    </div>
                    <div className="mt-4 text-base font-semibold text-primary text-right">
                      {platformNames[channel.provider] || channel.provider}
                    </div>
                    <div className="mt-1 text-xs text-muted text-right">
                      {anyChannel.credentials?.phone_number_id ? `معرف الرقم: ${anyChannel.credentials.phone_number_id}` : "تم التهيئة ببيانات معتمدة"}
                    </div>
                    <div className="mt-4 flex items-center justify-between gap-3 text-xs font-semibold">
                      <span className={`flex items-center gap-1.5 ${isConfigured ? "text-brand" : "text-amber-500"}`}>
                        <CircleCheck className="h-3.5 w-3.5" />
                        {isConfigured ? "مفعّل" : "بحاجة إعداد"}
                      </span>
                      
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setExpandedChannelId(isExpanded ? null : channel.id)}
                          className="rounded-full bg-surface-hover px-3 py-1.5 text-secondary transition hover:bg-surface border border-border flex items-center gap-1"
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
                    <div className="rounded-3xl border border-border bg-surface-hover p-4 text-right space-y-3 animate-in fade-in duration-200">
                      <div className="text-xs font-bold text-primary">تفاصيل الويب هوك لـ Meta Developers:</div>
                      
                      <div className="space-y-1">
                        <span className="text-[10px] text-muted block">Callback URL (رابط الاستقبال)</span>
                        <div className="flex items-center justify-between rounded-xl bg-surface border border-border px-2.5 py-1.5 text-[11px] font-mono">
                          <button
                            type="button"
                            onClick={() => handleCopy(getAbsoluteWebhookUrl(anyChannel), channel.id + "_url")}
                            className="text-brand-accent hover:text-brand text-[9px] font-bold"
                          >
                            {copiedKey === channel.id + "_url" ? "✓ تم النسخ" : "نسخ"}
                          </button>
                          <span className="text-secondary select-all overflow-x-auto whitespace-nowrap scrollbar-none">{getAbsoluteWebhookUrl(anyChannel)}</span>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <span className="text-[10px] text-muted block">Verify Token (رمز التحقق)</span>
                        <div className="flex items-center justify-between rounded-xl bg-surface border border-border px-2.5 py-1.5 text-[11px] font-mono">
                          <button
                            type="button"
                            onClick={() => handleCopy(anyChannel.credentials?.verify_token || "verify_token", channel.id + "_token")}
                            className="text-brand-accent hover:text-brand text-[9px] font-bold"
                          >
                            {copiedKey === channel.id + "_token" ? "✓ تم النسخ" : "نسخ"}
                          </button>
                          <span className="text-secondary select-all">{anyChannel.credentials?.verify_token || "verify_token"}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {(!isChatwootActive || connectionMode === "manual") && !hasChannels && (
        <div className="mt-6 flex flex-col items-center justify-center rounded-3xl border border-dashed border-border bg-surface-hover py-10 text-center">
          <MessageCircle className="h-10 w-10 text-muted mb-3" />
          <p className="text-sm text-secondary">لا توجد قنوات مرتبطة حتى الآن</p>
          <p className="mt-1 text-xs text-muted">اضغط &quot;ابدأ الربط الرسمي&quot; لإضافة أول قناة</p>
        </div>
      )}

      <div className="mt-5 flex flex-wrap gap-3">
        {["رسائل العملاء فقط", "تكامل رسمي قابل للتوصيل", "تحويل بشري عند الحساسية"].map((item) => (
          <div key={item} className="flex items-center gap-2 rounded-2xl bg-surface-hover px-3 py-2 text-sm text-secondary border border-border">
            <ShieldCheck className="h-4 w-4 text-brand-accent" />
            {item}
          </div>
        ))}
      </div>
    </GradientCard>
  );
}

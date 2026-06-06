"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  Code,
  Copy,
  ExternalLink,
  Facebook,
  Instagram,
  MessageCircle,
  Send,
  ShieldCheck,
  UserPlus,
  Webhook,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AppShell } from "@/components/app-shell";
import { GradientCard } from "@/components/gradient-card";
import { useAuthStore } from "@/store/use-auth-store";

type Platform = "whatsapp" | "messenger" | "instagram" | "webhook" | "widget";
type ManyChatSetupStatus = "not_started" | "pending_setup" | "completed";

interface ManyChatStatus {
  manychat_setup_status: ManyChatSetupStatus;
  fb_page_link: string | null;
  ig_username: string | null;
  wa_number: string | null;
  manychat_admin_confirmed: boolean;
  manychat_setup_submitted_at: string | null;
  manychat_setup_completed_at: string | null;
}

const manyChatAdminContact =
  process.env.NEXT_PUBLIC_MANYCHAT_ADMIN_CONTACT || "حساب إدارة المنصة";

const setupSteps = [
  {
    title: "أضف حساب الإدارة كمسؤول",
    body: "من إعدادات صفحة فيسبوك أو Meta Business Suite، أضف الحساب التالي بصلاحية مدير حتى نتمكن من اختيار الصفحة داخل ManyChat.",
    icon: UserPlus,
  },
  {
    title: "تأكد من ربط إنستقرام بالصفحة",
    body: "إذا كنت تريد ربط Instagram، تأكد أن الحساب Professional ومربوط بنفس صفحة فيسبوك من مركز الحسابات أو إعدادات الصفحة.",
    icon: Instagram,
  },
  {
    title: "فعّل الوصول للرسائل",
    body: "من إعدادات Instagram الخاصة بالرسائل، فعّل السماح بالوصول للرسائل حتى يستطيع ManyChat استقبال المحادثات والرد عليها.",
    icon: ShieldCheck,
  },
];

const platforms: Array<{
  id: Platform;
  label: string;
  hint: string;
  icon: typeof MessageCircle;
}> = [
  { id: "whatsapp", label: "WhatsApp", hint: "Cloud API", icon: MessageCircle },
  { id: "messenger", label: "Messenger", hint: "Meta Page", icon: Facebook },
  { id: "instagram", label: "Instagram", hint: "Professional account", icon: Instagram },
  { id: "widget", label: "Widget", hint: "موقع العميل", icon: Code },
  { id: "webhook", label: "Webhook", hint: "تكامل مخصص", icon: Webhook },
];

function platformFields(platform: Platform) {
  if (platform === "whatsapp") {
    return [
      ["phone_number_id", "Phone Number ID"],
      ["whatsapp_business_account_id", "WhatsApp Business Account ID"],
      ["access_token", "Access Token"],
      ["app_secret", "App Secret"],
      ["verify_token", "Verify Token"],
    ];
  }
  if (platform === "messenger" || platform === "instagram") {
    return [
      ["page_access_token", "Page Access Token"],
      ["app_secret", "App Secret"],
      ["verify_token", "Verify Token"],
    ];
  }
  if (platform === "webhook") {
    return [["webhook_secret", "Webhook Secret"]];
  }
  return [];
}

function absoluteEndpoint(channel: any) {
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

function manyChatStatusMeta(status: ManyChatSetupStatus) {
  if (status === "completed") {
    return {
      label: "مكتمل",
      title: "تم تفعيل ManyChat",
      body: "تم إعداد البوت وربطه بالحسابات المطلوبة. يمكنك الآن متابعة المحادثات من القنوات المتصلة.",
      className: "border-emeraldx-400/20 bg-emeraldx-500/10 text-emeraldx-400",
      icon: CheckCircle2,
    };
  }
  if (status === "pending_setup") {
    return {
      label: "قيد الإعداد",
      title: "تم استلام طلبك بنجاح",
      body: "جاري إعداد البوت يدوياً من حساب الوكالة. سيتم تفعيله خلال 24 ساعة بعد اكتمال الصلاحيات.",
      className: "border-amber-400/20 bg-amber-500/10 text-amber-300",
      icon: Clock3,
    };
  }
  return {
    label: "لم يبدأ",
    title: "إرسال طلب ربط ManyChat",
    body: "املأ البيانات بعد إضافة حساب الإدارة كمسؤول في صفحة فيسبوك الخاصة بك.",
    className: "border-white/10 bg-white/[0.035] text-white/55",
    icon: AlertCircle,
  };
}

export default function OnboardingPage() {
  const token = useAuthStore((s) => s.token);
  const [selected, setSelected] = useState<Platform>("whatsapp");
  const [credentials, setCredentials] = useState<Record<string, string>>({});
  const [channels, setChannels] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [manychatLoading, setManychatLoading] = useState(false);
  const [manychatStatus, setManychatStatus] = useState<ManyChatStatus | null>(null);
  const [manychatForm, setManychatForm] = useState({
    fb_page_link: "",
    ig_username: "",
    wa_number: "",
    admin_added_confirmed: false,
  });
  const [notice, setNotice] = useState<{ type: "ok" | "warn"; text: string } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const fields = useMemo(() => platformFields(selected), [selected]);
  const statusMeta = manyChatStatusMeta(manychatStatus?.manychat_setup_status || "not_started");
  const StatusIcon = statusMeta.icon;

  async function loadChannels() {
    if (!token) return;
    const res = await fetch("/api/integrations/connect", {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setChannels(data.channels || []);
    }
  }

  async function loadManyChatStatus() {
    if (!token) return;
    const res = await fetch("/api/onboarding/manychat", {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setManychatStatus(data);
      setManychatForm((current) => ({
        ...current,
        fb_page_link: data.fb_page_link || current.fb_page_link,
        ig_username: data.ig_username || current.ig_username,
        wa_number: data.wa_number || current.wa_number,
        admin_added_confirmed: data.manychat_admin_confirmed || current.admin_added_confirmed,
      }));
    }
  }

  useEffect(() => {
    loadChannels();
    loadManyChatStatus();
  }, [token]);

  async function submitManyChatRequest(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;
    if (!manychatForm.admin_added_confirmed) {
      setNotice({ type: "warn", text: "يجب تأكيد إضافة حساب الإدارة كمسؤول قبل إرسال الطلب." });
      return;
    }

    setManychatLoading(true);
    setNotice(null);
    try {
      const res = await fetch("/api/onboarding/manychat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(manychatForm),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.detail || "تعذر إرسال طلب ManyChat.");
      }
      setManychatStatus(data);
      setNotice({
        type: "ok",
        text: "تم استلام طلبك بنجاح. سنقوم بإعداد البوت وتفعيله خلال 24 ساعة.",
      });
    } catch (error) {
      setNotice({ type: "warn", text: error instanceof Error ? error.message : "صار خطأ أثناء إرسال الطلب." });
    } finally {
      setManychatLoading(false);
    }
  }

  async function connectManual() {
    if (!token) return;
    setLoading(true);
    setNotice(null);
    try {
      const cleanCredentials = Object.fromEntries(
        Object.entries(credentials).filter(([, value]) => value.trim()),
      );
      const res = await fetch("/api/integrations/connect", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ provider: selected, credentials: cleanCredentials }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "تعذر إنشاء القناة.");
      }
      setNotice({ type: "ok", text: "تم إنشاء القناة. انسخ بيانات الويبهوك من القائمة تحت." });
      setCredentials({});
      await loadChannels();
    } catch (error) {
      setNotice({ type: "warn", text: error instanceof Error ? error.message : "صار خطأ أثناء الربط." });
    } finally {
      setLoading(false);
    }
  }

  async function startMeta(platform: "messenger" | "instagram") {
    if (!token) return;
    setLoading(true);
    setNotice(null);
    try {
      const res = await fetch(`/api/integrations/meta/start?platform=${platform}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || data.error || "تعذر بدء الربط المباشر.");
      if (!data.configured) {
        setNotice({
          type: "warn",
          text: data.reason || "مفاتيح Meta OAuth غير مضافة على السيرفر. الربط اليدوي شغال.",
        });
        return;
      }
      window.location.href = data.auth_url;
    } catch (error) {
      setNotice({ type: "warn", text: error instanceof Error ? error.message : "صار خطأ أثناء الربط المباشر." });
    } finally {
      setLoading(false);
    }
  }

  async function copy(text: string, key: string) {
    await navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 1800);
  }

  return (
    <AppShell
      title="ربط القنوات"
      subtitle="جهز ManyChat أو اربط قناة مباشرة من Meta وواتساب والويبهوك."
    >
      <div className="space-y-6">
      {notice && (
        <div
          className={`flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm ${
            notice.type === "ok"
              ? "border-emeraldx-400/20 bg-emeraldx-500/10 text-emeraldx-400"
              : "border-amber-400/20 bg-amber-500/10 text-amber-300"
          }`}
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{notice.text}</span>
        </div>
      )}

      <GradientCard>
        <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
          <div className="space-y-5 text-right">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className={`inline-flex items-center gap-2 rounded-2xl border px-3 py-2 text-xs font-semibold ${statusMeta.className}`}>
                <StatusIcon className="h-4 w-4" />
                {statusMeta.label}
              </div>
              <div>
                <div className="flex items-center justify-end gap-2">
                  <h2 className="text-2xl font-semibold text-white">تهيئة ManyChat اليدوية</h2>
                  <MessageCircle className="h-5 w-5 text-emeraldx-400" />
                </div>
                <p className="mt-2 max-w-2xl text-sm leading-7 text-white/50">
                  أضف حساب الإدارة كمسؤول في صفحة فيسبوك، ثم أرسل بيانات الصفحة. سنكمل الربط داخل ManyChat من حساب الوكالة ونطبق قالب البوت المناسب.
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="rounded-full border border-emeraldx-400/20 bg-emeraldx-500/10 px-3 py-1 text-xs font-semibold text-emeraldx-400">
                  انسخ هذا الحساب
                </span>
                <div>
                  <div className="text-xs text-white/40">حساب الإدارة المطلوب إضافته</div>
                  <div className="mt-1 font-mono text-sm font-semibold text-white" dir="ltr">
                    {manyChatAdminContact}
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              {setupSteps.map((step, index) => {
                const Icon = step.icon;
                return (
                  <div key={step.title} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <span className="text-xs font-semibold text-white/35">0{index + 1}</span>
                      <Icon className="h-5 w-5 text-cyanx-300" />
                    </div>
                    <h3 className="text-sm font-semibold text-white">{step.title}</h3>
                    <p className="mt-2 text-xs leading-6 text-white/45">{step.body}</p>
                  </div>
                );
              })}
            </div>

            <form onSubmit={submitManyChatRequest} className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-white/55">رابط صفحة فيسبوك</label>
                  <Input
                    dir="ltr"
                    required
                    placeholder="https://facebook.com/your-page"
                    value={manychatForm.fb_page_link}
                    onChange={(event) =>
                      setManychatForm((current) => ({ ...current, fb_page_link: event.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-white/55">يوزر إنستقرام</label>
                  <Input
                    dir="ltr"
                    placeholder="@yourbrand"
                    value={manychatForm.ig_username}
                    onChange={(event) =>
                      setManychatForm((current) => ({ ...current, ig_username: event.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-white/55">رقم واتساب اختياري</label>
                  <Input
                    dir="ltr"
                    placeholder="+9627..."
                    value={manychatForm.wa_number}
                    onChange={(event) =>
                      setManychatForm((current) => ({ ...current, wa_number: event.target.value }))
                    }
                  />
                </div>
                <label className="flex min-h-11 cursor-pointer items-center justify-end gap-3 rounded-2xl border border-white/10 bg-white/[0.035] px-4 py-3 text-right text-xs font-semibold leading-6 text-white/70">
                  <span>أتعهد أنني أضفت حساب الإدارة كمسؤول في صفحة فيسبوك</span>
                  <input
                    type="checkbox"
                    checked={manychatForm.admin_added_confirmed}
                    onChange={(event) =>
                      setManychatForm((current) => ({ ...current, admin_added_confirmed: event.target.checked }))
                    }
                    className="h-4 w-4 accent-emeraldx-400"
                    required
                  />
                </label>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs leading-6 text-white/40">
                  يمكنك تعديل البيانات وإعادة الإرسال إذا تغيرت الصلاحيات أو الصفحة.
                </p>
                <Button type="submit" disabled={manychatLoading}>
                  <Send className="h-4 w-4" />
                  {manychatLoading ? "جاري الإرسال..." : "إرسال طلب التهيئة"}
                </Button>
              </div>
            </form>
          </div>

          <div className={`rounded-2xl border p-5 text-right ${statusMeta.className}`}>
            <StatusIcon className="mb-4 mr-auto h-8 w-8" />
            <h3 className="text-lg font-semibold text-white">{statusMeta.title}</h3>
            <p className="mt-2 text-sm leading-7 opacity-80">{statusMeta.body}</p>
            {manychatStatus?.manychat_setup_submitted_at && (
              <div className="mt-5 rounded-xl bg-black/15 p-3 text-xs leading-6 text-white/65">
                <div className="font-semibold text-white/80">آخر طلب</div>
                <div dir="ltr">
                  {new Date(manychatStatus.manychat_setup_submitted_at).toLocaleString("ar-JO")}
                </div>
              </div>
            )}
            {manychatStatus?.fb_page_link && (
              <a
                href={manychatStatus.fb_page_link}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-flex items-center gap-2 text-xs font-semibold text-cyanx-300 hover:text-cyanx-200"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                فتح صفحة فيسبوك
              </a>
            )}
          </div>
        </div>
      </GradientCard>

      <GradientCard>
        <div className="grid gap-3 md:grid-cols-5">
          {platforms.map((platform) => {
            const Icon = platform.icon;
            const active = selected === platform.id;
            return (
              <button
                key={platform.id}
                type="button"
                onClick={() => {
                  setSelected(platform.id);
                  setCredentials({});
                }}
                className={`rounded-2xl border p-4 text-right transition ${
                  active
                    ? "border-emeraldx-400/40 bg-emeraldx-500/10 text-white shadow-glow"
                    : "border-white/10 bg-white/[0.035] text-white/65 hover:border-white/18 hover:bg-white/[0.06]"
                }`}
              >
                <Icon className="mb-3 h-5 w-5 text-emeraldx-400" />
                <div className="font-semibold">{platform.label}</div>
                <div className="mt-1 text-xs text-white/40">{platform.hint}</div>
              </button>
            );
          })}
        </div>

        {(selected === "messenger" || selected === "instagram") && (
          <div className="mt-6 rounded-2xl border border-emeraldx-400/20 bg-emeraldx-500/[0.045] p-4 text-right">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-semibold text-white">ربط مباشر من Meta</h3>
                <p className="mt-1 text-xs leading-6 text-white/50">بنجهز OAuth callback ونحاول نعمل webhook subscribe تلقائياً.</p>
              </div>
              <Button type="button" onClick={() => startMeta(selected)} disabled={loading}>
                <ExternalLink className="h-4 w-4" />
                ابدأ الربط المباشر
              </Button>
            </div>
          </div>
        )}

        <div className="mt-6 space-y-4 text-right">
          <div>
            <h3 className="font-semibold text-white">الإعداد اليدوي</h3>
            <p className="mt-1 text-xs text-white/45">اترك الحقول الفارغة إذا بدك النظام يولدها لك مثل verify token.</p>
          </div>

          {fields.length > 0 ? (
            <div className="grid gap-3 md:grid-cols-2">
              {fields.map(([key, label]) => (
                <Input
                  key={key}
                  dir="ltr"
                  placeholder={label}
                  value={credentials[key] || ""}
                  onChange={(event) => setCredentials((current) => ({ ...current, [key]: event.target.value }))}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4 text-sm text-white/50">
              هذه القناة لا تحتاج أسرار إضافية من البداية.
            </div>
          )}

          <Button type="button" onClick={connectManual} disabled={loading}>
            إنشاء قناة يدوية
          </Button>
        </div>
      </GradientCard>

      <GradientCard>
        <div className="mb-4 flex items-center justify-between gap-3">
          <span className="text-xs text-white/35">{channels.length} قناة</span>
          <h2 className="text-xl font-semibold text-white">القنوات الحالية</h2>
        </div>

        {channels.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/12 py-10 text-center text-sm text-white/42">
            ما في قنوات مضافة حالياً.
          </div>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {channels.map((channel) => {
              const endpoint = absoluteEndpoint(channel);
              const verifyToken = channel.credentials?.verify_token;
              const webhookSecret = channel.credentials?.webhook_secret;
              return (
                <div key={channel.id} className="rounded-2xl border border-white/10 bg-white/[0.035] p-4 text-right">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="rounded-full bg-emeraldx-500/10 px-2 py-1 text-xs text-emeraldx-400">
                      {channel.status}
                    </span>
                    <h3 className="font-semibold text-white">{channel.name}</h3>
                  </div>

                  <div className="space-y-2">
                    <div className="rounded-xl bg-black/20 p-3">
                      <div className="mb-1 text-[11px] text-white/40">Endpoint</div>
                      <button
                        type="button"
                        onClick={() => copy(endpoint, `${channel.id}_endpoint`)}
                        className="flex w-full items-center gap-2 text-left font-mono text-xs text-cyanx-300"
                      >
                        <Copy className="h-3.5 w-3.5 shrink-0" />
                        <span className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap">
                          {copied === `${channel.id}_endpoint` ? "تم النسخ" : endpoint}
                        </span>
                      </button>
                    </div>

                    {(verifyToken || webhookSecret) && (
                      <div className="rounded-xl bg-black/20 p-3">
                        <div className="mb-1 text-[11px] text-white/40">
                          {verifyToken ? "Verify Token" : "Webhook Secret"}
                        </div>
                        <button
                          type="button"
                          onClick={() => copy(verifyToken || webhookSecret, `${channel.id}_secret`)}
                          className="flex w-full items-center gap-2 text-left font-mono text-xs text-cyanx-300"
                        >
                          <Copy className="h-3.5 w-3.5 shrink-0" />
                          <span className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap">
                            {copied === `${channel.id}_secret` ? "تم النسخ" : verifyToken || webhookSecret}
                          </span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </GradientCard>
      </div>
    </AppShell>
  );
}

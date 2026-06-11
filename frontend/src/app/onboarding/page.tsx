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
import { useLanguageStore } from "@/store/use-language-store";
import { cn } from "@/lib/utils";

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

function getManyChatStatusMeta(status: ManyChatSetupStatus, isRtl: boolean) {
  if (status === "completed") {
    return {
      label: isRtl ? "مكتمل" : "Completed",
      title: isRtl ? "تم تفعيل ManyChat" : "ManyChat Activated",
      body: isRtl 
        ? "تم إعداد البوت وربطه بالحسابات المطلوبة. يمكنك الآن متابعة المحادثات من القنوات المتصلة." 
        : "The bot has been configured and connected to the required accounts. You can now monitor chats from the connected channels.",
      className: "border-primary-400/20 bg-primary-500/10 text-primary-400",
      icon: CheckCircle2,
    };
  }
  if (status === "pending_setup") {
    return {
      label: isRtl ? "قيد الإعداد" : "Pending Setup",
      title: isRtl ? "تم استلام طلبك بنجاح" : "Request Received Successfully",
      body: isRtl 
        ? "جاري إعداد البوت يدوياً من حساب الوكالة. سيتم تفعيله خلال 24 ساعة بعد اكتمال الصلاحيات." 
        : "The bot is being manually configured from the agency account. It will be activated within 24 hours once permissions are ready.",
      className: "border-amber-400/20 bg-amber-500/10 text-amber-300",
      icon: Clock3,
    };
  }
  return {
    label: isRtl ? "لم يبدأ" : "Not Started",
    title: isRtl ? "إرسال طلب ربط ManyChat" : "Submit ManyChat Integration",
    body: isRtl 
      ? "املأ البيانات بعد إضافة حساب الإدارة كمسؤول في صفحة فيسبوك الخاصة بك." 
      : "Fill out the fields after adding the admin account as admin in your Facebook page settings.",
    className: "border-white/10 bg-white/[0.035] text-white/55",
    icon: AlertCircle,
  };
}

export default function OnboardingPage() {
  const token = useAuthStore((s) => s.token);
  const language = useLanguageStore((state) => state.language);
  const isRtl = language === "ar";

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

  const setupSteps = useMemo(() => [
    {
      title: isRtl ? "أضف حساب الإدارة كمسؤول" : "Add Admin Account",
      body: isRtl 
        ? "من إعدادات صفحة فيسبوك أو Meta Business Suite، أضف الحساب التالي بصلاحية مدير حتى نتمكن من اختيار الصفحة داخل ManyChat." 
        : "From Facebook page or Meta Business Suite settings, add the following account with Admin permission so we can select the page in ManyChat.",
      icon: UserPlus,
    },
    {
      title: isRtl ? "تأكد من ربط إنستقرام بالصفحة" : "Connect Instagram",
      body: isRtl 
        ? "إذا كنت تريد ربط Instagram، تأكد أن الحساب Professional ومربوط بنفس صفحة فيسبوك من مركز الحسابات أو إعدادات الصفحة." 
        : "If you want to connect Instagram, make sure the account is Professional and linked to the same Facebook Page via Accounts Center.",
      icon: Instagram,
    },
    {
      title: isRtl ? "فعّل الوصول للرسائل" : "Enable Message Access",
      body: isRtl 
        ? "من إعدادات Instagram الخاصة بالرسائل، فعّل السماح بالوصول للرسائل حتى يستطيع ManyChat استقبال المحادثات والرد عليها." 
        : "From Instagram messaging settings, enable allowing access to messages so ManyChat can receive and reply to conversations.",
      icon: ShieldCheck,
    },
  ], [isRtl]);

  const platforms = useMemo<Array<{
    id: Platform;
    label: string;
    hint: string;
    icon: typeof MessageCircle;
  }>>(() => [
    { id: "whatsapp", label: "WhatsApp", hint: "Cloud API", icon: MessageCircle },
    { id: "messenger", label: "Messenger", hint: "Meta Page", icon: Facebook },
    { id: "instagram", label: "Instagram", hint: "Professional account", icon: Instagram },
    { id: "widget", label: "Widget", hint: isRtl ? "موقع العميل" : "Client Widget", icon: Code },
    { id: "webhook", label: "Webhook", hint: isRtl ? "تكامل مخصص" : "Custom Webhook", icon: Webhook },
  ], [isRtl]);

  const fields = useMemo(() => platformFields(selected), [selected]);
  const statusMeta = getManyChatStatusMeta(manychatStatus?.manychat_setup_status || "not_started", isRtl);
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
      setNotice({ 
        type: "warn", 
        text: isRtl 
          ? "يجب تأكيد إضافة حساب الإدارة كمسؤول قبل إرسال الطلب." 
          : "You must confirm adding the admin account as admin before submitting." 
      });
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
        throw new Error(data.detail || (isRtl ? "تعذر إرسال طلب ManyChat." : "Could not submit ManyChat request."));
      }
      setManychatStatus(data);
      setNotice({
        type: "ok",
        text: isRtl 
          ? "تم استلام طلبك بنجاح. سنقوم بإعداد البوت وتفعيله خلال 24 ساعة." 
          : "Your request was successfully received. We will set up and activate the bot within 24 hours.",
      });
    } catch (error) {
      setNotice({ 
        type: "warn", 
        text: error instanceof Error ? error.message : (isRtl ? "صار خطأ أثناء إرسال الطلب." : "An error occurred while submitting the request.") 
      });
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
        throw new Error(data.error || (isRtl ? "تعذر إنشاء القناة." : "Could not create the channel."));
      }
      setNotice({ 
        type: "ok", 
        text: isRtl 
          ? "تم إنشاء القناة. انسخ بيانات الويبهوك من القائمة تحت." 
          : "Channel created successfully. Copy the webhook details from the list below." 
      });
      setCredentials({});
      await loadChannels();
    } catch (error) {
      setNotice({ 
        type: "warn", 
        text: error instanceof Error ? error.message : (isRtl ? "صار خطأ أثناء الربط." : "An error occurred during manual connection.") 
      });
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
      if (!res.ok) throw new Error(data.detail || data.error || (isRtl ? "تعذر بدء الربط المباشر." : "Could not initiate direct connection."));
      if (!data.configured) {
        setNotice({
          type: "warn",
          text: data.reason || (isRtl ? "مفاتيح Meta OAuth غير مضافة على السيرفر. الربط اليدوي شغال." : "Meta OAuth keys are not configured on the server. Manual connection is available."),
        });
        return;
      }
      window.location.href = data.auth_url;
    } catch (error) {
      setNotice({ 
        type: "warn", 
        text: error instanceof Error ? error.message : (isRtl ? "صار خطأ أثناء الربط المباشر." : "An error occurred during direct connection.") 
      });
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
      title={isRtl ? "ربط القنوات" : "Connect Channels"}
      subtitle={isRtl ? "جهز ManyChat أو اربط قناة مباشرة من Meta وواتساب والويبهوك." : "Set up ManyChat or connect channels directly from Meta, WhatsApp, and custom Webhooks."}
    >
      <div className="space-y-6">
      {notice && (
        <div
          className={cn(
            "flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm",
            notice.type === "ok"
              ? "border-primary-400/20 bg-primary-500/10 text-primary-400"
              : "border-amber-400/20 bg-amber-500/10 text-amber-300"
          )}
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{notice.text}</span>
        </div>
      )}

      <GradientCard>
        <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
          <div className={cn("space-y-5", isRtl ? "text-right" : "text-left")}>
            <div className={cn("flex flex-wrap items-start gap-4", isRtl ? "justify-between" : "justify-between flex-row-reverse")}>
              <div className={cn("inline-flex items-center gap-2 rounded-2xl border px-3 py-2 text-xs font-semibold", statusMeta.className)}>
                <StatusIcon className="h-4 w-4" />
                {statusMeta.label}
              </div>
              <div className={isRtl ? "text-right" : "text-left"}>
                <div className={cn("flex items-center gap-2", isRtl ? "justify-end" : "justify-start flex-row-reverse")}>
                  <h2 className="text-2xl font-semibold text-white">
                    {isRtl ? "تهيئة ManyChat اليدوية" : "Manual ManyChat Setup"}
                  </h2>
                  <MessageCircle className="h-5 w-5 text-primary-400" />
                </div>
                <p className="mt-2 max-w-2xl text-sm leading-7 text-white/50">
                  {isRtl 
                    ? "أضف حساب الإدارة كمسؤول في صفحة فيسبوك، ثم أرسل بيانات الصفحة. سنكمل الربط داخل ManyChat من حساب الوكالة ونطبق قالب البوت المناسب." 
                    : "Add the admin account as admin on your Facebook page, then submit page info. We will configure ManyChat from our agency account and apply templates."}
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                {isRtl ? (
                  <>
                    <span className="rounded-full border border-primary-400/20 bg-primary-500/10 px-3 py-1 text-xs font-semibold text-primary-400">
                      انسخ هذا الحساب
                    </span>
                    <div>
                      <div className="text-xs text-white/40">حساب الإدارة المطلوب إضافته</div>
                      <div className="mt-1 font-mono text-sm font-semibold text-white" dir="ltr">
                        {manyChatAdminContact}
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <div className="text-xs text-white/40">Required Admin Account to Add</div>
                      <div className="mt-1 font-mono text-sm font-semibold text-white" dir="ltr">
                        {manyChatAdminContact}
                      </div>
                    </div>
                    <span className="rounded-full border border-primary-400/20 bg-primary-500/10 px-3 py-1 text-xs font-semibold text-primary-400">
                      Copy Account ID
                    </span>
                  </>
                )}
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              {setupSteps.map((step, index) => {
                const Icon = step.icon;
                return (
                  <div key={step.title} className={cn("rounded-2xl border border-white/10 bg-white/[0.03] p-4", isRtl ? "text-right" : "text-left")}>
                    <div className="mb-3 flex items-center justify-between">
                      <span className="text-xs font-semibold text-white/35">0{index + 1}</span>
                      <Icon className="h-5 w-5 text-cyan-300" />
                    </div>
                    <h3 className="text-sm font-semibold text-white">{step.title}</h3>
                    <p className="mt-2 text-xs leading-6 text-white/45">{step.body}</p>
                  </div>
                );
              })}
            </div>

            <form onSubmit={submitManyChatRequest} className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2">
                <div className={cn("space-y-2", isRtl ? "text-right" : "text-left")}>
                  <label className="block text-xs font-semibold text-white/55">
                    {isRtl ? "رابط صفحة فيسبوك" : "Facebook Page Link"}
                  </label>
                  <Input
                    dir="ltr"
                    required
                    placeholder="https://facebook.com/your-page"
                    value={manychatForm.fb_page_link}
                    onChange={(event) =>
                      setManychatForm((current) => ({ ...current, fb_page_link: event.target.value }))
                    }
                    className="text-left"
                  />
                </div>
                <div className={cn("space-y-2", isRtl ? "text-right" : "text-left")}>
                  <label className="block text-xs font-semibold text-white/55">
                    {isRtl ? "يوزر إنستقرام" : "Instagram Username"}
                  </label>
                  <Input
                    dir="ltr"
                    placeholder="@yourbrand"
                    value={manychatForm.ig_username}
                    onChange={(event) =>
                      setManychatForm((current) => ({ ...current, ig_username: event.target.value }))
                    }
                    className="text-left"
                  />
                </div>
                <div className={cn("space-y-2", isRtl ? "text-right" : "text-left")}>
                  <label className="block text-xs font-semibold text-white/55">
                    {isRtl ? "رقم واتساب (اختياري)" : "WhatsApp Number (Optional)"}
                  </label>
                  <Input
                    dir="ltr"
                    placeholder="+9627..."
                    value={manychatForm.wa_number}
                    onChange={(event) =>
                      setManychatForm((current) => ({ ...current, wa_number: event.target.value }))
                    }
                    className="text-left"
                  />
                </div>
                <label className={cn(
                  "flex min-h-11 cursor-pointer items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.035] px-4 py-3 text-xs font-semibold leading-6 text-white/70",
                  isRtl ? "justify-end text-right" : "justify-start text-left flex-row-reverse"
                )}>
                  <span>
                    {isRtl 
                      ? "أتعهد أنني أضفت حساب الإدارة كمسؤول في صفحة فيسبوك" 
                      : "I confirm that I added the admin account as admin on the Facebook page"}
                  </span>
                  <input
                    type="checkbox"
                    checked={manychatForm.admin_added_confirmed}
                    onChange={(event) =>
                      setManychatForm((current) => ({ ...current, admin_added_confirmed: event.target.checked }))
                    }
                    className="h-4 w-4 accent-primary-400"
                    required
                  />
                </label>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs leading-6 text-white/40">
                  {isRtl 
                    ? "يمكنك تعديل البيانات وإعادة الإرسال إذا تغيرت الصلاحيات أو الصفحة." 
                    : "You can modify and re-submit details if permissions or page changes."}
                </p>
                <Button type="submit" disabled={manychatLoading}>
                  <Send className="h-4 w-4" />
                  {manychatLoading ? (isRtl ? "جاري الإرسال..." : "Sending...") : (isRtl ? "إرسال طلب التهيئة" : "Submit Request")}
                </Button>
              </div>
            </form>
          </div>

          <div className={cn("rounded-2xl border p-5", isRtl ? "text-right" : "text-left", statusMeta.className)}>
            <StatusIcon className={cn("mb-4 h-8 w-8", isRtl ? "mr-auto" : "ml-auto")} />
            <h3 className="text-lg font-semibold text-white">{statusMeta.title}</h3>
            <p className="mt-2 text-sm leading-7 opacity-80">{statusMeta.body}</p>
            {manychatStatus?.manychat_setup_submitted_at && (
              <div className="mt-5 rounded-xl bg-black/15 p-3 text-xs leading-6 text-white/65">
                <div className="font-semibold text-white/80">{isRtl ? "آخر طلب" : "Last Request"}</div>
                <div dir="ltr">
                  {new Date(manychatStatus.manychat_setup_submitted_at).toLocaleString(isRtl ? "ar-JO" : "en-US")}
                </div>
              </div>
            )}
            {manychatStatus?.fb_page_link && (
              <a
                href={manychatStatus.fb_page_link}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-flex items-center gap-2 text-xs font-semibold text-cyan-300 hover:text-cyan-200"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                {isRtl ? "فتح صفحة فيسبوك" : "Open Facebook Page"}
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
                className={cn(
                  "rounded-2xl border p-4 transition",
                  isRtl ? "text-right" : "text-left",
                  active
                    ? "border-primary-400/40 bg-primary-500/10 text-white shadow-glow"
                    : "border-white/10 bg-white/[0.035] text-white/65 hover:border-white/18 hover:bg-white/[0.06]"
                )}
              >
                <Icon className="mb-3 h-5 w-5 text-primary-400" />
                <div className="font-semibold">{platform.label}</div>
                <div className="mt-1 text-xs text-white/40">{platform.hint}</div>
              </button>
            );
          })}
        </div>

        {(selected === "messenger" || selected === "instagram") && (
          <div className={cn("mt-6 rounded-2xl border border-primary-400/20 bg-primary-500/[0.045] p-4", isRtl ? "text-right" : "text-left")}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-semibold text-white">{isRtl ? "ربط مباشر من Meta" : "Direct Meta Link"}</h3>
                <p className="mt-1 text-xs leading-6 text-white/50">
                  {isRtl 
                    ? "بنجهز OAuth callback ونحاول نعمل webhook subscribe تلقائياً." 
                    : "We set up OAuth callbacks and subscribe to webhooks automatically."}
                </p>
              </div>
              <Button type="button" onClick={() => startMeta(selected)} disabled={loading}>
                <ExternalLink className="h-4 w-4" />
                {isRtl ? "ابدأ الربط المباشر" : "Start Direct Connect"}
              </Button>
            </div>
          </div>
        )}

        <div className={cn("mt-6 space-y-4", isRtl ? "text-right" : "text-left")}>
          <div>
            <h3 className="font-semibold text-white">{isRtl ? "الإعداد اليدوي" : "Manual Setup"}</h3>
            <p className="mt-1 text-xs text-white/45">
              {isRtl 
                ? "اترك الحقول الفارغة إذا بدك النظام يولدها لك مثل verify token." 
                : "Leave empty fields if you want the system to auto-generate (e.g. verify token)."}
            </p>
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
                  className="text-left"
                />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4 text-sm text-white/50">
              {isRtl ? "هذه القناة لا تحتاج أسرار إضافية من البداية." : "This channel does not require initial credentials."}
            </div>
          )}

          <Button type="button" onClick={connectManual} disabled={loading}>
            {isRtl ? "إنشاء قناة يدوية" : "Create Manual Channel"}
          </Button>
        </div>
      </GradientCard>

      <GradientCard>
        <div className="mb-4 flex items-center justify-between gap-3">
          <span className="text-xs text-white/35">
            {isRtl ? `${channels.length} قناة` : `${channels.length} channel(s)`}
          </span>
          <h2 className="text-xl font-semibold text-white">{isRtl ? "القنوات الحالية" : "Current Channels"}</h2>
        </div>

        {channels.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/12 py-10 text-center text-sm text-white/42">
            {isRtl ? "ما في قنوات مضافة حالياً." : "No channels connected at the moment."}
          </div>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {channels.map((channel) => {
              const endpoint = absoluteEndpoint(channel);
              const verifyToken = channel.credentials?.verify_token;
              const webhookSecret = channel.credentials?.webhook_secret;
              return (
                <div key={channel.id} className={cn("rounded-2xl border border-white/10 bg-white/[0.035] p-4", isRtl ? "text-right" : "text-left")}>
                  <div className="mb-3 flex items-center justify-between">
                    <span className="rounded-full bg-primary-500/10 px-2 py-1 text-xs text-primary-400">
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
                        className="flex w-full items-center gap-2 text-left font-mono text-xs text-cyan-300"
                      >
                        <Copy className="h-3.5 w-3.5 shrink-0" />
                        <span className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap">
                          {copied === `${channel.id}_endpoint` ? (isRtl ? "تم النسخ" : "Copied") : endpoint}
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
                          className="flex w-full items-center gap-2 text-left font-mono text-xs text-cyan-300"
                        >
                          <Copy className="h-3.5 w-3.5 shrink-0" />
                          <span className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap">
                            {copied === `${channel.id}_secret` ? (isRtl ? "تم النسخ" : "Copied") : verifyToken || webhookSecret}
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

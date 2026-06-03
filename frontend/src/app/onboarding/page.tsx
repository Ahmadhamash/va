"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, Code, Copy, ExternalLink, Facebook, Instagram, MessageCircle, Webhook } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GradientCard } from "@/components/gradient-card";
import { useAuthStore } from "@/store/use-auth-store";

type Platform = "whatsapp" | "messenger" | "instagram" | "webhook" | "widget";

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

export default function OnboardingPage() {
  const token = useAuthStore((s) => s.token);
  const [selected, setSelected] = useState<Platform>("whatsapp");
  const [credentials, setCredentials] = useState<Record<string, string>>({});
  const [channels, setChannels] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<{ type: "ok" | "warn"; text: string } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const fields = useMemo(() => platformFields(selected), [selected]);

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

  useEffect(() => {
    loadChannels();
  }, [token]);

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
    <div className="space-y-6">
      <div className="text-right">
        <span className="inline-flex items-center gap-2 rounded-full bg-emeraldx-500/10 px-3 py-1 text-xs font-semibold text-emeraldx-400">
          <CheckCircle2 className="h-3.5 w-3.5" />
          ربط القنوات
        </span>
        <h1 className="mt-3 text-3xl font-semibold text-white">جهز قناة العميل</h1>
        <p className="mt-2 text-sm text-white/50">
          الربط المباشر لـ Messenger و Instagram يحتاج مفاتيح Meta وصلاحيات التطبيق. الربط اليدوي موجود دائماً.
        </p>
      </div>

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
  );
}

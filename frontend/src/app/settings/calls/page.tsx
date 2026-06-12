"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Clipboard,
  ExternalLink,
  Loader2,
  PhoneCall,
  Radio,
  RefreshCw,
  Save,
  ShieldCheck,
  Webhook,
} from "lucide-react";
import toast from "react-hot-toast";
import { AppShell } from "@/components/app-shell";
import { GradientCard } from "@/components/gradient-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ToggleSetting } from "@/components/toggle-setting";
import { apiClient } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { useLanguageStore } from "@/store/use-language-store";

type CallSettings = {
  id: string;
  public_id: string;
  enabled: boolean;
  status: string;
  assistant_strategy: "shared" | "per_tenant";
  assistant_id: string | null;
  phone_number_id: string | null;
  phone_number: string | null;
  webhook_credential_id: string | null;
  language: string;
  dialect: string;
  handoff_phone: string | null;
  business_hours: string | null;
  model_provider: string;
  model_name: string;
  voice_provider: string;
  voice_id: string | null;
  recording_enabled: boolean;
  config: Record<string, unknown>;
  webhook_url: string;
};

type VoiceCall = {
  id: string;
  vapi_call_id: string;
  direction: string;
  status: string;
  customer_phone: string | null;
  customer_name: string | null;
  started_at: string | null;
  ended_at: string | null;
  duration_seconds: number | null;
  summary: string | null;
  sentiment: string | null;
  needs_followup: boolean;
  order_status: string | null;
  created_at: string;
};

const defaultSettings: CallSettings = {
  id: "",
  public_id: "",
  enabled: false,
  status: "draft",
  assistant_strategy: "shared",
  assistant_id: "",
  phone_number_id: "",
  phone_number: "",
  webhook_credential_id: "",
  language: "ar",
  dialect: "Jordanian / Levantine",
  handoff_phone: "",
  business_hours: "",
  model_provider: "openai",
  model_name: "gpt-4o",
  voice_provider: "vapi",
  voice_id: "",
  recording_enabled: true,
  config: {},
  webhook_url: "",
};

const dialectOptions = [
  "Jordanian / Levantine",
  "Palestinian / Levantine",
  "Syrian / Levantine",
  "Lebanese / Levantine",
  "Egyptian",
  "Gulf",
  "Saudi / Gulf",
  "Iraqi",
  "Arabic",
];

function cleanPayload(settings: CallSettings) {
  return {
    enabled: settings.enabled,
    status: settings.status || "draft",
    assistant_strategy: settings.assistant_strategy,
    assistant_id: settings.assistant_id?.trim() || null,
    phone_number_id: settings.phone_number_id?.trim() || null,
    phone_number: settings.phone_number?.trim() || null,
    webhook_credential_id: settings.webhook_credential_id?.trim() || null,
    language: settings.language || "ar",
    dialect: settings.dialect || "Jordanian / Levantine",
    handoff_phone: settings.handoff_phone?.trim() || null,
    business_hours: settings.business_hours?.trim() || null,
    model_provider: settings.model_provider || "openai",
    model_name: settings.model_name || "gpt-4o",
    voice_provider: settings.voice_provider || "vapi",
    voice_id: settings.voice_id?.trim() || null,
    recording_enabled: settings.recording_enabled,
    config: settings.config || {},
  };
}

function formatDate(value: string | null, isRtl: boolean) {
  if (!value) return isRtl ? "غير محدد" : "Not set";
  return new Intl.DateTimeFormat(isRtl ? "ar-JO" : "en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default function VoiceCallsPage() {
  const language = useLanguageStore((state) => state.language);
  const isRtl = language === "ar";
  const [settings, setSettings] = useState<CallSettings>(defaultSettings);
  const [calls, setCalls] = useState<VoiceCall[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const activeCalls = useMemo(
    () => calls.filter((call) => ["in-progress", "ringing", "queued", "scheduled"].includes(call.status)).length,
    [calls],
  );

  async function load() {
    setLoading(true);
    try {
      const [settingsRes, callsRes] = await Promise.all([
        apiClient.get("/calls/settings"),
        apiClient.get("/calls?limit=12"),
      ]);
      setSettings({ ...defaultSettings, ...settingsRes.data });
      setCalls(Array.isArray(callsRes.data) ? callsRes.data : []);
    } catch (error: any) {
      toast.error(error?.response?.data?.detail || (isRtl ? "تعذر تحميل إعدادات المكالمات." : "Could not load call settings."));
    } finally {
      setLoading(false);
    }
  }

  async function refreshCalls() {
    setRefreshing(true);
    try {
      const callsRes = await apiClient.get("/calls?limit=12");
      setCalls(Array.isArray(callsRes.data) ? callsRes.data : []);
    } catch (error: any) {
      toast.error(error?.response?.data?.detail || (isRtl ? "تعذر تحديث سجل المكالمات." : "Could not refresh calls."));
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function save() {
    setSaving(true);
    try {
      const response = await apiClient.put("/calls/settings", cleanPayload(settings));
      setSettings({ ...defaultSettings, ...response.data });
      toast.success(isRtl ? "تم حفظ إعدادات المكالمات." : "Call settings saved.");
    } catch (error: any) {
      toast.error(error?.response?.data?.detail || (isRtl ? "تعذر حفظ إعدادات المكالمات." : "Could not save call settings."));
    } finally {
      setSaving(false);
    }
  }

  async function copyWebhook() {
    if (!settings.webhook_url) return;
    await navigator.clipboard.writeText(settings.webhook_url);
    toast.success(isRtl ? "تم نسخ رابط Vapi webhook." : "Vapi webhook URL copied.");
  }

  if (loading) {
    return (
      <AppShell
        title={isRtl ? "المكالمات الصوتية" : "Voice calls"}
        subtitle={isRtl ? "إعداد مساعد المكالمات وربط Vapi مع بيانات المتجر." : "Configure the call assistant and connect Vapi to store data."}
      >
        <div className="flex h-96 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary-400" />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      title={isRtl ? "المكالمات الصوتية" : "Voice calls"}
      subtitle={isRtl ? "إعداد مساعد المكالمات وربط Vapi مع بيانات المتجر." : "Configure the call assistant and connect Vapi to store data."}
    >
      <div className="grid gap-6 xl:grid-cols-[1fr_400px]">
        <div className="space-y-6">
          <GradientCard>
            <div className={cn("mb-5 flex items-center justify-between gap-4", isRtl && "flex-row-reverse text-right")}>
              <div>
                <h3 className="text-xl font-semibold text-white">
                  {isRtl ? "تشغيل قناة المكالمات" : "Call channel"}
                </h3>
                <p className="mt-1 text-sm text-white/45">
                  {settings.enabled ? (isRtl ? "القناة مفعلة" : "Channel enabled") : (isRtl ? "القناة متوقفة" : "Channel disabled")}
                </p>
              </div>
              <span className={cn(
                "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold",
                settings.enabled
                  ? "border-emerald-400/25 bg-emerald-500/10 text-emerald-300"
                  : "border-white/10 bg-white/[0.04] text-white/50",
              )}>
                <Radio className="h-3.5 w-3.5" />
                {settings.status || "draft"}
              </span>
            </div>

            <div className="space-y-3">
              <ToggleSetting
                title={isRtl ? "تفعيل استقبال المكالمات" : "Enable voice calls"}
                description={isRtl ? "يفتح webhook ويجهز مساعد Vapi للرد من بيانات المتجر." : "Opens the webhook and prepares the Vapi assistant to answer from store data."}
                checked={settings.enabled}
                onChange={(enabled) => setSettings((current) => ({ ...current, enabled, status: enabled ? "active" : "draft" }))}
              />
              <ToggleSetting
                title={isRtl ? "تسجيل المكالمة" : "Call recording"}
                description={isRtl ? "يحفظ رابط التسجيل والملخص عند وصول تقرير نهاية المكالمة." : "Stores the recording link and summary when the end-of-call report arrives."}
                checked={settings.recording_enabled}
                onChange={(recording_enabled) => setSettings((current) => ({ ...current, recording_enabled }))}
              />
            </div>
          </GradientCard>

          <GradientCard>
            <div className={cn("mb-5 flex items-center justify-between", isRtl && "flex-row-reverse text-right")}>
              <Webhook className="h-5 w-5 text-cyanx-300" />
              <h3 className="text-xl font-semibold text-white">{isRtl ? "ربط Vapi" : "Vapi connection"}</h3>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className={cn("space-y-1.5", isRtl ? "text-right" : "text-left")}>
                <label className="block text-xs font-semibold text-white/60">Assistant ID</label>
                <Input
                  value={settings.assistant_id || ""}
                  onChange={(event) => setSettings({ ...settings, assistant_id: event.target.value })}
                  placeholder="asst_..."
                  className="text-left"
                  dir="ltr"
                />
              </div>
              <div className={cn("space-y-1.5", isRtl ? "text-right" : "text-left")}>
                <label className="block text-xs font-semibold text-white/60">Phone Number ID</label>
                <Input
                  value={settings.phone_number_id || ""}
                  onChange={(event) => setSettings({ ...settings, phone_number_id: event.target.value })}
                  placeholder="pn_..."
                  className="text-left"
                  dir="ltr"
                />
              </div>
              <div className={cn("space-y-1.5", isRtl ? "text-right" : "text-left")}>
                <label className="block text-xs font-semibold text-white/60">{isRtl ? "رقم المكالمات" : "Call number"}</label>
                <Input
                  value={settings.phone_number || ""}
                  onChange={(event) => setSettings({ ...settings, phone_number: event.target.value })}
                  placeholder="+962..."
                  className="text-left"
                  dir="ltr"
                />
              </div>
              <div className={cn("space-y-1.5", isRtl ? "text-right" : "text-left")}>
                <label className="block text-xs font-semibold text-white/60">{isRtl ? "رقم التحويل البشري" : "Human handoff number"}</label>
                <Input
                  value={settings.handoff_phone || ""}
                  onChange={(event) => setSettings({ ...settings, handoff_phone: event.target.value })}
                  placeholder="+962..."
                  className="text-left"
                  dir="ltr"
                />
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <div className={cn("mb-2 flex items-center justify-between gap-3", isRtl && "flex-row-reverse")}>
                <span className="text-xs font-semibold text-white/55">Webhook URL</span>
                <Button type="button" size="sm" variant="secondary" onClick={() => void copyWebhook()}>
                  <Clipboard className="h-4 w-4" />
                  {isRtl ? "نسخ" : "Copy"}
                </Button>
              </div>
              <div className="overflow-x-auto rounded-xl bg-black/20 px-3 py-2 text-left font-mono text-xs text-cyanx-200" dir="ltr">
                {settings.webhook_url}
              </div>
            </div>
          </GradientCard>

          <GradientCard>
            <div className={cn("mb-5 flex items-center justify-between", isRtl && "flex-row-reverse text-right")}>
              <PhoneCall className="h-5 w-5 text-primary-400" />
              <h3 className="text-xl font-semibold text-white">{isRtl ? "سلوك المساعد" : "Assistant behavior"}</h3>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className={cn("space-y-1.5", isRtl ? "text-right" : "text-left")}>
                <label className="block text-xs font-semibold text-white/60">{isRtl ? "اللهجة" : "Dialect"}</label>
                <select
                  value={settings.dialect}
                  onChange={(event) => setSettings({ ...settings, dialect: event.target.value })}
                  className="h-11 w-full rounded-2xl border border-white/10 bg-white/[0.07] px-4 text-sm text-white outline-none focus:border-primary-400/60"
                >
                  {dialectOptions.map((dialect) => (
                    <option key={dialect} value={dialect}>{dialect}</option>
                  ))}
                </select>
              </div>
              <div className={cn("space-y-1.5", isRtl ? "text-right" : "text-left")}>
                <label className="block text-xs font-semibold text-white/60">{isRtl ? "الموديل" : "Model"}</label>
                <Input
                  value={settings.model_name}
                  onChange={(event) => setSettings({ ...settings, model_name: event.target.value })}
                  className="text-left"
                  dir="ltr"
                />
              </div>
              <div className={cn("space-y-1.5", isRtl ? "text-right" : "text-left")}>
                <label className="block text-xs font-semibold text-white/60">{isRtl ? "مزود الصوت" : "Voice provider"}</label>
                <Input
                  value={settings.voice_provider}
                  onChange={(event) => setSettings({ ...settings, voice_provider: event.target.value })}
                  className="text-left"
                  dir="ltr"
                />
              </div>
              <div className={cn("space-y-1.5", isRtl ? "text-right" : "text-left")}>
                <label className="block text-xs font-semibold text-white/60">Voice ID</label>
                <Input
                  value={settings.voice_id || ""}
                  onChange={(event) => setSettings({ ...settings, voice_id: event.target.value })}
                  className="text-left"
                  dir="ltr"
                />
              </div>
            </div>

            <div className={cn("mt-4 space-y-1.5", isRtl ? "text-right" : "text-left")}>
              <label className="block text-xs font-semibold text-white/60">{isRtl ? "ساعات العمل" : "Business hours"}</label>
              <Textarea
                value={settings.business_hours || ""}
                onChange={(event) => setSettings({ ...settings, business_hours: event.target.value })}
                placeholder={isRtl ? "مثال: السبت إلى الخميس، 10 صباحا حتى 8 مساء" : "Example: Sat-Thu, 10 AM to 8 PM"}
                className={cn("min-h-24", isRtl ? "text-right" : "text-left")}
              />
            </div>
          </GradientCard>
        </div>

        <div className="space-y-6">
          <GradientCard>
            <div className={cn("mb-5 flex items-center justify-between", isRtl && "flex-row-reverse text-right")}>
              <ShieldCheck className="h-5 w-5 text-emerald-300" />
              <h3 className="text-lg font-semibold text-white">{isRtl ? "الحالة" : "Status"}</h3>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className={cn("rounded-2xl border border-white/10 bg-white/[0.04] p-4", isRtl ? "text-right" : "text-left")}>
                <div className="text-2xl font-bold text-white">{calls.length}</div>
                <div className="mt-1 text-xs text-white/42">{isRtl ? "آخر المكالمات" : "Recent calls"}</div>
              </div>
              <div className={cn("rounded-2xl border border-white/10 bg-white/[0.04] p-4", isRtl ? "text-right" : "text-left")}>
                <div className="text-2xl font-bold text-white">{activeCalls}</div>
                <div className="mt-1 text-xs text-white/42">{isRtl ? "نشطة الآن" : "Active now"}</div>
              </div>
            </div>
            <Button className="mt-4 w-full" onClick={() => void save()} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {saving ? (isRtl ? "جاري الحفظ..." : "Saving...") : (isRtl ? "حفظ إعدادات المكالمات" : "Save call settings")}
            </Button>
          </GradientCard>

          <GradientCard>
            <div className={cn("mb-5 flex items-center justify-between gap-3", isRtl && "flex-row-reverse text-right")}>
              <Button type="button" size="sm" variant="secondary" onClick={() => void refreshCalls()} disabled={refreshing}>
                {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                {isRtl ? "تحديث" : "Refresh"}
              </Button>
              <h3 className="text-lg font-semibold text-white">{isRtl ? "سجل المكالمات" : "Call history"}</h3>
            </div>

            <div className="space-y-3">
              {calls.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/12 bg-white/[0.03] p-6 text-center text-sm text-white/45">
                  {isRtl ? "لا توجد مكالمات محفوظة بعد." : "No saved calls yet."}
                </div>
              ) : calls.map((call) => (
                <div key={call.id} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                  <div className={cn("flex items-center justify-between gap-3", isRtl && "flex-row-reverse text-right")}>
                    <div>
                      <div className="font-semibold text-white">
                        {call.customer_name || call.customer_phone || call.vapi_call_id}
                      </div>
                      <div className="mt-1 text-xs text-white/42">{formatDate(call.created_at, isRtl)}</div>
                    </div>
                    <span className="rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 text-[11px] font-semibold text-white/65">
                      {call.status}
                    </span>
                  </div>
                  {call.summary && (
                    <p className={cn("mt-3 line-clamp-3 text-xs leading-5 text-white/50", isRtl ? "text-right" : "text-left")}>
                      {call.summary}
                    </p>
                  )}
                  <div className={cn("mt-3 flex items-center justify-between gap-3 text-xs text-white/35", isRtl && "flex-row-reverse")}>
                    <span>{call.direction}</span>
                    <span>{call.duration_seconds ? `${call.duration_seconds}s` : ""}</span>
                  </div>
                </div>
              ))}
            </div>
          </GradientCard>

          {settings.public_id && (
            <a
              href="/api/docs"
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-white/70 transition hover:bg-white/[0.08] hover:text-white"
            >
              <ExternalLink className="h-4 w-4" />
              Swagger
            </a>
          )}
        </div>
      </div>
    </AppShell>
  );
}

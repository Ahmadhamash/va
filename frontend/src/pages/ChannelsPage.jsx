import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Camera,
  CheckCircle2,
  Code2,
  Copy,
  ExternalLink,
  Globe2,
  Link2,
  MessageCircle,
  MessagesSquare,
  PlugZap,
  Power,
  RefreshCw,
  Settings2,
  Trash2,
  Webhook,
} from "lucide-react";
import api, { API_BASE } from "../services/api";

const PLATFORMS = [
  {
    id: "whatsapp",
    label: "WhatsApp",
    subtitle: "رسائل واتساب الرسمية",
    icon: MessageCircle,
    tone: "text-mint-600",
    badge: "الأكثر طلبا",
    connectLabel: "إعداد الربط",
    creds: [
      { k: "phone_number_id", label: "Phone Number ID" },
      { k: "access_token", label: "Permanent Access Token" },
      { k: "waba_id", label: "WhatsApp Business Account ID" },
      { k: "verify_token", label: "Webhook Verify Token" },
      { k: "app_secret", label: "App Secret" },
    ],
    steps: ["أدخل بيانات WhatsApp Cloud", "انسخ رابط Webhook", "فعّل الرسائل من Meta"],
  },
  {
    id: "instagram",
    label: "Instagram",
    subtitle: "رسائل إنستغرام للأعمال",
    icon: Camera,
    tone: "text-rose-500",
    connectLabel: "إعداد الربط",
    creds: [
      { k: "page_access_token", label: "Page access token" },
      { k: "app_secret", label: "App secret" },
      { k: "verify_token", label: "Verify token" },
    ],
    steps: ["اربط Instagram مع صفحة Meta", "أدخل المفاتيح", "انسخ Callback URL"],
  },
  {
    id: "messenger",
    label: "Facebook Messenger",
    subtitle: "رسائل صفحات فيسبوك",
    icon: MessagesSquare,
    tone: "text-brand-600",
    connectLabel: "إعداد الربط",
    creds: [
      { k: "page_access_token", label: "Page access token" },
      { k: "app_secret", label: "App secret" },
      { k: "verify_token", label: "Verify token" },
    ],
    steps: ["أدخل مفاتيح Meta", "انسخ Callback URL", "ضع نفس Verify token في Meta"],
  },
  {
    id: "widget",
    label: "Website Widget",
    subtitle: "زر محادثة داخل موقعك",
    icon: Code2,
    tone: "text-ember-600",
    connectLabel: "إنشاء الودجت",
    creds: [],
    steps: ["أنشئ القناة", "انسخ كود السكربت", "ضعه قبل نهاية body في موقعك"],
  },
  {
    id: "webhook",
    label: "Webhook",
    subtitle: "ربط أي نظام خارجي",
    icon: Webhook,
    tone: "text-cyan-600",
    connectLabel: "إنشاء Webhook",
    creds: [{ k: "webhook_secret", label: "Shared secret اختياري" }],
    steps: ["ضع secret إذا بدك", "انسخ رابط inbound", "أرسل payload من نظامك"],
  },
];

function fullUrl(path) {
  if (!path || typeof path !== "string" || !path.startsWith("/")) return path;
  return `${API_BASE}${path}`;
}

function platformDef(platform) {
  return PLATFORMS.find((p) => p.id === platform) || PLATFORMS[0];
}

export default function ChannelsPage() {
  const [channels, setChannels] = useState([]);
  const [platform, setPlatform] = useState("whatsapp");
  const [creds, setCreds] = useState({});
  const [err, setErr] = useState("");
  const [copied, setCopied] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const { data } = await api.get("/channels");
      setChannels(data || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const def = platformDef(platform);
  const ActiveIcon = def.icon;
  const activeCount = useMemo(() => channels.filter((ch) => ch.is_active).length, [channels]);

  async function create(e) {
    e.preventDefault();
    setErr("");
    setSaving(true);
    try {
      await api.post("/channels", { platform, credentials: creds });
      setCreds({});
      await load();
    } catch (e2) {
      setErr(e2?.response?.data?.detail || "تعذر إنشاء القناة");
    } finally {
      setSaving(false);
    }
  }

  async function toggle(id) {
    await api.patch(`/channels/${id}/toggle`);
    await load();
  }

  async function remove(id) {
    if (!window.confirm("حذف هذه القناة؟")) return;
    await api.delete(`/channels/${id}`);
    await load();
  }

  function copy(text, key = text) {
    navigator.clipboard?.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(""), 1600);
  }

  return (
    <div className="py-7" dir="rtl">
      <div className="app-container space-y-7">
        <section className="surface overflow-hidden">
          <div className="grid gap-0 lg:grid-cols-[0.95fr_1.05fr]">
            <div className="p-5 sm:p-6">
              <p className="eyebrow">Channel setup</p>
              <h1 className="mt-2 text-2xl font-black text-gray-950 dark:text-white sm:text-3xl">
                ربط القنوات
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-gray-600 dark:text-slate-300">
                الصفحة مصممة للعميل النهائي: قنوات واضحة، حالة الربط مباشرة، وأزرار أساسية بدون تفاصيل تقنية زائدة.
              </p>

              <div className="mt-6 grid grid-cols-2 gap-3">
                <div className="surface-soft p-4">
                  <div className="text-3xl font-black text-gray-950 dark:text-white">{channels.length}</div>
                  <div className="mt-1 text-xs font-bold text-gray-500 dark:text-slate-400">كل القنوات</div>
                </div>
                <div className="surface-soft p-4">
                  <div className="text-3xl font-black text-mint-700 dark:text-mint-300">{activeCount}</div>
                  <div className="mt-1 text-xs font-bold text-gray-500 dark:text-slate-400">قنوات فعالة</div>
                </div>
              </div>
            </div>

            <div className="border-t border-gray-200 bg-gray-50 p-5 dark:border-slate-800 dark:bg-slate-950/50 lg:border-r lg:border-t-0">
              <div className="grid gap-3 sm:grid-cols-2">
                {PLATFORMS.slice(0, 4).map((item) => {
                  const Icon = item.icon;
                  const connected = channels.some((ch) => ch.platform === item.id && ch.is_active);
                  const selected = platform === item.id;
                  return (
                    <button
                      type="button"
                      key={item.id}
                      onClick={() => {
                        setPlatform(item.id);
                        setCreds({});
                      }}
                      className={`rounded-lg border p-4 text-start transition ${
                        selected
                          ? "border-mint-500 bg-white shadow-sm dark:border-mint-400 dark:bg-slate-900"
                          : "border-gray-200 bg-white hover:border-gray-300 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-600"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <span className="grid h-11 w-11 place-items-center rounded-lg bg-gray-50 dark:bg-slate-800">
                          <Icon className={`h-5 w-5 ${item.tone}`} />
                        </span>
                        <span className={`status-pill ${connected ? "bg-mint-50 text-mint-700 dark:bg-mint-500/10 dark:text-mint-300" : "bg-gray-100 text-gray-500 dark:bg-slate-800 dark:text-slate-400"}`}>
                          {connected ? "مربوط" : "غير مربوط"}
                        </span>
                      </div>
                      <div className="mt-4 font-black text-gray-950 dark:text-white">{item.label}</div>
                      <div className="mt-1 text-xs leading-5 text-gray-500 dark:text-slate-400">{item.subtitle}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
          <form onSubmit={create} className="surface p-5 sm:p-6">
            <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="grid h-12 w-12 place-items-center rounded-lg bg-mint-50 text-mint-700 dark:bg-mint-500/10 dark:text-mint-300">
                  <ActiveIcon className="h-6 w-6" />
                </span>
                <div>
                  <p className="eyebrow">New connection</p>
                  <h2 className="mt-1 text-xl font-black text-gray-950 dark:text-white">{def.label}</h2>
                </div>
              </div>
              {def.badge && (
                <span className="status-pill bg-mint-50 text-mint-700 dark:bg-mint-500/10 dark:text-mint-300">
                  {def.badge}
                </span>
              )}
            </div>

            <div className="mb-5 grid gap-3">
              {def.steps.map((step, index) => (
                <div key={step} className="flex gap-3">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-gray-100 text-sm font-black text-gray-700 dark:bg-slate-800 dark:text-slate-200">
                    {index + 1}
                  </span>
                  <p className="pt-1 text-sm leading-6 text-gray-600 dark:text-slate-300">{step}</p>
                </div>
              ))}
            </div>

            {def.creds.length === 0 ? (
              <div className="surface-soft flex items-center gap-3 p-4 text-sm text-gray-600 dark:text-slate-300">
                <CheckCircle2 className="h-5 w-5 shrink-0 text-mint-600" />
                هذه القناة لا تحتاج مفاتيح. أنشئها ثم انسخ كود الودجت من الأسفل.
              </div>
            ) : (
              <div className="grid gap-4">
                {def.creds.map((c) => (
                  <div key={c.k}>
                    <label className="label">{c.label}</label>
                    <input
                      value={creds[c.k] || ""}
                      onChange={(e) => setCreds({ ...creds, [c.k]: e.target.value })}
                      className="input-field"
                      dir="ltr"
                      placeholder={c.k}
                    />
                  </div>
                ))}
              </div>
            )}

            {err && (
              <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">
                {err}
              </div>
            )}

            <div className="mt-5 flex flex-wrap gap-2">
              <button className="btn-primary" disabled={saving}>
                <PlugZap className="h-4 w-4" />
                {saving ? "جاري الإنشاء..." : def.connectLabel}
              </button>
              <button type="button" onClick={load} className="btn-secondary" disabled={loading}>
                <RefreshCw className="h-4 w-4" />
                تحديث الحالة
              </button>
            </div>
          </form>

          <section className="surface p-5 sm:p-6">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <p className="eyebrow">Connected</p>
                <h2 className="mt-1 text-xl font-black text-gray-950 dark:text-white">القنوات المربوطة</h2>
              </div>
              <Settings2 className="h-5 w-5 text-gray-400" />
            </div>

            {channels.length === 0 ? (
              <div className="surface-soft p-8 text-center">
                <Link2 className="mx-auto h-10 w-10 text-gray-400" />
                <h3 className="mt-3 font-black text-gray-950 dark:text-white">لا توجد قنوات بعد</h3>
                <p className="mt-2 text-sm leading-6 text-gray-500 dark:text-slate-400">
                  اختر قناة من البطاقات، أكمل الإعداد، وستظهر هنا روابط الربط الجاهزة.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {channels.map((ch) => {
                  const chDef = platformDef(ch.platform);
                  const Icon = chDef.icon;
                  return (
                    <div key={ch.id} className="rounded-lg border border-gray-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <span className="grid h-11 w-11 place-items-center rounded-lg bg-gray-50 dark:bg-slate-900">
                            <Icon className={`h-5 w-5 ${chDef.tone}`} />
                          </span>
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="font-black text-gray-950 dark:text-white">{chDef.label}</h3>
                              <span className={`status-pill ${ch.is_active ? "bg-mint-50 text-mint-700 dark:bg-mint-500/10 dark:text-mint-300" : "bg-gray-100 text-gray-500 dark:bg-slate-800 dark:text-slate-300"}`}>
                                {ch.is_active ? "فعال" : "متوقف"}
                              </span>
                            </div>
                            {ch.configured_keys.length > 0 && (
                              <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">
                                مفاتيح محفوظة: {ch.configured_keys.join(", ")}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <button onClick={() => toggle(ch.id)} className="btn-secondary h-9 px-3">
                            <Power className="h-4 w-4" />
                            {ch.is_active ? "إيقاف" : "تفعيل"}
                          </button>
                          <button onClick={() => remove(ch.id)} className="btn-danger h-9 px-3" title="حذف">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>

                      <div className="mt-4 space-y-2">
                        {Object.entries(ch.endpoints || {}).map(([k, v]) =>
                          k === "note" ? (
                            <p key={k} className="rounded-lg bg-gray-50 px-3 py-2 text-xs leading-6 text-gray-500 dark:bg-slate-900 dark:text-slate-400">
                              {v}
                            </p>
                          ) : (
                            <div key={k} className="grid gap-2 rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-slate-800 dark:bg-slate-900 md:grid-cols-[130px_1fr_auto] md:items-center">
                              <span className="text-xs font-black uppercase text-gray-500 dark:text-slate-400">{k}</span>
                              <code className="break-all rounded bg-white px-2 py-1 text-xs text-gray-700 dark:bg-slate-950 dark:text-slate-200" dir="ltr">
                                {fullUrl(v)}
                              </code>
                              <div className="flex gap-2">
                                <button onClick={() => copy(fullUrl(v), `${ch.id}-${k}`)} className="btn-secondary h-9 px-3" type="button">
                                  <Copy className="h-4 w-4" />
                                  {copied === `${ch.id}-${k}` ? "تم" : "نسخ"}
                                </button>
                                {String(fullUrl(v)).startsWith("http") && (
                                  <a href={fullUrl(v)} target="_blank" rel="noreferrer" className="icon-button h-9 w-9" title="فتح">
                                    <ExternalLink className="h-4 w-4" />
                                  </a>
                                )}
                              </div>
                            </div>
                          )
                        )}
                      </div>

                      {ch.platform === "widget" && (
                        <div className="mt-4 rounded-lg bg-ink-900 p-4 text-xs text-slate-100 dark:bg-black" dir="ltr">
                          <div className="mb-2 flex items-center justify-between gap-3 text-slate-300">
                            <span className="inline-flex items-center gap-2">
                              <Globe2 className="h-4 w-4" />
                              Website widget script
                            </span>
                            <button
                              onClick={() => copy(`<script src="${fullUrl(ch.endpoints?.script_url)}" async></script>`, `${ch.id}-script`)}
                              className="rounded-lg border border-white/15 px-3 py-1.5 text-white hover:bg-white/10"
                              type="button"
                            >
                              {copied === `${ch.id}-script` ? "Copied" : "Copy"}
                            </button>
                          </div>
                          <code className="block overflow-x-auto whitespace-nowrap">
                            {`<script src="${fullUrl(ch.endpoints?.script_url)}" async></script>`}
                          </code>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </section>

        <section className="surface-soft flex items-start gap-3 p-4">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <p className="text-sm leading-7 text-gray-600 dark:text-slate-300">
            ربط Meta بضغطة واحدة يحتاج إعداد Meta App وChatwoot tokens. هذه الصفحة جاهزة بصريا وتجربيا، وعند توفر مفاتيح Meta نربط زر "ربط الآن" مباشرة مع OAuth أو Embedded Signup.
          </p>
        </section>
      </div>
    </div>
  );
}

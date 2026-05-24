import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Headphones,
  Mic2,
  Play,
  Radio,
  Save,
  SlidersHorizontal,
  Volume2,
} from "lucide-react";
import api, { API_BASE } from "../services/api";

const DEFAULT_SETTINGS = {
  voice_mode: "off",
  tts_provider: "openai",
  preferred_voice: "nova",
  speech_speed: 1.0,
  max_audio_duration_seconds: 120,
  fallback_to_text: true,
  audio_format: "mp3",
  tts_config: {},
};

const VOICE_MODES = [
  { value: "off", label: "نص فقط", desc: "المساعد يرسل ردود نصية بدون صوت." },
  {
    value: "voice_when_voice",
    label: "صوت عند الصوت",
    desc: "يرد بصوت فقط إذا العميل أرسل رسالة صوتية.",
  },
  { value: "always_voice", label: "صوت دائما", desc: "كل رد يتحول إلى رسالة صوتية." },
  {
    value: "text_and_voice",
    label: "نص + صوت",
    desc: "يحفظ النص ويرسل الصوت للمحادثة.",
  },
];

const PROVIDERS = [
  ["openai", "OpenAI TTS", "مستقر وسريع كخيار افتراضي."],
  ["elevenlabs", "ElevenLabs", "أصوات عربية ولهجات طبيعية أكثر."],
];

const FALLBACK_VOICES = {
  openai: [
    { value: "nova", label: "Nova", dialect: "عربي محايد", gender: "female" },
    { value: "alloy", label: "Alloy", dialect: "عربي محايد", gender: "neutral" },
    { value: "shimmer", label: "Shimmer", dialect: "عربي محايد", gender: "female" },
  ],
  elevenlabs: [],
  elevenlabs_available: false,
  elevenlabs_dynamic: false,
  elevenlabs_message: "",
  elevenlabs_missing_permissions: false,
};

function mediaUrl(url) {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith("/api/uploads/")) return url;
  if (url.startsWith("/uploads/")) return `${API_BASE}${url}`;
  return `${API_BASE}/uploads/${url}`;
}

function configForVoice(voice, previousConfig = {}) {
  if (!voice?.voice_id) return previousConfig || {};
  return {
    ...(previousConfig || {}),
    voice_id: voice.voice_id,
    voice_label: voice.label,
    dialect: voice.dialect,
    model_id: "eleven_multilingual_v2",
  };
}

export default function VoiceSettingsPage() {
  const [settings, setSettings] = useState(null);
  const [voiceOptions, setVoiceOptions] = useState(FALLBACK_VOICES);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [previewing, setPreviewing] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      const [{ data: settingsData }, { data: voicesData }] = await Promise.all([
        api.get("/voice-settings/"),
        api.get("/voice-settings/voices"),
      ]);
      setSettings({ ...DEFAULT_SETTINGS, ...settingsData });
      setVoiceOptions({ ...FALLBACK_VOICES, ...voicesData });
    } catch {
      setSettings(DEFAULT_SETTINGS);
    } finally {
      setLoading(false);
    }
  }

  const provider = settings?.tts_provider || "openai";
  const voices = useMemo(() => voiceOptions[provider] || [], [voiceOptions, provider]);
  const selectedVoice =
    voices.find((v) => v.value === settings?.preferred_voice) ||
    (provider === "elevenlabs" && settings?.tts_config?.voice_id
      ? {
          value: settings.preferred_voice || "custom_elevenlabs",
          label: settings.tts_config.voice_label || "Custom ElevenLabs voice",
          dialect: settings.tts_config.dialect || "Arabic",
          gender: "custom",
          voice_id: settings.tts_config.voice_id,
          sample_text: "مرحبا، كيف أقدر أساعدك اليوم؟",
        }
      : null);
  const elevenlabsAvailable =
    settings?.elevenlabs_available || voiceOptions.elevenlabs_available;
  const elevenlabsMessage = voiceOptions.elevenlabs_message || "";
  const elevenlabsMissingPermissions = !!voiceOptions.elevenlabs_missing_permissions;
  const canPreviewSelected =
    provider !== "elevenlabs" || voices.length > 0 || !!settings?.tts_config?.voice_id;

  function update(key, value) {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }

  function chooseProvider(nextProvider) {
    const providerVoices = voiceOptions[nextProvider] || [];
    const firstVoice = providerVoices[0];
    setPreviewUrl("");
    setSettings((prev) => ({
      ...prev,
      tts_provider: nextProvider,
      preferred_voice:
        firstVoice?.value ||
        (nextProvider === "openai" ? "nova" : prev?.preferred_voice || "custom_elevenlabs"),
      tts_config:
        nextProvider === "elevenlabs"
          ? configForVoice(firstVoice, prev?.tts_config || {})
          : {},
    }));
  }

  function chooseVoice(voice) {
    setPreviewUrl("");
    setSettings((prev) => ({
      ...prev,
      preferred_voice: voice.value,
      tts_config: provider === "elevenlabs" ? configForVoice(voice, prev?.tts_config) : prev?.tts_config || {},
    }));
  }

  function updateCustomVoiceId(value) {
    setSettings((prev) => ({
      ...prev,
      preferred_voice: "custom_elevenlabs",
      tts_config: {
        ...(prev?.tts_config || {}),
        voice_id: value.trim(),
        voice_label: "Custom ElevenLabs voice",
      },
    }));
  }

  async function save() {
    setSaving(true);
    setMsg("");
    try {
      await api.put("/voice-settings/", settings);
      setMsg("تم حفظ إعدادات الصوت.");
    } catch (e) {
      setMsg(e?.response?.data?.detail || "تعذر الحفظ.");
    } finally {
      setSaving(false);
    }
  }

  async function previewVoice(voice = selectedVoice) {
    const voiceToPreview = voice || selectedVoice;
    setMsg("");
    setPreviewUrl("");
    setPreviewing(voiceToPreview?.value || settings.preferred_voice || "selected");
    try {
      const ttsConfig =
        provider === "elevenlabs"
          ? configForVoice(voiceToPreview, settings.tts_config)
          : settings.tts_config || {};
      const { data } = await api.post("/voice-settings/preview", {
        tts_provider: provider,
        preferred_voice: voiceToPreview?.value || settings.preferred_voice,
        speech_speed: settings.speech_speed,
        audio_format: settings.audio_format || "mp3",
        tts_config: ttsConfig,
        text: voiceToPreview?.sample_text || "مرحبا، كيف أقدر أساعدك اليوم؟",
      });
      if (!data.success) throw new Error(data.error || "Preview failed.");
      setPreviewUrl(mediaUrl(data.audio_url));
      if (provider === "elevenlabs" && data.tts_provider && data.tts_provider !== "elevenlabs") {
        setMsg("ElevenLabs رفض هذا الصوت، لذلك تم استخدام OpenAI كخيار احتياطي للمعاينة.");
      }
    } catch (e) {
      setMsg(e?.response?.data?.detail || e.message || "تعذرت المعاينة.");
    } finally {
      setPreviewing("");
    }
  }

  if (loading || !settings) {
    return (
      <div className="grid min-h-[60vh] place-items-center text-gray-400">
        <div className="flex items-center gap-3">
          <Radio className="h-5 w-5 animate-pulse" />
          جاري تحميل إعدادات الصوت...
        </div>
      </div>
    );
  }

  return (
    <div className="py-7" dir="rtl">
      <div className="app-container space-y-7">
        <section className="surface overflow-hidden">
          <div className="grid gap-0 lg:grid-cols-[0.95fr_1.05fr]">
            <div className="p-5 sm:p-6">
              <p className="eyebrow">AI voice</p>
              <h1 className="mt-2 text-2xl font-black text-gray-950 dark:text-white sm:text-3xl">
                إعدادات الصوت والرد
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-gray-600 dark:text-slate-300">
                اختر متى يرد المساعد بصوت، ثم حدد المزود والصوت المناسب للهجة عملك.
              </p>
              <div className="mt-6 grid grid-cols-2 gap-3">
                <div className="surface-soft p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-gray-500 dark:text-slate-400">المزود</span>
                    <Headphones className="h-5 w-5 text-mint-600" />
                  </div>
                  <div className="mt-2 text-xl font-black text-gray-950 dark:text-white">
                    {provider === "elevenlabs" ? "ElevenLabs" : "OpenAI"}
                  </div>
                </div>
                <div className="surface-soft p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-gray-500 dark:text-slate-400">السرعة</span>
                    <SlidersHorizontal className="h-5 w-5 text-brand-600" />
                  </div>
                  <div className="mt-2 text-xl font-black text-gray-950 dark:text-white">
                    {settings.speech_speed}x
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t border-gray-200 bg-gray-50 p-5 dark:border-slate-800 dark:bg-slate-950/50 lg:border-r lg:border-t-0">
              <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                <div className="mb-3 flex items-center gap-2 text-sm font-black text-gray-700 dark:text-slate-200">
                  <Volume2 className="h-5 w-5 text-mint-600" />
                  معاينة الصوت
                </div>
                <div className="rounded-lg bg-gray-50 p-4 text-sm leading-7 text-gray-600 dark:bg-slate-950 dark:text-slate-300">
                  مرحبا، كيف أقدر أساعدك اليوم؟
                </div>
                {previewUrl ? (
                  <audio controls autoPlay src={previewUrl} className="mt-4 w-full" />
                ) : (
                  <div className="mt-4 rounded-lg border border-dashed border-gray-300 p-4 text-center text-sm text-gray-400 dark:border-slate-700">
                    اضغط معاينة لسماع الصوت المختار.
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="surface p-5 sm:p-6">
            <p className="eyebrow">Reply mode</p>
            <h2 className="mt-2 text-xl font-black text-gray-950 dark:text-white">متى يرد بصوت؟</h2>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {VOICE_MODES.map((mode) => (
                <button
                  type="button"
                  key={mode.value}
                  onClick={() => update("voice_mode", mode.value)}
                  className={`rounded-lg border p-4 text-start transition ${
                    settings.voice_mode === mode.value
                      ? "border-mint-500 bg-mint-50 dark:border-mint-400 dark:bg-mint-500/10"
                      : "border-gray-200 bg-white hover:border-gray-300 dark:border-slate-800 dark:bg-slate-950"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className={`h-5 w-5 ${settings.voice_mode === mode.value ? "text-mint-600" : "text-gray-300"}`} />
                    <span className="font-black text-gray-950 dark:text-white">{mode.label}</span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-gray-500 dark:text-slate-400">{mode.desc}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="surface p-5 sm:p-6">
            <p className="eyebrow">Provider</p>
            <h2 className="mt-2 text-xl font-black text-gray-950 dark:text-white">مزود تحويل النص لصوت</h2>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {PROVIDERS.map(([value, label, desc]) => (
                <button
                  type="button"
                  key={value}
                  onClick={() => chooseProvider(value)}
                  className={`rounded-lg border p-4 text-start transition ${
                    provider === value
                      ? "border-mint-500 bg-mint-50 dark:border-mint-400 dark:bg-mint-500/10"
                      : "border-gray-200 bg-white hover:border-gray-300 dark:border-slate-800 dark:bg-slate-950"
                  }`}
                >
                  <div className="font-black text-gray-950 dark:text-white">{label}</div>
                  <p className="mt-2 text-sm leading-6 text-gray-500 dark:text-slate-400">{desc}</p>
                </button>
              ))}
            </div>

            {provider === "elevenlabs" && !elevenlabsAvailable && (
              <div className="mt-4 flex gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-800 dark:border-amber-900/50 dark:bg-amber-500/10 dark:text-amber-200">
                <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
                أضف ELEVENLABS_API_KEY على السيرفر ثم أعد تشغيل backend و worker.
              </div>
            )}

            {provider === "elevenlabs" && elevenlabsMessage && (
              <div className="mt-4 flex gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-800 dark:border-amber-900/50 dark:bg-amber-500/10 dark:text-amber-200">
                <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
                {elevenlabsMissingPermissions
                  ? "مفتاح ElevenLabs يحتاج صلاحية voices_read حتى تظهر الأصوات العربية تلقائيا."
                  : elevenlabsMessage}
              </div>
            )}
          </div>
        </section>

        <section className="surface p-5 sm:p-6">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="eyebrow">Voices</p>
              <h2 className="mt-2 text-xl font-black text-gray-950 dark:text-white">اختيار الصوت</h2>
            </div>
            <button
              type="button"
              onClick={() => previewVoice()}
              disabled={!!previewing || !canPreviewSelected}
              className="btn-secondary"
            >
              <Play className="h-4 w-4" />
              {previewing ? "جاري التوليد..." : "معاينة الصوت المختار"}
            </button>
          </div>

          {provider === "elevenlabs" && voices.length === 0 && (
            <div className="mb-4 rounded-lg border border-dashed border-amber-300 bg-amber-50 px-4 py-3 text-sm leading-7 text-amber-800 dark:border-amber-900/50 dark:bg-amber-500/10 dark:text-amber-200">
              لم يتم تحميل أصوات ElevenLabs العربية. استخدم مفتاح API بصلاحية voices_read أو ضع Voice ID يدوي.
            </div>
          )}

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {voices.map((voice) => (
              <div
                key={voice.value}
                className={`rounded-lg border p-4 ${
                  settings.preferred_voice === voice.value
                    ? "border-mint-500 bg-mint-50 dark:border-mint-400 dark:bg-mint-500/10"
                    : "border-gray-200 bg-white dark:border-slate-800 dark:bg-slate-950"
                }`}
              >
                <button type="button" onClick={() => chooseVoice(voice)} className="block w-full text-start">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-black text-gray-950 dark:text-white">{voice.label}</span>
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-bold text-gray-600 dark:bg-slate-800 dark:text-slate-300">
                      {voice.gender}
                    </span>
                  </div>
                  <div className="mt-2 text-sm text-gray-500 dark:text-slate-400">{voice.dialect}</div>
                  <div className="mt-1 text-xs text-gray-400">
                    {voice.source_label || (provider === "elevenlabs" ? "ElevenLabs" : "OpenAI")}
                    {voice.usable_note ? ` - ${voice.usable_note}` : ""}
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => previewVoice(voice)}
                  disabled={previewing === voice.value}
                  className="btn-secondary mt-4 h-9 px-3 text-xs"
                >
                  <Play className="h-4 w-4" />
                  {previewing === voice.value ? "جاري التوليد..." : "اسمع"}
                </button>
              </div>
            ))}
          </div>

          {provider === "elevenlabs" && (
            <div className="mt-5">
              <label className="label">Custom ElevenLabs Voice ID</label>
              <input
                value={settings.tts_config?.voice_id || ""}
                onChange={(e) => updateCustomVoiceId(e.target.value)}
                placeholder="Paste a voice_id from ElevenLabs"
                className="input-field"
                dir="ltr"
              />
            </div>
          )}
        </section>

        <section className="surface p-5 sm:p-6">
          <div className="grid gap-5 lg:grid-cols-[1fr_0.8fr]">
            <div>
              <label className="label">سرعة الكلام: {settings.speech_speed}x</label>
              <input
                type="range"
                min="0.5"
                max="2.0"
                step="0.1"
                value={settings.speech_speed}
                onChange={(e) => update("speech_speed", parseFloat(e.target.value))}
                className="w-full accent-[#13b77a]"
              />
            </div>

            <label className="surface-soft flex items-center gap-3 p-4 text-sm font-bold text-gray-700 dark:text-slate-200">
              <input
                type="checkbox"
                checked={settings.fallback_to_text}
                onChange={(e) => update("fallback_to_text", e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 accent-[#13b77a]"
              />
              إرسال نص إذا فشل توليد الصوت
            </label>
          </div>

          {msg && <p className="mt-4 rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-700 dark:bg-slate-950 dark:text-slate-300">{msg}</p>}

          <div className="mt-5 flex flex-wrap gap-3">
            <button type="button" onClick={save} disabled={saving} className="btn-primary">
              <Save className="h-4 w-4" />
              {saving ? "جاري الحفظ..." : "حفظ الإعدادات"}
            </button>
            <button
              type="button"
              onClick={() => previewVoice()}
              disabled={!!previewing || !canPreviewSelected}
              className="btn-secondary"
            >
              <Play className="h-4 w-4" />
              {previewing ? "جاري التوليد..." : "معاينة"}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}

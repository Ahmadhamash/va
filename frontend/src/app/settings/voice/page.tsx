"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Mic, PlayCircle, Save, Volume2 } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { GradientCard } from "@/components/gradient-card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { apiClient } from "@/lib/api-client";

type Voice = {
  value: string;
  label: string;
  dialect: string;
  gender: string;
  voice_id?: string;
  sample_text?: string;
  source_label?: string;
};

const voiceModes = [
  { id: "off", label: "مطفي", hint: "الردود تبقى نصية فقط" },
  { id: "voice_when_voice", label: "للرسائل الصوتية", hint: "يرد صوتياً إذا العميل أرسل صوت" },
  { id: "text_and_voice", label: "نص وصوت", hint: "يرسل الرد كنص ومعه صوت" },
  { id: "always_voice", label: "صوت دائماً", hint: "كل رد يكون بصوت أيضاً" },
];

function normalizeAudioUrl(url?: string) {
  if (!url) return "";
  if (url.startsWith("/uploads/")) return `/api${url}`;
  if (!url.startsWith("http") && !url.startsWith("/")) return `/api/uploads/${url}`;
  return url;
}

export default function VoiceSettingsPage() {
  const [settings, setSettings] = useState<any>({
    voice_mode: "off",
    preferred_voice: "alloy",
    speech_speed: 1,
    voice_personality: "يا هلا، كيف بقدر أساعدك اليوم؟",
    tts_provider: "openai",
    audio_format: "mp3",
    fallback_to_text: true,
  });
  const [voices, setVoices] = useState<{ openai: Voice[]; elevenlabs: Voice[]; elevenlabs_available?: boolean; elevenlabs_message?: string }>({ openai: [], elevenlabs: [] });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [previewing, setPreviewing] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState("");
  const [notice, setNotice] = useState("");

  const activeVoices = useMemo(() => settings.tts_provider === "elevenlabs" ? voices.elevenlabs : voices.openai, [settings.tts_provider, voices]);

  async function load() {
    setLoading(true);
    try {
      const [settingsRes, voicesRes] = await Promise.all([
        apiClient.get("/voice-settings/"),
        apiClient.get("/voice-settings/voices"),
      ]);
      setSettings((current: any) => ({ ...current, ...settingsRes.data }));
      setVoices(voicesRes.data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function save() {
    setSaving(true);
    setNotice("");
    try {
      const payload = {
        voice_mode: settings.voice_mode,
        fallback_to_text: settings.fallback_to_text,
        max_audio_duration_seconds: settings.max_audio_duration_seconds,
        preferred_voice: settings.preferred_voice,
        stt_provider: settings.stt_provider,
        tts_provider: settings.tts_provider,
        audio_format: settings.audio_format,
        speech_speed: settings.speech_speed,
        voice_personality: settings.voice_personality,
        stt_config: settings.stt_config,
        tts_config: settings.tts_config,
      };
      await apiClient.put("/voice-settings/", payload);
      setNotice("تم حفظ إعدادات الصوت.");
    } catch (error: any) {
      let msg = "تعذر حفظ إعدادات الصوت.";
      const detail = error?.response?.data?.detail;
      if (Array.isArray(detail)) {
        msg = detail.map((e) => `${e.loc?.join(".") || ""}: ${e.msg}`).join(" | ");
      } else if (typeof detail === "string") {
        msg = detail;
      }
      setNotice(msg);
    } finally {
      setSaving(false);
    }
  }

  async function preview(voice?: Voice) {
    const selectedVoice = voice?.value || settings.preferred_voice;
    setPreviewing(selectedVoice);
    setNotice("");
    try {
      const res = await apiClient.post("/voice-settings/preview", {
        tts_provider: settings.tts_provider,
        preferred_voice: selectedVoice,
        speech_speed: settings.speech_speed,
        audio_format: settings.audio_format,
        text: voice?.sample_text || settings.voice_personality,
      });
      if (!res.data.success) throw new Error(res.data.error || "تعذر توليد المعاينة.");
      setAudioUrl(normalizeAudioUrl(res.data.audio_url));
    } catch (error: any) {
      let msg = error.message || "تعذر تشغيل المعاينة.";
      const detail = error?.response?.data?.detail;
      if (Array.isArray(detail)) {
        msg = detail.map((e) => `${e.loc?.join(".") || ""}: ${e.msg}`).join(" | ");
      } else if (typeof detail === "string") {
        msg = detail;
      }
      setNotice(msg);
    } finally {
      setPreviewing(null);
    }
  }

  if (loading) {
    return (
      <AppShell title="إعدادات الصوت" subtitle="اختيار صوت الوكيل ومعاينته.">
        <div className="flex h-96 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-emeraldx-400" />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="إعدادات الصوت" subtitle="أصوات OpenAI وElevenLabs مع معاينة حقيقية قبل الحفظ.">
      {notice && (
        <div className="mb-6 rounded-2xl border border-amber-400/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
          {notice}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
        <div className="space-y-6">
          <GradientCard>
            <div className="mb-5 flex items-center justify-between">
              <Mic className="h-5 w-5 text-emeraldx-400" />
              <h3 className="text-xl font-semibold text-white">تفعيل الصوت</h3>
            </div>
            <div className="grid gap-3 md:grid-cols-4">
              {voiceModes.map((mode) => (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => setSettings({ ...settings, voice_mode: mode.id })}
                  className={`rounded-2xl border p-4 text-right transition ${
                    settings.voice_mode === mode.id
                      ? "border-emeraldx-400/40 bg-emeraldx-500/12 text-white shadow-glow"
                      : "border-white/10 bg-white/[0.035] text-white/65"
                  }`}
                >
                  <div className="font-semibold">{mode.label}</div>
                  <div className="mt-2 text-xs leading-5 text-white/42">{mode.hint}</div>
                </button>
              ))}
            </div>
            {settings.voice_mode !== "off" && (
              <div className="mt-4 rounded-2xl border border-amber-400/20 bg-amber-500/10 p-4 text-sm text-amber-300">
                تفعيل الردود الصوتية يزيد كلفة التشغيل حسب مزود الصوت وعدد الرسائل الصوتية.
              </div>
            )}
          </GradientCard>

          <GradientCard>
            <div className="mb-5 flex items-center justify-between">
              <Volume2 className="h-5 w-5 text-emeraldx-400" />
              <h3 className="text-xl font-semibold text-white">مزود الصوت</h3>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {["openai", "elevenlabs"].map((provider) => (
                <button
                  key={provider}
                  type="button"
                  disabled={provider === "elevenlabs" && !voices.elevenlabs_available}
                  onClick={() => setSettings({ ...settings, tts_provider: provider, preferred_voice: provider === "openai" ? "alloy" : voices.elevenlabs[0]?.value || settings.preferred_voice })}
                  className={`rounded-2xl border p-4 text-right transition disabled:cursor-not-allowed disabled:opacity-45 ${
                    settings.tts_provider === provider
                      ? "border-emeraldx-400/40 bg-emeraldx-500/12 text-white"
                      : "border-white/10 bg-white/[0.035] text-white/65"
                  }`}
                >
                  <div className="font-semibold">{provider === "openai" ? "OpenAI" : "ElevenLabs"}</div>
                  <div className="mt-2 text-xs leading-5 text-white/42">
                    {provider === "openai" ? "أصوات ثابتة بكلفة أقل غالباً" : voices.elevenlabs_available ? "أصوات عربية من حساب ElevenLabs" : voices.elevenlabs_message || "غير مفعل"}
                  </div>
                </button>
              ))}
            </div>
          </GradientCard>

          <GradientCard>
            <div className="mb-5 flex items-center justify-between">
              <span className="text-xs text-white/40">{activeVoices.length} صوت</span>
              <h3 className="text-xl font-semibold text-white">اختيار الصوت</h3>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {activeVoices.map((voice) => (
                <div key={voice.value} className={`rounded-2xl border p-4 text-right ${settings.preferred_voice === voice.value ? "border-emeraldx-400/40 bg-emeraldx-500/12" : "border-white/10 bg-white/[0.035]"}`}>
                  <button type="button" className="w-full text-right" onClick={() => setSettings({ ...settings, preferred_voice: voice.value })}>
                    <div className="font-semibold text-white">{voice.label}</div>
                    <div className="mt-1 text-xs text-white/42">{voice.dialect} · {voice.gender}</div>
                    {voice.source_label && <div className="mt-1 text-[11px] text-cyanx-400">{voice.source_label}</div>}
                  </button>
                  <Button type="button" size="sm" variant="secondary" className="mt-3 w-full" onClick={() => preview(voice)} disabled={previewing === voice.value}>
                    <PlayCircle className="h-4 w-4" />
                    {previewing === voice.value ? "جاري التوليد..." : "سماع عينة"}
                  </Button>
                </div>
              ))}
            </div>
          </GradientCard>
        </div>

        <div className="space-y-6">
          <GradientCard>
            <h3 className="mb-4 text-lg font-semibold text-white">نص المعاينة</h3>
            <Textarea value={settings.voice_personality || ""} onChange={(e) => setSettings({ ...settings, voice_personality: e.target.value })} className="min-h-28 text-right" />
            <div className="mt-4 space-y-2">
              <label className="text-xs text-white/50">سرعة الصوت: {settings.speech_speed}x</label>
              <input
                type="range"
                min="0.5"
                max="2"
                step="0.1"
                value={settings.speech_speed}
                onChange={(e) => setSettings({ ...settings, speech_speed: Number(e.target.value) })}
                className="w-full accent-emeraldx-500"
              />
            </div>
            <Button className="mt-4 w-full" onClick={() => preview()} disabled={!!previewing}>
              <PlayCircle className="h-4 w-4" />
              معاينة الصوت المختار
            </Button>
            {audioUrl && (
              <audio className="mt-4 w-full" controls src={audioUrl} autoPlay>
                <track kind="captions" />
              </audio>
            )}
          </GradientCard>

          <Button className="w-full" onClick={save} disabled={saving}>
            <Save className="h-4 w-4" />
            {saving ? "جاري الحفظ..." : "حفظ إعدادات الصوت"}
          </Button>
        </div>
      </div>
    </AppShell>
  );
}

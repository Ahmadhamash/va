import { useEffect, useMemo, useState } from "react";
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
  { value: "off", label: "Off", desc: "Send text replies only." },
  {
    value: "voice_when_voice",
    label: "Voice for voice",
    desc: "Reply with audio only when the customer sends audio.",
  },
  { value: "always_voice", label: "Always voice", desc: "Every reply is audio." },
  {
    value: "text_and_voice",
    label: "Text + voice",
    desc: "Save both text and audio in the conversation.",
  },
];

const FALLBACK_VOICES = {
  openai: [
    { value: "nova", label: "Nova", dialect: "Arabic neutral", gender: "female" },
    { value: "alloy", label: "Alloy", dialect: "Arabic neutral", gender: "neutral" },
    { value: "shimmer", label: "Shimmer", dialect: "Arabic neutral", gender: "female" },
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
  const voices = useMemo(
    () => voiceOptions[provider] || [],
    [voiceOptions, provider]
  );
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
  const elevenlabsMissingPermissions =
    !!voiceOptions.elevenlabs_missing_permissions;
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
        (nextProvider === "openai"
          ? "nova"
          : prev?.preferred_voice || "custom_elevenlabs"),
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
      tts_config:
        provider === "elevenlabs"
          ? configForVoice(voice, prev?.tts_config)
          : prev?.tts_config || {},
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
      setMsg("Saved successfully.");
    } catch (e) {
      setMsg(e?.response?.data?.detail || "Save failed.");
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
        text: voiceToPreview?.sample_text,
      });
      if (!data.success) throw new Error(data.error || "Preview failed.");
      setPreviewUrl(mediaUrl(data.audio_url));
      if (
        provider === "elevenlabs" &&
        data.tts_provider &&
        data.tts_provider !== "elevenlabs"
      ) {
        setMsg("ElevenLabs rejected this voice, so the preview used OpenAI fallback.");
      }
    } catch (e) {
      setMsg(e?.response?.data?.detail || e.message || "Preview failed.");
    } finally {
      setPreviewing("");
    }
  }

  if (loading || !settings) {
    return <div className="p-8 text-gray-400">Loading...</div>;
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 space-y-6">
      <div>
        <h1 className="text-xl font-bold">Voice Settings</h1>
        <p className="text-sm text-gray-500 mt-1">
          Choose when the assistant replies with audio, then pick an OpenAI or
          ElevenLabs Arabic voice.
        </p>
      </div>

      <section className="bg-white rounded-xl shadow p-6 space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Reply mode
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {VOICE_MODES.map((mode) => (
              <button
                type="button"
                key={mode.value}
                onClick={() => update("voice_mode", mode.value)}
                className={`text-left p-3 rounded-lg border-2 transition ${
                  settings.voice_mode === mode.value
                    ? "border-brand-600 bg-brand-50"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <div className="font-medium text-sm">{mode.label}</div>
                <div className="text-xs text-gray-500 mt-0.5">{mode.desc}</div>
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Text to speech provider
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              ["openai", "OpenAI TTS", "Reliable fallback voice engine."],
              [
                "elevenlabs",
                "ElevenLabs",
                "Premium Arabic voices. Requires ELEVENLABS_API_KEY.",
              ],
            ].map(([value, label, desc]) => (
              <button
                type="button"
                key={value}
                onClick={() => chooseProvider(value)}
                className={`p-3 rounded-lg border-2 text-left transition ${
                  provider === value
                    ? "border-brand-600 bg-brand-50"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <div className="font-medium text-sm">{label}</div>
                <div className="text-xs text-gray-500 mt-0.5">{desc}</div>
              </button>
            ))}
          </div>
          {provider === "elevenlabs" && !elevenlabsAvailable && (
            <p className="text-xs text-amber-700 mt-2 bg-amber-50 rounded p-2">
              Add ELEVENLABS_API_KEY to the server .env and recreate backend +
              worker before using ElevenLabs.
            </p>
          )}
          {provider === "elevenlabs" && elevenlabsMessage && (
            <p className="text-xs text-amber-700 mt-2 bg-amber-50 rounded p-2">
              {elevenlabsMissingPermissions
                ? "Your ElevenLabs API key needs voices_read permission to load Arabic voices automatically."
                : elevenlabsMessage}
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Voice
          </label>
          {provider === "elevenlabs" && voices.length === 0 && (
            <div className="rounded-lg border border-dashed border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 mb-3">
              No Arabic ElevenLabs voices were loaded. Use an API key with
              voices_read permission, or paste a voice_id from your ElevenLabs
              Arabic library below.
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {voices.map((voice) => (
              <div
                key={voice.value}
                className={`rounded-lg border-2 p-3 ${
                  settings.preferred_voice === voice.value
                    ? "border-brand-600 bg-brand-50"
                    : "border-gray-200"
                }`}
              >
                <button
                  type="button"
                  onClick={() => chooseVoice(voice)}
                  className="block w-full text-left"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-sm">{voice.label}</span>
                    <span className="text-[11px] rounded bg-gray-100 px-2 py-0.5 text-gray-600">
                      {voice.gender}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {voice.dialect}
                  </div>
                  <div className="text-[11px] text-gray-400 mt-1">
                    {voice.source_label || "ElevenLabs"}
                    {voice.usable_note ? ` - ${voice.usable_note}` : ""}
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => previewVoice(voice)}
                  disabled={previewing === voice.value}
                  className="mt-3 text-xs rounded-md border border-gray-300 px-3 py-1.5 hover:bg-gray-50 disabled:opacity-50"
                >
                  {previewing === voice.value ? "Generating..." : "Preview"}
                </button>
              </div>
            ))}
          </div>
        </div>

        {provider === "elevenlabs" && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Custom ElevenLabs Voice ID
            </label>
            <input
              value={settings.tts_config?.voice_id || ""}
              onChange={(e) => updateCustomVoiceId(e.target.value)}
              placeholder="Paste a voice_id from ElevenLabs"
              className="w-full rounded-md border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-brand-500"
            />
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Speech speed: {settings.speech_speed}x
          </label>
          <input
            type="range"
            min="0.5"
            max="2.0"
            step="0.1"
            value={settings.speech_speed}
            onChange={(e) => update("speech_speed", parseFloat(e.target.value))}
            className="w-full"
          />
        </div>

        <label className="flex items-center gap-3 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={settings.fallback_to_text}
            onChange={(e) => update("fallback_to_text", e.target.checked)}
            className="rounded border-gray-300"
          />
          Send text if audio generation fails
        </label>

        {previewUrl && (
          <div className="rounded-lg bg-gray-50 p-3">
            <div className="text-xs text-gray-500 mb-2">
              Preview: {selectedVoice?.label || settings.tts_config?.voice_label}
            </div>
            <audio controls autoPlay src={previewUrl} className="w-full" />
          </div>
        )}

        {msg && <p className="text-sm text-gray-700">{msg}</p>}

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => previewVoice()}
            disabled={!!previewing || !canPreviewSelected}
            className="border border-gray-300 text-gray-700 rounded-md px-5 py-2 font-medium hover:bg-gray-50 disabled:opacity-50"
          >
            {previewing ? "Generating preview..." : "Preview selected voice"}
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="bg-brand-600 hover:bg-brand-700 text-white rounded-md px-6 py-2 font-medium disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save settings"}
          </button>
        </div>
      </section>
    </div>
  );
}

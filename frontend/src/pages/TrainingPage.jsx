import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext.jsx";
import api from "../services/api";

export default function TrainingPage() {
  const { t } = useTranslation();
  const { user, setUser } = useAuth();

  // Settings states
  const [businessName, setBusinessName] = useState("");
  const [plainPersona, setPlainPersona] = useState("");
  const [promptMode, setPromptMode] = useState("default");
  const [dialect, setDialect] = useState("jordanian");
  const [emoji, setEmoji] = useState("medium");
  const [tone, setTone] = useState("friendly");

  
  const [settingsBusy, setSettingsBusy] = useState(false);
  const [settingsMsg, setSettingsMsg] = useState("");
  const [settingsErr, setSettingsErr] = useState("");

  // Samples states
  const [samples, setSamples] = useState([]);
  const [myName, setMyName] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const fileRef = useRef(null);

  async function loadSamples() {
    try {
      const { data } = await api.get("/style/samples");
      setSamples(data);
    } catch (e) {
      console.error("Failed to load style samples", e);
    }
  }

  // Parse settings from user profile on load/change
  useEffect(() => {
    if (user) {
      setBusinessName(user.business_name || "");
      const persona = user.ai_persona || "";
      const match = persona.match(/<!--\s*({.*?})\s*-->/);
      if (match) {
        try {
          const config = JSON.parse(match[1]);
          setPromptMode(config.prompt_mode || "default");
          setDialect(config.dialect || "jordanian");
          setEmoji(config.emoji || "medium");
          setTone(config.tone || "friendly");
          setPlainPersona(persona.replace(match[0], "").trim());
        } catch (e) {
          setPlainPersona(persona);
          setPromptMode("default");
        }
      } else {
        setPlainPersona(persona);
        setPromptMode("default");
      }
    }
  }, [user]);

  useEffect(() => {
    loadSamples();
  }, []);

  async function handleSaveSettings(e) {
    e.preventDefault();
    setSettingsErr("");
    setSettingsMsg("");
    setSettingsBusy(true);

    const config = {
      prompt_mode: promptMode,

      dialect,
      emoji,
      tone
    };

    const mergedPersona = `${plainPersona.trim()}\n\n<!-- ${JSON.stringify(config)} -->`;

    try {
      const { data } = await api.put("/auth/me", {
        business_name: businessName.trim(),
        ai_persona: mergedPersona
      });
      setUser(data);
      setSettingsMsg(t("settings_saved"));
      setTimeout(() => setSettingsMsg(""), 4000);
    } catch (err2) {
      setSettingsErr(err2?.response?.data?.detail || t("settings_save_error"));
    } finally {
      setSettingsBusy(false);
    }
  }

  async function handleUpload(e) {
    e.preventDefault();
    setErr("");
    setMsg("");
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setErr("Choose a .txt, .json or .csv export first");
      return;
    }
    const fd = new FormData();
    fd.append("file", file);
    if (myName.trim()) fd.append("my_name", myName.trim());
    setBusy(true);
    try {
      const { data } = await api.post("/style/upload", fd);
      setMsg(`Added ${data.added} style samples (total ${data.total}).`);
      fileRef.current.value = "";
      await loadSamples();
      setTimeout(() => setMsg(""), 5000);
    } catch (e2) {
      setErr(e2?.response?.data?.detail || "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  async function deleteSample(id) {
    try {
      await api.delete(`/style/samples/${id}`);
      await loadSamples();
    } catch (e) {
      console.error("Failed to delete sample", e);
    }
  }

  async function clearAll() {
    if (!window.confirm("Remove ALL learned style samples?")) return;
    try {
      await api.delete("/style/samples");
      await loadSamples();
    } catch (e) {
      console.error("Failed to clear samples", e);
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t("smart_assistant_settings")}</h1>
        <p className="text-sm text-gray-500 mt-1">
          {t("txt_30")} {t("txt_31")} {t("txt_32")} {t("txt_33")} {t("txt_34")}
        </p>
      </div>

      {/* Main Settings Card */}
      <form onSubmit={handleSaveSettings} className="bg-white rounded-2xl shadow-sm border border-gray-150 p-6 space-y-6">
        <div className="grid grid-cols-1 gap-6">
          {/* Business Name */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              {t("business_name")}
            </label>
            <input
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder="e.g. My Cafe"
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-all text-sm"
            />
          </div>

        </div>

        {/* AI Voice Mode Toggle */}
        <div className="pt-4 border-t border-gray-100">
          <label className="block text-sm font-semibold text-gray-700 mb-3">
            {t("voice_mode")}
          </label>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 bg-gray-100 p-1 rounded-xl">
            {[
              { id: "default", label: t("prompt_mode_default") },
              { id: "custom_settings", label: t("prompt_mode_custom_settings") },
              { id: "full_prompt", label: t("prompt_mode_full_prompt") },
              { id: "samples", label: t("prompt_mode_samples") },
            ].map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setPromptMode(m.id)}
                className={`text-center py-2.5 rounded-lg font-medium text-xs sm:text-sm transition-all ${
                  promptMode === m.id
                    ? "bg-white text-brand-700 shadow-sm"
                    : "text-gray-500 hover:text-gray-800"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* Mode Settings Content */}
        {promptMode === "default" && (
          <div className="bg-brand-50 border border-brand-100 rounded-xl p-4 text-brand-800 text-xs sm:text-sm mt-4">
            💡 <strong>{t("prompt_mode_default")}</strong>: {t("prompt_mode_default_msg")}
          </div>
        )}

        {promptMode === "full_prompt" && (
          <div className="pt-4 mt-4 border-t border-gray-50">
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              {t("ai_persona")}
            </label>
            <textarea
              value={plainPersona}
              onChange={(e) => setPlainPersona(e.target.value)}
              placeholder={t("ai_persona_help")}
              rows={4}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-all text-sm"
            />
          </div>
        )}

        {promptMode === "custom_settings" && (
          <div className="space-y-4 pt-4 mt-4 border-t border-gray-50">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                {t("ai_persona")}
              </label>
              <textarea
                value={plainPersona}
                onChange={(e) => setPlainPersona(e.target.value)}
                placeholder={t("ai_persona_help")}
                rows={4}
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-all text-sm"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Arabic Dialect */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  {t("dialect")}
                </label>
                <select
                  value={dialect}
                  onChange={(e) => setDialect(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white text-sm"
                >
                  <option value="jordanian">{t("dialect_jordanian")}</option>
                  <option value="saudi">{t("dialect_saudi")}</option>
                  <option value="egyptian">{t("dialect_egyptian")}</option>
                  <option value="syrian">{t("dialect_syrian")}</option>
                  <option value="msa">{t("dialect_msa")}</option>
                </select>
              </div>

              {/* Tone of Voice */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  {t("tone_of_voice")}
                </label>
                <select
                  value={tone}
                  onChange={(e) => setTone(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white text-sm"
                >
                  <option value="friendly">{t("tone_friendly")}</option>
                  <option value="professional">{t("tone_professional")}</option>
                  <option value="salesy">{t("tone_salesy")}</option>
                </select>
              </div>

              {/* Emoji Level */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  {t("emoji_level")}
                </label>
                <select
                  value={emoji}
                  onChange={(e) => setEmoji(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white text-sm"
                >
                  <option value="none">{t("emoji_none")}</option>
                  <option value="low">{t("emoji_low")}</option>
                  <option value="medium">{t("emoji_medium")}</option>
                  <option value="high">{t("emoji_high")}</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {promptMode === "samples" && (
          <div className="bg-brand-50 border border-brand-100 rounded-xl p-4 text-brand-800 text-xs sm:text-sm mt-4">
            💡 <strong>{t("prompt_mode_samples")}</strong>: {t("txt_16")}
            <div className="mt-2 text-xs text-brand-600">
              * سيقوم المساعد بمحاكاة أسلوب الكلام الخاص بك تلقائياً من عينات المحادثات المرفوعة أدناه بدلاً من الخيارات المحددة مسبقاً.
            </div>
          </div>
        )}



        {/* Submit Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 border-t border-gray-100">
          <div className="w-full sm:w-auto text-center sm:text-left">
            {settingsErr && (
              <div className="text-red-600 text-sm font-semibold">{settingsErr}</div>
            )}
            {settingsMsg && (
              <div className="text-green-600 text-sm font-semibold">{settingsMsg}</div>
            )}
          </div>
          <button
            type="submit"
            disabled={settingsBusy}
            className="w-full sm:w-auto bg-brand-600 hover:bg-brand-700 text-white rounded-xl px-8 py-3 font-semibold disabled:opacity-60 transition-all shadow-sm text-sm"
          >
            {settingsBusy ? t("saving") : t("save")}
          </button>
        </div>
      </form>

      {/* Voice Cloning Details (Only displayed when samples mode is active) */}
      {promptMode === "samples" && (
        <div className="space-y-6 animate-fadeIn">
          {/* Upload Form */}
          <form onSubmit={handleUpload} className="bg-white rounded-2xl shadow-sm border border-gray-150 p-6 space-y-4">
            <h2 className="text-lg font-bold text-gray-900">{t("nav_training")} — {t("voice_mode_samples")}</h2>
            <p className="text-xs sm:text-sm text-gray-500">
              Upload your past conversations (WhatsApp/Messenger export as{" "}
              <code>.txt</code>/<code>.json</code>, or a <code>.csv</code> with
              sender/text columns). The AI copies your tone and phrasing only — it
              still answers facts strictly from your catalog.
            </p>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Your name as it appears in the chat (optional but recommended)
              </label>
              <input
                value={myName}
                onChange={(e) => setMyName(e.target.value)}
                placeholder="e.g. Ahmad"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm"
              />
              <p className="text-xs text-gray-400 mt-1">
                Used to pick out your replies so the AI learns your side of the
                conversation.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Conversation file
              </label>
              <input
                ref={fileRef}
                type="file"
                accept=".txt,.json,.csv"
                className="block w-full text-sm text-gray-600 file:me-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-brand-50 file:text-brand-700 text-xs sm:text-sm"
              />
            </div>

            {err && (
              <div className="bg-red-50 text-red-700 text-sm rounded-lg px-3 py-2">
                {err}
              </div>
            )}
            {msg && (
              <div className="bg-green-50 text-green-700 text-sm rounded-lg px-3 py-2">
                {msg}
              </div>
            )}

            <button
              disabled={busy}
              className="bg-brand-600 hover:bg-brand-700 text-white rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-60 transition-all"
            >
              {busy ? "Processing…" : "Upload & learn"}
            </button>
          </form>

          {/* Learned style samples list */}
          <section className="bg-white rounded-2xl shadow-sm border border-gray-150 p-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold text-gray-900">
                Learned style samples ({samples.length})
              </h2>
              {samples.length > 0 && (
                <button
                  onClick={clearAll}
                  className="text-xs sm:text-sm text-red-600 border border-red-300 rounded-lg px-3 py-1.5 hover:bg-red-50 transition-all"
                >
                  Clear all
                </button>
              )}
            </div>
            {samples.length === 0 ? (
              <p className="text-sm text-gray-400">
                Nothing learned yet. Upload a conversation above.
              </p>
            ) : (
              <ul className="space-y-2 max-h-[420px] overflow-y-auto">
                {samples.map((s) => (
                  <li
                    key={s.id}
                    className="border border-gray-200 rounded-xl p-3 text-sm flex justify-between gap-3 bg-gray-50"
                  >
                    <pre className="whitespace-pre-wrap break-words font-sans text-gray-700 text-xs sm:text-sm">
                      {s.sample}
                    </pre>
                    <button
                      onClick={() => deleteSample(s.id)}
                      className="text-gray-400 hover:text-red-600 shrink-0 text-lg font-bold"
                      title="Delete"
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

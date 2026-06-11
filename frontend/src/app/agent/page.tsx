"use client";

import { useEffect, useState } from "react";
import { Bot, CheckCircle2, Handshake, MessageCircle, ShieldCheck, Sparkles, X, Plus } from "lucide-react";
import { AgentPreview } from "@/components/agent-preview";
import { AppShell } from "@/components/app-shell";
import { ToggleSetting } from "@/components/toggle-setting";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { GradientCard } from "@/components/gradient-card";
import { useAuthStore } from "@/store/use-auth-store";
import { useLanguageStore } from "@/store/use-language-store";

const dialectsAr = [
  { id: "jordanian", label: "أردني", hint: "لهجة يومية قريبة من السوق الأردني" },
  { id: "syrian", label: "شامي", hint: "أسلوب لطيف ومفهوم في بلاد الشام" },
  { id: "saudi", label: "خليجي", hint: "مناسب لعملاء السعودية والخليج" },
  { id: "egyptian", label: "مصري", hint: "خفيف وواضح للعملاء المصريين" },
  { id: "msa", label: "عربي مبسط", hint: "رسمي وواضح بدون عامية قوية" },
] as const;

const dialectsEn = [
  { id: "jordanian", label: "Jordanian", hint: "Daily dialect close to the Jordanian market" },
  { id: "syrian", label: "Levantine", hint: "Kind and understandable style in the Levant" },
  { id: "saudi", label: "Gulf", hint: "Suitable for clients in Saudi Arabia and the Gulf" },
  { id: "egyptian", label: "Egyptian", hint: "Light and clear for Egyptian customers" },
  { id: "msa", label: "Modern Standard", hint: "Formal and clear without strong colloquialisms" },
] as const;

const tonesAr = [
  { id: "friendly", label: "ودود", hint: "دافئ وسريع وقريب من العميل" },
  { id: "professional", label: "مهني", hint: "مختصر ومحترم ومناسب للعلامات الرسمية" },
  { id: "salesy", label: "مبيعات", hint: "نشط ومقنع بدون مبالغة" },
] as const;

const tonesEn = [
  { id: "friendly", label: "Friendly", hint: "Warm, prompt, and close to the customer" },
  { id: "professional", label: "Professional", hint: "Brief, respectful, and suitable for official brands" },
  { id: "salesy", label: "Sales", hint: "Active and persuasive without exaggeration" },
] as const;

const strictnessOptionsAr = [
  { id: "strict", label: "صارم", hint: "لا يجاوب إلا من قاعدة المعرفة" },
  { id: "balanced", label: "متوازن", hint: "يسأل توضيح ويرفض التخمين" },
  { id: "guided", label: "إرشادي", hint: "يساعد بأسئلة متابعة بدون اختراع حقائق" },
] as const;

const strictnessOptionsEn = [
  { id: "strict", label: "Strict", hint: "Only answers from the knowledge base" },
  { id: "balanced", label: "Balanced", hint: "Asks for clarification and rejects guessing" },
  { id: "guided", label: "Guided", hint: "Helps with follow-up questions without inventing facts" },
] as const;

function parsePersonaConfig(persona?: string | null) {
  const match = persona?.match(/<!--\s*({.*?})\s*-->/);
  if (!match) return {};
  try {
    return JSON.parse(match[1]);
  } catch {
    return {};
  }
}

export default function AgentSettingsPage() {
  const { token, user, setAuth } = useAuthStore();
  const language = useLanguageStore((state) => state.language);
  const isRtl = language === "ar";

  const dialects = isRtl ? dialectsAr : dialectsEn;
  const tones = isRtl ? tonesAr : tonesEn;
  const strictnessOptions = isRtl ? strictnessOptionsAr : strictnessOptionsEn;

  const [notice, setNotice] = useState("");
  const [agentName, setAgentName] = useState(isRtl ? "مساعد chatter" : "chatter Assistant");
  const [dialect, setDialect] = useState("jordanian");
  const [tone, setTone] = useState("friendly");
  const [strictness, setStrictness] = useState("balanced");
  const [workingHours, setWorkingHours] = useState(isRtl ? "9 صباحاً - 6 مساءً" : "9 AM - 6 PM");
  const [fallbackMessage, setFallbackMessage] = useState(isRtl ? "ثواني بس، رح أحولك لموظف يساعدك بشكل أدق." : "Just a second, I will connect you to a staff member to assist you better.");
  const [angryHandoff, setAngryHandoff] = useState(true);
  const [refundHandoff, setRefundHandoff] = useState(true);
  const [sensitiveHandoff, setSensitiveHandoff] = useState(true);
  const [bannedPhrases, setBannedPhrases] = useState<string[]>(isRtl ? ["مجاني بالكامل", "خصم سري"] : ["completely free", "secret discount"]);
  const [phraseInput, setPhraseInput] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const config = parsePersonaConfig(user?.ai_persona);
    if (typeof config.dialect === "string") setDialect(config.dialect);
    if (typeof config.tone === "string") setTone(config.tone);
    if (typeof config.strictness === "string") setStrictness(config.strictness);
    if (typeof config.agent_name === "string") setAgentName(config.agent_name);
    if (typeof config.working_hours === "string") setWorkingHours(config.working_hours);
    if (typeof config.fallback_message === "string") setFallbackMessage(config.fallback_message);
    if (typeof config.handoff_angry === "boolean") setAngryHandoff(config.handoff_angry);
    if (typeof config.handoff_refund === "boolean") setRefundHandoff(config.handoff_refund);
    if (typeof config.handoff_sensitive === "boolean") setSensitiveHandoff(config.handoff_sensitive);
    if (Array.isArray(config.banned_phrases)) setBannedPhrases(config.banned_phrases);
  }, [user?.ai_persona]);

  async function handleSave() {
    if (!token) return;
    setSaving(true);
    setNotice("");
    const config = {
      prompt_mode: "custom_settings",
      dialect,
      tone,
      emoji: "low",
      strictness,
      agent_name: agentName,
      working_hours: workingHours,
      fallback_message: fallbackMessage,
      handoff_angry: angryHandoff,
      handoff_refund: refundHandoff,
      handoff_sensitive: sensitiveHandoff,
      banned_phrases: bannedPhrases,
    };
    const persona = [
      `<!-- ${JSON.stringify(config)} -->`,
      `اسم الوكيل الظاهر للعملاء: ${agentName}.`,
      `أوقات العمل: ${workingHours}.`,
      `مستوى الالتزام: ${strictness}. لا تخترع منتجات أو أسعار أو وعود غير موجودة في قاعدة المعرفة.`,
      bannedPhrases.length ? `تجنب هذه العبارات: ${bannedPhrases.join(", ")}.` : "",
      `رسالة التحويل البشري: ${fallbackMessage}`,
    ].filter(Boolean).join("\n");

    try {
      const res = await fetch("/api/auth/me", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ ai_persona: persona }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || (isRtl ? "تعذر حفظ إعدادات الوكيل." : "Could not save agent settings."));
      setAuth(token, data);
      setNotice(isRtl ? "تم حفظ إعدادات الوكيل وتطبيقها على نظام الذكاء." : "Agent settings saved and applied to the AI system.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : (isRtl ? "صار خطأ أثناء الحفظ." : "Error occurred while saving."));
    } finally {
      setSaving(false);
    }
  }

  function addBannedPhrase() {
    const clean = phraseInput.trim();
    if (clean && !bannedPhrases.includes(clean)) {
      setBannedPhrases([...bannedPhrases, clean]);
      setPhraseInput("");
    }
  }

  return (
    <AppShell 
      title={isRtl ? "الوكيل الذكي" : "Smart AI Agent"} 
      subtitle={isRtl ? "إعدادات آمنة ومفهومة بدون تعريض System Prompt أو Temperature للعميل." : "Safe, understandable controls without exposing System Prompt or Temperature to the user."}
    >
      <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
        <div className="space-y-6">
          {notice && (
            <div className="rounded-2xl border border-primary-400/20 bg-primary-500/10 px-5 py-4 text-sm font-semibold text-primary-400">
              {notice}
            </div>
          )}

          <GradientCard>
            <div className="mb-5 flex items-center justify-between">
              <Sparkles className="h-5 w-5 text-primary-400" />
              <h2 className="text-xl font-semibold text-white">{isRtl ? "هوية الوكيل" : "Agent Identity"}</h2>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 rtl:text-right ltr:text-left">
                <label className="text-xs font-semibold text-white/60">{isRtl ? "اسم الوكيل" : "Agent Name"}</label>
                <Input value={agentName} onChange={(e) => setAgentName(e.target.value)} className="rtl:text-right ltr:text-left" />
              </div>
              <div className="space-y-2 rtl:text-right ltr:text-left">
                <label className="text-xs font-semibold text-white/60">{isRtl ? "أوقات العمل" : "Working Hours"}</label>
                <Input value={workingHours} onChange={(e) => setWorkingHours(e.target.value)} className="rtl:text-right ltr:text-left" />
              </div>
            </div>
          </GradientCard>

          <GradientCard>
            <div className="mb-5 flex items-center justify-between">
              <MessageCircle className="h-5 w-5 text-primary-400" />
              <h2 className="text-xl font-semibold text-white">{isRtl ? "لهجة الوكيل" : "Agent Dialect"}</h2>
            </div>
            <div className="grid gap-3 md:grid-cols-5">
              {dialects.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setDialect(item.id)}
                  className={`rounded-2xl border p-4 text-start transition ${
                    dialect === item.id
                      ? "border-primary-400/40 bg-primary-500/12 text-white shadow-glow"
                      : "border-white/10 bg-white/[0.035] text-white/65 hover:border-white/18 hover:bg-white/[0.06]"
                  }`}
                >
                  <div className="font-semibold">{item.label}</div>
                  <div className="mt-2 text-xs leading-5 text-white/42">{item.hint}</div>
                </button>
              ))}
            </div>
          </GradientCard>

          <GradientCard>
            <div className="mb-5 flex items-center justify-between">
              <Bot className="h-5 w-5 text-primary-400" />
              <h2 className="text-xl font-semibold text-white">{isRtl ? "النبرة والالتزام" : "Tone & Strictness"}</h2>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              {tones.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTone(item.id)}
                  className={`rounded-2xl border p-4 text-start transition ${
                    tone === item.id ? "border-primary-400/40 bg-primary-500/12 text-white" : "border-white/10 bg-white/[0.035] text-white/65"
                  }`}
                >
                  <div className="font-semibold">{item.label}</div>
                  <div className="mt-2 text-xs leading-5 text-white/42">{item.hint}</div>
                </button>
              ))}
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {strictnessOptions.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setStrictness(item.id)}
                  className={`rounded-2xl border p-4 text-start transition ${
                    strictness === item.id ? "border-cyanx-400/40 bg-cyanx-500/12 text-white" : "border-white/10 bg-white/[0.035] text-white/65"
                  }`}
                >
                  <div className="font-semibold">{item.label}</div>
                  <div className="mt-2 text-xs leading-5 text-white/42">{item.hint}</div>
                </button>
              ))}
            </div>
          </GradientCard>

          <GradientCard>
            <div className="mb-5 flex items-center justify-between">
              <Handshake className="h-5 w-5 text-primary-400" />
              <h2 className="text-xl font-semibold text-white">{isRtl ? "التحويل البشري" : "Human Handoff"}</h2>
            </div>
            <div className="space-y-3">
              <ToggleSetting 
                title={isRtl ? "غضب أو شكوى واضحة" : "Anger or clear complaint"} 
                description={isRtl ? "تتحول المحادثة لموظف بدل استمرار الذكاء بالرد." : "Transfers the chat to support staff instead of auto-responding."} 
                checked={angryHandoff} 
                onChange={setAngryHandoff} 
              />
              <ToggleSetting 
                title={isRtl ? "إلغاء أو استرجاع أو مشكلة دفع" : "Cancellation, refund, or payment issue"} 
                description={isRtl ? "الحالات المالية تنتقل لموظف المنصة." : "Financial cases transfer directly to support agents."} 
                checked={refundHandoff} 
                onChange={setRefundHandoff} 
              />
              <ToggleSetting 
                title={isRtl ? "معلومات حساسة أو قانونية" : "Sensitive or legal info"} 
                description={isRtl ? "الذكاء يتوقف عن التخمين ويطلب تدخل بشري." : "AI stops guessing and prompts for human support."} 
                checked={sensitiveHandoff} 
                onChange={setSensitiveHandoff} 
              />
            </div>
            <Textarea className="mt-4 min-h-24 rtl:text-right ltr:text-left" value={fallbackMessage} onChange={(e) => setFallbackMessage(e.target.value)} />
          </GradientCard>

          <GradientCard>
            <div className="mb-5 flex items-center justify-between">
              <ShieldCheck className="h-5 w-5 text-primary-400" />
              <h2 className="text-xl font-semibold text-white">{isRtl ? "عبارات ممنوعة" : "Forbidden Phrases"}</h2>
            </div>
            <div className="flex gap-2">
              <Button type="button" size="sm" onClick={addBannedPhrase} className="h-10">
                <Plus className="h-4 w-4" />
              </Button>
              <Input
                value={phraseInput}
                onChange={(e) => setPhraseInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addBannedPhrase();
                  }
                }}
                className="h-10 rtl:text-right ltr:text-left"
                placeholder={isRtl ? "مثال: مجاني بالكامل" : "e.g., completely free"}
              />
            </div>
            <div className="mt-4 flex flex-wrap gap-2 rtl:justify-end ltr:justify-start">
              {bannedPhrases.map((phrase) => (
                <span key={phrase} className="inline-flex items-center gap-2 rounded-full border border-red-500/20 bg-red-500/10 px-3 py-1.5 text-xs text-red-200">
                  <button type="button" onClick={() => setBannedPhrases(bannedPhrases.filter((item) => item !== phrase))}>
                    <X className="h-3 w-3" />
                  </button>
                  {phrase}
                </span>
              ))}
            </div>
          </GradientCard>

          <Button className="w-full" onClick={handleSave} disabled={saving}>
            <CheckCircle2 className="h-4 w-4" />
            {saving ? (isRtl ? "جاري الحفظ..." : "Saving...") : (isRtl ? "حفظ إعدادات الوكيل" : "Save Agent Settings")}
          </Button>
        </div>

        <div className="space-y-6">
          <div className="sticky top-24">
            <AgentPreview
              agentName={agentName}
              dialect={dialect}
              tone={tone}
              strictness={strictness}
              workingHours={workingHours}
              fallbackMessage={fallbackMessage}
              bannedPhrases={bannedPhrases}
              handoffToggles={{
                angry: angryHandoff,
                refund: refundHandoff,
                sensitive: sensitiveHandoff,
              }}
            />
          </div>
        </div>
      </div>
    </AppShell>
  );
}


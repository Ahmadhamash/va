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

const dialects = [
  { id: "jordanian", label: "أردني", hint: "لهجة يومية قريبة من السوق الأردني" },
  { id: "syrian", label: "شامي", hint: "أسلوب لطيف ومفهوم في بلاد الشام" },
  { id: "saudi", label: "خليجي", hint: "مناسب لعملاء السعودية والخليج" },
  { id: "egyptian", label: "مصري", hint: "خفيف وواضح للعملاء المصريين" },
  { id: "msa", label: "عربي مبسط", hint: "رسمي وواضح بدون عامية قوية" },
] as const;

const tones = [
  { id: "friendly", label: "ودود", hint: "دافئ وسريع وقريب من العميل" },
  { id: "professional", label: "مهني", hint: "مختصر ومحترم ومناسب للعلامات الرسمية" },
  { id: "salesy", label: "مبيعات", hint: "نشط ومقنع بدون مبالغة" },
] as const;

const strictnessOptions = [
  { id: "strict", label: "صارم", hint: "لا يجاوب إلا من قاعدة المعرفة" },
  { id: "balanced", label: "متوازن", hint: "يسأل توضيح ويرفض التخمين" },
  { id: "guided", label: "إرشادي", hint: "يساعد بأسئلة متابعة بدون اختراع حقائق" },
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
  const [notice, setNotice] = useState("");
  const [agentName, setAgentName] = useState("مساعد chatter");
  const [dialect, setDialect] = useState("jordanian");
  const [tone, setTone] = useState("friendly");
  const [strictness, setStrictness] = useState("balanced");
  const [workingHours, setWorkingHours] = useState("9 صباحاً - 6 مساءً");
  const [fallbackMessage, setFallbackMessage] = useState("ثواني بس، رح أحولك لموظف يساعدك بشكل أدق.");
  const [angryHandoff, setAngryHandoff] = useState(true);
  const [refundHandoff, setRefundHandoff] = useState(true);
  const [sensitiveHandoff, setSensitiveHandoff] = useState(true);
  const [bannedPhrases, setBannedPhrases] = useState<string[]>(["مجاني بالكامل", "خصم سري"]);
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
      if (!res.ok) throw new Error(data.detail || "تعذر حفظ إعدادات الوكيل.");
      setAuth(token, data);
      setNotice("تم حفظ إعدادات الوكيل وتطبيقها على نظام الذكاء.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "صار خطأ أثناء الحفظ.");
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
    <AppShell title="الوكيل الذكي" subtitle="إعدادات آمنة ومفهومة بدون تعريض System Prompt أو Temperature للعميل.">
      <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
        <div className="space-y-6">
          {notice && (
            <div className="rounded-2xl border border-emeraldx-400/20 bg-emeraldx-500/10 px-5 py-4 text-sm font-semibold text-emeraldx-400">
              {notice}
            </div>
          )}

          <GradientCard>
            <div className="mb-5 flex items-center justify-between">
              <Sparkles className="h-5 w-5 text-emeraldx-400" />
              <h2 className="text-xl font-semibold text-white">هوية الوكيل</h2>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 text-right">
                <label className="text-xs font-semibold text-white/60">اسم الوكيل</label>
                <Input value={agentName} onChange={(e) => setAgentName(e.target.value)} className="text-right" />
              </div>
              <div className="space-y-2 text-right">
                <label className="text-xs font-semibold text-white/60">أوقات العمل</label>
                <Input value={workingHours} onChange={(e) => setWorkingHours(e.target.value)} className="text-right" />
              </div>
            </div>
          </GradientCard>

          <GradientCard>
            <div className="mb-5 flex items-center justify-between">
              <MessageCircle className="h-5 w-5 text-emeraldx-400" />
              <h2 className="text-xl font-semibold text-white">لهجة الوكيل</h2>
            </div>
            <div className="grid gap-3 md:grid-cols-5">
              {dialects.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setDialect(item.id)}
                  className={`rounded-2xl border p-4 text-right transition ${
                    dialect === item.id
                      ? "border-emeraldx-400/40 bg-emeraldx-500/12 text-white shadow-glow"
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
              <Bot className="h-5 w-5 text-emeraldx-400" />
              <h2 className="text-xl font-semibold text-white">النبرة والالتزام</h2>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              {tones.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTone(item.id)}
                  className={`rounded-2xl border p-4 text-right transition ${
                    tone === item.id ? "border-emeraldx-400/40 bg-emeraldx-500/12 text-white" : "border-white/10 bg-white/[0.035] text-white/65"
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
                  className={`rounded-2xl border p-4 text-right transition ${
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
              <Handshake className="h-5 w-5 text-emeraldx-400" />
              <h2 className="text-xl font-semibold text-white">التحويل البشري</h2>
            </div>
            <div className="space-y-3">
              <ToggleSetting title="غضب أو شكوى واضحة" description="تتحول المحادثة لموظف بدل استمرار الذكاء بالرد." checked={angryHandoff} onChange={setAngryHandoff} />
              <ToggleSetting title="إلغاء أو استرجاع أو مشكلة دفع" description="الحالات المالية تنتقل لموظف المنصة." checked={refundHandoff} onChange={setRefundHandoff} />
              <ToggleSetting title="معلومات حساسة أو قانونية" description="الذكاء يتوقف عن التخمين ويطلب تدخل بشري." checked={sensitiveHandoff} onChange={setSensitiveHandoff} />
            </div>
            <Textarea className="mt-4 min-h-24 text-right" value={fallbackMessage} onChange={(e) => setFallbackMessage(e.target.value)} />
          </GradientCard>

          <GradientCard>
            <div className="mb-5 flex items-center justify-between">
              <ShieldCheck className="h-5 w-5 text-emeraldx-400" />
              <h2 className="text-xl font-semibold text-white">عبارات ممنوعة</h2>
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
                className="h-10 text-right"
                placeholder="مثال: مجاني بالكامل"
              />
            </div>
            <div className="mt-4 flex flex-wrap justify-end gap-2">
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
            {saving ? "جاري الحفظ..." : "حفظ إعدادات الوكيل"}
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

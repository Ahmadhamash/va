"use client";

import { useState, useEffect } from "react";
import { AgentPreview } from "@/components/agent-preview";
import { AppShell } from "@/components/app-shell";
import { ToggleSetting } from "@/components/toggle-setting";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Sparkles, X, Plus } from "lucide-react";

export default function AgentSettingsPage() {
  const [isLoaded, setIsLoaded] = useState(false);
  const [notice, setNotice] = useState("");

  // Agent Settings States
  const [agentName, setAgentName] = useState("مساعد مسار");
  const [responseLanguage, setResponseLanguage] = useState("العربية");
  const [tone, setTone] = useState("عربي ودود (لهجة أردنية)");
  const [workingHours, setWorkingHours] = useState("9 ص - 11 م");
  const [strictness, setStrictness] = useState("متوازن");
  const [systemPrompt, setSystemPrompt] = useState(
    "أنت وكيل ذكي تمثل منصة مسار، وظيفتك الإجابة عن استفسارات العملاء بخصوص ربط القنوات المختلفة كواتساب وتلقي الرسائل وتفعيل الحسابات."
  );
  const [temperature, setTemperature] = useState(0.5);
  const [fallbackMessage, setFallbackMessage] = useState(
    "لحظة من فضلك، رح أحولك لموظف يساعدك بشكل أفضل."
  );
  
  // Toggles
  const [angryHandoff, setAngryHandoff] = useState(true);
  const [refundHandoff, setRefundHandoff] = useState(true);
  const [sensitiveHandoff, setSensitiveHandoff] = useState(true);

  // Banned Phrases
  const [bannedPhrases, setBannedPhrases] = useState<string[]>(["مجاني بالكامل", "خصم سري"]);
  const [phraseInput, setPhraseInput] = useState("");

  // Load from localStorage on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedName = localStorage.getItem("agent_name");
      const savedLang = localStorage.getItem("agent_lang");
      const savedTone = localStorage.getItem("agent_tone");
      const savedHours = localStorage.getItem("agent_hours");
      const savedStrictness = localStorage.getItem("agent_strictness");
      const savedPrompt = localStorage.getItem("agent_prompt");
      const savedTemp = localStorage.getItem("agent_temp");
      const savedFallback = localStorage.getItem("agent_fallback");
      const savedAngry = localStorage.getItem("agent_angry");
      const savedRefund = localStorage.getItem("agent_refund");
      const savedSensitive = localStorage.getItem("agent_sensitive");
      const savedBanned = localStorage.getItem("agent_banned");

      if (savedName) setAgentName(savedName);
      if (savedLang) setResponseLanguage(savedLang);
      if (savedTone) setTone(savedTone);
      if (savedHours) setWorkingHours(savedHours);
      if (savedStrictness) setStrictness(savedStrictness);
      if (savedPrompt) setSystemPrompt(savedPrompt);
      if (savedTemp) setTemperature(parseFloat(savedTemp));
      if (savedFallback) setFallbackMessage(savedFallback);
      if (savedAngry) setAngryHandoff(savedAngry === "true");
      if (savedRefund) setRefundHandoff(savedRefund === "true");
      if (savedSensitive) setSensitiveHandoff(savedSensitive === "true");
      if (savedBanned) {
        try {
          setBannedPhrases(JSON.parse(savedBanned));
        } catch (e) {
          console.error(e);
        }
      }
      setIsLoaded(true);
    }
  }, []);

  const handleSave = () => {
    localStorage.setItem("agent_name", agentName);
    localStorage.setItem("agent_lang", responseLanguage);
    localStorage.setItem("agent_tone", tone);
    localStorage.setItem("agent_hours", workingHours);
    localStorage.setItem("agent_strictness", strictness);
    localStorage.setItem("agent_prompt", systemPrompt);
    localStorage.setItem("agent_temp", temperature.toString());
    localStorage.setItem("agent_fallback", fallbackMessage);
    localStorage.setItem("agent_angry", angryHandoff.toString());
    localStorage.setItem("agent_refund", refundHandoff.toString());
    localStorage.setItem("agent_sensitive", sensitiveHandoff.toString());
    localStorage.setItem("agent_banned", JSON.stringify(bannedPhrases));

    setNotice("✨ تم حفظ وتطبيق إعدادات الوكيل الذكي بنجاح!");
    setTimeout(() => setNotice(""), 4000);
  };

  const addBannedPhrase = () => {
    if (phraseInput.trim() && !bannedPhrases.includes(phraseInput.trim())) {
      setBannedPhrases([...bannedPhrases, phraseInput.trim()]);
      setPhraseInput("");
    }
  };

  const removeBannedPhrase = (phraseToRemove: string) => {
    setBannedPhrases(bannedPhrases.filter(p => p !== phraseToRemove));
  };

  return (
    <AppShell title="الوكيل الذكي" subtitle="تحكم كامل بقوة الوكيل، حدوده، وطريقته بالحديث مع تفعيل التحسينات التجريبية.">
      <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
        {/* Settings Form */}
        <div className="space-y-6">
          {notice && (
            <div className="rounded-3xl border border-emeraldx-400/20 bg-emeraldx-500/10 px-5 py-4 text-sm font-semibold text-emeraldx-400 text-right animate-pulse">
              {notice}
            </div>
          )}

          {/* Card 1: Basics */}
          <Card className="rounded-3xl border border-white/10 bg-white/[0.02]">
            <CardHeader className="text-right">
              <CardTitle className="text-lg font-bold text-white flex items-center gap-2 justify-end">
                <span>أساسيات الوكيل</span>
                <Sparkles className="h-5 w-5 text-emeraldx-400" />
              </CardTitle>
              <CardDescription className="text-sm text-white/45">إعدادات الهوية ومظهر المحادثة الأساسي للوكيل.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5 text-right">
                <label className="text-xs font-semibold text-white/60">اسم الوكيل</label>
                <Input className="text-right" placeholder="اسم الوكيل" value={agentName} onChange={(e) => setAgentName(e.target.value)} />
              </div>
              <div className="space-y-1.5 text-right">
                <label className="text-xs font-semibold text-white/60">لغة الرد الأساسية</label>
                <Input className="text-right" placeholder="لغة الرد" value={responseLanguage} onChange={(e) => setResponseLanguage(e.target.value)} />
              </div>
              <div className="space-y-1.5 text-right">
                <label className="text-xs font-semibold text-white/60 font-medium">أسلوب وصوت الوكيل (اللهجة)</label>
                <select
                  value={tone}
                  onChange={(e) => setTone(e.target.value)}
                  className="w-full h-11 px-3 rounded-2xl border border-white/12 bg-white/5 hover:bg-white/10 transition text-white text-sm text-right focus:outline-none focus:ring-2 focus:ring-emeraldx-400/70"
                >
                  <option value="عربي ودود (لهجة أردنية)" className="bg-ink-950">عربي ودود (لهجة أردنية)</option>
                  <option value="سعودي تسويقي (لهجة سعودية)" className="bg-ink-950">سعودي تسويقي (لهجة سعودية)</option>
                  <option value="مصري مرح (لهجة مصرية)" className="bg-ink-950">مصري مرح (لهجة مصرية)</option>
                  <option value="رسمي مهني (عربية فصحى)" className="bg-ink-950">رسمي مهني (عربية فصحى)</option>
                </select>
              </div>
              <div className="space-y-1.5 text-right">
                <label className="text-xs font-semibold text-white/60">أوقات العمل المحددة</label>
                <Input className="text-right" placeholder="أوقات العمل" value={workingHours} onChange={(e) => setWorkingHours(e.target.value)} />
              </div>
            </CardContent>
          </Card>

          {/* Card 2: Advanced Prompts & Temperature */}
          <Card className="rounded-3xl border border-white/10 bg-white/[0.02]">
            <CardHeader className="text-right">
              <CardTitle className="text-lg font-bold text-white justify-end flex">توجيه الوكيل والإبداع</CardTitle>
              <CardDescription className="text-sm text-white/45">اكتب تفاصيل هوية الوكيل وعمله الأساسي ومستوى ابتكاره.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5 text-right">
                <label className="text-xs font-semibold text-white/60">تعليمات النظام للوكيل (System Prompt)</label>
                <Textarea
                  className="text-right min-h-[100px] text-xs leading-6"
                  placeholder="حدد لهجة الوكيل، هويته، وما يجب وما يمنع عليه الإجابة عنه..."
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                />
              </div>
              <div className="space-y-2 text-right">
                <div className="flex justify-between items-center text-xs font-semibold text-white/60">
                  <span className="text-emeraldx-400 font-bold">{temperature}</span>
                  <span>درجة الابتكار والتفكير (Temperature)</span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="1.0"
                  step="0.05"
                  value={temperature}
                  onChange={(e) => setTemperature(parseFloat(e.target.value))}
                  className="w-full accent-emeraldx-500 bg-white/10 rounded-lg appearance-none h-1.5 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-white/35">
                  <span>إبداعي ومرن جداً (1.0)</span>
                  <span>دقيق وملتزم جداً بالحقائق (0.1)</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Card 3: Strictness */}
          <Card className="rounded-3xl border border-white/10 bg-white/[0.02]">
            <CardHeader className="text-right">
              <CardTitle className="text-lg font-bold text-white justify-end flex">صرامة المعرفة</CardTitle>
              <CardDescription className="text-sm text-white/45">كيف يتعامل الوكيل مع استفسارات ليست متوفرة بقاعدة البيانات.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-3">
              {[
                { name: "صارم: من قاعدة المعرفة فقط", desc: "يرفض الإجابة عن أي شيء خارجي" },
                { name: "متوازن", desc: "إجابات ذكية مع الالتزام بالسياق" },
                { name: "مرن", desc: "ودود وحواري مع إمكانية التوضيح" }
              ].map((mode) => (
                <button
                  type="button"
                  key={mode.name}
                  onClick={() => setStrictness(mode.name)}
                  className={
                    strictness === mode.name
                      ? "rounded-3xl bg-emeraldx-500 p-4 text-right text-xs font-bold text-ink-950 shadow-glow"
                      : "rounded-3xl border border-white/10 bg-white/[0.055] p-4 text-right text-xs font-semibold text-white/72 transition hover:bg-white/10"
                  }
                >
                  <div className="font-bold">{mode.name}</div>
                  <div className={strictness === mode.name ? "text-ink-950/70 text-[9px] mt-1" : "text-white/40 text-[9px] mt-1"}>
                    {mode.desc}
                  </div>
                </button>
              ))}
            </CardContent>
          </Card>

          {/* Card 4: Banned Phrases */}
          <Card className="rounded-3xl border border-white/10 bg-white/[0.02]">
            <CardHeader className="text-right">
              <CardTitle className="text-lg font-bold text-white justify-end flex">إدارة الكلمات والعبارات المحظورة</CardTitle>
              <CardDescription className="text-sm text-white/45">امنع الوكيل من التحدث بكلمات معينة مثل منافسين، أو أسعار غير مصرحة.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Button type="button" size="sm" onClick={addBannedPhrase} className="h-10 px-4">
                  <Plus className="h-4 w-4" />
                </Button>
                <Input
                  className="text-right h-10 pr-3"
                  placeholder="اكتب كلمة محظورة واضغط إضافة..."
                  value={phraseInput}
                  onChange={(e) => setPhraseInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addBannedPhrase();
                    }
                  }}
                />
              </div>
              <div className="flex flex-wrap gap-2 justify-end">
                {bannedPhrases.length === 0 ? (
                  <span className="text-xs text-white/30">لم يتم تحديد كلمات محظورة بعد.</span>
                ) : (
                  bannedPhrases.map((phrase) => (
                    <span
                      key={phrase}
                      className="inline-flex items-center gap-1 bg-red-500/10 border border-red-500/20 text-red-200 text-xs px-3 py-1.5 rounded-full"
                    >
                      <button type="button" onClick={() => removeBannedPhrase(phrase)} className="hover:text-red-400">
                        <X className="h-3 w-3" />
                      </button>
                      <span>{phrase}</span>
                    </span>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          {/* Card 5: Handoff Rules */}
          <Card className="rounded-3xl border border-white/10 bg-white/[0.02]">
            <CardHeader className="text-right">
              <CardTitle className="text-lg font-bold text-white justify-end flex">قوانين التحويل البشري</CardTitle>
              <CardDescription className="text-sm text-white/45">سيناريوهات تتطلب توقف الوكيل فوراً وتحويل العميل لموظف بشري.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <ToggleSetting
                title="تحويل العملاء الغاضبين"
                description="الشكاوى، الغضب الشديد، أو العبارات المسيئة يتم إسنادها فوراً لفريقك."
                checked={angryHandoff}
                onChange={setAngryHandoff}
              />
              <ToggleSetting
                title="تحويل الإلغاء والاسترجاع"
                description="طلبات إلغاء الحسابات، الدفع المالي، أو استرداد الأموال تنتقل للموظفين مباشرة."
                checked={refundHandoff}
                onChange={setRefundHandoff}
              />
              <ToggleSetting
                title="مراجعة الردود الحساسة"
                description="في حال استفسار العميل عن كلمات سرية أو قانونية، الوكيل يتوقف للأمان."
                checked={sensitiveHandoff}
                onChange={setSensitiveHandoff}
              />
            </CardContent>
          </Card>

          {/* Card 6: Fallback Message */}
          <Card className="rounded-3xl border border-white/10 bg-white/[0.02]">
            <CardHeader className="text-right">
              <CardTitle className="text-lg font-bold text-white justify-end flex">رسالة التحويل والـ Fallback</CardTitle>
              <CardDescription className="text-sm text-white/45">الرسالة التي يرسلها الوكيل للعميل كآخر رد قبل نقله للموظف.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                className="text-right min-h-[80px]"
                value={fallbackMessage}
                onChange={(e) => setFallbackMessage(e.target.value)}
              />
              <Button type="button" className="w-full" onClick={handleSave}>حفظ وتطبيق إعدادات الوكيل</Button>
            </CardContent>
          </Card>
        </div>

        {/* Dynamic Simulator Preview Column */}
        <div className="space-y-6">
          <div className="sticky top-24">
            <div className="mb-3 text-right">
              <h3 className="text-sm font-semibold text-white/80">المحاكاة الحية والتحقق</h3>
              <p className="text-xs text-white/40 mt-1">اختبر التغييرات مباشرة بالدردشة مع الوكيل ومراقبة سلوكه.</p>
            </div>
            {isLoaded ? (
              <AgentPreview
                agentName={agentName}
                tone={tone}
                strictness={strictness}
                workingHours={workingHours}
                systemPrompt={systemPrompt}
                fallbackMessage={fallbackMessage}
                bannedPhrases={bannedPhrases}
                handoffToggles={{
                  angry: angryHandoff,
                  refund: refundHandoff,
                  sensitive: sensitiveHandoff
                }}
              />
            ) : (
              <div className="h-[650px] flex items-center justify-center border border-white/10 bg-white/[0.035] rounded-3xl text-sm text-white/45">
                جاري تحميل المحاكي...
              </div>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}

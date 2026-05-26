"use client";

import { useState, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Bot,
  CircleCheck,
  Clock,
  Facebook,
  Instagram,
  MessageCircle,
  PartyPopper,
  Upload,
  WalletCards,
  Loader2,
  Copy,
  ExternalLink
} from "lucide-react";
import Link from "next/link";
import { AgentPreview } from "@/components/agent-preview";
import { OnboardingStepper } from "@/components/onboarding-stepper";
import { StatusBadge } from "@/components/status-badge";
import { ThemeToggle } from "@/components/theme-toggle";
import { ToggleSetting } from "@/components/toggle-setting";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuthStore } from "@/store/use-auth-store";

const businessTypes = ["مطعم", "متجر إلكتروني", "عيادة", "خدمات", "أخرى"];
const languages = ["عربي", "إنجليزي", "الاثنين"];
const tones = ["ودود", "احترافي", "لهجة أردنية", "قصير ومباشر"];

const onboardingChannels = [
  { icon: MessageCircle, title: "واتساب بزنس", provider: "whatsapp", description: "أفضل قناة للطلبات والأسئلة اليومية." },
  { icon: Facebook, title: "فيسبوك ماسنجر", provider: "messenger", description: "اربط صفحة فيسبوك ورد على الرسائل من نفس الصندوق." },
  { icon: Instagram, title: "إنستغرام DM", provider: "instagram", description: "تابع الرسائل الخاصة من إنستغرام بنفس أسلوب البراند." }
];

function FieldGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-white/72">{label}</span>
      {children}
    </label>
  );
}

export default function OnboardingPage() {
  const { token, user, setAuth } = useAuthStore();

  const [step, setStep] = useState(0);
  const [selectedType, setSelectedType] = useState("مطعم");
  const [selectedLanguage, setSelectedLanguage] = useState("عربي");
  const [selectedTone, setSelectedTone] = useState("لهجة أردنية");
  const [demoEnabled, setDemoEnabled] = useState(false);
  const [notice, setNotice] = useState("اختَر قناة أو كمّل إعداد الوكيل.");
  const [testMessage, setTestMessage] = useState("شو الخدمات اللي بتقدموها؟");
  const [testReply, setTestReply] = useState("عنا وكيل ردود ذكي، صندوق محادثات موحد، وتحويل بشري. بأي خدمة مهتم أكثر؟");
  const [testing, setTesting] = useState(false);

  // Form States (Step 0)
  const [businessName, setBusinessName] = useState("مسار");

  // Form States (Step 2 - Teach)
  const [businessDesc, setBusinessDesc] = useState("منصة مسار تساعد الأعمال على إدارة محادثات العملاء من واتساب وفيسبوك وإنستغرام.");
  const [workingHours, setWorkingHours] = useState("9 صباحا - 11 مساء");
  const [location, setLocation] = useState("عمّان، الأردن");
  const [regions, setRegions] = useState("الأردن والخليج");
  const [pricingNotes, setPricingNotes] = useState("الباقات تبدأ من 29$");
  const [refundPolicy, setRefundPolicy] = useState("طلبات الإلغاء أو الاسترجاع تتحول لفريق بشري.");

  // Product addition state
  const [productName, setProductName] = useState("");
  const [productPrice, setProductPrice] = useState("");
  const [productDesc, setProductDesc] = useState("");
  const [addingProduct, setAddingProduct] = useState(false);

  // Integrations/Channels connection state
  const [connectedChannels, setConnectedChannels] = useState<any[]>([]);
  const [configuringChannel, setConfiguringChannel] = useState<any | null>(null);
  const [credValues, setCredValues] = useState<Record<string, string>>({});
  const [connectingChannel, setConnectingChannel] = useState<string | null>(null);

  // Copy details helper
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Stepper saving transitions
  const [savingStep, setSavingStep] = useState(false);

  // Load user data on mount
  useEffect(() => {
    if (user) {
      if (user.business_name) setBusinessName(user.business_name);
      if (user.business_type) {
        const revMapping: Record<string, string> = {
          restaurant: "مطعم",
          retail: "متجر إلكتروني",
          clinic: "عيادة",
          services: "خدمات"
        };
        setSelectedType(revMapping[user.business_type] || "أخرى");
      }
    }
  }, [user]);

  // Load channels on mount
  useEffect(() => {
    if (!token) return;
    async function loadChannels() {
      try {
        const res = await fetch("/api/integrations/connect", {
          headers: { Authorization: "Bearer " + token }
        });
        if (res.ok) {
          const data = await res.json();
          if (data.channels) {
            setConnectedChannels(data.channels);
          }
        }
      } catch (err) {
        console.error("Error loading channels:", err);
      }
    }
    loadChannels();
  }, [token]);

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const getAbsoluteWebhookUrl = (channel: any) => {
    if (typeof window === "undefined") return "";
    const base = window.location.origin;
    const path = channel.endpoints?.callback_url || `/api/webhooks/meta/${channel.public_id}`;
    return `${base}${path}`;
  };

  // Connect Channel Action
  async function submitChannelConfig(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !configuringChannel) return;
    const provider = configuringChannel.provider;
    setConnectingChannel(provider);
    setNotice(`جاري ربط قناة ${configuringChannel.title}...`);
    try {
      const res = await fetch("/api/integrations/connect", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ 
          provider,
          credentials: credValues 
        })
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        // Replace or add channel connection in UI
        setConnectedChannels((prev) => {
          const filtered = prev.filter(c => c.provider !== data.channel.provider);
          return [...filtered, data.channel];
        });
        setNotice(`✨ تم ربط قناة ${configuringChannel.title} بنجاح! انسخ رابط الاستقبال الموضح بالأسفل وضعه في Meta console.`);
        setDemoEnabled(true);
        setConfiguringChannel(null);
      } else {
        setNotice(`❌ فشل ربط القناة: ${data.error || "خطأ غير معروف"}`);
      }
    } catch (err) {
      console.error(err);
      setNotice("❌ حدث خطأ غير متوقع أثناء ربط القناة.");
    } finally {
      setConnectingChannel(null);
    }
  }

  // Add Product to database
  async function handleAddProduct() {
    if (!productName.trim() || !token) return;
    setAddingProduct(true);
    setNotice("جاري إضافة الخدمة/المنتج إلى قاعدة المعرفة...");
    try {
      const res = await fetch("/api/products", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          name: productName,
          price: productPrice,
          description: productDesc,
          category: "عام"
        })
      });
      if (res.ok) {
        setProductName("");
        setProductPrice("");
        setProductDesc("");
        setNotice("✨ تم إضافة المنتج بنجاح وحفظه في المعرفة!");
      } else {
        setNotice("❌ فشل إضافة المنتج. يرجى المحاولة مرة أخرى.");
      }
    } catch (err) {
      console.error(err);
      setNotice("❌ حدث خطأ أثناء إضافة المنتج.");
    } finally {
      setAddingProduct(false);
    }
  }

  // Save Step 0 configuration (business name & type)
  async function saveStep0() {
    if (!token) return;
    const typeMapping: Record<string, string> = {
      "مطعم": "restaurant",
      "متجر إلكتروني": "retail",
      "عيادة": "clinic",
      "خدمات": "services",
      "أخرى": "retail"
    };

    try {
      const res = await fetch("/api/auth/me", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          business_name: businessName,
          business_type: typeMapping[selectedType] || "retail"
        })
      });
      if (res.ok) {
        const updatedUser = await res.json();
        setAuth(token, updatedUser);
      }
    } catch (e) {
      console.error("Error saving step 0:", e);
    }
  }

  // Save Step 2 configuration (compiled ai persona)
  async function saveStep2() {
    if (!token) return;
    const compiledPersona = `أنت مساعد ذكي لـ ${businessName}.
نوع النشاط: ${selectedType}.
لغة الردود: ${selectedLanguage}.
أسلوب ونبرة الصوت: ${selectedTone}.

حول النشاط: ${businessDesc}
ساعات العمل: ${workingHours}
الموقع: ${location}
المناطق المستهدفة: ${regions}
تفاصيل الأسعار: ${pricingNotes}
سياسة الاسترجاع والإلغاء: ${refundPolicy}`;

    try {
      const res = await fetch("/api/auth/me", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          ai_persona: compiledPersona
        })
      });
      if (res.ok) {
        const updatedUser = await res.json();
        setAuth(token, updatedUser);
      }
    } catch (e) {
      console.error("Error saving step 2:", e);
    }
  }

  async function next() {
    setSavingStep(true);
    try {
      if (step === 0) {
        await saveStep0();
        setStep(1);
      } else if (step === 2) {
        await saveStep2();
        setStep(3);
      } else {
        setStep((value) => Math.min(value + 1, 5));
      }
    } catch (err) {
      console.error("Error during step transition:", err);
    } finally {
      setSavingStep(false);
    }
  }

  function prev() {
    setStep((value) => Math.max(value - 1, 0));
  }

  async function runTest() {
    if (!testMessage.trim() || !token) return;
    setTesting(true);
    setTestReply("جاري التفكير...");
    try {
      const res = await fetch("/api/agent/test", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body: JSON.stringify({ message: testMessage, tone: selectedTone, language: selectedLanguage })
      });
      const data = await res.json();
      if (data.ok && data.result?.reply) {
        setTestReply(data.result.reply);
      } else {
        setTestReply("حدث خطأ في الاتصال بالذكاء الاصطناعي.");
      }
    } catch (err) {
      console.error(err);
      setTestReply("حدث خطأ في الشبكة.");
    } finally {
      setTesting(false);
    }
  }

  const screens = [
    <div key="business" className="grid gap-5 lg:grid-cols-2">
      <FieldGroup label="اسم النشاط">
        <Input 
          placeholder="مثال: مطعم عمّان" 
          value={businessName} 
          onChange={(e) => setBusinessName(e.target.value)} 
        />
      </FieldGroup>
      <FieldGroup label="نوع النشاط">
        <div className="grid grid-cols-2 gap-2">
          {businessTypes.map((type) => (
            <button
              key={type}
              onClick={() => setSelectedType(type)}
              className={selectedType === type ? "rounded-2xl bg-emeraldx-500 px-4 py-3 text-sm font-semibold text-ink-950" : "rounded-2xl border border-white/10 bg-white/[0.055] px-4 py-3 text-sm font-semibold text-white/68 transition hover:bg-white/10"}
              type="button"
            >
              {type}
            </button>
          ))}
        </div>
      </FieldGroup>
      <FieldGroup label="لغة الرد">
        <div className="flex flex-wrap gap-2">
          {languages.map((language) => (
            <button key={language} onClick={() => setSelectedLanguage(language)} className={selectedLanguage === language ? "rounded-2xl bg-emeraldx-500 px-4 py-2 text-sm font-semibold text-ink-950" : "rounded-2xl bg-white/[0.07] px-4 py-2 text-sm font-semibold text-white/68 transition hover:bg-white/10"} type="button">
              {language}
            </button>
          ))}
        </div>
      </FieldGroup>
      <FieldGroup label="أسلوب الوكيل">
        <div className="flex flex-wrap gap-2">
          {tones.map((tone) => (
            <button key={tone} onClick={() => setSelectedTone(tone)} className={selectedTone === tone ? "rounded-2xl bg-emeraldx-500 px-4 py-2 text-sm font-semibold text-ink-950" : "rounded-2xl bg-white/[0.07] px-4 py-2 text-sm font-semibold text-white/68 transition hover:bg-white/10"} type="button">
              {tone}
            </button>
          ))}
        </div>
      </FieldGroup>
    </div>,

    <div key="connect" className="space-y-4">
      {configuringChannel ? (
        <form onSubmit={submitChannelConfig} className="space-y-4 rounded-3xl border border-white/10 bg-white/[0.03] p-6 text-right animate-in fade-in duration-200">
          <div className="flex items-center justify-between border-b border-white/5 pb-3">
            <Button variant="ghost" size="sm" onClick={() => setConfiguringChannel(null)} type="button">
              إلغاء
            </Button>
            <div className="text-right">
              <h4 className="text-base font-bold text-white">إعداد ربط {configuringChannel.title}</h4>
              <p className="text-xs text-white/40 mt-1">أدخل مفاتيح الوصول الرسمية لتطبيقك على Meta Developers.</p>
            </div>
          </div>

          <div className="space-y-4 py-2">
            {configuringChannel.provider === "whatsapp" ? (
              <>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-white/70 block">معرف رقم الهاتف (Phone Number ID)</label>
                  <Input 
                    value={credValues.phone_number_id || ""} 
                    onChange={(e) => setCredValues(prev => ({ ...prev, phone_number_id: e.target.value }))}
                    placeholder="مثال: 104729104847294"
                    required 
                    className="font-mono text-left"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-white/70 block">توكن الوصول الدائم (Access Token)</label>
                  <Textarea 
                    value={credValues.access_token || ""} 
                    onChange={(e) => setCredValues(prev => ({ ...prev, access_token: e.target.value }))}
                    placeholder="EAAZB..."
                    required 
                    className="font-mono text-left h-20"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-white/70 block">رمز التحقق للويب هوك (Verify Token)</label>
                  <Input 
                    value={credValues.verify_token || ""} 
                    onChange={(e) => setCredValues(prev => ({ ...prev, verify_token: e.target.value }))}
                    placeholder="أدخل رمز تحقق مخصص (مثال: masarjo_verify_123)"
                    required 
                    className="font-mono text-left"
                  />
                </div>
              </>
            ) : (
              <>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-white/70 block">رمز وصول الصفحة (Page Access Token)</label>
                  <Textarea 
                    value={credValues.page_access_token || ""} 
                    onChange={(e) => setCredValues(prev => ({ ...prev, page_access_token: e.target.value }))}
                    placeholder="EAAZB..."
                    required 
                    className="font-mono text-left h-20"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-white/70 block">رمز التحقق للويب هوك (Verify Token)</label>
                  <Input 
                    value={credValues.verify_token || ""} 
                    onChange={(e) => setCredValues(prev => ({ ...prev, verify_token: e.target.value }))}
                    placeholder="أدخل رمز تحقق مخصص (مثال: masarjo_verify_123)"
                    required 
                    className="font-mono text-left"
                  />
                </div>
              </>
            )}
          </div>

          <div className="rounded-2xl bg-white/[0.02] border border-white/5 p-4 text-xs text-white/50 leading-5 space-y-1">
            <div className="font-bold text-white/80 mb-1">💡 إرشادات الإعداد السريع:</div>
            <div>1. توجه إلى حساب المطورين <a href="https://developers.facebook.com" target="_blank" rel="noreferrer" className="text-cyanx-400 underline inline-flex items-center gap-0.5">developers.facebook.com <ExternalLink className="h-3 w-3" /></a></div>
            <div>2. أنشئ تطبيقاً وأضف منتج {configuringChannel.title}.</div>
            <div>3. قم بتهيئة الويب هوك باستخدام رابط الاستقبال ومفتاح التحقق اللذين سيظهران لك بعد الحفظ مباشرة.</div>
          </div>

          <div className="flex gap-2 justify-end">
            <Button variant="secondary" onClick={() => setConfiguringChannel(null)} type="button">
              إلغاء
            </Button>
            <Button type="submit" disabled={connectingChannel !== null}>
              {connectingChannel ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>جاري الربط والتحقق...</span>
                </>
              ) : (
                <span>تأكيد وحفظ الاتصال</span>
              )}
            </Button>
          </div>
        </form>
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-3">
            {onboardingChannels.map((option) => {
              const Icon = option.icon;
              const isConnected = connectedChannels.some(
                (c) => c.provider === option.provider.toUpperCase() && c.is_active
              );
              const isConnecting = connectingChannel === option.provider;

              return (
                <Card key={option.title} className="premium-ring">
                  <CardHeader>
                    <div className="mb-5 flex items-center justify-between">
                      <div className="grid h-12 w-12 place-items-center rounded-3xl bg-white/8 text-emeraldx-400">
                        <CircleCheck className={isConnected ? "h-6 w-6 text-emeraldx-400 fill-emeraldx-500/20" : "h-6 w-6 text-white/20"} />
                      </div>
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${isConnected ? "bg-emeraldx-500/10 text-emeraldx-400" : "bg-white/8 text-white/48"}`}>
                        {isConnected ? "متصل" : "يتطلب ربط"}
                      </span>
                    </div>
                    <CardTitle>{option.title}</CardTitle>
                    <CardDescription>{option.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button
                      className="w-full flex items-center justify-center gap-2"
                      variant={isConnected ? "secondary" : "primary"}
                      onClick={() => setConfiguringChannel(option)}
                    >
                      {isConnected ? (
                        <span>تعديل الاتصال</span>
                      ) : (
                        <span>ربط القناة الرسمية</span>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <div className="rounded-3xl border border-cyanx-400/20 bg-cyanx-500/10 p-4 text-sm font-semibold text-cyanx-400">{notice}</div>

          {/* Webhook URLs summary section */}
          {connectedChannels.length > 0 && (
            <div className="rounded-3xl border border-white/10 bg-white/[0.02] p-5 space-y-4 text-right">
              <h4 className="text-sm font-bold text-white">🔗 روابط استقبال الرسائل (Webhook Settings) لربط Meta Console:</h4>
              <div className="space-y-3">
                {connectedChannels.map((channel) => {
                  const label = channel.platform === "whatsapp" ? "واتساب بزنس" : channel.platform === "facebook" ? "فيسبوك ماسنجر" : "إنستغرام DM";
                  const webhookUrl = getAbsoluteWebhookUrl(channel);
                  const vToken = channel.credentials?.verify_token || "رمز التحقق المدخل من قبلك";
                  
                  return (
                    <div key={channel.id} className="rounded-2xl border border-white/5 bg-white/[0.03] p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-white/40 font-mono">ID: {channel.public_id}</span>
                        <span className="text-xs font-bold text-emeraldx-400">{label}</span>
                      </div>
                      <div className="grid gap-3 md:grid-cols-2">
                        <div className="space-y-1 text-right">
                          <span className="text-[10px] text-white/40 block">Callback URL (رابط الاستقبال)</span>
                          <div className="flex items-center justify-between rounded-xl bg-black/20 border border-white/5 px-3 py-2 text-xs font-mono">
                            <button
                              type="button"
                              onClick={() => handleCopy(webhookUrl, channel.id + "_url")}
                              className="text-cyanx-400 hover:text-cyanx-300 text-[10px] font-bold"
                            >
                              {copiedKey === channel.id + "_url" ? "✓ تم النسخ" : "نسخ الرابط"}
                            </button>
                            <span className="text-white/70 select-all overflow-x-auto whitespace-nowrap scrollbar-none">{webhookUrl}</span>
                          </div>
                        </div>
                        <div className="space-y-1 text-right">
                          <span className="text-[10px] text-white/40 block">Verify Token (رمز التحقق)</span>
                          <div className="flex items-center justify-between rounded-xl bg-black/20 border border-white/5 px-3 py-2 text-xs font-mono">
                            <button
                              type="button"
                              onClick={() => handleCopy(vToken, channel.id + "_token")}
                              className="text-cyanx-400 hover:text-cyanx-300 text-[10px] font-bold"
                            >
                              {copiedKey === channel.id + "_token" ? "✓ تم النسخ" : "نسخ الرمز"}
                            </button>
                            <span className="text-white/70 select-all">{vToken}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <Button variant="secondary" onClick={next}>
            <Clock className="h-4 w-4" />
            الذهاب للخطوة التالية
          </Button>
        </>
      )}
    </div>,

    <div key="teach" className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
      <div className="space-y-4">
        <FieldGroup label="وصف النشاط">
          <Textarea 
            placeholder="احكي للوكيل ماذا تقدم، لمن، وبأي أسلوب..." 
            value={businessDesc} 
            onChange={(e) => setBusinessDesc(e.target.value)} 
          />
        </FieldGroup>
        <div className="grid gap-4 md:grid-cols-2">
          <Input placeholder="أوقات العمل" value={workingHours} onChange={(e) => setWorkingHours(e.target.value)} />
          <Input placeholder="الموقع" value={location} onChange={(e) => setLocation(e.target.value)} />
          <Input placeholder="المناطق أو الأسواق" value={regions} onChange={(e) => setRegions(e.target.value)} />
          <Input placeholder="ملاحظات الأسعار" value={pricingNotes} onChange={(e) => setPricingNotes(e.target.value)} />
        </div>
        <Textarea placeholder="سياسة الإلغاء والاسترجاع" value={refundPolicy} onChange={(e) => setRefundPolicy(e.target.value)} />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>منتجات وخدمات المعرفة</CardTitle>
          <CardDescription>أضف بعض المنتجات والخدمات الآن لمساعدة الوكيل الذكي على معرفة أسعارك وتوفيرها.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button variant="secondary" className="w-full justify-start" onClick={() => setNotice("رفع الملفات جاهز كواجهة، وسيتم ربطه بالتخزين لاحقا.")}>
            <Upload className="h-4 w-4" />
            رفع ملف معرفة
          </Button>
          <Input 
            placeholder="اسم المنتج أو الخدمة" 
            value={productName}
            onChange={(e) => setProductName(e.target.value)}
          />
          <Input 
            placeholder="السعر" 
            value={productPrice}
            onChange={(e) => setProductPrice(e.target.value)}
          />
          <Textarea 
            placeholder="الوصف" 
            value={productDesc}
            onChange={(e) => setProductDesc(e.target.value)}
          />
          <Button 
            className="w-full flex items-center justify-center gap-2" 
            onClick={handleAddProduct}
            disabled={addingProduct || !productName.trim()}
          >
            {addingProduct ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>جاري الإضافة...</span>
              </>
            ) : (
              <>
                <WalletCards className="h-4 w-4" />
                <span>إضافة خدمة</span>
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>,

    <div key="behavior" className="grid gap-4 lg:grid-cols-2">
      <ToggleSetting title="الرد التلقائي مفعل" description="خلّي الذكاء يرد على الأسئلة الطبيعية تلقائيا." />
      <ToggleSetting title="مراجعة الردود الحساسة" description="اطلب موافقة بشرية للأسعار المتضاربة أو الأمور الحساسة." />
      <ToggleSetting title="تحويل العملاء الغاضبين" description="أي شكوى أو غضب تنتقل لفريقك." />
      <ToggleSetting title="تحويل الإلغاء والاسترجاع" description="طلبات المال والسياسات تحتاج موظف." />
      <ToggleSetting title="الرد من المعرفة فقط" description="لا يخترع جواب إذا المعلومة غير محفوظة." />
      <ToggleSetting title="ردود قصيرة" description="رسائل مختصرة ومناسبة للموبايل." />
    </div>,

    <div key="test" className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
      <Card>
        <CardHeader>
          <CardTitle>اختبر الوكيل</CardTitle>
          <CardDescription>اكتب رسالة عميل وشوف الرد المقترح.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea value={testMessage} onChange={(event) => setTestMessage(event.target.value)} />
          <Button onClick={runTest} disabled={testing}>
            {testing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            جرّب الرد
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>رد الذكاء</CardTitle>
          <CardDescription>رد تجريبي مبني على معلومات النشاط.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-3xl bg-emeraldx-500 p-4 text-sm leading-7 text-ink-950">{testReply}</div>
          <Button className="mt-5 w-full" onClick={next}>
            ممتاز، جهّز الوكيل
          </Button>
        </CardContent>
      </Card>
    </div>,

    <div key="done" className="mx-auto max-w-2xl text-center">
      <div className="mx-auto grid h-20 w-20 place-items-center rounded-[2rem] bg-emeraldx-500 text-ink-950 shadow-glow">
        <PartyPopper className="h-10 w-10" />
      </div>
      <h2 className="mt-8 text-4xl font-semibold text-white">وكيلك جاهز</h2>
      <p className="mt-4 text-white/55">افتح المحادثات، راجع الإعدادات، أو اختبر رسالة ثانية قبل الإطلاق.</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link href="/inbox"><Button>افتح المحادثات</Button></Link>
        <Link href="/agent"><Button variant="secondary">إعدادات الوكيل</Button></Link>
        <Button variant="secondary" onClick={() => setStep(4)}>اختبار رسالة ثانية</Button>
      </div>
    </div>
  ];

  return (
    <main className="min-h-screen px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-3 text-white/65 hover:text-white">
            <ArrowRight className="h-4 w-4" />
            رجوع
          </Link>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <StatusBadge status={connectedChannels.length > 0 ? "CONNECTED" : "SETUP_REQUIRED"} />
          </div>
        </div>

        <div className="mb-8">
          <h1 className="text-4xl font-semibold text-white">إعداد منصة مسار</h1>
          <p className="mt-3 max-w-2xl text-white/55">خطوات بسيطة لصاحب العمل: عرّف النشاط، اربط القنوات، علّم الوكيل، اختبره، ثم ابدأ.</p>
        </div>

        <OnboardingStepper current={step} />

        <Card className="mt-6 overflow-hidden">
          <CardContent className="p-6">
            <AnimatePresence mode="wait">
              <motion.div
                key={step}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -14 }}
                transition={{ duration: 0.22 }}
              >
                {screens[step]}
              </motion.div>
            </AnimatePresence>
          </CardContent>
        </Card>

        {step < 5 ? (
          <div className="mt-6 flex justify-between">
            <Button variant="secondary" onClick={prev} disabled={step === 0 || savingStep || configuringChannel !== null}>
              <ArrowRight className="h-4 w-4" />
              السابق
            </Button>
            {configuringChannel === null && (
              <Button onClick={next} disabled={savingStep}>
                {savingStep ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>جاري الحفظ...</span>
                  </>
                ) : (
                  <>
                    <span>التالي</span>
                    <ArrowLeft className="h-4 w-4" />
                  </>
                )}
              </Button>
            )}
          </div>
        ) : null}

        {step === 3 ? <div className="mt-6"><AgentPreview tone={selectedTone} strictness="متوازن" /></div> : null}
      </div>
    </main>
  );
}

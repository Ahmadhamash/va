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
  Loader2
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
  const [connectingChannel, setConnectingChannel] = useState<string | null>(null);

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

  // Connect Channel Action
  async function handleConnectChannel(provider: string, optionTitle: string) {
    if (!token) return;
    setConnectingChannel(provider);
    setNotice(`جاري ربط قناة ${optionTitle}...`);
    try {
      const res = await fetch("/api/integrations/connect", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ provider })
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setConnectedChannels((prev) => [...prev, data.channel]);
        setNotice(`✨ تم ربط قناة ${optionTitle} بنجاح!`);
        setDemoEnabled(true);
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
      <div className="grid gap-4 lg:grid-cols-3">
        {onboardingChannels.map((option) => {
          const Icon = option.icon;
          const isConnected = connectedChannels.some(
            (c) => c.provider === option.provider.toUpperCase() && c.status === "CONNECTED"
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
                  disabled={isConnecting || isConnected}
                  onClick={() => handleConnectChannel(option.provider, option.title)}
                >
                  {isConnecting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>جاري الاتصال...</span>
                    </>
                  ) : isConnected ? (
                    <span>✓ متصل بالكامل</span>
                  ) : (
                    <span>ربط وتفعيل القناة</span>
                  )}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
      <div className="rounded-3xl border border-cyanx-400/20 bg-cyanx-500/10 p-4 text-sm font-semibold text-cyanx-400">{notice}</div>
      <Button variant="secondary" onClick={next} disabled={savingStep}>
        <Clock className="h-4 w-4" />
        الربط لاحقا، كمل الإعداد
      </Button>
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
            <Button variant="secondary" onClick={prev} disabled={step === 0 || savingStep}>
              <ArrowRight className="h-4 w-4" />
              السابق
            </Button>
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
          </div>
        ) : null}

        {step === 3 ? <div className="mt-6"><AgentPreview tone={selectedTone} strictness="متوازن" /></div> : null}
      </div>
    </main>
  );
}

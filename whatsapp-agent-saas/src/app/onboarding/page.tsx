"use client";

import { useState } from "react";
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
  WalletCards
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
import { Loader2 } from "lucide-react";

const businessTypes = ["مطعم", "متجر إلكتروني", "عيادة", "خدمات", "أخرى"];
const languages = ["عربي", "إنجليزي", "الاثنين"];
const tones = ["ودود", "احترافي", "لهجة أردنية", "قصير ومباشر"];
const channels = [
  { icon: MessageCircle, title: "واتساب بزنس", description: "أفضل قناة للطلبات والأسئلة اليومية.", status: "وضع تجريبي" },
  { icon: Facebook, title: "فيسبوك ماسنجر", description: "اربط صفحة فيسبوك ورد على الرسائل من نفس الصندوق.", status: "يتطلب إعداد" },
  { icon: Instagram, title: "إنستغرام DM", description: "تابع الرسائل الخاصة من إنستغرام بنفس أسلوب البراند.", status: "بانتظار التحقق" }
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
  const [step, setStep] = useState(0);
  const [selectedType, setSelectedType] = useState("مطعم");
  const [selectedLanguage, setSelectedLanguage] = useState("عربي");
  const [selectedTone, setSelectedTone] = useState("لهجة أردنية");
  const [demoEnabled, setDemoEnabled] = useState(false);
  const [notice, setNotice] = useState("اختَر قناة أو كمّل إعداد الوكيل.");
  const [testMessage, setTestMessage] = useState("شو الخدمات اللي بتقدموها؟");
  const [testReply, setTestReply] = useState("عنا وكيل ردود ذكي، صندوق محادثات موحد، وتحويل بشري. بأي خدمة مهتم أكثر؟");
  const [testing, setTesting] = useState(false);
  const { token } = useAuthStore();

  function next() {
    setStep((value) => Math.min(value + 5, 5)); // jump straight to done or progress
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
      if (data.ok && data.reply) {
        setTestReply(data.reply);
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
        <Input placeholder="مثال: مطعم عمّان" defaultValue="مسار" />
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
        {channels.map((option) => {
          const Icon = option.icon;
          return (
            <Card key={option.title} className="premium-ring">
              <CardHeader>
                <div className="mb-5 flex items-center justify-between">
                  <div className="grid h-12 w-12 place-items-center rounded-3xl bg-white/8 text-emeraldx-400">
                    <CircleCheck className="h-6 w-6 text-emeraldx-400" />
                  </div>
                  <span className="rounded-full bg-white/8 px-3 py-1 text-xs font-semibold text-white/48">{option.status}</span>
                </div>
                <CardTitle>{option.title}</CardTitle>
                <CardDescription>{option.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  className="w-full"
                  variant={option.title === "واتساب بزنس" ? "primary" : "secondary"}
                  onClick={() => {
                    setDemoEnabled(true);
                    setNotice(`تم تفعيل مسار ${option.title} التجريبي. الربط الحقيقي يحتاج بيانات Meta الرسمية.`);
                  }}
                >
                  ربط / تجربة
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
      <div className="rounded-3xl border border-cyanx-400/20 bg-cyanx-500/10 p-4 text-sm font-semibold text-cyanx-400">{notice}</div>
      <Button variant="secondary" onClick={next}>
        <Clock className="h-4 w-4" />
        الربط لاحقا، كمل الإعداد
      </Button>
    </div>,

    <div key="teach" className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
      <div className="space-y-4">
        <FieldGroup label="وصف النشاط">
          <Textarea placeholder="احكي للوكيل ماذا تقدم، لمن، وبأي أسلوب..." defaultValue="منصة مسار تساعد الأعمال على إدارة محادثات العملاء من واتساب وفيسبوك وإنستغرام." />
        </FieldGroup>
        <div className="grid gap-4 md:grid-cols-2">
          <Input placeholder="أوقات العمل" defaultValue="9 صباحا - 11 مساء" />
          <Input placeholder="الموقع" defaultValue="عمّان، الأردن" />
          <Input placeholder="المناطق أو الأسواق" defaultValue="الأردن والخليج" />
          <Input placeholder="ملاحظات الأسعار" defaultValue="الباقات تبدأ من 29$" />
        </div>
        <Textarea placeholder="سياسة الإلغاء والاسترجاع" defaultValue="طلبات الإلغاء أو الاسترجاع تتحول لفريق بشري." />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>منتجات وخدمات</CardTitle>
          <CardDescription>أضف معرفة بسيطة الآن، وكل شيء قابل للتعديل لاحقا.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button variant="secondary" className="w-full justify-start" onClick={() => setNotice("رفع الملفات جاهز كواجهة، وسيتم ربطه بالتخزين لاحقا.")}>
            <Upload className="h-4 w-4" />
            رفع ملف معرفة
          </Button>
          <Input placeholder="اسم المنتج أو الخدمة" />
          <Input placeholder="السعر" />
          <Textarea placeholder="الوصف" />
          <Button className="w-full" onClick={() => setNotice("تم حفظ الخدمة في الديمو.")}>
            <WalletCards className="h-4 w-4" />
            إضافة خدمة
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
            <StatusBadge status={demoEnabled ? "DEMO_MODE" : "SETUP_REQUIRED"} />
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
            <Button variant="secondary" onClick={prev} disabled={step === 0}>
              <ArrowRight className="h-4 w-4" />
              السابق
            </Button>
            <Button onClick={next}>
              التالي
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </div>
        ) : null}

        {step === 3 ? <div className="mt-6"><AgentPreview tone={selectedTone} strictness="متوازن" /></div> : null}
      </div>
    </main>
  );
}

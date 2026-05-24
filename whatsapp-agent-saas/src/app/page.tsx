"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Bot,
  CheckCircle2,
  Facebook,
  Instagram,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  UserCheck,
  WalletCards
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { GradientCard } from "@/components/gradient-card";
import { PremiumButton } from "@/components/premium-button";
import { ThemeToggle } from "@/components/theme-toggle";

const featureCards = [
  {
    icon: MessageCircle,
    title: "كل القنوات من مكان واحد",
    text: "واتساب، فيسبوك، وإنستغرام داخل صندوق محادثات مرتب وسهل على صاحب العمل."
  },
  {
    icon: WalletCards,
    title: "علّم الوكيل بدون تعقيد",
    text: "أضف المنتجات، الأسعار، السياسات، أوقات العمل، واللهجة المطلوبة بكلمات بسيطة."
  },
  {
    icon: UserCheck,
    title: "تحويل بشري ذكي",
    text: "الشكاوى، الإلغاء، الاسترجاع، والغضب تتحول لفريقك بدل ما يرد الذكاء بشكل خاطئ."
  }
];

function PhoneMockup() {
  const messages = [
    { from: "customer", channel: "Instagram", text: "مرحبا، شو بتقدموا؟" },
    { from: "ai", channel: "AI", text: "عنا وكيل ردود ذكي، صندوق محادثات موحد، وتحويل بشري. بأي خدمة مهتم؟" },
    { from: "customer", channel: "Facebook", text: "بدي أربط صفحة الفيسبوك" },
    { from: "ai", channel: "AI", text: "تمام، بنجهز الربط الرسمي ونخليك تتابع كل الرسائل من لوحة واحدة." }
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 24, rotate: 2 }}
      animate={{ opacity: 1, y: 0, rotate: 0 }}
      transition={{ duration: 0.7, ease: "easeOut" }}
      className="relative mx-auto w-full max-w-sm"
    >
      <div className="absolute -inset-8 rounded-full bg-emeraldx-500/20 blur-3xl" />
      <div className="relative rounded-[2.4rem] border border-white/12 bg-ink-950 p-3 shadow-2xl shadow-black/40">
        <div className="rounded-[2rem] border border-white/10 bg-gradient-to-b from-ink-900 to-ink-950 p-4">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-full bg-emeraldx-500 text-ink-950">
                <Bot className="h-5 w-5" />
              </div>
              <div>
                <div className="text-sm font-semibold text-white">وكيل مسار</div>
                <div className="text-xs text-emeraldx-400">متصل الآن</div>
              </div>
            </div>
            <div className="flex gap-2 text-white/55">
              <MessageCircle className="h-4 w-4" />
              <Facebook className="h-4 w-4" />
              <Instagram className="h-4 w-4" />
            </div>
          </div>
          <div className="space-y-3">
            {messages.map((message, index) => (
              <motion.div
                key={`${message.channel}-${message.text}`}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35 + index * 0.14 }}
                className={message.from === "ai" ? "flex justify-start" : "flex justify-end"}
              >
                <div
                  className={
                    message.from === "ai"
                      ? "max-w-[78%] rounded-3xl rounded-bl-md bg-emeraldx-500 px-4 py-3 text-sm leading-6 text-ink-950"
                      : "max-w-[78%] rounded-3xl rounded-br-md bg-white/9 px-4 py-3 text-sm leading-6 text-white/80"
                  }
                >
                  <div className="mb-1 text-[11px] font-semibold opacity-60">{message.channel}</div>
                  {message.text}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export default function LandingPage() {
  return (
    <main className="min-h-screen overflow-hidden">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-4 py-6 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-3">
          <span className="grid h-12 w-12 place-items-center rounded-3xl bg-emeraldx-500 text-ink-950 shadow-glow">
            <MessageCircle className="h-6 w-6" />
          </span>
          <span>
            <span className="block text-lg font-semibold text-white">مسار</span>
            <span className="block text-xs text-white/42">وكيل ذكاء اصطناعي لكل قنواتك</span>
          </span>
        </Link>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <Link href="/dashboard">
            <Button variant="ghost">شاهد الديمو</Button>
          </Link>
          <Link href="/onboarding">
            <Button>ابدأ الإعداد</Button>
          </Link>
        </div>
      </header>

      <section className="mx-auto grid max-w-7xl items-center gap-12 px-4 pb-16 pt-10 sm:px-6 lg:grid-cols-[1.03fr_0.97fr] lg:px-8 lg:pb-24">
        <div>
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 inline-flex items-center gap-2 rounded-full border border-emeraldx-400/20 bg-emeraldx-500/10 px-3 py-1.5 text-sm font-semibold text-emeraldx-400"
          >
            <Sparkles className="h-4 w-4" />
            واتساب + فيسبوك + إنستغرام في تجربة واحدة
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="max-w-4xl text-5xl font-semibold tracking-tight text-white sm:text-6xl lg:text-7xl"
          >
            خلي مسار يرد على عملاءك بذكاء وبأسلوب عربي مرتب
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mt-6 max-w-2xl text-lg leading-8 text-white/58"
          >
            اربط قنوات Meta الرسمية، علّم الوكيل معلومات نشاطك، وخليه يرد على الأسئلة المتكررة مع تحويل بشري وقت الحاجة.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mt-9 flex flex-wrap gap-3"
          >
            <Link href="/onboarding">
              <PremiumButton className="h-14 px-7 text-base">
                ابدأ الآن
                <ArrowLeft className="h-5 w-5" />
              </PremiumButton>
            </Link>
            <Link href="/dashboard">
              <Button variant="secondary" className="h-14 px-7 text-base">
                ادخل لوحة التحكم
              </Button>
            </Link>
          </motion.div>

          <div className="mt-10 grid gap-3 sm:grid-cols-3">
            {[
              ["محادثات العملاء", "بدون حملات مزعجة أو سبام"],
              ["وضع تجريبي", "جرّب الوكيل قبل الربط الحقيقي"],
              ["تسليم بشري", "للحالات الحساسة والمشتكية"]
            ].map(([title, text]) => (
              <div key={title} className="rounded-3xl border border-white/10 bg-white/[0.055] p-4">
                <CheckCircle2 className="h-5 w-5 text-emeraldx-400" />
                <div className="mt-3 text-sm font-semibold text-white">{title}</div>
                <div className="mt-1 text-xs leading-5 text-white/45">{text}</div>
              </div>
            ))}
          </div>
        </div>

        <PhoneMockup />
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-20 sm:px-6 lg:px-8">
        <div className="grid gap-4 md:grid-cols-3">
          {featureCards.map((feature) => {
            const Icon = feature.icon;
            return (
              <GradientCard key={feature.title}>
                <div className="grid h-12 w-12 place-items-center rounded-3xl bg-white/8 text-emeraldx-400">
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="mt-5 text-xl font-semibold text-white">{feature.title}</h3>
                <p className="mt-3 text-sm leading-7 text-white/55">{feature.text}</p>
              </GradientCard>
            );
          })}
        </div>
        <div className="mt-5 rounded-3xl border border-white/10 bg-white/[0.045] p-5">
          <div className="flex flex-wrap items-center gap-3 text-sm font-semibold text-white/65">
            <ShieldCheck className="h-5 w-5 text-cyanx-400" />
            مصمم لمحادثات الدعم التي يبدأها العميل والردود التجارية المسموحة، وليس للإرسال الجماعي أو الأتمتة غير الرسمية.
          </div>
        </div>
      </section>
    </main>
  );
}

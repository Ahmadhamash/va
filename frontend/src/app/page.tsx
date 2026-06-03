"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Bot,
  CircleCheck,
  Facebook,
  Instagram,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  UserCheck,
  WalletCards,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { GradientCard } from "@/components/gradient-card";
import { PremiumButton } from "@/components/premium-button";
import { ThemeToggle } from "@/components/theme-toggle";
import { useAuthStore } from "@/store/use-auth-store";

const featureCards = [
  {
    icon: MessageCircle,
    title: "كل القنوات بمكان واحد",
    text: "واتساب وMessenger وInstagram داخل صندوق محادثات مرتب وسهل على صاحب العمل.",
  },
  {
    icon: WalletCards,
    title: "قاعدة معرفة عملية",
    text: "منتجات، أسعار، صور، سياسات، كفالات، ومعلومات نشاطك بدون تعقيد.",
  },
  {
    icon: UserCheck,
    title: "تحويل بشري ذكي",
    text: "المحادثات الحساسة بتوصل لموظف المنصة عشان يكمل بدل الذكاء الاصطناعي.",
  },
];

function homeForRole(role?: string) {
  if (role === "admin") return "/admin";
  if (role === "support_agent") return "/support";
  return "/dashboard";
}

function PhoneMockup() {
  const messages = [
    { from: "customer", channel: "Instagram", text: "مرحبا، عندكم قياسات جاكيتات؟" },
    { from: "ai", channel: "AI", text: "أهلاً وسهلاً، آه موجود. أي موديل حاب تشوف قياساته؟" },
    { from: "customer", channel: "Messenger", text: "والكفالة كيف؟" },
    { from: "ai", channel: "AI", text: "الكفالة حسب المنتج. بحكيلك التفاصيل المؤكدة من قاعدة المعرفة." },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 28, rotate: 2 }}
      animate={{ opacity: 1, y: [0, -10, 0], rotate: [0, -1.2, 0.8, 0] }}
      transition={{ opacity: { duration: 0.6 }, y: { duration: 6, repeat: Infinity, ease: "easeInOut" }, rotate: { duration: 8, repeat: Infinity, ease: "easeInOut" } }}
      className="relative mx-auto w-full max-w-sm"
    >
      <motion.div
        aria-hidden
        animate={{ scale: [1, 1.04, 1], opacity: [0.45, 0.8, 0.45] }}
        transition={{ duration: 2.6, repeat: Infinity }}
        className="absolute -inset-3 rounded-[2.7rem] border border-emeraldx-400/30"
      />
      <motion.div
        aria-hidden
        animate={{ scale: [1, 1.08, 1], opacity: [0.18, 0.42, 0.18] }}
        transition={{ duration: 3.4, repeat: Infinity, delay: 0.4 }}
        className="absolute -inset-7 rounded-[3rem] border border-cyanx-400/20"
      />

      <div className="relative rounded-[2.4rem] border border-white/12 bg-ink-950 p-3 shadow-2xl shadow-black/40">
        <div className="rounded-[2rem] border border-white/10 bg-gradient-to-b from-ink-900 to-ink-950 p-4">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-2xl bg-emeraldx-500 text-white">
                <Bot className="h-5 w-5" />
              </div>
              <div>
                <div className="text-sm font-semibold text-white">وكيل chatter</div>
                <div className="flex items-center gap-1 text-xs text-emeraldx-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-emeraldx-400" />
                  متصل الآن
                </div>
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
                initial={{ opacity: 0, y: 12, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ delay: 0.35 + index * 0.2 }}
                className={message.from === "ai" ? "flex justify-start" : "flex justify-end"}
              >
                <div
                  className={
                    message.from === "ai"
                      ? "max-w-[80%] rounded-2xl rounded-bl-md bg-emeraldx-500 px-4 py-3 text-sm leading-6 text-white"
                      : "max-w-[80%] rounded-2xl rounded-br-md bg-white/9 px-4 py-3 text-sm leading-6 text-white/80"
                  }
                >
                  <div className="mb-1 text-[11px] font-semibold opacity-60">{message.channel}</div>
                  {message.text}
                </div>
              </motion.div>
            ))}
          </div>

          <div className="mt-4 rounded-2xl border border-white/8 bg-white/[0.04] p-3">
            <div className="mb-2 flex items-center justify-between text-xs text-white/50">
              <span>Human fallback</span>
              <span className="text-emeraldx-400">جاهز</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/10">
              <motion.div
                animate={{ x: ["-35%", "15%", "105%"] }}
                transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
                className="h-full w-1/3 rounded-full bg-cyanx-400"
              />
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export default function LandingPage() {
  const user = useAuthStore((s) => s.user);
  const dashboardHref = homeForRole(user?.role);

  return (
    <main className="min-h-screen overflow-hidden">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-4 py-6 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-3">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-emeraldx-500 text-white shadow-glow">
            <MessageCircle className="h-6 w-6" />
          </span>
          <span>
            <span className="block text-lg font-semibold text-white">chatter</span>
            <span className="block text-xs text-white/42">وكيل ذكاء اصطناعي لكل قنواتك</span>
          </span>
        </Link>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          {user ? (
            <Link href={dashboardHref}>
              <Button>لوحة التحكم</Button>
            </Link>
          ) : (
            <Link href="/login">
              <Button>تسجيل الدخول</Button>
            </Link>
          )}
        </div>
      </header>

      <section className="relative mx-auto flex max-w-7xl items-center px-4 pb-14 pt-8 sm:px-6 lg:min-h-[calc(100vh-120px)] lg:px-8">
        <div className="relative z-10 max-w-2xl">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 inline-flex items-center gap-2 rounded-full border border-emeraldx-400/20 bg-emeraldx-500/10 px-3 py-1.5 text-sm font-semibold text-emeraldx-400"
          >
            <Sparkles className="h-4 w-4" />
            واتساب + Messenger + Instagram
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="max-w-4xl text-5xl font-semibold tracking-tight text-white sm:text-6xl lg:text-7xl"
          >
            chatter
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mt-6 max-w-2xl text-lg leading-8 text-white/58"
          >
            وكيل خدمة عملاء عربي يرد من قاعدة معرفة مؤكدة، يربط قنوات العميل، ويحوّل المحادثة لموظف بشري وقت الحاجة.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mt-9 flex flex-wrap gap-3"
          >
            <Link href={user ? dashboardHref : "/login"}>
              <PremiumButton className="h-14 px-7 text-base">
                {user ? "ادخل لوحة التحكم" : "ابدأ الآن"}
                <ArrowLeft className="h-5 w-5" />
              </PremiumButton>
            </Link>
          </motion.div>

          <div className="mt-10 grid gap-3 sm:grid-cols-3">
            {[
              ["بدون هلوسة", "الإجابات من قاعدة المعرفة فقط"],
              ["ربط رسمي", "Meta OAuth مع خيار يدوي"],
              ["تحويل بشري", "للحالات الحساسة والمشتكية"],
            ].map(([title, text]) => (
              <div key={title} className="rounded-2xl border border-white/10 bg-white/[0.055] p-4">
                <CircleCheck className="h-5 w-5 text-emeraldx-400" />
                <div className="mt-3 text-sm font-semibold text-white">{title}</div>
                <div className="mt-1 text-xs leading-5 text-white/45">{text}</div>
              </div>
            ))}
          </div>

          <div className="mt-10 lg:hidden">
            <PhoneMockup />
          </div>
        </div>

        <div className="absolute left-8 top-1/2 hidden w-[28rem] -translate-y-1/2 lg:block xl:left-16">
          <PhoneMockup />
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-20 sm:px-6 lg:px-8">
        <div className="grid gap-4 md:grid-cols-3">
          {featureCards.map((feature) => {
            const Icon = feature.icon;
            return (
              <GradientCard key={feature.title}>
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-white/8 text-emeraldx-400">
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="mt-5 text-xl font-semibold text-white">{feature.title}</h3>
                <p className="mt-3 text-sm leading-7 text-white/55">{feature.text}</p>
              </GradientCard>
            );
          })}
        </div>
        <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.045] p-5">
          <div className="flex flex-wrap items-center gap-3 text-sm font-semibold text-white/65">
            <ShieldCheck className="h-5 w-5 text-cyanx-400" />
            مصمم لمحادثات الدعم التي يبدأها العميل والردود التجارية المسموحة، وليس للإرسال الجماعي أو الأتمتة غير الرسمية.
          </div>
        </div>
      </section>
    </main>
  );
}

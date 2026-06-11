"use client";

import { useEffect, useState } from "react";
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
    { from: "ai", channel: "الذكاء الاصطناعي", text: "أهلاً وسهلاً، آه موجود. أي موديل حاب تشوف قياساته؟" },
    { from: "customer", channel: "Messenger", text: "والكفالة كيف؟" },
    { from: "ai", channel: "الذكاء الاصطناعي", text: "الكفالة حسب المنتج. بحكيلك التفاصيل المؤكدة من قاعدة المعرفة." },
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
        className="absolute -inset-3 rounded-[2.7rem] border border-primary-400/30"
      />
      <motion.div
        aria-hidden
        animate={{ scale: [1, 1.08, 1], opacity: [0.18, 0.42, 0.18] }}
        transition={{ duration: 3.4, repeat: Infinity, delay: 0.4 }}
        className="absolute -inset-7 rounded-[3rem] border border-cyanx-400/20"
      />

      <div className="relative rounded-[2.4rem] border border-white/12 bg-ink-950 p-3 shadow-2xl shadow-black/40">
        <div className="rounded-[2rem] border border-white/10 bg-gradient-to-b from-ink-900 to-ink-950 p-4 text-right">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex gap-2 text-white/55">
              <MessageCircle className="h-4 w-4" />
              <Facebook className="h-4 w-4" />
              <Instagram className="h-4 w-4" />
            </div>
            <div className="flex items-center gap-3">
              <div>
                <div className="text-sm font-semibold text-white">وكيل chatter</div>
                <div className="flex items-center justify-end gap-1 text-xs text-primary-400">
                  متصل الآن
                  <span className="h-1.5 w-1.5 rounded-full bg-primary-400" />
                </div>
              </div>
              <div className="grid h-10 w-10 place-items-center rounded-2xl bg-primary-500 text-white">
                <Bot className="h-5 w-5" />
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {messages.map((message, index) => (
              <motion.div
                key={`${message.channel}-${message.text}`}
                initial={{ opacity: 0, y: 12, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ delay: 0.35 + index * 0.2 }}
                className={message.from === "ai" ? "flex justify-start text-right" : "flex justify-end text-right"}
              >
                <div
                  className={
                    message.from === "ai"
                      ? "max-w-[80%] rounded-2xl rounded-bl-md bg-primary-500 px-4 py-3 text-sm leading-6 text-white"
                      : "max-w-[80%] rounded-2xl rounded-br-md bg-white/9 px-4 py-3 text-sm leading-6 text-white/80"
                  }
                >
                  <div className="mb-1 text-[11px] font-semibold opacity-60">{message.channel}</div>
                  {message.text}
                </div>
              </motion.div>
            ))}
          </div>

          <div className="mt-4 rounded-2xl border border-white/8 bg-white/[0.04] p-3 text-right">
            <div className="mb-2 flex items-center justify-between text-xs text-white/50">
              <span className="text-primary-400">جاهز</span>
              <span>تحويل للموظف</span>
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

function CombinedMockup() {
  return (
    <div className="relative mx-auto w-full max-w-lg lg:h-[450px]">
      {/* Behind: Dashboard mockup */}
      <motion.div
        initial={{ opacity: 0, x: 20, y: 40 }}
        animate={{ opacity: 1, x: 0, y: 0 }}
        transition={{ duration: 0.8, delay: 0.2 }}
        className="absolute left-0 top-0 w-[85%] hidden sm:block opacity-80 hover:opacity-100 transition-opacity duration-300"
      >
        <div className="rounded-3xl border border-white/10 bg-ink-900/95 p-4 shadow-2xl shadow-black/60">
          <div className="mb-4 flex items-center justify-between border-b border-white/8 pb-3">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-red-500/80" />
              <span className="h-3 w-3 rounded-full bg-amber-500/80" />
              <span className="h-3 w-3 rounded-full bg-green-500/80" />
              <span className="ms-2 text-[10px] font-semibold text-white/40">chatter inbox</span>
            </div>
            <div className="rounded-full bg-primary-500/10 px-3 py-1 text-xs font-semibold text-primary-400">
              الرد التلقائي: مفعّل
            </div>
          </div>

          <div className="grid grid-cols-[100px_1fr] gap-3 text-xs">
            <div className="space-y-2 border-e border-white/5 pe-3 text-right">
              <div className="h-7 rounded-xl bg-primary-500/10 text-primary-400 flex items-center justify-center font-semibold">المحادثات</div>
              <div className="h-7 rounded-xl bg-white/5 flex items-center justify-center text-white/40">قاعدة المعرفة</div>
              <div className="h-7 rounded-xl bg-white/5 flex items-center justify-center text-white/40">التحليلات</div>
            </div>

            <div className="space-y-3 text-right">
              <div className="rounded-xl border border-white/5 bg-white/[0.03] p-3">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-white">أحمد علي</span>
                  <span className="text-[10px] text-primary-400 font-semibold bg-primary-500/10 px-2 py-0.5 rounded-full">واتساب</span>
                </div>
                <p className="mt-1 text-xs text-white/50 truncate">كم يستغرق الشحن للرياض؟</p>
                <div className="mt-2 text-[10px] text-primary-400 bg-primary-500/10 inline-block px-2 py-0.5 rounded">تم الرد بواسطة الوكيل الذكي</div>
              </div>

              <div className="rounded-xl bg-white/[0.01] p-3 opacity-50">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-white">رائد صالح</span>
                  <span className="text-[10px] text-violet-400 font-semibold bg-violet-500/10 px-2 py-0.5 rounded-full">إنستقرام</span>
                </div>
                <p className="mt-1 text-xs text-white/50 truncate">متى تفتحون المحل؟</p>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Front: Phone mockup overlapping */}
      <div className="relative z-10 sm:absolute sm:-right-4 sm:top-12 w-full sm:w-[75%] max-w-sm">
        <PhoneMockup />
      </div>
    </div>
  );
}

export default function LandingPage() {
  const [mounted, setMounted] = useState(false);
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    setMounted(true);
  }, []);

  const activeUser = mounted ? user : null;
  const dashboardHref = homeForRole(activeUser?.role);

  return (
    <main className="min-h-screen overflow-hidden">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-4 py-6 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2 sm:gap-3">
          <span className="grid h-10 w-10 sm:h-12 sm:w-12 place-items-center rounded-xl sm:rounded-2xl bg-primary-500 text-white shadow-glow">
            <MessageCircle className="h-5 w-5 sm:h-6 sm:w-6" />
          </span>
          <span>
            <span className="block text-base sm:text-lg font-semibold text-white">chatter</span>
            <span className="hidden sm:block text-xs text-white/42">وكيل ذكاء اصطناعي لكل قنواتك</span>
          </span>
        </Link>
        <div className="flex items-center gap-2 sm:gap-3">
          <ThemeToggle />
          {activeUser ? (
            <Link href={dashboardHref}>
              <Button size="sm" className="sm:h-10 sm:px-4">لوحة التحكم</Button>
            </Link>
          ) : (
            <Link href="/login">
              <Button size="sm" className="sm:h-10 sm:px-4 text-xs sm:text-sm whitespace-nowrap">تسجيل الدخول</Button>
            </Link>
          )}
        </div>
      </header>

      <section className="relative mx-auto max-w-7xl px-4 pb-14 pt-8 sm:px-6 lg:px-8 lg:min-h-[calc(100vh-120px)] flex items-center">
        <div className="grid gap-8 lg:grid-cols-12 items-center w-full">
          {/* Left Column: Combined Mockup (RTL: left side) */}
          <div className="order-2 lg:order-1 lg:col-span-5 w-full">
            <CombinedMockup />
          </div>

          {/* Right Column: Text Content (RTL: right side) */}
          <div className="order-1 lg:order-2 lg:col-span-7 text-right flex flex-col items-end">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary-400/20 bg-primary-500/10 px-3 py-1.5 text-sm font-semibold text-primary-400 animate-pulse"
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
              className="mt-9 flex flex-wrap justify-end gap-3"
            >
              <Link href={activeUser ? dashboardHref : "/login"}>
                <PremiumButton className="h-14 px-7 text-base flex items-center gap-2">
                  <ArrowLeft className="h-5 w-5" />
                  {activeUser ? "ادخل لوحة التحكم" : "ابدأ الآن"}
                </PremiumButton>
              </Link>
            </motion.div>

            <div className="mt-10 grid gap-3 sm:grid-cols-3 w-full">
              {[
                ["بدون هلوسة", "الإجابات من قاعدة المعرفة فقط"],
                ["ربط رسمي", "Meta OAuth مع خيار يدوي"],
                ["تحويل بشري", "للحالات الحساسة والمشتكية"],
              ].map(([title, text]) => (
                <div key={title} className="rounded-2xl border border-white/10 bg-white/[0.055] p-4 text-right">
                  <div className="flex justify-end mb-2">
                    <CircleCheck className="h-5 w-5 text-primary-400" />
                  </div>
                  <div className="mt-1 text-sm font-semibold text-white">{title}</div>
                  <div className="mt-1 text-xs leading-5 text-white/45">{text}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-20 sm:px-6 lg:px-8">
        <div className="grid gap-4 md:grid-cols-3">
          {featureCards.map((feature) => {
            const Icon = feature.icon;
            return (
              <GradientCard key={feature.title} className="text-right">
                <div className="flex justify-end">
                  <div className="grid h-12 w-12 place-items-center rounded-2xl bg-white/8 text-primary-400">
                    <Icon className="h-6 w-6" />
                  </div>
                </div>
                <h3 className="mt-5 text-xl font-semibold text-white">{feature.title}</h3>
                <p className="mt-3 text-sm leading-7 text-white/55">{feature.text}</p>
              </GradientCard>
            );
          })}
        </div>
        <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.045] p-5">
          <div className="flex flex-wrap items-center justify-end gap-3 text-sm font-semibold text-white/65 text-right">
            مصمم لمحادثات الدعم التي يبدأها العميل والردود التجارية المسموحة، وليس للإرسال الجماعي أو الأتمتة غير الرسمية.
            <ShieldCheck className="h-5 w-5 text-cyanx-400" />
          </div>
        </div>
      </section>
    </main>
  );
}

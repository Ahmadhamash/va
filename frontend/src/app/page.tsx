"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
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
import { useLanguageStore } from "@/store/use-language-store";
import { cn } from "@/lib/utils";

function homeForRole(role?: string) {
  if (role === "admin") return "/admin";
  if (role === "support_agent") return "/support";
  return "/dashboard";
}

function PhoneMockup({ isRtl }: { isRtl: boolean }) {
  const messages = useMemo(() => [
    { 
      from: "customer", 
      channel: "Instagram", 
      text: isRtl ? "مرحبا، عندكم قياسات جاكيتات؟" : "Hello, do you have jacket sizes?" 
    },
    { 
      from: "ai", 
      channel: isRtl ? "الذكاء الاصطناعي" : "AI Agent", 
      text: isRtl 
        ? "أهلاً وسهلاً، آه موجود. أي موديل حاب تشوف قياساته؟" 
        : "Welcome! Yes we do. Which model would you like to check sizes for?" 
    },
    { 
      from: "customer", 
      channel: "Messenger", 
      text: isRtl ? "والكفالة كيف؟" : "How about the warranty?" 
    },
    { 
      from: "ai", 
      channel: isRtl ? "الذكاء الاصطناعي" : "AI Agent", 
      text: isRtl 
        ? "الكفالة حسب المنتج. بحكيلك التفاصيل المؤكدة من قاعدة المعرفة." 
        : "Warranty varies by product. I can share the verified details from the knowledge base." 
    },
  ], [isRtl]);

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
        className="absolute -inset-7 rounded-[3rem] border border-cyan-400/20"
      />

      <div className="relative rounded-[2.4rem] border border-white/12 bg-ink-950 p-3 shadow-2xl shadow-black/40">
        <div className={cn("rounded-[2rem] border border-white/10 bg-gradient-to-b from-ink-900 to-ink-950 p-4", isRtl ? "text-right" : "text-left")}>
          <div className={cn("mb-4 flex items-center justify-between", isRtl ? "flex-row" : "flex-row-reverse")}>
            <div className="flex gap-2 text-white/55">
              <MessageCircle className="h-4 w-4" />
              <Facebook className="h-4 w-4" />
              <Instagram className="h-4 w-4" />
            </div>
            <div className={cn("flex items-center gap-3", isRtl ? "flex-row" : "flex-row-reverse")}>
              <div className={isRtl ? "text-right" : "text-left"}>
                <div className="text-sm font-semibold text-white">
                  {isRtl ? "وكيل chatter" : "chatter Agent"}
                </div>
                <div className={cn("flex items-center gap-1 text-xs text-primary-400", isRtl ? "justify-end" : "justify-start flex-row-reverse")}>
                  <span>{isRtl ? "متصل الآن" : "Online now"}</span>
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
                className={message.from === "ai" 
                  ? (isRtl ? "flex justify-start text-right" : "flex justify-start text-left") 
                  : (isRtl ? "flex justify-end text-right" : "flex justify-end text-left")}
              >
                <div
                  className={cn(
                    message.from === "ai"
                      ? "max-w-[80%] rounded-2xl rounded-bl-md bg-primary-500 px-4 py-3 text-sm leading-6 text-white"
                      : "max-w-[80%] rounded-2xl rounded-br-md bg-white/9 px-4 py-3 text-sm leading-6 text-white/80",
                    isRtl ? "text-right" : "text-left"
                  )}
                >
                  <div className="mb-1 text-[11px] font-semibold opacity-60">{message.channel}</div>
                  {message.text}
                </div>
              </motion.div>
            ))}
          </div>

          <div className={cn("mt-4 rounded-2xl border border-white/8 bg-white/[0.04] p-3", isRtl ? "text-right" : "text-left")}>
            <div className="mb-2 flex items-center justify-between text-xs text-white/55">
              {isRtl ? (
                <>
                  <span className="text-primary-400">جاهز</span>
                  <span>تحويل للموظف</span>
                </>
              ) : (
                <>
                  <span>Handoff to Staff</span>
                  <span className="text-primary-400">Ready</span>
                </>
              )}
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/10">
              <motion.div
                animate={{ x: ["-35%", "15%", "105%"] }}
                transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
                className="h-full w-1/3 rounded-full bg-cyan-400"
              />
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export default function LandingPage() {
  const [mounted, setMounted] = useState(false);
  const user = useAuthStore((s) => s.user);
  const language = useLanguageStore((state) => state.language);
  const isRtl = language === "ar";

  useEffect(() => {
    setMounted(true);
  }, []);

  const activeUser = mounted ? user : null;
  const dashboardHref = homeForRole(activeUser?.role);

  const featureCards = useMemo(() => [
    {
      icon: MessageCircle,
      title: isRtl ? "كل القنوات بمكان واحد" : "All Channels in One Place",
      text: isRtl 
        ? "واتساب وMessenger وInstagram داخل صندوق محادثات مرتب وسهل على صاحب العمل." 
        : "WhatsApp, Messenger, and Instagram combined in a clean inbox, built simple for business owners.",
    },
    {
      icon: WalletCards,
      title: isRtl ? "قاعدة معرفة عملية" : "Smart Knowledge Base",
      text: isRtl 
        ? "منتجات، أسعار، صور، سياسات، كفالات، ومعلومات نشاطك بدون تعقيد." 
        : "Products, pricing, images, policies, warranties, and key info loaded without complexity.",
    },
    {
      icon: UserCheck,
      title: isRtl ? "تحويل بشري ذكي" : "Smart Human Handoff",
      text: isRtl 
        ? "المحادثات الحساسة بتوصل لموظف المنصة عشان يكمل بدل الذكاء الاصطناعي." 
        : "Sensitive support conversations are escalated to team members to continue instead of the AI.",
    },
  ], [isRtl]);

  const quickPoints = useMemo(() => [
    [isRtl ? "بدون هلوسة" : "No Hallucination", isRtl ? "الإجابات من قاعدة المعرفة فقط" : "Replies generated strictly from your knowledge facts"],
    [isRtl ? "ربط رسمي" : "Official Connect", isRtl ? "Meta OAuth مع خيار يدوي" : "Direct Meta OAuth login with manual backup config"],
    [isRtl ? "تحويل بشري" : "Human Support", isRtl ? "للحالات الحساسة والمشتكية" : "Escalation paths for complaints and manual queries"],
  ], [isRtl]);

  return (
    <main className="min-h-screen overflow-hidden">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-4 py-6 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2 sm:gap-3">
          <span className="grid h-10 w-10 sm:h-12 sm:w-12 place-items-center rounded-xl sm:rounded-2xl bg-primary-500 text-white shadow-glow">
            <MessageCircle className="h-5 w-5 sm:h-6 sm:w-6" />
          </span>
          <span className={isRtl ? "text-right" : "text-left"}>
            <span className="block text-base sm:text-lg font-semibold text-white">chatter</span>
            <span className="hidden sm:block text-xs text-white/42">
              {isRtl ? "وكيل ذكاء اصطناعي لكل قنواتك" : "Conversational AI for all customer channels"}
            </span>
          </span>
        </Link>
        <div className="flex items-center gap-2 sm:gap-3">
          <ThemeToggle />
          {activeUser ? (
            <Link href={dashboardHref}>
              <Button size="sm" className="sm:h-10 sm:px-4">
                {isRtl ? "لوحة التحكم" : "Dashboard"}
              </Button>
            </Link>
          ) : (
            <Link href="/login">
              <Button size="sm" className="sm:h-10 sm:px-4 text-xs sm:text-sm whitespace-nowrap">
                {isRtl ? "تسجيل الدخول" : "Log In"}
              </Button>
            </Link>
          )}
        </div>
      </header>

      <section className="relative mx-auto max-w-7xl px-4 pb-14 pt-8 sm:px-6 lg:px-8 lg:min-h-[calc(100vh-120px)] flex items-center">
        <div className="grid gap-8 lg:grid-cols-12 items-center w-full">
          {/* Mockup Column */}
          <div className={cn("w-full flex items-center justify-center", isRtl ? "order-2 lg:order-1 lg:col-span-5" : "order-2 lg:order-2 lg:col-span-5")}>
            <PhoneMockup isRtl={isRtl} />
          </div>

          {/* Text Content Column */}
          <div className={cn("flex flex-col w-full", isRtl ? "order-1 lg:order-2 lg:col-span-7 text-right items-end" : "order-1 lg:order-1 lg:col-span-7 text-left items-start")}>
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary-400/20 bg-primary-500/10 px-3 py-1.5 text-sm font-semibold text-primary-400 animate-pulse animate-duration-1000"
            >
              <Sparkles className="h-4 w-4" />
              <span>WhatsApp + Facebook + Instagram</span>
            </motion.div>
            <motion.h1
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="max-w-4xl text-5xl font-semibold tracking-tight text-white sm:text-6xl lg:text-7xl font-sans"
            >
              chatter
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className={cn("mt-6 max-w-2xl text-lg leading-8 text-white/58", isRtl ? "text-right" : "text-left")}
            >
              {isRtl 
                ? "وكيل خدمة عملاء عربي يرد من قاعدة معرفة مؤكدة، يربط قنوات العميل، ويحوّل المحادثة لموظف بشري وقت الحاجة." 
                : "An automated customer service agent answering from your business facts, integrated with Meta social channels, with smart manual support handover."}
            </motion.p>
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="mt-9 flex flex-wrap gap-3"
            >
              <Link href={activeUser ? dashboardHref : "/login"}>
                <PremiumButton className="h-14 px-7 text-base flex items-center gap-2">
                  {isRtl ? (
                    <>
                      <ArrowLeft className="h-5 w-5" />
                      <span>ادخل لوحة التحكم</span>
                    </>
                  ) : (
                    <>
                      <span>Go to Dashboard</span>
                      <ArrowRight className="h-5 w-5" />
                    </>
                  )}
                </PremiumButton>
              </Link>
            </motion.div>

            <div className="mt-10 grid gap-3 sm:grid-cols-3 w-full">
              {quickPoints.map(([title, text]) => (
                <div key={title} className={cn("rounded-2xl border border-white/10 bg-white/[0.055] p-4", isRtl ? "text-right" : "text-left")}>
                  <div className={cn("flex mb-2", isRtl ? "justify-end" : "justify-start")}>
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
              <GradientCard key={feature.title} className={isRtl ? "text-right" : "text-left"}>
                <div className={cn("flex", isRtl ? "justify-end" : "justify-start")}>
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
          <div className={cn("flex flex-wrap items-center gap-3 text-sm font-semibold text-white/65", isRtl ? "justify-end text-right" : "justify-start text-left flex-row-reverse")}>
            <span>
              {isRtl 
                ? "مصمم لمحادثات الدعم التي يبدأها العميل والردود التجارية المسموحة، وليس للإرسال الجماعي أو الأتمتة غير الرسمية." 
                : "Designed for client-initiated support threads and standard business replies, not bulk spam or unofficial automation."}
            </span>
            <ShieldCheck className="h-5 w-5 text-cyan-400" />
          </div>
        </div>
      </section>
    </main>
  );
}

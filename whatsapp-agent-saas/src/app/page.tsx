"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Bot, CheckCircle2, MessageCircle, ShieldCheck, Sparkles, UserCheck, WalletCards } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GradientCard } from "@/components/gradient-card";
import { PremiumButton } from "@/components/premium-button";

const featureCards = [
  {
    icon: MessageCircle,
    title: "Connect WhatsApp Business",
    text: "Use the official WhatsApp Business Platform path with Demo Mode while production setup is pending."
  },
  {
    icon: WalletCards,
    title: "Train Your Agent",
    text: "Add products, policies, hours, location, delivery areas, and simple rules in plain language."
  },
  {
    icon: UserCheck,
    title: "Auto-Reply + Human Handoff",
    text: "Let AI handle simple questions and transfer sensitive conversations to your team."
  }
];

function PhoneMockup() {
  const messages = [
    { from: "customer", text: "Hi, do you deliver to Khalda?" },
    { from: "ai", text: "Yes, we do. Delivery starts from 2 JOD. What would you like to order?" },
    { from: "customer", text: "What meals do you have?" },
    { from: "ai", text: "We have shawarma meals, burgers, and family grill boxes. Which one are you interested in?" }
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 24, rotate: -2 }}
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
                <div className="text-sm font-semibold text-white">Mira AI</div>
                <div className="text-xs text-emeraldx-400">Online now</div>
              </div>
            </div>
            <ShieldCheck className="h-5 w-5 text-cyanx-400" />
          </div>
          <div className="space-y-3">
            {messages.map((message, index) => (
              <motion.div
                key={message.text}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35 + index * 0.14 }}
                className={message.from === "ai" ? "flex justify-end" : "flex justify-start"}
              >
                <div
                  className={
                    message.from === "ai"
                      ? "max-w-[78%] rounded-3xl rounded-br-md bg-emeraldx-500 px-4 py-3 text-sm leading-6 text-ink-950"
                      : "max-w-[78%] rounded-3xl rounded-bl-md bg-white/9 px-4 py-3 text-sm leading-6 text-white/80"
                  }
                >
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
            <span className="block text-lg font-semibold text-white">AgentFlow</span>
            <span className="block text-xs text-white/42">AI WhatsApp support</span>
          </span>
        </Link>
        <div className="flex items-center gap-3">
          <Link href="/dashboard">
            <Button variant="ghost">View Demo</Button>
          </Link>
          <Link href="/onboarding">
            <Button>Start Setup</Button>
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
            Official WhatsApp Business Platform ready
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="max-w-4xl text-5xl font-semibold tracking-tight text-white sm:text-6xl lg:text-7xl"
          >
            Your AI WhatsApp Agent, Live in Minutes
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mt-6 max-w-2xl text-lg leading-8 text-white/58"
          >
            Connect WhatsApp Business, teach your agent, and let it handle customer messages with human handoff when needed.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mt-9 flex flex-wrap gap-3"
          >
            <Link href="/onboarding">
              <PremiumButton className="h-14 px-7 text-base">
                Start Setup
                <ArrowRight className="h-5 w-5" />
              </PremiumButton>
            </Link>
            <Link href="/dashboard">
              <Button variant="secondary" className="h-14 px-7 text-base">
                View Demo
              </Button>
            </Link>
          </motion.div>

          <div className="mt-10 grid gap-3 sm:grid-cols-3">
            {[
              ["Customer-initiated", "Support conversations"],
              ["Demo Mode", "Test before launch"],
              ["Human handoff", "For sensitive cases"]
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
      </section>
    </main>
  );
}

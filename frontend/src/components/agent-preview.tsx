"use client";

import { Bot, RotateCcw, Send, ShieldAlert } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { GradientCard } from "@/components/gradient-card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Message {
  id: string;
  sender: "CUSTOMER" | "AI" | "SYSTEM";
  body: string;
}

const dialectGreeting: Record<string, string> = {
  jordanian: "يا هلا، كيف بقدر أساعدك اليوم؟",
  syrian: "أهلاً وسهلاً، كيف فيني ساعدك؟",
  saudi: "يا هلا ومرحبا، كيف أقدر أساعدك؟",
  egyptian: "أهلاً بيك، أقدر أساعدك إزاي؟",
  msa: "أهلاً بك، كيف يمكنني مساعدتك؟",
};

export function AgentPreview({
  agentName = "مساعد chatter",
  dialect = "jordanian",
  tone = "friendly",
  strictness = "balanced",
  workingHours = "9 صباحاً - 6 مساءً",
  fallbackMessage = "ثواني بس، رح أحولك لموظف يساعدك بشكل أدق.",
  bannedPhrases = [],
  handoffToggles = { angry: true, refund: true, sensitive: true },
}: {
  agentName?: string;
  dialect?: string;
  tone?: string;
  strictness?: string;
  workingHours?: string;
  fallbackMessage?: string;
  bannedPhrases?: string[];
  handoffToggles?: { angry: boolean; refund: boolean; sensitive: boolean };
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [agentStatus, setAgentStatus] = useState<"ONLINE" | "HANDOFF">("ONLINE");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  function resetChat() {
    setAgentStatus("ONLINE");
    setMessages([
      {
        id: "init",
        sender: "AI",
        body: `أنا ${agentName}. ${dialectGreeting[dialect] || dialectGreeting.jordanian}`,
      },
    ]);
  }

  useEffect(() => {
    resetChat();
  }, [agentName, dialect]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  function responseFor(input: string): { text: string; handoff?: boolean; reason?: string } {
    const text = input.toLowerCase();
    const banned = bannedPhrases.find((phrase) => phrase.trim() && text.includes(phrase.toLowerCase().trim()));
    if (banned) {
      return { text: `هاي العبارة ممنوعة عندنا: ${banned}. بقدر أساعدك بسؤال ثاني ضمن معلومات النشاط.` };
    }
    if (handoffToggles.angry && ["شكوى", "غاضب", "سيء", "نصب", "مشكلة"].some((word) => text.includes(word))) {
      return { text: fallbackMessage, handoff: true, reason: "شكوى أو غضب" };
    }
    if (handoffToggles.refund && ["استرجاع", "إلغاء", "فلوسي", "مصاري", "ترجيع"].some((word) => text.includes(word))) {
      return { text: fallbackMessage, handoff: true, reason: "إلغاء أو استرجاع" };
    }
    if (handoffToggles.sensitive && ["قانوني", "كلمة المرور", "سري", "اختراق"].some((word) => text.includes(word))) {
      return { text: fallbackMessage, handoff: true, reason: "معلومة حساسة" };
    }
    if (["دوام", "أوقات", "متى"].some((word) => text.includes(word))) {
      return { text: `أوقات العمل هي ${workingHours}. وإذا بدك تفاصيل أكثر بحولك للموظف المناسب.` };
    }
    if (strictness === "strict") {
      return { text: "ما بقدر أعطي معلومة مش موجودة بقاعدة المعرفة. احكيلي اسم المنتج أو السؤال بشكل أدق." };
    }
    if (tone === "salesy") {
      return { text: "تمام، بعطيك المعلومة المؤكدة وبساعدك تختار الأنسب بدون ما أخترع تفاصيل مش موجودة." };
    }
    if (tone === "professional") {
      return { text: "أكيد، سأجيبك بناءً على المعلومات المتوفرة فقط، وإذا احتجنا تفاصيل إضافية سأطلبها منك بوضوح." };
    }
    return { text: "أكيد، احكيلي أي منتج أو خدمة تقصد وبجاوبك من المعلومات الموجودة عندنا." };
  }

  function handleSend(textToSend = inputText) {
    if (!textToSend.trim() || agentStatus === "HANDOFF") return;
    setMessages((current) => [...current, { id: `user-${Date.now()}`, sender: "CUSTOMER", body: textToSend }]);
    setInputText("");
    setIsTyping(true);
    setTimeout(() => {
      const result = responseFor(textToSend);
      setIsTyping(false);
      setMessages((current) => [
        ...current,
        { id: `ai-${Date.now()}`, sender: "AI", body: result.text },
        ...(result.handoff
          ? [{ id: `sys-${Date.now()}`, sender: "SYSTEM" as const, body: `تم تشغيل التحويل البشري: ${result.reason}.` }]
          : []),
      ]);
      if (result.handoff) setAgentStatus("HANDOFF");
    }, 650);
  }

  const quickTests = [
    { label: "أوقات العمل", query: "شو أوقات الدوام؟" },
    { label: "استرجاع", query: "بدي استرجاع مصاري" },
    { label: "شكوى", query: "عندي شكوى ومشكلة" },
    { label: "سؤال عام", query: "كيف بقدر أطلب؟" },
  ];

  return (
    <GradientCard className="flex h-[650px] flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/[0.035] p-0">
      <div className="flex items-center justify-between border-b border-white/10 bg-white/[0.04] p-4">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-emeraldx-500 text-white shadow-glow">
              <Bot className="h-5 w-5" />
            </div>
            <span className={cn("absolute -bottom-1 -left-1 h-3.5 w-3.5 rounded-full border-2 border-ink-950", agentStatus === "ONLINE" ? "bg-emeraldx-400" : "bg-amber-500")} />
          </div>
          <div className="text-right">
            <h3 className="text-sm font-semibold text-white">{agentName}</h3>
            <p className="text-[10px] text-white/50">{agentStatus === "ONLINE" ? "نشط الآن" : "تحويل بشري نشط"}</p>
          </div>
        </div>
        <Button type="button" size="sm" variant="ghost" className="h-8 w-8 p-0 text-white/40 hover:text-white" onClick={resetChat}>
          <RotateCcw className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex items-center justify-between border-b border-white/5 bg-white/[0.02] px-4 py-2 text-[11px] text-white/45">
        <span>{dialect}</span>
        <span>{tone} / {strictness}</span>
      </div>

      <div className="custom-scrollbar flex-1 space-y-3 overflow-y-auto p-4">
        {messages.map((msg) => {
          if (msg.sender === "SYSTEM") {
            return (
              <div key={msg.id} className="mx-auto flex max-w-[90%] items-center justify-center gap-2 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-3 text-center text-xs text-amber-300">
                <ShieldAlert className="h-4 w-4 shrink-0" />
                <span>{msg.body}</span>
              </div>
            );
          }
          const customer = msg.sender === "CUSTOMER";
          return (
            <div key={msg.id} className={cn("flex w-full", customer ? "justify-end" : "justify-start")}>
              <div className={cn("max-w-[80%] rounded-2xl px-3.5 py-2.5 text-right text-xs leading-5", customer ? "rounded-br-none border border-white/5 bg-white/[0.07] text-white/90" : "rounded-bl-none bg-emeraldx-500 font-medium text-white")}>
                {msg.body}
              </div>
            </div>
          );
        })}
        {isTyping && (
          <div className="flex w-full justify-start">
            <div className="flex items-center gap-1 rounded-2xl rounded-bl-none border border-white/5 bg-white/[0.07] px-4 py-3">
              <span className="h-2 w-2 animate-bounce rounded-full bg-white/40" />
              <span className="h-2 w-2 animate-bounce rounded-full bg-white/40 [animation-delay:150ms]" />
              <span className="h-2 w-2 animate-bounce rounded-full bg-white/40 [animation-delay:300ms]" />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="border-t border-white/5 bg-white/[0.02] p-3">
        <div className="mb-2 text-right text-[10px] font-medium text-white/40">اختبارات سريعة</div>
        <div className="flex flex-wrap justify-end gap-1.5">
          {quickTests.map((test) => (
            <button
              type="button"
              key={test.label}
              disabled={agentStatus === "HANDOFF"}
              onClick={() => handleSend(test.query)}
              className="rounded-full border border-white/5 bg-white/[0.04] px-2.5 py-1 text-[10px] text-white/70 transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {test.label}
            </button>
          ))}
        </div>
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          handleSend();
        }}
        className="flex gap-2 border-t border-white/10 bg-white/[0.04] p-3"
      >
        <Input
          value={inputText}
          onChange={(event) => setInputText(event.target.value)}
          disabled={agentStatus === "HANDOFF" || isTyping}
          placeholder={agentStatus === "HANDOFF" ? "المحادثة محولة لموظف..." : "اكتب رسالة للتجربة..."}
          className="h-9 pr-3 text-right text-xs"
        />
        <Button type="submit" disabled={agentStatus === "HANDOFF" || isTyping || !inputText.trim()} size="sm" className="h-9 px-3">
          <Send className="h-3.5 w-3.5 scale-x-[-1]" />
        </Button>
      </form>
    </GradientCard>
  );
}

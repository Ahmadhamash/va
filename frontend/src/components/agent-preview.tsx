"use client";

import { Bot, RotateCcw, Send, ShieldAlert } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { GradientCard } from "@/components/gradient-card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/use-auth-store";
import { useLanguageStore } from "@/store/use-language-store";

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
  emoji = "low",
  strictness = "balanced",
  workingHours = "9 صباحاً - 6 مساءً",
  fallbackMessage = "ثواني بس، رح أحولك لموظف يساعدك بشكل أدق.",
  bannedPhrases = [],
  handoffToggles = { angry: true, refund: true, sensitive: true },
}: {
  agentName?: string;
  dialect?: string;
  tone?: string;
  emoji?: string;
  strictness?: string;
  workingHours?: string;
  fallbackMessage?: string;
  bannedPhrases?: string[];
  handoffToggles?: { angry: boolean; refund: boolean; sensitive: boolean };
}) {
  const language = useLanguageStore((state) => state.language);
  const isRtl = language === "ar";

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
        body: isRtl 
          ? `أنا ${agentName}. ${dialectGreeting[dialect] || dialectGreeting.jordanian}`
          : `I am ${agentName}. ${dialectGreeting[dialect] || dialectGreeting.jordanian}`,
      },
    ]);
  }

  useEffect(() => {
    resetChat();
  }, [agentName, dialect]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  async function handleSend(textToSend = inputText) {
    if (!textToSend.trim() || agentStatus === "HANDOFF") return;
    setMessages((current) => [...current, { id: `user-${Date.now()}`, sender: "CUSTOMER", body: textToSend }]);
    setInputText("");
    setIsTyping(true);

    const config = {
      prompt_mode: "custom_settings",
      dialect,
      tone,
      emoji,
      strictness,
      agent_name: agentName,
      working_hours: workingHours,
      fallback_message: fallbackMessage,
      handoff_angry: handoffToggles.angry,
      handoff_refund: handoffToggles.refund,
      handoff_sensitive: handoffToggles.sensitive,
      banned_phrases: bannedPhrases,
    };
    
    const persona = [
      `<!-- ${JSON.stringify(config)} -->`,
      `اسم الوكيل الظاهر للعملاء: ${agentName}.`,
      `أوقات العمل: ${workingHours}.`,
      `مستوى الالتزام: ${strictness}. لا تخترع منتجات أو أسعار أو وعود غير موجودة في قاعدة المعرفة.`,
      `مستوى الإيموجي: ${emoji}.`,
      bannedPhrases.length ? `تجنب هذه العبارات: ${bannedPhrases.join(", ")}.` : "",
      `رسالة التحويل البشري: ${fallbackMessage}`,
    ].filter(Boolean).join("\n");

    try {
      const res = await fetch("/api/chat/preview", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${useAuthStore.getState().token}`,
        },
        body: JSON.stringify({ message: textToSend, persona }),
      });
      const data = await res.json();
      
      let replyText = data.reply || (isRtl ? "عذراً، ما قدرت أرد حالياً." : "Sorry, I could not respond at the moment.");
      let isHandoff = false;
      let handoffReason = "";

      // Simple frontend check for handoff terms to simulate handoff state visually
      const textLower = textToSend.toLowerCase();
      if (handoffToggles.angry && ["شكوى", "غاضب", "سيء", "نصب", "مشكلة", "complaint", "angry", "bad", "scam", "problem"].some((word) => textLower.includes(word))) {
        isHandoff = true; 
        handoffReason = isRtl ? "شكوى أو غضب" : "Complaint or Anger"; 
        replyText = fallbackMessage;
      } else if (handoffToggles.refund && ["استرجاع", "إلغاء", "فلوسي", "مصاري", "ترجيع", "refund", "cancel", "money", "return"].some((word) => textLower.includes(word))) {
        isHandoff = true; 
        handoffReason = isRtl ? "إلغاء أو استرجاع" : "Cancellation or Refund"; 
        replyText = fallbackMessage;
      } else if (handoffToggles.sensitive && ["قانوني", "كلمة المرور", "سري", "اختراق", "legal", "password", "secret", "hack"].some((word) => textLower.includes(word))) {
        isHandoff = true; 
        handoffReason = isRtl ? "معلومة حساسة" : "Sensitive Information"; 
        replyText = fallbackMessage;
      }

      setMessages((current) => [
        ...current,
        { id: `ai-${Date.now()}`, sender: "AI", body: replyText },
        ...(isHandoff
          ? [{ id: `sys-${Date.now()}`, sender: "SYSTEM" as const, body: isRtl ? `تم تشغيل التحويل البشري: ${handoffReason}.` : `Human handoff triggered: ${handoffReason}.` }]
          : []),
      ]);
      if (isHandoff) setAgentStatus("HANDOFF");
    } catch (error) {
      setMessages((current) => [
        ...current,
        { id: `ai-${Date.now()}`, sender: "AI", body: isRtl ? "حصل خطأ في الاتصال بالسيرفر. تأكد من إعداداتك." : "Server connection error. Please verify settings." },
      ]);
    } finally {
      setIsTyping(false);
    }
  }

  const quickTests = [
    { label: isRtl ? "أوقات العمل" : "Working Hours", query: "شو أوقات الدوام؟" },
    { label: isRtl ? "استرجاع" : "Refund", query: "بدي استرجاع مصاري" },
    { label: isRtl ? "شكوى" : "Complaint", query: "عندي شكوى ومشكلة" },
    { label: isRtl ? "سؤال عام" : "General Question", query: "كيف بقدر أطلب؟" },
  ];

  return (
    <GradientCard className="flex h-[650px] flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/[0.035] p-0">
      <div className="flex items-center justify-between border-b border-white/10 bg-white/[0.04] p-4">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-primary-500 text-white shadow-glow">
              <Bot className="h-5 w-5" />
            </div>
            <span className={cn("absolute -bottom-1 -left-1 h-3.5 w-3.5 rounded-full border-2 border-ink-950", agentStatus === "ONLINE" ? "bg-primary-400" : "bg-amber-500")} />
          </div>
          <div className="rtl:text-right ltr:text-left">
            <h3 className="text-sm font-semibold text-white">{agentName}</h3>
            <p className="text-[10px] text-white/50">{agentStatus === "ONLINE" ? (isRtl ? "نشط الآن" : "Active Now") : (isRtl ? "تحويل بشري نشط" : "Human handoff active")}</p>
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
              <div className={cn("max-w-[80%] rounded-2xl px-3.5 py-2.5 rtl:text-right ltr:text-left text-xs leading-5", customer ? "rounded-br-none border border-white/5 bg-white/[0.07] text-white/90" : "rounded-bl-none bg-primary-500 font-medium text-white")}>
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
        <div className="mb-2 rtl:text-right ltr:text-left text-right text-[10px] font-medium text-white/40">
          {isRtl ? "اختبارات سريعة" : "Quick Tests"}
        </div>
        <div className="flex flex-wrap gap-1.5 rtl:justify-end ltr:justify-start">
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
          placeholder={agentStatus === "HANDOFF" 
            ? (isRtl ? "المحادثة محولة لموظف..." : "Conversation claimed by staff...") 
            : (isRtl ? "اكتب رسالة للتجربة..." : "Type a message to test...")}
          className="h-9 pr-3 rtl:text-right ltr:text-left text-xs"
        />
        <Button type="submit" disabled={agentStatus === "HANDOFF" || isTyping || !inputText.trim()} size="sm" className="h-9 px-3">
          <Send className="h-3.5 w-3.5 scale-x-[-1]" />
        </Button>
      </form>
    </GradientCard>
  );
}

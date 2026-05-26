"use client";

import { Bot, Send, RotateCcw, ShieldAlert } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { GradientCard } from "@/components/gradient-card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Message {
  id: string;
  sender: "CUSTOMER" | "AI" | "SYSTEM";
  body: string;
  createdAt: Date;
}

export function AgentPreview({
  agentName = "مساعد مسار",
  tone = "عربي ودود",
  strictness = "متوازن",
  workingHours = "9 ص - 11 م",
  systemPrompt = "",
  fallbackMessage = "لحظة من فضلك، رح أحولك لموظف يساعدك بشكل أفضل.",
  bannedPhrases = [],
  handoffToggles = { angry: true, refund: true, sensitive: true }
}: {
  agentName?: string;
  tone?: string;
  strictness?: string;
  workingHours?: string;
  systemPrompt?: string;
  fallbackMessage?: string;
  bannedPhrases?: string[];
  handoffToggles?: { angry: boolean; refund: boolean; sensitive: boolean };
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [agentStatus, setAgentStatus] = useState<"ONLINE" | "HANDOFF">("ONLINE");
  const [handoffReason, setHandoffReason] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Initialize with greeting
  useEffect(() => {
    resetChat();
  }, [agentName, tone]);

  const resetChat = () => {
    let initialGreeting = `أهلاً بك! أنا ${agentName}، كيف يمكنني مساعدتك اليوم؟`;
    if (tone.includes("أردنية") || tone.includes("ودود") || tone.includes("friendly")) {
      initialGreeting = `يا هلا والله! أنا ${agentName}، كيف بقدر أخدمك وأساعدك اليوم؟ 😊`;
    } else if (tone.includes("سعودية") || tone.includes("saudi")) {
      initialGreeting = `يا هلا ومرحبا فيك! أنا ${agentName}، كيف أقدر أساعدك اليوم طال عمرك؟ 🇸🇦`;
    } else if (tone.includes("مصرية") || tone.includes("egyptian")) {
      initialGreeting = `أهلاً وسهلاً بحضرتك! منورنا، أنا ${agentName}، إزاي أقدر أساعدك النهاردة يا فندم؟ 🌸`;
    }

    setMessages([
      {
        id: "init",
        sender: "AI",
        body: initialGreeting,
        createdAt: new Date()
      }
    ]);
    setAgentStatus("ONLINE");
    setHandoffReason("");
  };

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  const handleSend = (textToSend = inputText) => {
    if (!textToSend.trim()) return;

    // Add user message
    const userMsg: Message = {
      id: `user-${Date.now()}`,
      sender: "CUSTOMER",
      body: textToSend,
      createdAt: new Date()
    };

    setMessages(prev => [...prev, userMsg]);
    setInputText("");
    setIsTyping(true);

    // Simulate Agent processing
    setTimeout(() => {
      setIsTyping(false);
      const res = getMockResponse(textToSend);

      if (res.handoff) {
        setAgentStatus("HANDOFF");
        setHandoffReason(res.reason || "");
        setMessages(prev => [
          ...prev,
          {
            id: `ai-${Date.now()}`,
            sender: "AI",
            body: res.text,
            createdAt: new Date()
          },
          {
            id: `sys-${Date.now()}`,
            sender: "SYSTEM",
            body: `⚠️ تم تشغيل قاعدة التحويل البشري: (${res.reason}). المحادثة معلقة بانتظار موظف.`,
            createdAt: new Date()
          }
        ]);
      } else {
        setMessages(prev => [
          ...prev,
          {
            id: `ai-${Date.now()}`,
            sender: "AI",
            body: res.text,
            createdAt: new Date()
          }
        ]);
      }
    }, 1000);
  };

  const getMockResponse = (input: string) => {
    const text = input.toLowerCase();

    // 1. Banned Phrases Check
    const triggeredBanned = bannedPhrases.find(phrase =>
      phrase.trim() && text.includes(phrase.toLowerCase().trim())
    );
    if (triggeredBanned) {
      return {
        text: `عذراً، لقد كتبت عبارة تحتوي على كلمة محظورة من قبل إدارة النظام (${triggeredBanned}). كوكيل ذكي، يمنع عليّ استخدام أو مناقشة هذه الكلمات بناءً على سياسة النشاط.`,
        handoff: false
      };
    }

    // 2. Anger Check
    const angryWords = ["غاضب", "سيء", "شكوى", "سيئه", "تافه", "كذاب", "احتيال", "نصب", "زفت", "غبي", "حمار"];
    const isAngry = angryWords.some(w => text.includes(w));
    if (isAngry && handoffToggles.angry) {
      return {
        text: fallbackMessage || "لحظة من فضلك، رح أحولك لموظف يساعدك بشكل أفضل.",
        handoff: true,
        reason: "غضب العميل"
      };
    }

    // 3. Refund/Cancel Check
    const refundWords = ["استرجاع", "الغاء", "الاسترجاع", "الإلغاء", "ترجيع", "فلوسي", "مصاري", "الغاء الاشتراك", "ارجاع"];
    const isRefund = refundWords.some(w => text.includes(w));
    if (isRefund && handoffToggles.refund) {
      return {
        text: fallbackMessage || "لحظة من فضلك، رح أحولك لموظف يساعدك بشكل أفضل.",
        handoff: true,
        reason: "طلب إلغاء/استرجاع"
      };
    }

    // 4. Sensitive Information Check
    const sensitiveWords = ["سري", "باسورد", "اختراق", "تهديد", "قانوني", "محامي", "سرقة", "كلمة المرور"];
    const isSensitive = sensitiveWords.some(w => text.includes(w));
    if (isSensitive && handoffToggles.sensitive) {
      return {
        text: "عذراً، هذا الاستفسار يتعلق بمعلومات حساسة. جاري تحويلك مباشرة للتحقق البشري لمتابعة الطلب بأمان.",
        handoff: true,
        reason: "معلومات حساسة"
      };
    }

    // 5. Working Hours Check
    const hoursWords = ["ساعات", "مواعيد", "وقت", "اوقات", "متى", "تفتحوا", "دوام"];
    const isHours = hoursWords.some(w => text.includes(w));
    if (isHours) {
      return {
        text: `أوقات عملنا الرسمية للرد البشري هي: ${workingHours}. ولكن أنا كوكيل ذكي متواجد لخدمتك على مدار الساعة!`,
        handoff: false
      };
    }

    // 6. Greetings Check
    const greetings = ["مرحبا", "هلا", "السلام", "مرحب", "سلام", "hi", "hello"];
    const isGreeting = greetings.some(g => text.includes(g));
    if (isGreeting) {
      let greetingText = `أهلاً بك مجدداً! كيف يمكنني مساعدتك اليوم؟`;
      if (tone.includes("أردنية") || tone.includes("ودود") || tone.includes("friendly")) {
        greetingText = `يا هلا والله وغلا! كيف بقدر أخدمك وأساعدك اليوم؟ 😊`;
      } else if (tone.includes("سعودية") || tone.includes("saudi")) {
        greetingText = `يا هلا ومرحبا فيك! كيف أقدر أساعدك اليوم طال عمرك؟ 🇸🇦`;
      } else if (tone.includes("مصرية") || tone.includes("egyptian")) {
        greetingText = `أهلاً وسهلاً بحضرتك يا فندم! إزاي أقدر أساعدك النهاردة؟ 🌸`;
      }
      return { text: greetingText, handoff: false };
    }

    // 7. Strictness Check
    if (strictness.includes("صارم")) {
      return {
        text: `أنا آسف، كوكيل ذكي مضبوط على الوضع الصارم، يمكنني الإجابة فقط على الأسئلة المطابقة للمعلومات المحفوظة في قاعدة المعرفة. يرجى إعادة صياغة سؤالك حول خدماتنا الأساسية.`,
        handoff: false
      };
    }

    // Default responses based on dialect
    let replyText = "";
    if (tone.includes("أردنية") || tone.includes("ودود") || tone.includes("friendly")) {
      replyText = `على راسي، بخصوص سؤالك عن "${input}"، وكيلنا مبرمج باللهجة الأردنية الودودة لمساعدتك. تحب تستفسر عن الأسعار أو طريقة الربط؟`;
    } else if (tone.includes("سعودية") || tone.includes("saudi")) {
      replyText = `أبشر، استفسارك بخصوص "${input}" محل اهتمامنا. منصة مسار توفر لك ربط تلقائي ومبيعات ذكية لعملائك بكل سهولة. وش تبي تعرف أكثر؟`;
    } else if (tone.includes("مصرية") || tone.includes("egyptian")) {
      replyText = `يا فندم بخصوص "${input}"، عيونا ليك! إحنا بنسهل عليك الربط والرد التلقائي بالكامل عشان تريح بالك. تحب أبعتلك تفاصيل الأسعار؟`;
    } else {
      replyText = `بخصوص استفسارك حول "${input}"، يسعدني إعلامك أن الوكيل الذكي يعمل بكفاءة لمعالجة طلباتك. يرجى تزويدنا بالمزيد من التفاصيل لنتمكن من إفادتك بشكل أدق.`;
    }

    return { text: replyText, handoff: false };
  };

  const quickTests = [
    { label: "⏰ أوقات العمل", query: "ما هي أوقات العمل والدوام؟" },
    { label: "💳 طلب استرجاع", query: "أريد إلغاء الطلب واسترجاع أموالي!" },
    { label: "🚫 كلمة محظورة", query: bannedPhrases[0] ? `هل تقدمون ${bannedPhrases[0]}؟` : "هل تقدمون خصم خاص؟" },
    { label: "💡 استفسار عام", query: "كيف يعمل الربط مع واتساب؟" }
  ];

  return (
    <GradientCard className="flex flex-col h-[650px] p-0 overflow-hidden border border-white/10 bg-white/[0.035] rounded-3xl">
      {/* Mock Chat Header */}
      <div className="flex items-center justify-between border-b border-white/10 bg-white/[0.04] p-4">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-emeraldx-500 text-ink-950 shadow-glow">
              <Bot className="h-5 w-5" />
            </div>
            <span className={cn(
              "absolute -bottom-1 -left-1 h-3.5 w-3.5 rounded-full border-2 border-ink-950",
              agentStatus === "ONLINE" ? "bg-emeraldx-400" : "bg-amber-500"
            )} />
          </div>
          <div className="text-right">
            <h3 className="text-sm font-semibold text-white">{agentName}</h3>
            <p className="text-[10px] text-white/50 text-right">
              {agentStatus === "ONLINE" ? "نشط الآن (الذكاء)" : `تحويل بشري نشط (${handoffReason})`}
            </p>
          </div>
        </div>
        <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-white/40 hover:text-white" onClick={resetChat}>
          <RotateCcw className="h-4 w-4" />
        </Button>
      </div>

      {/* Simulator Details Indicator */}
      <div className="bg-white/[0.02] border-b border-white/5 px-4 py-2 flex items-center justify-between text-[11px] text-white/45">
        <span>الأسلوب: <b className="text-white/60">{tone}</b></span>
        <span>الصرامة: <b className="text-white/60">{strictness}</b></span>
      </div>

      {/* Message Screen */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
        {messages.map((msg) => {
          if (msg.sender === "SYSTEM") {
            return (
              <div key={msg.id} className="mx-auto max-w-[90%] rounded-2xl border border-amber-500/20 bg-amber-500/5 p-3 text-center text-xs text-amber-300 flex items-center justify-center gap-2">
                <ShieldAlert className="h-4 w-4 shrink-0" />
                <span>{msg.body}</span>
              </div>
            );
          }

          const fromCustomer = msg.sender === "CUSTOMER";
          return (
            <div key={msg.id} className={cn("flex w-full", fromCustomer ? "justify-end" : "justify-start")}>
              <div
                className={cn(
                  "max-w-[80%] rounded-2xl px-3.5 py-2.5 text-xs leading-5 shadow-sm text-right",
                  fromCustomer 
                    ? "rounded-br-none bg-white/[0.07] border border-white/5 text-white/90"
                    : "rounded-bl-none bg-gradient-to-br from-emeraldx-500 to-teal-400 text-ink-950 font-medium"
                )}
              >
                <div>{msg.body}</div>
              </div>
            </div>
          );
        })}

        {isTyping && (
          <div className="flex w-full justify-start">
            <div className="rounded-2xl rounded-bl-none bg-white/[0.07] border border-white/5 px-4 py-3 flex gap-1 items-center">
              <span className="h-2 w-2 rounded-full bg-white/40 animate-bounce" style={{ animationDelay: "0ms" }} />
              <span className="h-2 w-2 rounded-full bg-white/40 animate-bounce" style={{ animationDelay: "150ms" }} />
              <span className="h-2 w-2 rounded-full bg-white/40 animate-bounce" style={{ animationDelay: "300ms" }} />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Test Tags */}
      <div className="p-3 bg-white/[0.02] border-t border-white/5">
        <div className="text-[10px] text-white/40 mb-2 font-medium text-right">:اختبارات سريعة للتحقق من أداء الوكيل</div>
        <div className="flex flex-wrap gap-1.5 justify-end">
          {quickTests.map((test, index) => (
            <button
              type="button"
              key={index}
              disabled={agentStatus === "HANDOFF"}
              onClick={() => handleSend(test.query)}
              className="text-[10px] bg-white/[0.04] border border-white/5 hover:bg-white/[0.08] hover:border-white/10 text-white/70 rounded-full px-2.5 py-1 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {test.label}
            </button>
          ))}
        </div>
      </div>

      {/* Input area */}
      <div className="p-3 bg-white/[0.04] border-t border-white/10">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex gap-2"
        >
          <Input
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            disabled={agentStatus === "HANDOFF" || isTyping}
            placeholder={agentStatus === "HANDOFF" ? "تم تحويل المحادثة للموظف..." : "اكتب رسالة لتجربة الوكيل..."}
            className="h-9 text-xs text-right pr-3"
          />
          <Button
            type="submit"
            disabled={agentStatus === "HANDOFF" || isTyping || !inputText.trim()}
            size="sm"
            className="h-9 px-3"
          >
            <Send className="h-3.5 w-3.5 transform scale-x-[-1]" />
          </Button>
        </form>
      </div>
    </GradientCard>
  );
}

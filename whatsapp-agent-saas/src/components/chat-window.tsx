"use client";

import { useMemo, useState } from "react";
import { Bot, Facebook, Instagram, MessageCircle, Pencil, RefreshCw, Send, StickyNote, UserCheck, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/status-badge";
import type { ChannelProvider, Conversation, ConversationStatus, Message } from "@/lib/types";
import { cn, formatTime } from "@/lib/utils";

const channelLabels: Record<ChannelProvider, string> = {
  WHATSAPP: "واتساب",
  FACEBOOK: "فيسبوك",
  INSTAGRAM: "إنستغرام"
};

function ChannelIcon({ channel }: { channel: ChannelProvider }) {
  const Icon = channel === "WHATSAPP" ? MessageCircle : channel === "FACEBOOK" ? Facebook : Instagram;
  return <Icon className="h-4 w-4 text-emeraldx-400" />;
}

function MessageBubble({ message }: { message: Message }) {
  const fromCustomer = message.sender === "CUSTOMER";
  const fromSystem = message.sender === "SYSTEM";
  return (
    <div className={cn("flex", fromCustomer ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[78%] rounded-3xl px-4 py-3 text-sm leading-6",
          fromCustomer && "rounded-br-md bg-white/9 text-white/78",
          message.sender === "AI" && "rounded-bl-md bg-emeraldx-500 text-ink-950",
          message.sender === "HUMAN" && "rounded-bl-md bg-violetrx-500/80 text-white",
          fromSystem && "mx-auto max-w-[86%] rounded-2xl border border-white/10 bg-white/[0.04] text-center text-white/45"
        )}
      >
        <div>{message.body}</div>
        <div className={cn("mt-1 text-[11px]", message.sender === "AI" ? "text-ink-950/55" : "text-white/35")}>
          {formatTime(message.createdAt)}
        </div>
      </div>
    </div>
  );
}

export function ChatWindow({ conversation }: { conversation: Conversation }) {
  const [draft, setDraft] = useState("");
  const [status, setStatus] = useState<ConversationStatus>(conversation.status);
  const [messages, setMessages] = useState<Message[]>(conversation.messages);
  const [version, setVersion] = useState(0);
  const [note, setNote] = useState("العميل يفضل الردود المختصرة ويهتم بسرعة الربط.");

  const suggestedReply = useMemo(() => {
    if (status === "NEEDS_HUMAN") {
      return "أكيد، رح أحولك لموظف يساعدك بأسرع وقت.";
    }
    const variants = [
      "عنا ربط واتساب وفيسبوك وإنستغرام، صندوق محادثات موحد، ووكيل ذكي يرد من معلومات نشاطك. بأي قناة مهتم تبدأ؟",
      "أكيد. نقدر نجهز لك الوكيل، نضيف معلومات نشاطك، ونخليه يرد على العملاء مع تحويل بشري عند الحالات الحساسة.",
      "منصة مسار تجمع رسائل العملاء وتخلي الذكاء يرد بالعربي بدون تعقيد. احكيلي شو نوع نشاطك؟"
    ];
    return variants[version % variants.length];
  }, [status, version]);

  async function addMessage(sender: Message["sender"], body: string) {
    if (!body.trim()) return;
    
    // Optimistic UI update
    const tempId = `msg_${Date.now()}`;
    setMessages((items) => [
      ...items,
      {
        id: tempId,
        conversationId: conversation.id,
        sender,
        body,
        createdAt: new Date().toISOString()
      }
    ]);

    if (sender === "HUMAN" || sender === "AI") {
        try {
            await fetch(`/api/conversations/${conversation.id}/message`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message: body })
            });
        } catch (e) {
            console.error(e);
        }
    }
  }

  async function updateStatus(newStatus: ConversationStatus, action: "takeover" | "return-to-ai" | "close") {
    setStatus(newStatus);
    try {
      const endpoint = action === "close" ? "takeover" : action;
      await fetch(`/api/conversations/${conversation.id}/${endpoint}`, {
        method: "POST"
      });
    } catch (e) {
      console.error(e);
    }
  }

  return (
    <div className="grid min-h-[680px] gap-4 lg:grid-cols-[1fr_280px]">
      <div className="flex min-h-[680px] flex-col rounded-3xl border border-white/10 bg-white/[0.045]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 p-4">
          <div>
            <div className="flex items-center gap-2 text-lg font-semibold text-white">
              <ChannelIcon channel={conversation.channel} />
              {conversation.customerName}
            </div>
            <div className="mt-1 text-sm text-white/42">{channelLabels[conversation.channel]} · {conversation.customerPhone}</div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={status} />
            <Button size="sm" variant="secondary" onClick={() => updateStatus("HUMAN_ACTIVE", "takeover")}>
              <UserCheck className="h-4 w-4" />
              استلام
            </Button>
            <Button size="sm" variant="ghost" onClick={() => updateStatus("AI_HANDLING", "return-to-ai")}>إرجاع للذكاء</Button>
            <Button size="sm" variant="ghost" onClick={() => updateStatus("CLOSED", "close")}>إغلاق</Button>
          </div>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          {messages.map((message) => (
            <MessageBubble key={message.id} message={message} />
          ))}
        </div>

        <div className="border-t border-white/10 p-4">
          <div className="mb-3 rounded-3xl border border-emeraldx-400/20 bg-emeraldx-500/10 p-4">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-emeraldx-400">
                <Bot className="h-4 w-4" />
                رد مقترح
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => addMessage("AI", suggestedReply)}>إرسال</Button>
                <Button size="sm" variant="secondary" onClick={() => setDraft(suggestedReply)}>
                  <Pencil className="h-3.5 w-3.5" />
                  تعديل
                </Button>
                <Button size="sm" variant="ghost" aria-label="توليد رد جديد" onClick={() => setVersion((value) => value + 1)}>
                  <RefreshCw className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
            <p className="text-sm leading-6 text-white/68">{suggestedReply}</p>
          </div>
          <div className="flex gap-2">
            <Input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="اكتب رد الموظف..." />
            <Button
              onClick={() => {
                addMessage("HUMAN", draft);
                setDraft("");
                setStatus("HUMAN_ACTIVE");
              }}
            >
              <Send className="h-4 w-4" />
              إرسال
            </Button>
          </div>
        </div>
      </div>

      <aside className="space-y-4">
        <div className="rounded-3xl border border-white/10 bg-white/[0.045] p-4">
          <div className="text-sm font-semibold text-white">ملف العميل</div>
          <div className="mt-4 space-y-3 text-sm text-white/58">
            <div className="flex justify-between gap-3">
              <span>الاسم</span>
              <span className="text-white">{conversation.customerName}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span>القناة</span>
              <span className="text-white">{channelLabels[conversation.channel]}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span>عدد المحادثات</span>
              <span className="text-white">3</span>
            </div>
          </div>
        </div>
        <div className="rounded-3xl border border-white/10 bg-white/[0.045] p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
            <StickyNote className="h-4 w-4 text-cyanx-400" />
            ملاحظات
          </div>
          <p className="text-sm leading-6 text-white/50">{note}</p>
          <Button className="mt-4 w-full" variant="secondary" size="sm" onClick={() => setNote("تمت إضافة ملاحظة: راجع الربط الرسمي مع العميل.")}>
            إضافة ملاحظة
          </Button>
        </div>
        <div className="rounded-3xl border border-red-400/20 bg-red-500/10 p-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-red-100">
            <XCircle className="h-4 w-4" />
            حماية
          </div>
          <p className="text-sm leading-6 text-red-100/70">
            الشكاوى والإلغاء والاسترجاع تتحول لموظف تلقائيا.
          </p>
        </div>
      </aside>
    </div>
  );
}

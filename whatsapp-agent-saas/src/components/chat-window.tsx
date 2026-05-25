"use client";

import { useMemo, useState, useEffect } from "react";
import { Bot, Facebook, Instagram, MessageCircle, Pencil, RefreshCw, Send, StickyNote, UserCheck, XCircle, Webhook, Code, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/status-badge";
import type { ChannelProvider, Conversation, ConversationStatus, Message } from "@/lib/types";
import { cn, formatTime } from "@/lib/utils";
import { useAuthStore } from "@/store/use-auth-store";
import { Textarea } from "@/components/ui/textarea";

const channelLabels: Record<string, string> = {
  WHATSAPP: "واتساب",
  FACEBOOK: "فيسبوك",
  MESSENGER: "فيسبوك ماسنجر",
  INSTAGRAM: "إنستغرام",
  WEBHOOK: "ويب هوك",
  WIDGET: "ويدجت"
};

function ChannelIcon({ channel }: { channel: ChannelProvider }) {
  const Icon =
    channel === "WHATSAPP"
      ? MessageCircle
      : channel === "FACEBOOK" || channel === "MESSENGER"
        ? Facebook
        : channel === "INSTAGRAM"
          ? Instagram
          : channel === "WEBHOOK"
            ? Webhook
            : channel === "WIDGET"
              ? Code
              : MessageCircle;
  return <Icon className="h-4 w-4 text-emeraldx-400" />;
}

function MessageBubble({ message }: { message: Message }) {
  const fromCustomer = message.sender === "CUSTOMER";
  const fromSystem = message.sender === "SYSTEM";
  return (
    <div className={cn("flex w-full mb-3 transition-all duration-300 hover:translate-y-[-1px]", fromCustomer ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[78%] rounded-[20px] px-4 py-3 text-sm leading-6 shadow-sm backdrop-blur-md",
          fromCustomer && "rounded-br-none bg-white/[0.07] border border-white/5 text-white/90",
          message.sender === "AI" && "rounded-bl-none bg-gradient-to-br from-emeraldx-500 to-teal-400 text-ink-950 font-medium shadow-emeraldx-500/10",
          message.sender === "HUMAN" && "rounded-bl-none bg-gradient-to-br from-violetrx-600 to-indigo-500 text-white shadow-violetrx-600/15",
          fromSystem && "mx-auto max-w-[86%] rounded-2xl border border-white/10 bg-white/[0.04] text-center text-white/45"
        )}
      >
        <div className="break-words whitespace-pre-wrap">{message.body}</div>
        <div className={cn("mt-1.5 text-[10px] text-right font-medium tracking-tight", message.sender === "AI" ? "text-ink-950/50" : "text-white/30")}>
          {formatTime(message.createdAt)}
        </div>
      </div>
    </div>
  );
}

export function ChatWindow({
  conversation,
  onStatusChange,
  onNewMessage
}: {
  conversation: Conversation;
  onStatusChange?: (id: string, status: ConversationStatus) => void;
  onNewMessage?: (id: string, message: Message) => void;
}) {
  const { token } = useAuthStore();
  const [draft, setDraft] = useState("");
  const [status, setStatus] = useState<ConversationStatus>(conversation.status);
  const [messages, setMessages] = useState<Message[]>(conversation.messages);
  const [version, setVersion] = useState(0);
  const [note, setNote] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem(`masarjo_note_${conversation.id}`) || "";
    }
    return "";
  });
  const [isEditingNote, setIsEditingNote] = useState(false);
  const [noteDraft, setNoteDraft] = useState(note);

  // Sync props to state
  useEffect(() => {
    setMessages(conversation.messages);
  }, [conversation.messages]);

  useEffect(() => {
    setStatus(conversation.status);
  }, [conversation.status]);

  useEffect(() => {
    const savedNote = localStorage.getItem(`masarjo_note_${conversation.id}`) || "";
    setNote(savedNote);
    setNoteDraft(savedNote);
    setIsEditingNote(false);
  }, [conversation.id]);

  const suggestedReply = useMemo(() => {
    if (conversation.aiSuggestedReply) {
      return conversation.aiSuggestedReply;
    }
    if (status === "NEEDS_HUMAN") {
      return "أكيد، رح أحولك لموظف يساعدك بأسرع وقت.";
    }
    const variants = [
      "عنا ربط واتساب وفيسبوك وإنستغرام، صندوق محادثات موحد، ووكيل ذكي يرد من معلومات نشاطك. بأي قناة مهتم تبدأ؟",
      "أكيد. نقدر نجهز لك الوكيل، نضيف معلومات نشاطك، ونخليه يرد على العملاء مع تحويل بشري عند الحالات الحساسة.",
      "منصة مسار تجمع رسائل العملاء وتخلي الذكاء يرد بالعربي بدون تعقيد. احكيلي شو نوع نشاطك؟"
    ];
    return variants[version % variants.length];
  }, [conversation.aiSuggestedReply, status, version]);

  async function addMessage(sender: Message["sender"], body: string) {
    if (!body.trim()) return;
    
    // Construct new message
    const tempId = `msg_${Date.now()}`;
    const newMessage = {
      id: tempId,
      conversationId: conversation.id,
      sender,
      body,
      createdAt: new Date().toISOString()
    };

    setMessages((items) => [...items, newMessage]);
    onNewMessage?.(conversation.id, newMessage);

    if (sender === "HUMAN" || sender === "AI") {
      try {
        await fetch(`/api/conversations/${conversation.id}/message`, {
          method: "POST",
          headers: { 
            "Content-Type": "application/json",
            ...(token ? { Authorization: "Bearer " + token } : {})
          },
          body: JSON.stringify({ message: body })
        });
      } catch (e) {
        console.error(e);
      }
    }
  }

  async function updateStatus(newStatus: ConversationStatus, action: "takeover" | "return-to-ai" | "close") {
    setStatus(newStatus);
    onStatusChange?.(conversation.id, newStatus);
    try {
      const endpoint = action === "close" ? "takeover" : action;
      await fetch(`/api/conversations/${conversation.id}/${endpoint}`, {
        method: "POST",
        headers: {
          ...(token ? { Authorization: "Bearer " + token } : {})
        }
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
            <div className="mt-1 text-sm text-white/42">{(channelLabels[conversation.channel] || conversation.channel)} · {conversation.customerPhone}</div>
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
                {!conversation.aiSuggestedReply && (
                  <Button size="sm" variant="ghost" aria-label="توليد رد جديد" onClick={() => setVersion((value) => value + 1)}>
                    <RefreshCw className="h-3.5 w-3.5" />
                  </Button>
                )}
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
              <span className="text-white">{(channelLabels[conversation.channel] || conversation.channel)}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span>عدد الرسائل</span>
              <span className="text-white">{messages.length}</span>
            </div>
          </div>
        </div>
        <div className="rounded-3xl border border-white/10 bg-white/[0.045] p-4 transition-all duration-300">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <StickyNote className="h-4 w-4 text-cyanx-400" />
              ملاحظات
            </div>
            {!isEditingNote && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs text-cyanx-400 hover:bg-white/5"
                onClick={() => {
                  setNoteDraft(note);
                  setIsEditingNote(true);
                }}
              >
                تعديل
              </Button>
            )}
          </div>
          {isEditingNote ? (
            <div className="space-y-2">
              <Textarea
                value={noteDraft}
                onChange={(e) => setNoteDraft(e.target.value)}
                placeholder="اكتب ملاحظة عن هذا العميل..."
                className="min-h-[100px] text-xs"
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="flex-1 bg-emeraldx-500 text-ink-950 hover:bg-emeraldx-400 text-xs"
                  onClick={() => {
                    localStorage.setItem(`masarjo_note_${conversation.id}`, noteDraft);
                    setNote(noteDraft);
                    setIsEditingNote(false);
                  }}
                >
                  <Check className="ml-1 h-3 w-3" />
                  حفظ
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  className="flex-1 text-xs"
                  onClick={() => setIsEditingNote(false)}
                >
                  إلغاء
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-sm leading-6 text-white/50 whitespace-pre-wrap">{note || "لا توجد ملاحظات مضافة للعميل."}</p>
          )}
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

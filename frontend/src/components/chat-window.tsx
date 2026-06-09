"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import { Bot, Facebook, Instagram, MessageCircle, Paperclip, Pencil, RefreshCw, Send, StickyNote, UserCheck, XCircle, Webhook, Code, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/status-badge";
import type { ChannelProvider, Conversation, ConversationStatus, Message } from "@/lib/types";
import { cn, formatTime } from "@/lib/utils";
import { useAuthStore } from "@/store/use-auth-store";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "react-hot-toast";

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

function MediaAttachment({ message, token }: { message: Message; token: string | null }) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const mediaUrl = message.mediaUrl;

  useEffect(() => {
    if (!mediaUrl || !mediaUrl.startsWith("/api/uploads")) {
      setObjectUrl(null);
      setFailed(false);
      return;
    }
    let cancelled = false;
    let url: string | null = null;
    fetch(mediaUrl, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    })
      .then((res) => {
        if (!res.ok) throw new Error("media fetch failed");
        return res.blob();
      })
      .then((blob) => {
        if (cancelled) return;
        url = URL.createObjectURL(blob);
        setObjectUrl(url);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [mediaUrl, token]);

  if (!mediaUrl) return null;
  const src = mediaUrl.startsWith("/api/uploads") ? objectUrl : mediaUrl;
  if (!src || failed) {
    return <div className="mb-2 rounded-xl bg-black/10 px-3 py-2 text-xs opacity-70">مرفق محفوظ</div>;
  }
  if (message.mediaType === "image") {
    return <img src={src} alt="" className="mb-2 max-h-72 rounded-2xl object-contain" />;
  }
  if (message.mediaType === "audio") {
    return <audio src={src} controls className="mb-2 w-full" />;
  }
  return (
    <a href={src} target="_blank" rel="noreferrer" className="mb-2 block rounded-xl bg-black/10 px-3 py-2 text-xs underline">
      فتح المرفق
    </a>
  );
}

function MessageBubble({ message, token }: { message: Message; token: string | null }) {
  const fromCustomer = message.sender === "CUSTOMER";
  const fromSystem = message.sender === "SYSTEM";
  return (
    <div className={cn("flex w-full mb-3 transition-all duration-300 hover:translate-y-[-1px]", fromCustomer ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[78%] rounded-[20px] px-4 py-3 text-sm leading-6 shadow-sm backdrop-blur-md",
          fromCustomer && "rounded-br-none bg-white/[0.07] border border-white/5 text-white/90",
          message.sender === "AI" && "rounded-bl-none bg-gradient-to-br from-emeraldx-500 to-teal-400 text-ink-950 font-medium shadow-emeraldx-500/10",
          message.sender === "HUMAN" && "rounded-bl-none bg-gradient-to-br from-violetrx-500 to-indigo-500 text-white shadow-violetrx-500/15",
          fromSystem && "mx-auto max-w-[86%] rounded-2xl border border-white/10 bg-white/[0.04] text-center text-white/45"
        )}
      >
        <MediaAttachment message={message} token={token} />
        <div className="break-words whitespace-pre-wrap">{message.body}</div>
        <div className={cn("mt-1.5 flex items-center justify-end gap-1 text-[10px] font-medium tracking-tight", message.sender === "AI" ? "text-ink-950/50" : "text-white/30")}>
          {message.sender === "HUMAN" && message.deliveryStatus ? <span>{message.deliveryStatus}</span> : null}
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
  const { token, user } = useAuthStore();
  const [draft, setDraft] = useState("");
  const [status, setStatus] = useState<ConversationStatus>(conversation.status);
  const [messages, setMessages] = useState<Message[]>(conversation.messages);
  const [version, setVersion] = useState(0);
  const [note, setNote] = useState("");
  const [isEditingNote, setIsEditingNote] = useState(false);
  const [noteDraft, setNoteDraft] = useState(note);
  const [sending, setSending] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [savingNote, setSavingNote] = useState(false);
  const [attachment, setAttachment] = useState<File | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const canAct = user?.role === "admin" || user?.role === "support_agent";
  const context = conversation.context || {};
  const productCategories = context.productCatalog?.categories?.slice(0, 4) || [];
  const knowledgeCategories = context.knowledgeBase?.categories?.slice(0, 4) || [];

  // Sync props to state
  useEffect(() => {
    setMessages(conversation.messages);
  }, [conversation.messages]);

  useEffect(() => {
    setStatus(conversation.status);
  }, [conversation.status]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ block: "end" });
  }, [messages, conversation.id]);

  useEffect(() => {
    let cancelled = false;
    setIsEditingNote(false);
    setNote("");
    setNoteDraft("");
    if (!token) return;

    fetch(`/api/conversations/${conversation.id}/notes`, {
      headers: {
        Authorization: "Bearer " + token,
      },
    })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok || data.ok === false) {
          throw new Error(data.error || "تعذر تحميل الملاحظات");
        }
        if (!cancelled) {
          setNote(data.note || "");
          setNoteDraft(data.note || "");
        }
      })
      .catch((e) => {
        console.error(e);
      });

    return () => {
      cancelled = true;
    };
  }, [conversation.id, token]);

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
      "chatter تجمع رسائل العملاء وتخلي الذكاء يرد بالعربي بدون تعقيد. احكيلي شو نوع نشاطك؟"
    ];
    return variants[version % variants.length];
  }, [conversation.aiSuggestedReply, status, version]);

  async function addMessage(sender: Message["sender"], body: string, file?: File | null) {
    if (!canAct) return false;
    const clean = body.trim();
    if ((!clean && !file) || sending) return false;

    if (sender === "HUMAN" || sender === "AI") {
      setSending(true);
      try {
        const bodyPayload = file ? new FormData() : JSON.stringify({ message: clean });
        if (file && bodyPayload instanceof FormData) {
          bodyPayload.append("message", clean);
          bodyPayload.append("file", file);
        }
        const res = await fetch(`/api/conversations/${conversation.id}/message`, {
          method: "POST",
          headers: {
            ...(!file ? { "Content-Type": "application/json" } : {}),
            ...(token ? { Authorization: "Bearer " + token } : {})
          },
          body: bodyPayload
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || data.ok === false) {
          throw new Error(data.error || "تعذر إرسال الرسالة");
        }

        const saved = data.result || {};
        const newMessage = {
          id: saved.id || `msg_${Date.now()}`,
          conversationId: conversation.id,
          sender,
          body: saved.content || clean,
          createdAt: saved.created_at || new Date().toISOString(),
          mediaType: saved.media_type || null,
          mediaUrl: saved.media_url || null,
          deliveryStatus: "sent"
        };
        setMessages((items) => [...items, newMessage]);
        onNewMessage?.(conversation.id, newMessage);
        return true;
      } catch (e) {
        console.error(e);
        toast.error(e instanceof Error ? e.message : "تعذر إرسال الرسالة");
        return false;
      } finally {
        setSending(false);
      }
    }

    const newMessage = {
      id: `msg_${Date.now()}`,
      conversationId: conversation.id,
      sender,
      body: clean,
      createdAt: new Date().toISOString()
    };
    setMessages((items) => [...items, newMessage]);
    onNewMessage?.(conversation.id, newMessage);
    return true;
  }

  async function updateStatus(newStatus: ConversationStatus, action: "takeover" | "return-to-ai" | "close") {
    if (!canAct) return false;
    if (statusUpdating) return false;
    const previousStatus = status;
    setStatusUpdating(true);
    setStatus(newStatus);
    onStatusChange?.(conversation.id, newStatus);
    try {
      const res = await fetch(`/api/conversations/${conversation.id}/${action}`, {
        method: "POST",
        headers: {
          ...(token ? { Authorization: "Bearer " + token } : {})
        }
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.ok === false) {
        throw new Error(data.error || "تعذر تحديث حالة المحادثة");
      }
      return true;
    } catch (e) {
      console.error(e);
      setStatus(previousStatus);
      onStatusChange?.(conversation.id, previousStatus);
      toast.error(e instanceof Error ? e.message : "تعذر تحديث حالة المحادثة");
      return false;
    } finally {
      setStatusUpdating(false);
    }
  }

  const isAiHandling = status === "AI_HANDLING";
  const isClosed = status === "CLOSED";
  const isReplyLocked = !canAct || isAiHandling || isClosed;

  async function sendDraft() {
    if (!canAct) return;
    if (isReplyLocked || sending || statusUpdating || (!draft.trim() && !attachment)) return;
    const currentDraft = draft;
    const currentAttachment = attachment;
    const claimed = await updateStatus("HUMAN_ACTIVE", "takeover");
    if (!claimed) return;
    const sent = await addMessage("HUMAN", currentDraft, currentAttachment);
    if (sent) {
      setDraft("");
      setAttachment(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function saveNote() {
    if (!canAct) return;
    if (!token || savingNote) return;
    setSavingNote(true);
    try {
      const res = await fetch(`/api/conversations/${conversation.id}/notes`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + token,
        },
        body: JSON.stringify({ note: noteDraft }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.ok === false) {
        throw new Error(data.error || "تعذر حفظ الملاحظة");
      }
      setNote(data.note || "");
      setNoteDraft(data.note || "");
      setIsEditingNote(false);
      toast.success("تم حفظ الملاحظة");
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "تعذر حفظ الملاحظة");
    } finally {
      setSavingNote(false);
    }
  }

  return (
    <div className="grid h-full min-h-[680px] xl:min-h-0 gap-4 lg:grid-cols-[1fr_280px]">
      <div className="flex h-full min-h-[680px] xl:min-h-0 flex-col rounded-3xl border border-white/10 bg-white/[0.045]">
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
            {canAct ? (
              <>
            <Button
              size="sm"
              variant={status === "HUMAN_ACTIVE" ? "secondary" : "ghost"}
              disabled={statusUpdating}
              onClick={() => void updateStatus("HUMAN_ACTIVE", "takeover")}
            >
              <UserCheck className="h-4 w-4" />
              استلام
            </Button>
            <Button
              size="sm"
              variant={status === "AI_HANDLING" ? "secondary" : "ghost"}
              disabled={statusUpdating}
              onClick={() => void updateStatus("AI_HANDLING", "return-to-ai")}
            >
              إرجاع للذكاء
            </Button>
            <Button
              size="sm"
              variant={status === "CLOSED" ? "secondary" : "ghost"}
              disabled={statusUpdating}
              onClick={() => void updateStatus("CLOSED", "close")}
            >
              إغلاق
            </Button>
              </>
            ) : null}
          </div>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-5 custom-scrollbar">
          {messages.map((message) => (
            <MessageBubble key={message.id} message={message} token={token} />
          ))}
          <div ref={messagesEndRef} />
        </div>

        <div className="border-t border-white/10 p-4">
          {!canAct ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.035] px-4 py-3 text-sm text-white/50">
              Read-only access: you can view conversations and analytics, but only employees and admins can reply or change conversation status.
            </div>
          ) : (
            <>
          <div className={cn("mb-3 rounded-3xl border p-4 transition-opacity", isReplyLocked ? "opacity-50 pointer-events-none border-white/10 bg-white/5" : "border-emeraldx-400/20 bg-emeraldx-500/10")}>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-emeraldx-400">
                <Bot className="h-4 w-4" />
                رد مقترح
              </div>
              <div className="flex gap-2">
                <Button size="sm" disabled={sending || statusUpdating} onClick={() => void addMessage("AI", suggestedReply)}>إرسال</Button>
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
          {sending ? <div className="mb-2 text-xs text-emeraldx-300">جاري الإرسال...</div> : null}
          {attachment ? (
            <div className="mb-2 flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/60">
              <span className="truncate">{attachment.name}</span>
              <button
                type="button"
                onClick={() => {
                  setAttachment(null);
                  if (fileInputRef.current) fileInputRef.current.value = "";
                }}
                className="text-white/40 hover:text-white"
              >
                إزالة
              </button>
            </div>
          ) : null}
          <div className="flex gap-2">
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept="image/*,audio/*,.pdf,.doc,.docx"
              onChange={(event) => setAttachment(event.target.files?.[0] || null)}
            />
            <Button
              type="button"
              variant="secondary"
              disabled={isReplyLocked || sending || statusUpdating}
              onClick={() => fileInputRef.current?.click()}
              aria-label="إرفاق ملف"
            >
              <Paperclip className="h-4 w-4" />
            </Button>
            <Textarea
              value={draft} 
              onChange={(event) => setDraft(event.target.value)} 
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void sendDraft();
                }
              }}
              placeholder={isClosed ? "المحادثة مغلقة..." : isAiHandling ? "لا يمكن الرد بينما الذكاء الاصطناعي مفعل..." : "اكتب رد الموظف..."}
              disabled={isReplyLocked || sending || statusUpdating}
              className="min-h-11 max-h-32 flex-1 resize-none py-2.5"
            />
            <Button
              disabled={isReplyLocked || (!draft.trim() && !attachment) || sending || statusUpdating}
              onClick={() => void sendDraft()}
            >
              <Send className="h-4 w-4" />
              إرسال
            </Button>
          </div>
            </>
          )}
        </div>
      </div>

      <aside className="space-y-4 xl:h-full xl:overflow-y-auto custom-scrollbar">
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
            <div className="flex justify-between gap-3">
              <span>Business</span>
              <span className="text-white">{context.business?.name || "-"}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span>Account</span>
              <span className="text-white">{context.connectedAccount?.page_name || context.connectedAccount?.platform || "-"}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span>Catalog</span>
              <span className="text-white">{context.productCatalog?.product_count || 0}</span>
            </div>
            {productCategories.length ? (
              <div className="flex flex-wrap justify-end gap-1">
                {productCategories.map((category) => (
                  <span key={category} className="rounded-full bg-white/7 px-2 py-0.5 text-[10px] text-white/50">{category}</span>
                ))}
              </div>
            ) : null}
            <div className="flex justify-between gap-3">
              <span>Knowledge</span>
              <span className="text-white">{context.knowledgeBase?.item_count || 0}</span>
            </div>
            {knowledgeCategories.length ? (
              <div className="flex flex-wrap justify-end gap-1">
                {knowledgeCategories.map((category) => (
                  <span key={category} className="rounded-full bg-cyanx-500/10 px-2 py-0.5 text-[10px] text-cyanx-300">{category}</span>
                ))}
              </div>
            ) : null}
          </div>
        </div>
        <div className="rounded-3xl border border-white/10 bg-white/[0.045] p-4 transition-all duration-300">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <StickyNote className="h-4 w-4 text-cyanx-400" />
              ملاحظات
            </div>
            {canAct && !isEditingNote && (
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
                  disabled={savingNote}
                  onClick={() => void saveNote()}
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

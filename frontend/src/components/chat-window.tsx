"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import { Bot, Facebook, Instagram, MessageCircle, Paperclip, Pencil, RefreshCw, Send, StickyNote, UserCheck, XCircle, Webhook, Code, Check, Shield, ShieldAlert, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/status-badge";
import type { ChannelProvider, Conversation, ConversationStatus, Message } from "@/lib/types";
import { cn, formatTime } from "@/lib/utils";
import { useAuthStore } from "@/store/use-auth-store";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "react-hot-toast";
import { useLanguageStore } from "@/store/use-language-store";

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
  return <Icon className="h-4 w-4 text-primary-400" />;
}

function MediaAttachment({ message, token, isRtl }: { message: Message; token: string | null; isRtl: boolean }) {
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
    return <div className="mb-2 rounded-xl bg-black/10 px-3 py-2 text-xs opacity-70">{isRtl ? "مرفق محفوظ" : "Attachment Saved"}</div>;
  }
  if (message.mediaType === "image") {
    return <img src={src} alt="" className="mb-2 max-h-72 rounded-2xl object-contain" />;
  }
  if (message.mediaType === "audio") {
    return <audio src={src} controls className="mb-2 w-full" />;
  }
  return (
    <a href={src} target="_blank" rel="noreferrer" className="mb-2 block rounded-xl bg-black/10 px-3 py-2 text-xs underline">
      {isRtl ? "فتح المرفق" : "Open Attachment"}
    </a>
  );
}

function MessageBubble({ message, token, isRtl }: { message: Message; token: string | null; isRtl: boolean }) {
  const fromCustomer = message.sender === "CUSTOMER";
  const fromSystem = message.sender === "SYSTEM";
  return (
    <div className={cn("flex w-full mb-3 transition-all duration-300 hover:translate-y-[-1px]", fromCustomer ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[78%] rounded-[20px] px-4 py-3 text-sm leading-6 shadow-sm backdrop-blur-md rtl:text-right ltr:text-left",
          fromCustomer && "rounded-br-none bg-white/[0.07] border border-white/5 text-white/90",
          message.sender === "AI" && "rounded-bl-none bg-gradient-to-br from-primary-500 to-teal-400 text-ink-950 font-medium shadow-primary-500/10",
          message.sender === "HUMAN" && "rounded-bl-none bg-gradient-to-br from-violetrx-500 to-indigo-500 text-white shadow-violetrx-500/15",
          fromSystem && "mx-auto max-w-[86%] rounded-2xl border border-white/10 bg-white/[0.04] text-center text-white/45"
        )}
      >
        <MediaAttachment message={message} token={token} isRtl={isRtl} />
        <div className="break-words whitespace-pre-wrap">{message.body}</div>
        <div className={cn("mt-1.5 flex items-center justify-end gap-1.5 text-[10px] font-medium tracking-tight", message.sender === "AI" ? "text-ink-950/50" : "text-white/30")}>
          {message.sender === "AI" && (
            <div className="flex items-center gap-1 mr-auto bg-black/10 px-1.5 py-0.5 rounded-full text-[9px] font-semibold text-teal-900 border border-teal-950/10" title={isRtl ? `تحليل الأمان والتحقق. نسبة المخاطرة: ${message.riskScore ?? 0.05}` : `Safety verification. Risk factor: ${message.riskScore ?? 0.05}`}>
              {typeof message.riskScore === 'number' && message.riskScore > 0.4 ? (
                <ShieldAlert className="h-3 w-3 text-amber-700" />
              ) : typeof message.riskScore === 'number' && message.riskScore <= 0.1 ? (
                <ShieldCheck className="h-3 w-3 text-emerald-700" />
              ) : (
                <Shield className="h-3 w-3 text-teal-700" />
              )}
              <span>{Math.round((1 - (message.riskScore ?? 0.05)) * 100)}% safe</span>
            </div>
          )}
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
  const language = useLanguageStore((state) => state.language);
  const isRtl = language === "ar";

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

  const channelLabels = useMemo<Record<string, string>>(() => ({
    WHATSAPP: isRtl ? "واتساب" : "WhatsApp",
    FACEBOOK: isRtl ? "فيسبوك" : "Facebook",
    MESSENGER: isRtl ? "فيسبوك ماسنجر" : "Messenger",
    INSTAGRAM: isRtl ? "إنستغرام" : "Instagram",
    WEBHOOK: isRtl ? "ويب هوك" : "Webhook",
    WIDGET: isRtl ? "ويدجت" : "Widget"
  }), [isRtl]);

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
          throw new Error(data.error || (isRtl ? "تعذر تحميل الملاحظات" : "Could not load notes"));
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
  }, [conversation.id, token, isRtl]);

  const suggestedReply = useMemo(() => {
    if (conversation.aiSuggestedReply) {
      return conversation.aiSuggestedReply;
    }
    if (status === "NEEDS_HUMAN") {
      return isRtl 
        ? "أكيد، رح أحولك لموظف يساعدك بأسرع وقت."
        : "Sure, let me transfer you to an employee who can assist you shortly.";
    }
    const variants = isRtl ? [
      "عنا ربط واتساب وفيسبوك وإنستغرام، صندوق محادثات موحد، ووكيل ذكي يرد من معلومات نشاطك. بأي قناة مهتم تبدأ؟",
      "أكيد. نقدر نجهز لك الوكيل، نضيف معلومات نشاطك، ونخليه يرد على العملاء مع تحويل بشري عند الحالات الحساسة.",
      "chatter تجمع رسائل العملاء وتخلي الذكاء يرد بالعربي بدون تعقيد. احكيلي شو نوع نشاطك؟"
    ] : [
      "We support WhatsApp, Facebook, and Instagram, a unified inbox, and a smart agent replying from your business details. Which channel are you interested to connect first?",
      "Sure. We can set up the agent, add your business details, and let it reply to clients with human handoff for sensitive queries.",
      "chatter aggregates customer messages and enables the AI to reply in Arabic/English cleanly. Tell me what is your business type?"
    ];
    return variants[version % variants.length];
  }, [conversation.aiSuggestedReply, status, version, isRtl]);

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
          throw new Error(data.error || (isRtl ? "تعذر إرسال الرسالة" : "Could not send message"));
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
        toast.error(e instanceof Error ? e.message : (isRtl ? "تعذر إرسال الرسالة" : "Could not send message"));
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
        throw new Error(data.error || (isRtl ? "تعذر تحديث حالة المحادثة" : "Could not update conversation status"));
      }
      return true;
    } catch (e) {
      console.error(e);
      setStatus(previousStatus);
      onStatusChange?.(conversation.id, previousStatus);
      toast.error(e instanceof Error ? e.message : (isRtl ? "تعذر تحديث حالة المحادثة" : "Could not update conversation status"));
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
        throw new Error(data.error || (isRtl ? "تعذر حفظ الملاحظة" : "Could not save note"));
      }
      setNote(data.note || "");
      setNoteDraft(data.note || "");
      setIsEditingNote(false);
      toast.success(isRtl ? "تم حفظ الملاحظة" : "Note saved successfully");
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : (isRtl ? "تعذر حفظ الملاحظة" : "Could not save note"));
    } finally {
      setSavingNote(false);
    }
  }

  return (
    <div className="grid h-full min-h-[680px] xl:min-h-0 gap-4 lg:grid-cols-[1fr_280px]">
      <div className="flex h-full min-h-[680px] xl:min-h-0 flex-col rounded-3xl border border-white/10 bg-white/[0.045]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 p-4">
          <div className="rtl:text-right ltr:text-left">
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
                  {isRtl ? "استلام" : "Takeover"}
                </Button>
                <Button
                  size="sm"
                  variant={status === "AI_HANDLING" ? "secondary" : "ghost"}
                  disabled={statusUpdating}
                  onClick={() => void updateStatus("AI_HANDLING", "return-to-ai")}
                >
                  {isRtl ? "إرجاع للذكاء" : "Return to AI"}
                </Button>
                <Button
                  size="sm"
                  variant={status === "CLOSED" ? "secondary" : "ghost"}
                  disabled={statusUpdating}
                  onClick={() => void updateStatus("CLOSED", "close")}
                >
                  {isRtl ? "إغلاق" : "Close"}
                </Button>
              </>
            ) : null}
          </div>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-5 custom-scrollbar">
          {messages.map((message) => (
            <MessageBubble key={message.id} message={message} token={token} isRtl={isRtl} />
          ))}
          <div ref={messagesEndRef} />
        </div>

        <div className="border-t border-white/10 p-4">
          {!canAct ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.035] px-4 py-3 text-sm text-white/50 rtl:text-right ltr:text-left">
              {isRtl 
                ? "عرض فقط: يمكنك تصفح المحادثات والتحليلات، لكن تعديل الحالة أو إرسال الرسائل مقتصر على الموظفين والإدارة."
                : "Read-only access: you can view conversations and analytics, but only employees and admins can reply or change status."}
            </div>
          ) : (
            <>
              <div className={cn("mb-3 rounded-3xl border p-4 transition-opacity", isReplyLocked ? "opacity-50 pointer-events-none border-white/10 bg-white/5" : "border-primary-400/20 bg-primary-500/10")}>
                <div className="mb-2 flex flex-wrap items-center justify-between gap-3 ltr:flex-row-reverse">
                  <div className="flex items-center gap-2 text-sm font-semibold text-primary-400">
                    <Bot className="h-4 w-4" />
                    {isRtl ? "رد مقترح" : "Suggested Reply"}
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" disabled={sending || statusUpdating} onClick={() => void addMessage("AI", suggestedReply)}>
                      {isRtl ? "إرسال" : "Send"}
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => setDraft(suggestedReply)}>
                      <Pencil className="h-3.5 w-3.5" />
                      {isRtl ? "تعديل" : "Edit"}
                    </Button>
                    {!conversation.aiSuggestedReply && (
                      <Button size="sm" variant="ghost" aria-label={isRtl ? "توليد رد جديد" : "Generate new reply"} onClick={() => setVersion((value) => value + 1)}>
                        <RefreshCw className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
                <p className="text-sm leading-6 text-white/68 rtl:text-right ltr:text-left">{suggestedReply}</p>
              </div>
              {sending ? <div className="mb-2 text-xs text-primary-300 rtl:text-right ltr:text-left">{isRtl ? "جاري الإرسال..." : "Sending..."}</div> : null}
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
                    {isRtl ? "إزالة" : "Remove"}
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
                  aria-label={isRtl ? "إرفاق ملف" : "Attach file"}
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
                  placeholder={isClosed ? (isRtl ? "المحادثة مغلقة..." : "Conversation closed...") : isAiHandling ? (isRtl ? "لا يمكن الرد بينما الذكاء الاصطناعي مفعل..." : "Cannot reply while AI is active...") : (isRtl ? "اكتب رد الموظف..." : "Type agent reply...")}
                  disabled={isReplyLocked || sending || statusUpdating}
                  className="min-h-11 max-h-32 flex-1 resize-none py-2.5 rtl:text-right ltr:text-left"
                />
                <Button
                  disabled={isReplyLocked || (!draft.trim() && !attachment) || sending || statusUpdating}
                  onClick={() => void sendDraft()}
                >
                  <Send className="h-4 w-4" />
                  {isRtl ? "إرسال" : "Send"}
                </Button>
              </div>
            </>
          )}
        </div>
      </div>

      <aside className="space-y-4 xl:h-full xl:overflow-y-auto custom-scrollbar">
        <div className="rounded-3xl border border-white/10 bg-white/[0.045] p-4">
          <div className="text-sm font-semibold text-white rtl:text-right ltr:text-left">{isRtl ? "ملف العميل" : "Customer Profile"}</div>
          <div className="mt-4 space-y-3 text-sm text-white/58 rtl:text-right ltr:text-left">
            <div className="flex justify-between gap-3">
              <span>{isRtl ? "الاسم" : "Name"}</span>
              <span className="text-white">{conversation.customerName}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span>{isRtl ? "القناة" : "Channel"}</span>
              <span className="text-white">{(channelLabels[conversation.channel] || conversation.channel)}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span>{isRtl ? "عدد الرسائل" : "Messages"}</span>
              <span className="text-white">{messages.length}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span>{isRtl ? "المتجر" : "Business"}</span>
              <span className="text-white">{context.business?.name || "-"}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span>{isRtl ? "الحساب" : "Account"}</span>
              <span className="text-white">{context.connectedAccount?.page_name || context.connectedAccount?.platform || "-"}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span>{isRtl ? "الكتالوج" : "Catalog"}</span>
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
              <span>{isRtl ? "قاعدة المعرفة" : "Knowledge"}</span>
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
              {isRtl ? "ملاحظات" : "Notes"}
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
                {isRtl ? "تعديل" : "Edit"}
              </Button>
            )}
          </div>
          {isEditingNote ? (
            <div className="space-y-2">
              <Textarea
                value={noteDraft}
                onChange={(e) => setNoteDraft(e.target.value)}
                placeholder={isRtl ? "اكتب ملاحظة عن هذا العميل..." : "Write a note about this customer..."}
                className="min-h-[100px] text-xs"
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="flex-1 bg-primary-500 text-ink-950 hover:bg-primary-400 text-xs"
                  disabled={savingNote}
                  onClick={() => void saveNote()}
                >
                  <Check className="ml-1 h-3 w-3" />
                  {isRtl ? "حفظ" : "Save"}
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  className="flex-1 text-xs"
                  onClick={() => setIsEditingNote(false)}
                >
                  {isRtl ? "إلغاء" : "Cancel"}
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-sm leading-6 text-white/50 whitespace-pre-wrap rtl:text-right ltr:text-left">{note || (isRtl ? "لا توجد ملاحظات مضافة للعميل." : "No notes added for this customer.")}</p>
          )}
        </div>
        <div className="rounded-3xl border border-red-400/20 bg-red-500/10 p-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-red-100">
            <XCircle className="h-4 w-4" />
            {isRtl ? "حماية" : "Safety Guard"}
          </div>
          <p className="text-sm leading-6 text-red-100/70 rtl:text-right ltr:text-left">
            {isRtl 
              ? "الشكاوى والإلغاء والاسترجاع تتحول لموظف تلقائيا."
              : "Complaints, cancellations, and returns automatically escalate to an employee."}
          </p>
        </div>
      </aside>
    </div>
  );
}

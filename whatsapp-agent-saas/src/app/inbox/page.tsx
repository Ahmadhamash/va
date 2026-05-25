"use client";

import { useState, useEffect } from "react";
import { AppShell } from "@/components/app-shell";
import { ChatWindow } from "@/components/chat-window";
import { ConversationList } from "@/components/conversation-list";
import { useAuthStore } from "@/store/use-auth-store";
import type { Conversation, Message } from "@/lib/types";
import { Loader2 } from "lucide-react";

export default function InboxPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState("");
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const { token } = useAuthStore();

  useEffect(() => {
    async function load() {
      if (!token) return;
      try {
        const res = await fetch("/api/conversations", {
          headers: { Authorization: "Bearer " + token }
        });
        const data = await res.json();
        if (data.ok && data.conversations) {
          const sorted = [...data.conversations].sort(
            (a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
          );
          setConversations(sorted);
          if (sorted.length > 0) {
            setSelectedId(sorted[0].id);
          }
        }
      } catch (err) {
        console.error("Failed to load conversations", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [token]);

  useEffect(() => {
    async function loadMessages() {
      if (!selectedId || !token) return;
      const baseConversation = conversations.find(c => c.id === selectedId);
      if (!baseConversation) return;
      
      setMessagesLoading(true);
      try {
        const res = await fetch(`/api/conversations/${selectedId}`, {
          headers: { Authorization: "Bearer " + token }
        });
        const data = await res.json();
        if (data.ok && data.conversation) {
          setSelectedConversation({ ...baseConversation, messages: data.conversation.messages });
        } else {
          setSelectedConversation(baseConversation);
        }
      } catch (err) {
        console.error("Failed to load conversation details", err);
        setSelectedConversation(baseConversation);
      } finally {
        setMessagesLoading(false);
      }
    }
    loadMessages();
  }, [selectedId, token, conversations]);

  return (
    <AppShell title="المحادثات" subtitle="صندوق موحد لرسائل واتساب وفيسبوك وإنستغرام مع الذكاء والتحويل البشري." actionLabel="اختبار الديمو">
      <div className="grid gap-5 xl:grid-cols-[390px_1fr]">
        {loading ? (
          <div className="flex h-96 items-center justify-center col-span-2">
            <Loader2 className="h-8 w-8 animate-spin text-emeraldx-400" />
          </div>
        ) : (
          <>
            <ConversationList conversations={conversations} selectedId={selectedId} onSelect={setSelectedId} />
            {conversations.length === 0 ? (
              <div className="flex h-96 flex-col items-center justify-center rounded-3xl border border-white/10 bg-white/[0.02] text-white/45">
                <p>لا توجد محادثات نشطة حالياً.</p>
              </div>
            ) : messagesLoading || !selectedConversation ? (
              <div className="flex h-96 items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-emeraldx-400" />
              </div>
            ) : (
              <ChatWindow key={selectedConversation.id} conversation={selectedConversation} />
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}

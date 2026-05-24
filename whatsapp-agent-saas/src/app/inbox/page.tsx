"use client";

import { useState, useEffect } from "react";
import { AppShell } from "@/components/app-shell";
import { ChatWindow } from "@/components/chat-window";
import { ConversationList } from "@/components/conversation-list";
import { useAuthStore } from "@/store/use-auth-store";
import type { Conversation } from "@/lib/types";
import { Loader2 } from "lucide-react";

export default function InboxPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState("");
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
          setConversations(data.conversations);
          if (data.conversations.length > 0) {
            setSelectedId(data.conversations[0].id);
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

  const selected = conversations.find((c) => c.id === selectedId) || conversations[0];

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
            <ChatWindow conversation={selected} />
          </>
        )}
      </div>
    </AppShell>
  );
}

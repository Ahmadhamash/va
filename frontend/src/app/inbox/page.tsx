"use client";

import { useState, useEffect, useCallback } from "react";
import { AppShell } from "@/components/app-shell";
import { ChatWindow } from "@/components/chat-window";
import { ConversationList } from "@/components/conversation-list";
import { useAuthStore } from "@/store/use-auth-store";
import type { Conversation, Message, ConversationStatus } from "@/lib/types";
import { Loader2 } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { useSearchParams } from "next/navigation";

export default function InboxPage() {
  const [selectedId, setSelectedId] = useState("");
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [limit, setLimit] = useState(50);
  const { token } = useAuthStore();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get("q") || "";
  const rawStatus = searchParams.get("status") || "ALL";
  const initialFilter = (["ALL", "AI_HANDLING", "NEEDS_HUMAN", "HUMAN_ACTIVE", "CLOSED"].includes(rawStatus)
    ? rawStatus
    : "ALL") as ConversationStatus | "ALL";

  const { data: conversations = [], isLoading: loading } = useQuery({
    queryKey: ["conversations", limit],
    queryFn: async () => {
      const res = await apiClient.get(`/conversations?limit=${limit}`);
      const data = res.data.conversations || [];
      return [...data].sort(
        (a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
      );
    },
    enabled: !!token,
    refetchInterval: 3000,
  });

  useEffect(() => {
    if (conversations.length > 0 && !selectedId) {
      setSelectedId(conversations[0].id);
    }
  }, [conversations, selectedId]);

  const { data: conversationDetails, isLoading: messagesLoading } = useQuery({
    queryKey: ["conversation", selectedId],
    queryFn: async () => {
      if (!selectedId) return null;
      const baseConversation = conversations.find((c) => c.id === selectedId);
      if (!baseConversation) return null;
      
      const res = await apiClient.get(`/conversations/${selectedId}`);
      if (res.data.conversation) {
        return { ...baseConversation, messages: res.data.conversation.messages, unreadCount: 0 };
      }
      return baseConversation;
    },
    enabled: !!selectedId && !!token && conversations.length > 0,
    refetchInterval: 3000,
  });

  const clearUnreadCount = useCallback((id: string) => {
    const clearInList = (prev: Conversation[] | undefined) => {
      if (!prev) return prev;
      let changed = false;
      const next = prev.map((conversation) => {
        if (conversation.id !== id || !conversation.unreadCount) return conversation;
        changed = true;
        return { ...conversation, unreadCount: 0 };
      });
      return changed ? next : prev;
    };

    queryClient.setQueriesData<Conversation[]>({ queryKey: ["conversations"] }, clearInList);
    queryClient.setQueryData<Conversation[]>(["topbar-conversations"], clearInList);
  }, [queryClient]);

  useEffect(() => {
    if (conversationDetails) {
      setSelectedConversation({ ...conversationDetails, unreadCount: 0 });
      clearUnreadCount(conversationDetails.id);
    }
  }, [conversationDetails, clearUnreadCount]);

  function handleStatusChange(id: string, newStatus: ConversationStatus) {
    queryClient.setQueryData(["conversations", limit], (prev: Conversation[] | undefined) => {
      if (!prev) return prev;
      return prev.map(c => (c.id === id ? { ...c, status: newStatus } : c));
    });
    setSelectedConversation(prev =>
      prev && prev.id === id ? { ...prev, status: newStatus } : prev
    );
  }

  function handleNewMessage(id: string, message: Message) {
    queryClient.setQueryData(["conversations", limit], (prev: Conversation[] | undefined) => {
      if (!prev) return prev;
      const updated = prev.map(c =>
        c.id === id
          ? {
              ...c,
              lastMessage: message.body,
              lastMessageAt: message.createdAt,
              unreadCount: 0
            }
          : c
      );
      return [...updated].sort(
        (a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
      );
    });
    setSelectedConversation(prev =>
      prev && prev.id === id
        ? {
            ...prev,
            lastMessage: message.body,
            lastMessageAt: message.createdAt,
            messages: [...(prev.messages || []), message],
            unreadCount: 0
          }
        : prev
    );
  }

  return (
    <AppShell title="المحادثات" subtitle="صندوق موحد لرسائل واتساب وفيسبوك وإنستغرام مع الذكاء والتحويل البشري.">
      <div className="grid gap-5 xl:grid-cols-[390px_1fr] xl:h-[calc(100vh-170px)] xl:min-h-[620px]">
        {loading ? (
          <div className="flex h-96 items-center justify-center col-span-2">
            <Loader2 className="h-8 w-8 animate-spin text-emeraldx-400" />
          </div>
        ) : (
          <>
            <ConversationList
              conversations={conversations}
              selectedId={selectedId}
              onSelect={setSelectedId}
              initialQuery={initialQuery}
              initialFilter={initialFilter}
              canLoadMore={conversations.length >= limit}
              loadingMore={loading}
              onLoadMore={() => setLimit((value) => value + 50)}
            />
            {conversations.length === 0 ? (
              <div className="flex h-96 flex-col items-center justify-center rounded-3xl border border-white/10 bg-white/[0.02] text-white/45">
                <p>لا توجد محادثات نشطة حالياً.</p>
              </div>
            ) : messagesLoading || !selectedConversation ? (
              <div className="flex h-96 items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-emeraldx-400" />
              </div>
            ) : (
              <ChatWindow
                key={selectedConversation.id}
                conversation={selectedConversation}
                onStatusChange={handleStatusChange}
                onNewMessage={handleNewMessage}
              />
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}

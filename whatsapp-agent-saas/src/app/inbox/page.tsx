"use client";

import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { ChatWindow } from "@/components/chat-window";
import { ConversationList } from "@/components/conversation-list";
import { mockConversations } from "@/lib/mock-data";

export default function InboxPage() {
  const [selectedId, setSelectedId] = useState(mockConversations[0]?.id ?? "");
  const selected = mockConversations.find((conversation) => conversation.id === selectedId) ?? mockConversations[0];

  return (
    <AppShell title="المحادثات" subtitle="صندوق موحد لرسائل واتساب وفيسبوك وإنستغرام مع الذكاء والتحويل البشري." actionLabel="اختبار الديمو">
      <div className="grid gap-5 xl:grid-cols-[390px_1fr]">
        <ConversationList conversations={mockConversations} selectedId={selectedId} onSelect={setSelectedId} />
        <ChatWindow conversation={selected} />
      </div>
    </AppShell>
  );
}

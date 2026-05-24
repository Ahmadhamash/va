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
    <AppShell title="Inbox" subtitle="A calm workspace for AI and human support conversations." actionLabel="Test Demo Mode">
      <div className="grid gap-5 xl:grid-cols-[390px_1fr]">
        <ConversationList conversations={mockConversations} selectedId={selectedId} onSelect={setSelectedId} />
        <ChatWindow conversation={selected} />
      </div>
    </AppShell>
  );
}

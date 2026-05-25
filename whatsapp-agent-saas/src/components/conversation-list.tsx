"use client";

import { useMemo, useState } from "react";
import { Facebook, Instagram, MessageCircle, Search, Webhook, Code } from "lucide-react";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/status-badge";
import type { ChannelProvider, Conversation, ConversationStatus } from "@/lib/types";
import { cn, formatTime } from "@/lib/utils";

const filters: Array<{ label: string; value: "ALL" | ConversationStatus }> = [
  { label: "الكل", value: "ALL" },
  { label: "الذكاء يتابع", value: "AI_HANDLING" },
  { label: "يحتاج موظف", value: "NEEDS_HUMAN" },
  { label: "مغلق", value: "CLOSED" }
];

function StatusIndicator({ status }: { status: ConversationStatus }) {
  if (status === "AI_HANDLING") {
    return (
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emeraldx-400 opacity-75"></span>
        <span className="relative inline-flex rounded-full h-2 w-2 bg-emeraldx-500"></span>
      </span>
    );
  }
  if (status === "NEEDS_HUMAN") {
    return (
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
        <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
      </span>
    );
  }
  if (status === "HUMAN_ACTIVE") {
    return (
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violetrx-400 opacity-75"></span>
        <span className="relative inline-flex rounded-full h-2 w-2 bg-violetrx-500"></span>
      </span>
    );
  }
  return <span className="h-2 w-2 rounded-full bg-white/20"></span>;
}

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

export function ConversationList({
  conversations,
  selectedId,
  onSelect
}: {
  conversations: Conversation[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"ALL" | ConversationStatus>("ALL");

  const visible = useMemo(() => {
    return conversations.filter((conversation) => {
      const matchesFilter = filter === "ALL" || conversation.status === filter;
      const matchesQuery = `${conversation.customerName} ${conversation.customerPhone} ${conversation.lastMessage}`
        .toLowerCase()
        .includes(query.toLowerCase());
      return matchesFilter && matchesQuery;
    });
  }, [conversations, filter, query]);

  return (
    <div className="flex h-full min-h-[680px] flex-col rounded-3xl border border-white/10 bg-white/[0.045]">
      <div className="border-b border-white/10 p-4">
        <div className="relative">
          <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
          <Input className="pr-9" placeholder="ابحث في المحادثات" value={query} onChange={(event) => setQuery(event.target.value)} />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {filters.map((item) => (
            <button
              key={item.value}
              onClick={() => setFilter(item.value)}
              className={cn(
                "rounded-full px-3 py-1.5 text-xs font-semibold transition",
                filter === item.value ? "bg-emeraldx-500 text-ink-950" : "bg-white/7 text-white/58 hover:bg-white/10 hover:text-white"
              )}
              type="button"
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-3 custom-scrollbar">
        {visible.map((conversation) => (
          <button
            type="button"
            key={conversation.id}
            onClick={() => onSelect(conversation.id)}
            className={cn(
              "mb-2 w-full rounded-3xl border p-4 text-right transition-all duration-300 transform hover:translate-x-[-2px]",
              selectedId === conversation.id
                ? "border-emeraldx-400/40 bg-emeraldx-500/10 shadow-sm"
                : "border-white/8 bg-white/[0.035] hover:bg-white/[0.07] hover:shadow-md"
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 font-semibold text-white">
                  <ChannelIcon channel={conversation.channel} />
                  {conversation.customerName}
                  <StatusIndicator status={conversation.status} />
                </div>
                <div className="mt-1 text-xs text-white/38">{conversation.customerPhone}</div>
              </div>
              <span className="text-xs text-white/35">{formatTime(conversation.lastMessageAt)}</span>
            </div>
            <p className="mt-3 line-clamp-2 text-sm leading-6 text-white/52">{conversation.lastMessage}</p>
            <div className="mt-3">
              <StatusBadge status={conversation.status} />
            </div>
          </button>
        ))}
        {visible.length === 0 ? <div className="p-8 text-center text-sm text-white/45">لا توجد محادثات مطابقة.</div> : null}
      </div>
    </div>
  );
}

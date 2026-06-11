"use client";

import { useMemo, useState } from "react";
import { Facebook, Instagram, MessageCircle, Search, Webhook, Code } from "lucide-react";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/status-badge";
import type { ChannelProvider, Conversation, ConversationStatus } from "@/lib/types";
import { cn, formatTime } from "@/lib/utils";
import { useAuthStore } from "@/store/use-auth-store";

const filters: Array<{ label: string; value: "ALL" | ConversationStatus }> = [
  { label: "الكل", value: "ALL" },
  { label: "الذكاء يتابع", value: "AI_HANDLING" },
  { label: "يحتاج موظف", value: "NEEDS_HUMAN" },
  { label: "مع الموظف", value: "HUMAN_ACTIVE" },
  { label: "مغلق", value: "CLOSED" }
];

function StatusIndicator({ status }: { status: ConversationStatus }) {
  if (status === "AI_HANDLING") {
    return (
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary-400 opacity-75"></span>
        <span className="relative inline-flex rounded-full h-2 w-2 bg-primary-500"></span>
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
  return <Icon className="h-4 w-4 text-primary-400" />;
}

export function ConversationList({
  conversations,
  selectedId,
  onSelect,
  initialQuery = "",
  initialFilter = "ALL",
  onLoadMore,
  canLoadMore = false,
  loadingMore = false
}: {
  conversations: Conversation[];
  selectedId: string;
  onSelect: (id: string) => void;
  initialQuery?: string;
  initialFilter?: "ALL" | ConversationStatus;
  onLoadMore?: () => void;
  canLoadMore?: boolean;
  loadingMore?: boolean;
}) {
  const [query, setQuery] = useState(initialQuery);
  const [filter, setFilter] = useState<"ALL" | ConversationStatus>(initialFilter);
  const { user } = useAuthStore();
  const showBusinessName = user?.role === "admin" || user?.role === "support_agent";

  const visible = useMemo(() => {
    return conversations.filter((conversation) => {
      const matchesFilter = filter === "ALL" || conversation.status === filter;
      const businessName = conversation.context?.business?.name || "";
      const matchesQuery = `${conversation.customerName} ${conversation.customerPhone} ${conversation.lastMessage} ${businessName}`
        .toLowerCase()
        .includes(query.toLowerCase());
      return matchesFilter && matchesQuery;
    });
  }, [conversations, filter, query]);

  return (
    <div className="flex h-full min-h-[680px] xl:min-h-0 flex-col rounded-3xl border border-white/10 bg-white/[0.045]">
      <div className="border-b border-white/10 p-4">
        <div className="relative">
          <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
          <Input className="pr-9 text-right" placeholder="ابحث في المحادثات" value={query} onChange={(event) => setQuery(event.target.value)} />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {filters.map((item) => (
            <button
              key={item.value}
              onClick={() => setFilter(item.value)}
              className={cn(
                "rounded-full px-3 py-1.5 text-xs font-semibold transition",
                filter === item.value ? "bg-primary-500 text-ink-950" : "bg-white/7 text-white/58 hover:bg-white/10 hover:text-white"
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
                ? "border-primary-400/40 bg-primary-500/10 shadow-sm"
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
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-white/38">
                  <span>{conversation.customerPhone}</span>
                  {showBusinessName && conversation.context?.business?.name && (
                    <span className="inline-block px-1.5 py-0.5 rounded bg-cyanx-500/10 text-cyanx-300 text-[10px] font-medium">
                      {conversation.context.business.name}
                    </span>
                  )}
                </div>
              </div>
              <span className="text-xs text-white/35">{formatTime(conversation.lastMessageAt)}</span>
            </div>
            <p className="mt-3 line-clamp-2 text-sm leading-6 text-white/52 text-right">{conversation.lastMessage}</p>
            <div className="mt-3 flex items-center justify-between gap-2">
              <StatusBadge status={conversation.status} />
              {(conversation.unreadCount || 0) > 0 ? (
                <span className="min-w-6 rounded-full bg-primary-500 px-2 py-0.5 text-center text-xs font-bold text-ink-950">
                  {conversation.unreadCount}
                </span>
              ) : conversation.deliveryStatus ? (
                <span className="text-[10px] text-white/30">{conversation.deliveryStatus}</span>
              ) : null}
            </div>
          </button>
        ))}
        {visible.length === 0 ? <div className="p-8 text-center text-sm text-white/45">لا توجد محادثات مطابقة.</div> : null}
        {canLoadMore ? (
          <button
            type="button"
            onClick={onLoadMore}
            disabled={loadingMore}
            className="mt-3 w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/60 transition hover:bg-white/10 disabled:opacity-50"
          >
            {loadingMore ? "جاري التحميل..." : "تحميل المزيد"}
          </button>
        ) : null}
      </div>
    </div>
  );
}

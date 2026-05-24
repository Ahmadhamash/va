"use client";

import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/status-badge";
import type { Conversation } from "@/lib/types";
import { cn, formatTime } from "@/lib/utils";

export function ConversationList({
  conversations,
  selectedId,
  onSelect
}: {
  conversations: Conversation[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="flex h-full min-h-[680px] flex-col rounded-3xl border border-white/10 bg-white/[0.045]">
      <div className="border-b border-white/10 p-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
          <Input className="pl-9" placeholder="Search conversations" />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {["All", "AI Handling", "Needs Human", "Closed"].map((filter) => (
            <button
              key={filter}
              className="rounded-full bg-white/7 px-3 py-1.5 text-xs font-semibold text-white/58 transition hover:bg-white/10 hover:text-white"
              type="button"
            >
              {filter}
            </button>
          ))}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-3">
        {conversations.map((conversation) => (
          <button
            type="button"
            key={conversation.id}
            onClick={() => onSelect(conversation.id)}
            className={cn(
              "mb-2 w-full rounded-3xl border p-4 text-left transition",
              selectedId === conversation.id
                ? "border-emeraldx-400/40 bg-emeraldx-500/10"
                : "border-white/8 bg-white/[0.035] hover:bg-white/[0.07]"
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-semibold text-white">{conversation.customerName}</div>
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
      </div>
    </div>
  );
}

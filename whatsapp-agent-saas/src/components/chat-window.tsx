"use client";

import { useMemo, useState } from "react";
import { Bot, Pencil, RefreshCw, Send, StickyNote, UserCheck, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/status-badge";
import type { Conversation, Message } from "@/lib/types";
import { cn, formatTime } from "@/lib/utils";

function MessageBubble({ message }: { message: Message }) {
  const fromCustomer = message.sender === "CUSTOMER";
  const fromSystem = message.sender === "SYSTEM";
  return (
    <div className={cn("flex", fromCustomer ? "justify-start" : "justify-end")}>
      <div
        className={cn(
          "max-w-[78%] rounded-3xl px-4 py-3 text-sm leading-6",
          fromCustomer && "rounded-bl-md bg-white/9 text-white/78",
          message.sender === "AI" && "rounded-br-md bg-emeraldx-500 text-ink-950",
          message.sender === "HUMAN" && "rounded-br-md bg-violetrx-500/80 text-white",
          fromSystem && "mx-auto max-w-[86%] rounded-2xl border border-white/10 bg-white/[0.04] text-center text-white/45"
        )}
      >
        <div>{message.body}</div>
        <div className={cn("mt-1 text-[11px]", message.sender === "AI" ? "text-ink-950/55" : "text-white/35")}>
          {formatTime(message.createdAt)}
        </div>
      </div>
    </div>
  );
}

export function ChatWindow({ conversation }: { conversation: Conversation }) {
  const [draft, setDraft] = useState("");
  const suggestedReply = useMemo(() => {
    if (conversation.status === "NEEDS_HUMAN") {
      return "I will connect you with a team member who can handle this carefully.";
    }
    return "Yes, we can help with that. Could you share which item you are interested in?";
  }, [conversation.status]);

  return (
    <div className="grid min-h-[680px] gap-4 lg:grid-cols-[1fr_280px]">
      <div className="flex min-h-[680px] flex-col rounded-3xl border border-white/10 bg-white/[0.045]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 p-4">
          <div>
            <div className="text-lg font-semibold text-white">{conversation.customerName}</div>
            <div className="mt-1 text-sm text-white/42">{conversation.customerPhone}</div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={conversation.status} />
            <Button size="sm" variant="secondary">
              <UserCheck className="h-4 w-4" />
              Take Over
            </Button>
            <Button size="sm" variant="ghost">Return to AI</Button>
            <Button size="sm" variant="ghost">Close Chat</Button>
          </div>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          {conversation.messages.map((message) => (
            <MessageBubble key={message.id} message={message} />
          ))}
        </div>

        <div className="border-t border-white/10 p-4">
          <div className="mb-3 rounded-3xl border border-emeraldx-400/20 bg-emeraldx-500/10 p-4">
            <div className="mb-2 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-emeraldx-400">
                <Bot className="h-4 w-4" />
                Suggested reply
              </div>
              <div className="flex gap-2">
                <Button size="sm">Send</Button>
                <Button size="sm" variant="secondary">
                  <Pencil className="h-3.5 w-3.5" />
                  Edit
                </Button>
                <Button size="sm" variant="ghost">
                  <RefreshCw className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
            <p className="text-sm leading-6 text-white/68">{suggestedReply}</p>
          </div>
          <div className="flex gap-2">
            <Input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Write a human reply..." />
            <Button>
              <Send className="h-4 w-4" />
              Send
            </Button>
          </div>
        </div>
      </div>

      <aside className="space-y-4">
        <div className="rounded-3xl border border-white/10 bg-white/[0.045] p-4">
          <div className="text-sm font-semibold text-white">Customer profile</div>
          <div className="mt-4 space-y-3 text-sm text-white/58">
            <div className="flex justify-between gap-3">
              <span>Name</span>
              <span className="text-white">{conversation.customerName}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span>Phone</span>
              <span className="text-white">{conversation.customerPhone}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span>Orders</span>
              <span className="text-white">3</span>
            </div>
          </div>
        </div>
        <div className="rounded-3xl border border-white/10 bg-white/[0.045] p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
            <StickyNote className="h-4 w-4 text-cyanx-400" />
            Notes
          </div>
          <p className="text-sm leading-6 text-white/50">
            Customer prefers short replies and asks about delivery before ordering.
          </p>
          <Button className="mt-4 w-full" variant="secondary" size="sm">
            Add Note
          </Button>
        </div>
        <div className="rounded-3xl border border-red-400/20 bg-red-500/10 p-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-red-100">
            <XCircle className="h-4 w-4" />
            Safety
          </div>
          <p className="text-sm leading-6 text-red-100/70">
            Refund, cancellation, and angry customers should be transferred to a human.
          </p>
        </div>
      </aside>
    </div>
  );
}

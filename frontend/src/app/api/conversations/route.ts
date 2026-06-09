import { NextResponse } from "next/server";
import { backendFetch, getTokenFromRequest } from "@/lib/backend-api";

export async function GET(request: Request) {
  const token = getTokenFromRequest(request);
  
  if (!token) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const params = new URLSearchParams();
    for (const key of ["skip", "limit"]) {
      const value = searchParams.get(key);
      if (value) params.set(key, value);
    }
    const suffix = params.toString() ? `?${params.toString()}` : "";
    const res = await backendFetch(`/chat/inbox-conversations${suffix}`, { token });

    if (!res.ok) {
      return NextResponse.json({ ok: false, error: "Failed to fetch conversations" }, { status: res.status });
    }

    const inboxConversations = await res.json().catch(() => []);

    const conversations = inboxConversations.map((h: any) => {
      // Map database statuses (h.raw_status) to ConversationStatus types
      let status: "NEEDS_HUMAN" | "HUMAN_ACTIVE" | "AI_HANDLING" | "CLOSED" = "AI_HANDLING";
      if (h.raw_status === "unassigned" || h.raw_status === "pending") {
        status = "NEEDS_HUMAN";
      } else if (h.raw_status === "assigned" || h.raw_status === "in_progress") {
        status = "HUMAN_ACTIVE";
      } else if (h.raw_status === "resolved") {
        status = "CLOSED";
      } else if (h.raw_status === "returned_to_ai") {
        status = "AI_HANDLING";
      }

      return {
        id: h.id,
        customerName: h.customerName || "عميل",
        customerPhone: h.customerPhone || "",
        channel: h.channel || "WHATSAPP",
        status,
        lastMessage: h.lastMessage || "",
        lastMessageAt: h.lastMessageAt || new Date().toISOString(),
        aiSuggestedReply: h.aiSuggestedReply || null,
        unreadCount: h.unreadCount || 0,
        deliveryStatus: h.deliveryStatus || null,
        context: h.context || null,
        messages: [],
      };
    });

    return NextResponse.json({ ok: true, conversations });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ ok: false, error: "Internal Error" }, { status: 500 });
  }
}

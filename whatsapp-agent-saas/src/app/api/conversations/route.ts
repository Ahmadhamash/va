import { NextResponse } from "next/server";
import { backendFetch, getTokenFromRequest } from "@/lib/backend-api";
import { mockConversations } from "@/lib/mock-data";

export async function GET(request: Request) {
  const token = getTokenFromRequest(request);
  
  if (!token) {
    return NextResponse.json({ ok: true, conversations: mockConversations });
  }

  try {
    const res = await backendFetch("/handoff/", { token });
    if (res.ok) {
      const handoffs = await res.json();
      const conversations = handoffs.map((h: Record<string, string>) => ({
        id: h.id,
        customerName: h.customer_name || h.reason || "\u0639\u0645\u064A\u0644",
        customerPhone: h.customer_phone || "",
        channel: "WHATSAPP" as const,
        status: h.status === "pending" ? "NEEDS_HUMAN" : h.status === "assigned" ? "HUMAN_ACTIVE" : "AI_HANDLING",
        lastMessage: h.reason || h.ai_summary || "",
        lastMessageAt: h.created_at || new Date().toISOString(),
        messages: [],
      }));
      return NextResponse.json({ ok: true, conversations });
    }
  } catch {
    // Fall back to mock data on error
  }
  
  return NextResponse.json({ ok: true, conversations: mockConversations });
}

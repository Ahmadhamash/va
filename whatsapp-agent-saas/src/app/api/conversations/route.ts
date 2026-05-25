import { NextResponse } from "next/server";
import { backendFetch, getTokenFromRequest } from "@/lib/backend-api";

export async function GET(request: Request) {
  const token = getTokenFromRequest(request);
  
  if (!token) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const res = await backendFetch("/handoff/", { token });
    if (!res.ok) {
        return NextResponse.json({ ok: false, error: "Failed to fetch conversations" }, { status: res.status });
    }
    const handoffs = await res.json();
    const conversations = handoffs.map((h: Record<string, string>) => ({
      id: h.id,
      customerName: h.customer_name || h.reason || "عميل",
      customerPhone: h.customer_phone || "",
      channel: "WHATSAPP" as const,
      status: h.status === "pending" ? "NEEDS_HUMAN" : h.status === "assigned" ? "HUMAN_ACTIVE" : "AI_HANDLING",
      lastMessage: h.reason || h.ai_summary || "",
      lastMessageAt: h.created_at || new Date().toISOString(),
      messages: [],
    }));
    return NextResponse.json({ ok: true, conversations });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ ok: false, error: "Internal Error" }, { status: 500 });
  }
}

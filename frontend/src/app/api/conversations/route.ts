import { NextResponse } from "next/server";
import { backendFetch, getTokenFromRequest } from "@/lib/backend-api";

export async function GET(request: Request) {
  const token = getTokenFromRequest(request);
  
  if (!token) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const [activeRes, resolvedRes, aiRes] = await Promise.all([
      backendFetch("/handoff", { token }),
      backendFetch("/handoff?status=resolved", { token }),
      backendFetch("/handoff?status=returned_to_ai", { token }),
    ]);

    if (!activeRes.ok) {
      return NextResponse.json({ ok: false, error: "Failed to fetch conversations" }, { status: activeRes.status });
    }

    const activeHandoffs = await activeRes.json().catch(() => []);
    const resolvedHandoffs = resolvedRes.ok ? await resolvedRes.json().catch(() => []) : [];
    const aiHandoffs = aiRes.ok ? await aiRes.json().catch(() => []) : [];

    const allHandoffs = [
      ...activeHandoffs,
      ...resolvedHandoffs,
      ...aiHandoffs
    ];

    // Group by session_id and keep the latest handoff session
    const uniqueHandoffsMap = new Map<string, any>();
    allHandoffs.forEach((h: any) => {
      const existing = uniqueHandoffsMap.get(h.session_id);
      if (!existing || new Date(h.created_at) > new Date(existing.created_at)) {
        uniqueHandoffsMap.set(h.session_id, h);
      }
    });

    const uniqueHandoffs = Array.from(uniqueHandoffsMap.values());

    const conversations = uniqueHandoffs.map((h: any) => {
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
        id: h.session_id,
        customerName: h.customer_name || h.reason || "عميل",
        customerPhone: h.customer_phone || "",
        channel: "WHATSAPP" as const,
        status,
        lastMessage: h.reason || h.ai_summary || "",
        lastMessageAt: h.created_at || new Date().toISOString(),
        aiSuggestedReply: h.ai_suggested_reply || null,
        messages: [],
      };
    });

    return NextResponse.json({ ok: true, conversations });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ ok: false, error: "Internal Error" }, { status: 500 });
  }
}

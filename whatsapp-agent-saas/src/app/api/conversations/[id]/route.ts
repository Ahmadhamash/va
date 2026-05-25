import { NextResponse } from "next/server";
import { backendFetch, getTokenFromRequest } from "@/lib/backend-api";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const token = getTokenFromRequest(request);
  const { id } = await params; // id here is actually the session_id from the conversation object
  
  if (!token) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    // First try to fetch messages from chat/sessions/{id}/messages
    const res = await backendFetch(`/chat/sessions/${id}/messages`, { token });
    if (!res.ok) {
        return NextResponse.json({ ok: false, error: "Failed to fetch conversation" }, { status: res.status });
    }
    const messages = await res.json();
    return NextResponse.json({ 
        ok: true, 
        conversation: {
            id,
            messages: messages.map((m: any) => ({
                id: m.id,
                sender: m.role === "user" ? "CUSTOMER" : m.role === "agent" ? "HUMAN" : "AI",
                body: m.content,
                createdAt: m.created_at
            }))
        }
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ ok: false, error: "Internal Error" }, { status: 500 });
  }
}

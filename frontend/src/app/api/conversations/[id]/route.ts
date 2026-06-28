import { NextResponse } from "next/server";
import { backendFetch, getTokenFromRequest } from "@/lib/backend-api";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const token = getTokenFromRequest(request);
  const { id } = await params;
  
  if (!token) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const res = await backendFetch(`/chat/sessions/${id}/messages`, { token });
    if (!res.ok) {
        return NextResponse.json({ ok: false, error: "Failed to fetch conversation" }, { status: res.status });
    }
    const messages = await res.json();
    
    // Fetch verification logs to get risk scores
    let logs: any[] = [];
    try {
      const logsRes = await backendFetch(`/verification-logs?session_id=${id}`, { token });
      if (logsRes.ok) {
        const logsData = await logsRes.json();
        logs = logsData.logs || [];
      }
    } catch (err) {
      console.error("Failed to fetch verification logs", err);
    }
    
    const logsByMessageId = new Map<string, any>();
    for (const log of logs) {
      if (log.message_id) {
        logsByMessageId.set(log.message_id, log);
      }
    }

    return NextResponse.json({ 
        ok: true, 
        conversation: {
            id,
            messages: messages.map((m: any) => {
                const log = logsByMessageId.get(m.id);
                return {
                    id: m.id,
                    sender: m.role === "user" ? "CUSTOMER" : m.role === "agent" ? "HUMAN" : m.role === "system" ? "SYSTEM" : "AI",
                    body: m.content,
                    createdAt: m.created_at,
                    mediaType: m.media_type,
                    mediaUrl: m.media_url,
                    riskScore: log ? log.risk_score : undefined,
                    verifierStatus: log ? log.verifier_status : undefined
                };
            })
        }
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ ok: false, error: "Internal Error" }, { status: 500 });
  }
}

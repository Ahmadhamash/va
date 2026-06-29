import { NextResponse } from "next/server";
import { backendFetch, getTokenFromRequest } from "@/lib/backend-api";

export const dynamic = "force-dynamic";

function messageOrder(message: any) {
  const time = new Date(message.created_at || message.createdAt || 0).getTime();
  const senderRank =
    message.role === "user" || message.sender === "CUSTOMER"
      ? 0
      : message.role === "agent" || message.sender === "HUMAN"
        ? 1
        : message.role === "assistant" || message.sender === "AI"
          ? 2
          : 3;
  return { time: Number.isFinite(time) ? time : 0, senderRank, id: String(message.id || "") };
}

function sortMessages(messages: any[]) {
  return [...messages].sort((a, b) => {
    const left = messageOrder(a);
    const right = messageOrder(b);
    if (left.time !== right.time) return left.time - right.time;
    if (left.senderRank !== right.senderRank) return left.senderRank - right.senderRank;
    return left.id.localeCompare(right.id);
  });
}

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
    const messages = sortMessages(await res.json());
    
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

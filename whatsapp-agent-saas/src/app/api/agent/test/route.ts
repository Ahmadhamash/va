import { NextResponse } from "next/server";
import { backendFetch, getTokenFromRequest } from "@/lib/backend-api";
import { AgentService } from "@/lib/agent/AgentService";

export async function POST(request: Request) {
  const token = getTokenFromRequest(request);
  const body = await request.json();

  if (!token) {
    const service = new AgentService();
    const result = await service.test(body.message ?? "");
    return NextResponse.json({ ok: true, result });
  }

  try {
    const formData = new URLSearchParams();
    formData.append("message", body.message ?? "");

    const res = await fetch(
      (process.env.BACKEND_URL || "http://backend:8000") + "/api/chat/send",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: "Bearer " + token,
        },
        body: formData.toString(),
      }
    );

    if (res.ok) {
      const data = await res.json();
      return NextResponse.json({
        ok: true,
        result: {
          reply: data.reply || data.response || "",
          sessionId: data.session_id,
        },
      });
    }
  } catch {
    // Fall back to demo
  }

  const service = new AgentService();
  const result = await service.test(body.message ?? "");
  return NextResponse.json({ ok: true, result });
}

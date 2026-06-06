import { NextResponse } from "next/server";
import { backendFetch, getTokenFromRequest } from "@/lib/backend-api";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const token = getTokenFromRequest(request);
  const { id } = await params;

  if (!token) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const res = await backendFetch(`/chat/sessions/${id}/takeover`, {
      method: "POST",
      token
    });

    if (!res.ok) {
        return NextResponse.json({ ok: false, error: `Failed to takeover conversation: ${res.statusText}` }, { status: res.status });
    }

    return NextResponse.json({
        ok: true,
        conversationId: id,
        status: "HUMAN_ACTIVE"
    });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ ok: false, error: err.message || String(err) }, { status: 500 });
  }
}

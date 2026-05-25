import { NextResponse } from "next/server";
import { backendFetch, getTokenFromRequest } from "@/lib/backend-api";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const token = getTokenFromRequest(request);
  const { id } = await params;

  if (!token) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const listRes = await backendFetch("/handoff/", { token });
    if (!listRes.ok) {
      return NextResponse.json({ ok: false, error: `Failed to fetch handoff list: ${listRes.statusText}` }, { status: listRes.status });
    }
    const handoffs = await listRes.json();
    const handoff = handoffs.find((h: any) => h.session_id === id);
    if (!handoff) {
      return NextResponse.json({ ok: false, error: "Active handoff session not found" }, { status: 404 });
    }

    const res = await backendFetch(`/handoff/${handoff.id}/resolve`, {
      method: "POST",
      body: { return_to_ai: true },
      token
    });

    if (!res.ok) {
        return NextResponse.json({ ok: false, error: `Failed to return to AI: ${res.statusText}` }, { status: res.status });
    }

    return NextResponse.json({
        ok: true,
        conversationId: id,
        status: "AI_HANDLING"
    });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ ok: false, error: err.message || String(err) }, { status: 500 });
  }
}

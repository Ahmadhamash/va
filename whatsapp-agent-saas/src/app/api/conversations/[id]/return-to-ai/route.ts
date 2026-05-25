import { NextResponse } from "next/server";
import { backendFetch, getTokenFromRequest } from "@/lib/backend-api";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const token = getTokenFromRequest(request);
  const { id } = await params;

  if (!token) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const res = await backendFetch(`/handoff/${id}/resolve`, {
      method: "POST",
      body: { return_to_ai: true },
      token
    });

    if (!res.ok) {
        return NextResponse.json({ ok: false, error: "Failed to return to AI" }, { status: res.status });
    }

    return NextResponse.json({
        ok: true,
        conversationId: id,
        status: "AI_HANDLING"
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ ok: false, error: "Internal Error" }, { status: 500 });
  }
}

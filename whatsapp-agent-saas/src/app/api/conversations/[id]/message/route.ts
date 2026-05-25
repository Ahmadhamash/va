import { NextResponse } from "next/server";
import { backendFetch, getTokenFromRequest } from "@/lib/backend-api";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const token = getTokenFromRequest(request);
  const { id } = await params;
  const body = await request.json();

  if (!token) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = new URLSearchParams();
    formData.append("message", body.message ?? "");

    const res = await backendFetch(`/chat/sessions/${id}/agent-message`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: formData.toString(),
      token
    });

    if (!res.ok) {
        return NextResponse.json({ ok: false, error: "Failed to send message" }, { status: res.status });
    }

    const result = await res.json();

    return NextResponse.json({
        ok: true,
        result
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ ok: false, error: "Internal Error" }, { status: 500 });
  }
}

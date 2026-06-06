import { NextResponse } from "next/server";
import { backendFetch, getTokenFromRequest } from "@/lib/backend-api";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const token = getTokenFromRequest(request);
  const { id } = await params;

  if (!token) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const contentType = request.headers.get("content-type") || "";
    let body: FormData | URLSearchParams;
    if (contentType.includes("multipart/form-data")) {
      body = await request.formData();
    } else {
      const json = await request.json();
      body = new URLSearchParams();
      body.append("message", json.message ?? "");
    }

    const res = await backendFetch(`/chat/sessions/${id}/agent-message`, {
      method: "POST",
      body,
      token
    });

    if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        return NextResponse.json({ ok: false, error: data.detail || "Failed to send message" }, { status: res.status });
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

import { NextResponse } from "next/server";
import { getTokenFromRequest } from "@/lib/backend-api";

export async function POST(request: Request) {
  const token = getTokenFromRequest(request);
  const body = await request.json();

  if (!token) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
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
    return NextResponse.json({ ok: false, error: "Failed to process chat" }, { status: res.status });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 });
  }
}

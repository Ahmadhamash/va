import { NextResponse } from "next/server";
import { backendFetch, getTokenFromRequest } from "@/lib/backend-api";

export async function GET(request: Request) {
  const token = getTokenFromRequest(request);
  if (!token) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const res = await backendFetch("/chat/auto-reply", { token });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return NextResponse.json({ ok: false, error: data.detail || "Failed to fetch auto-reply status" }, { status: res.status });
    }
    return NextResponse.json({ ok: true, enabled: data.enabled !== false });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ ok: false, error: "Internal Error" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const token = getTokenFromRequest(request);
  const body = await request.json().catch(() => ({}));
  if (!token) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const res = await backendFetch("/chat/auto-reply", {
      method: "PUT",
      body: { enabled: body.enabled !== false },
      token,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return NextResponse.json({ ok: false, error: data.detail || "Failed to update auto-reply status" }, { status: res.status });
    }
    return NextResponse.json({ ok: true, enabled: data.enabled !== false });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ ok: false, error: "Internal Error" }, { status: 500 });
  }
}

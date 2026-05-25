import { NextResponse } from "next/server";
import { backendFetch, getTokenFromRequest } from "@/lib/backend-api";

export async function POST(request: Request) {
  const token = getTokenFromRequest(request);
  if (!token) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const provider = String(body.provider ?? "whatsapp").toLowerCase();

  try {
    const res = await backendFetch("/channels", {
      method: "POST",
      body: { platform: provider, credentials: {} },
      token
    });
    
    if (!res.ok) {
        return NextResponse.json({ ok: false, error: "Failed to connect channel" }, { status: res.status });
    }
    const channel = await res.json();
    return NextResponse.json({
        ok: true,
        channel,
        message: `تم إنشاء قناة ${channel.platform} بنجاح.`
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 });
  }
}

export async function GET(request: Request) {
    const token = getTokenFromRequest(request);
    if (!token) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    try {
        const res = await backendFetch("/channels", { token });
        if (!res.ok) {
            return NextResponse.json({ ok: false, error: "Failed to fetch channels" }, { status: res.status });
        }
        const channels = await res.json();
        return NextResponse.json({ ok: true, channels });
    } catch (err) {
        console.error(err);
        return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 });
    }
}

import { NextResponse } from "next/server";
import { backendFetch, getTokenFromRequest } from "@/lib/backend-api";

export async function POST(request: Request) {
  const token = getTokenFromRequest(request);
  if (!token) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const provider = String(body.provider ?? "whatsapp").toLowerCase();
  const credentials = body.credentials || {};

  try {
    const res = await backendFetch("/channels", {
      method: "POST",
      body: { platform: provider, credentials },
      token
    });
    
    if (!res.ok) {
        return NextResponse.json({ ok: false, error: "Failed to connect channel" }, { status: res.status });
    }
    const backendChannel = await res.json();
    const channel = {
        ...backendChannel,
        provider: String(backendChannel.platform || "WHATSAPP").toUpperCase(),
        status: backendChannel.is_active ? "CONNECTED" : "SETUP_REQUIRED",
        name: backendChannel.platform === "whatsapp" ? "واتساب بزنس" : backendChannel.platform === "facebook" ? "فيسبوك ماسنجر" : "قناة",
        handle: "رقم/حساب",
        description: "قناة تم جلبها من الخادم",
        metric: "جديد",
    };
    return NextResponse.json({
        ok: true,
        channel,
        message: `تم إنشاء قناة ${backendChannel.platform} بنجاح.`
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
        const channels = (await res.json()).map((c: any) => ({
          ...c,
          provider: String(c.platform || "WHATSAPP").toUpperCase(),
          status: c.is_active ? "CONNECTED" : "SETUP_REQUIRED",
          name: c.platform === "whatsapp" ? "واتساب بزنس" : c.platform === "facebook" ? "فيسبوك ماسنجر" : "قناة",
          handle: "رقم/حساب",
          description: "قناة تم جلبها من الخادم",
          metric: "جديد",
        }));
        return NextResponse.json({ ok: true, channels });
    } catch (err) {
        console.error(err);
        return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 });
    }
}

import { NextResponse } from "next/server";
import { backendFetch, getTokenFromRequest } from "@/lib/backend-api";

function toClientChannel(channel: any) {
  const provider = String(channel.platform || "whatsapp").toUpperCase();
  return {
    ...channel,
    provider,
    credentials: channel.setup_values || {},
    status: channel.is_active ? "CONNECTED" : "SETUP_REQUIRED",
    name:
      provider === "WHATSAPP"
        ? "واتساب بزنس"
        : provider === "MESSENGER"
          ? "Facebook Messenger"
          : provider === "INSTAGRAM"
            ? "Instagram"
            : provider === "WIDGET"
              ? "Widget"
              : provider === "WEBHOOK"
                ? "Webhook"
                : "قناة",
    handle: "حساب رسمي",
    description: "قناة مرتبطة من الخادم",
    metric: "جديد",
  };
}

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
      token,
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return NextResponse.json(
        { ok: false, error: data.detail || "Failed to connect channel" },
        { status: res.status },
      );
    }
    const backendChannel = await res.json();
    const channel = toClientChannel(backendChannel);
    return NextResponse.json({
      ok: true,
      channel,
      message: `تم إنشاء قناة ${backendChannel.platform} بنجاح.`,
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
      return NextResponse.json(
        { ok: false, error: "Failed to fetch channels" },
        { status: res.status },
      );
    }
    const channels = (await res.json()).map(toClientChannel);
    return NextResponse.json({ ok: true, channels });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 });
  }
}

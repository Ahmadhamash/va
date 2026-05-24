import { NextResponse } from "next/server";
import { mockChannels } from "@/lib/mock-data";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const provider = String(body.provider ?? "WHATSAPP").toUpperCase();
  const channel = mockChannels.find((item) => item.provider === provider) ?? mockChannels[0];

  return NextResponse.json({
    ok: true,
    channel,
    message: `تم تجهيز ربط ${channel.name} التجريبي. الربط الحقيقي يحتاج بيانات Meta الرسمية.`
  });
}

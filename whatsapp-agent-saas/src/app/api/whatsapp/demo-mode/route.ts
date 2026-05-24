import { NextResponse } from "next/server";
import { WhatsAppService } from "@/lib/whatsapp/WhatsAppService";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const service = new WhatsAppService("MOCK");
  const connection = await service.connect(body.businessId ?? "biz_demo");
  return NextResponse.json({
    ok: true,
    connection
  });
}

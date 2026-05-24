import { NextResponse } from "next/server";
import { WhatsAppService } from "@/lib/whatsapp/WhatsAppService";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const service = new WhatsAppService("CLOUD_API");
  const status = await service.connect(body.businessId ?? "biz_demo");
  return NextResponse.json({
    ok: true,
    message: "Official WhatsApp Business API setup placeholder created.",
    connection: status
  });
}

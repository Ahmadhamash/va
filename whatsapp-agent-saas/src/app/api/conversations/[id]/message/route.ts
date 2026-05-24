import { NextResponse } from "next/server";
import { createWhatsAppService } from "@/lib/whatsapp/WhatsAppService";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const service = createWhatsAppService();
  const result = await service.sendMessage(id, body.message ?? "");
  return NextResponse.json({ ok: result.ok, result });
}

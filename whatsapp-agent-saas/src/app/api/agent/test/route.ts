import { NextResponse } from "next/server";
import { AgentService } from "@/lib/agent/AgentService";

export async function POST(request: Request) {
  const body = await request.json();
  const service = new AgentService();
  const result = await service.test(body.message ?? "");
  return NextResponse.json({ ok: true, result });
}

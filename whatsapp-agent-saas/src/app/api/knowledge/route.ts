import { NextResponse } from "next/server";
import { mockKnowledge } from "@/lib/mock-data";

export async function GET() {
  return NextResponse.json({ ok: true, knowledge: mockKnowledge });
}

export async function POST(request: Request) {
  const body = await request.json();
  return NextResponse.json({
    ok: true,
    knowledgeItem: {
      id: `kn_${Date.now()}`,
      ...body,
      createdAt: new Date().toISOString()
    }
  });
}

import { NextResponse } from "next/server";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return NextResponse.json({
    ok: true,
    conversationId: id,
    status: "HUMAN_ACTIVE"
  });
}

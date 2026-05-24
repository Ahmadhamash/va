import { NextResponse } from "next/server";
import { mockConversations } from "@/lib/mock-data";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const conversation = mockConversations.find((item) => item.id === id);
  if (!conversation) {
    return NextResponse.json({ ok: false, error: "Conversation not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, conversation });
}

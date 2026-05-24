import { NextResponse } from "next/server";
import { mockConversations } from "@/lib/mock-data";

export async function GET() {
  return NextResponse.json({ ok: true, conversations: mockConversations });
}

import { NextResponse } from "next/server";
import { mockConnection } from "@/lib/mock-data";

export async function GET() {
  return NextResponse.json({
    ok: true,
    connection: mockConnection
  });
}

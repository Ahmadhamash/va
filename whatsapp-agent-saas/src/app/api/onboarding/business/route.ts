import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const body = await request.json();
  return NextResponse.json({
    ok: true,
    business: {
      id: "biz_demo",
      ...body,
      createdAt: new Date().toISOString()
    }
  });
}

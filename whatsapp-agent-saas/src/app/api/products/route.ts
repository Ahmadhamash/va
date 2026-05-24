import { NextResponse } from "next/server";
import { mockProducts } from "@/lib/mock-data";

export async function GET() {
  return NextResponse.json({ ok: true, products: mockProducts });
}

export async function POST(request: Request) {
  const body = await request.json();
  return NextResponse.json({
    ok: true,
    product: {
      id: `prod_${Date.now()}`,
      available: true,
      ...body
    }
  });
}

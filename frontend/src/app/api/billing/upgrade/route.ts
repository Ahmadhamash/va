import { NextResponse } from "next/server";
import { backendFetch, getTokenFromRequest } from "@/lib/backend-api";

export async function POST(request: Request) {
  const token = getTokenFromRequest(request);
  if (!token) {
    return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const tierId = searchParams.get("tier_id");
  if (!tierId) {
    return NextResponse.json({ detail: "tier_id query parameter is required" }, { status: 400 });
  }

  try {
    const res = await backendFetch(`/billing/upgrade?tier_id=${tierId}`, {
      method: "POST",
      token,
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error: any) {
    console.error("Error upgrading subscription in Next.js BFF:", error);
    return NextResponse.json({ detail: "Internal Server Error" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { backendFetch, getTokenFromRequest } from "@/lib/backend-api";

export async function POST(request: Request) {
  const token = getTokenFromRequest(request);
  if (!token) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const { tierId } = body;

    if (!tierId) {
      return NextResponse.json({ ok: false, error: "Missing tierId" }, { status: 400 });
    }

    const res = await backendFetch(`/billing/upgrade?tier_id=${tierId}`, {
      method: "POST",
      token,
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      return NextResponse.json(
        { ok: false, error: errData.detail || "Failed to upgrade subscription" },
        { status: res.status }
      );
    }

    const subscription = await res.json();
    return NextResponse.json({ ok: true, subscription });
  } catch (error) {
    console.error("Error in POST /api/billing/upgrade:", error);
    return NextResponse.json({ ok: false, error: "Internal Server Error" }, { status: 500 });
  }
}

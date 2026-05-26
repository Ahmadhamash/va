import { NextResponse } from "next/server";
import { backendFetch, getTokenFromRequest } from "@/lib/backend-api";

export async function GET(request: Request) {
  const token = getTokenFromRequest(request);
  if (!token) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const tiersRes = await backendFetch("/billing/tiers", { token });
    if (!tiersRes.ok) {
      return NextResponse.json({ ok: false, error: "Failed to fetch subscription tiers" }, { status: tiersRes.status });
    }
    const tiers = await tiersRes.json();

    // Fetch user subscription (can be 404 if user has no subscription yet)
    let subscription = null;
    const subRes = await backendFetch("/billing/subscription", { token });
    if (subRes.ok) {
      subscription = await subRes.json();
    } else if (subRes.status !== 404) {
      console.warn("Unexpected status code fetching subscription:", subRes.status);
    }

    return NextResponse.json({ ok: true, tiers, subscription });
  } catch (error) {
    console.error("Error in GET /api/billing:", error);
    return NextResponse.json({ ok: false, error: "Internal Server Error" }, { status: 500 });
  }
}

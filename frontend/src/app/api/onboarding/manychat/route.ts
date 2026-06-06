import { NextResponse } from "next/server";
import { backendFetch, getTokenFromRequest } from "@/lib/backend-api";

export async function GET(request: Request) {
  const token = getTokenFromRequest(request);
  if (!token) {
    return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
  }

  try {
    const res = await backendFetch("/onboarding/manychat/status", { token });
    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    console.error("Error fetching ManyChat onboarding status:", error);
    return NextResponse.json({ detail: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const token = getTokenFromRequest(request);
  if (!token) {
    return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const res = await backendFetch("/onboarding/manychat", {
      method: "POST",
      token,
      body,
    });
    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    console.error("Error submitting ManyChat onboarding request:", error);
    return NextResponse.json({ detail: "Internal Server Error" }, { status: 500 });
  }
}

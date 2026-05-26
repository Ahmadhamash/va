import { NextResponse } from "next/server";
import { backendFetch, getTokenFromRequest } from "@/lib/backend-api";

export async function GET(request: Request) {
  const token = getTokenFromRequest(request);
  if (!token) {
    return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
  }
  try {
    const res = await backendFetch("/billing/subscription", { token });
    if (!res.ok) {
      if (res.status === 404) {
        return NextResponse.json(null, { status: 404 });
      }
      return NextResponse.json({ detail: "Failed to fetch subscription" }, { status: res.status });
    }
    const data = await res.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Error fetching subscription in Next.js BFF:", error);
    return NextResponse.json({ detail: "Internal Server Error" }, { status: 500 });
  }
}

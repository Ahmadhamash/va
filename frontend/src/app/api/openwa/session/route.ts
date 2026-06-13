import { NextResponse } from "next/server";
import { backendFetch, getTokenFromRequest } from "@/lib/backend-api";

export async function GET(request: Request) {
  const token = getTokenFromRequest(request);
  if (!token) {
    return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
  }

  const res = await backendFetch("/openwa/session", { token });
  const data = await res.json().catch(() => ({}));
  return NextResponse.json(data, { status: res.status });
}

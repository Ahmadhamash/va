import { NextResponse } from "next/server";
import { backendFetch, getTokenFromRequest } from "@/lib/backend-api";

export async function GET(request: Request) {
  const token = getTokenFromRequest(request);
  if (!token) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const path = status ? `/handoff?status=${encodeURIComponent(status)}` : "/handoff";
  const res = await backendFetch(path, { token });
  const data = await res.json().catch(() => []);
  return NextResponse.json(data, { status: res.status });
}

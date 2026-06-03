import { NextResponse } from "next/server";
import { backendFetch, getTokenFromRequest } from "@/lib/backend-api";

export async function GET(request: Request) {
  const token = getTokenFromRequest(request);
  if (!token) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const res = await backendFetch("/voice-settings/voices", { token });
  const data = await res.json().catch(() => ({}));
  return NextResponse.json(data, { status: res.status });
}

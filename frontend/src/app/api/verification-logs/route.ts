import { NextResponse } from "next/server";
import { backendFetch, getTokenFromRequest } from "@/lib/backend-api";

const FORWARDED_PARAMS = ["limit", "verifier_status", "session_id"] as const;

export async function GET(request: Request) {
  const token = getTokenFromRequest(request);
  if (!token) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const incoming = new URL(request.url).searchParams;
  const query = new URLSearchParams();

  FORWARDED_PARAMS.forEach((name) => {
    const value = incoming.get(name);
    if (value && value !== "all") {
      query.set(name, value);
    }
  });

  try {
    const suffix = query.toString() ? `?${query.toString()}` : "";
    const res = await backendFetch(`/verification-logs/${suffix}`, { token });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      return NextResponse.json(
        { ok: false, error: data.detail || data.error || "Failed to fetch verification logs" },
        { status: res.status },
      );
    }

    return NextResponse.json({ ok: true, ...data });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 });
  }
}

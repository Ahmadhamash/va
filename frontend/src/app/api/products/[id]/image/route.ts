import { NextResponse } from "next/server";
import { getTokenFromRequest } from "@/lib/backend-api";

const BACKEND_BASE = process.env.BACKEND_URL || "http://backend:8000";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const token = getTokenFromRequest(request);
  const { id } = await params;
  if (!token) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const res = await fetch(`${BACKEND_BASE}/api/items/${id}/image`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  return NextResponse.json({ ok: res.ok, product: data, error: data.detail }, { status: res.status });
}

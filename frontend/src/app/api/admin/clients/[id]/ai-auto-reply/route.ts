import { NextResponse } from "next/server";
import { backendFetch, getTokenFromRequest } from "@/lib/backend-api";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = getTokenFromRequest(request);
  if (!token) {
    return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
  }
  const { id } = await params;
  try {
    const body = await request.json();
    const res = await backendFetch(`/admin/clients/${id}/ai-auto-reply`, {
      method: "PATCH",
      token,
      body,
    });
    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    console.error("Error setting client AI auto-reply status in BFF:", error);
    return NextResponse.json({ detail: "Internal Server Error" }, { status: 500 });
  }
}

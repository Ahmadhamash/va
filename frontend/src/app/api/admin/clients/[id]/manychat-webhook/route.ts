import { NextResponse } from "next/server";
import { backendFetch, getTokenFromRequest } from "@/lib/backend-api";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = getTokenFromRequest(request);
  if (!token) {
    return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
  }

  const { id } = await params;
  try {
    const res = await backendFetch(`/admin/clients/${id}/manychat-webhook`, {
      method: "POST",
      token,
    });
    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    console.error("Error generating ManyChat webhook in BFF:", error);
    return NextResponse.json({ detail: "Internal Server Error" }, { status: 500 });
  }
}

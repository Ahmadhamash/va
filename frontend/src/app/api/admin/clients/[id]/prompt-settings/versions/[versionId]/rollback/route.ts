import { NextResponse } from "next/server";
import { backendFetch, getTokenFromRequest } from "@/lib/backend-api";

interface RouteContext {
  params: Promise<{ id: string; versionId: string }>;
}

export async function POST(request: Request, { params }: RouteContext) {
  const token = getTokenFromRequest(request);
  if (!token) {
    return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
  }
  const { id, versionId } = await params;
  const res = await backendFetch(
    `/admin/clients/${id}/prompt-settings/versions/${versionId}/rollback`,
    {
      method: "POST",
      token,
      body: {},
    },
  );
  const data = await res.json().catch(() => ({}));
  return NextResponse.json(data, { status: res.status });
}

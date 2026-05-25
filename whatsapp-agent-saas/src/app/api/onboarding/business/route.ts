import { NextResponse } from "next/server";
import { backendFetch, getTokenFromRequest } from "@/lib/backend-api";

export async function POST(request: Request) {
  const token = getTokenFromRequest(request);
  const body = await request.json();

  if (!token) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const res = await backendFetch("/auth/me", {
      method: "PUT",
      body: { 
        business_name: body.name,
        business_type: body.industry
      },
      token
    });

    if (!res.ok) {
        return NextResponse.json({ ok: false, error: "Failed to update business profile" }, { status: res.status });
    }
    
    const user = await res.json();
    return NextResponse.json({
        ok: true,
        business: {
            id: user.id,
            name: user.business_name,
            industry: user.business_type,
            createdAt: user.created_at
        }
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ ok: false, error: "Internal Error" }, { status: 500 });
  }
}

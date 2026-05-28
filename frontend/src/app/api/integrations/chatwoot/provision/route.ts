import { NextResponse } from "next/server";
import { backendFetch, getTokenFromRequest } from "@/lib/backend-api";

export async function POST(request: Request) {
  const token = getTokenFromRequest(request);
  if (!token) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const res = await backendFetch("/channels/chatwoot/provision", {
      method: "POST",
      token
    });
    
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return NextResponse.json({ ok: false, error: data.detail || "Failed to provision Chatwoot account" }, { status: res.status });
    }
    
    const updatedUser = await res.json();
    return NextResponse.json({
      ok: true,
      user: updatedUser,
      message: "تم تفعيل وتجهيز حساب Chatwoot بنجاح!"
    });
  } catch (err) {
    console.error("Error provisioning Chatwoot:", err);
    return NextResponse.json({ ok: false, error: "Internal Server Error" }, { status: 500 });
  }
}

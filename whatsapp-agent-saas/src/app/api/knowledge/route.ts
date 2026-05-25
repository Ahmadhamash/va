import { NextResponse } from "next/server";
import { backendFetch, getTokenFromRequest } from "@/lib/backend-api";

export async function GET(request: Request) {
  const token = getTokenFromRequest(request);
  if (!token) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const res = await backendFetch("/policies", { token });
    if (!res.ok) {
        return NextResponse.json({ ok: false, error: "Failed to fetch policies" }, { status: res.status });
    }
    const policies = await res.json();
    const knowledge = policies.map((p: Record<string, unknown>) => ({
      id: p.id,
      title: p.title,
      body: p.content,
      category: p.policy_type || "عام",
    }));
    return NextResponse.json({ ok: true, knowledge });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const token = getTokenFromRequest(request);
  if (!token) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const body = await request.json();

  try {
    const res = await backendFetch("/policies", {
      method: "POST",
      body: {
        policy_type: body.category || "general",
        title: body.title,
        content: body.body,
        is_active: true,
      },
      token,
    });
    if (!res.ok) {
        return NextResponse.json({ ok: false, error: "Failed to create policy" }, { status: res.status });
    }
    const policy = await res.json();
    return NextResponse.json({ ok: true, knowledgeItem: policy });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 });
  }
}

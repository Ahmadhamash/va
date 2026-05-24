import { NextResponse } from "next/server";
import { backendFetch, getTokenFromRequest } from "@/lib/backend-api";
import { mockKnowledge } from "@/lib/mock-data";

export async function GET(request: Request) {
  const token = getTokenFromRequest(request);
  if (!token) {
    return NextResponse.json({ ok: true, knowledge: mockKnowledge });
  }

  try {
    const res = await backendFetch("/policies", { token });
    if (res.ok) {
      const policies = await res.json();
      const knowledge = policies.map((p: Record<string, unknown>) => ({
        id: p.id,
        title: p.title,
        body: p.content,
        category: p.policy_type || "\u0639\u0627\u0645",
      }));
      return NextResponse.json({ ok: true, knowledge });
    }
  } catch {
    // Fall back
  }
  return NextResponse.json({ ok: true, knowledge: mockKnowledge });
}

export async function POST(request: Request) {
  const token = getTokenFromRequest(request);
  const body = await request.json();

  if (!token) {
    return NextResponse.json({
      ok: true,
      knowledgeItem: { id: "kn_" + Date.now(), ...body, createdAt: new Date().toISOString() },
    });
  }

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
    if (res.ok) {
      const policy = await res.json();
      return NextResponse.json({ ok: true, knowledgeItem: policy });
    }
  } catch {
    // Fall back
  }
  return NextResponse.json({
    ok: true,
    knowledgeItem: { id: "kn_" + Date.now(), ...body, createdAt: new Date().toISOString() },
  });
}

import { NextResponse } from "next/server";
import { backendFetch, getTokenFromRequest } from "@/lib/backend-api";

function mapKnowledgeItem(policy: Record<string, unknown>) {
  return {
    id: policy.id,
    title: policy.title,
    body: policy.content,
    category: policy.policy_type || "عام",
  };
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const token = getTokenFromRequest(request);
  const { id } = await params;

  if (!token) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const res = await backendFetch(`/policies/${id}`, {
      method: "DELETE",
      token,
    });
    if (!res.ok) {
      return NextResponse.json({ ok: false, error: "Failed to delete knowledge item" }, { status: res.status });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const token = getTokenFromRequest(request);
  const { id } = await params;

  if (!token) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();

  try {
    const res = await backendFetch(`/policies/${id}`, {
      method: "PUT",
      body: {
        policy_type: body.category || "general",
        title: body.title,
        content: body.body,
        is_active: true,
      },
      token,
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return NextResponse.json({ ok: false, error: data.detail || "Failed to update knowledge item" }, { status: res.status });
    }
    const policy = await res.json();
    return NextResponse.json({ ok: true, knowledgeItem: mapKnowledgeItem(policy) });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 });
  }
}

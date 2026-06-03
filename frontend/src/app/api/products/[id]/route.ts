import { NextResponse } from "next/server";
import { backendFetch, getTokenFromRequest } from "@/lib/backend-api";

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const token = getTokenFromRequest(request);
  const { id } = await params;

  if (!token) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const res = await backendFetch(`/items/${id}`, {
      method: "DELETE",
      token,
    });
    if (!res.ok) {
      return NextResponse.json({ ok: false, error: "Failed to delete item" }, { status: res.status });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ ok: false, error: "Internal Error" }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const token = getTokenFromRequest(request);
  const { id } = await params;

  if (!token) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const res = await backendFetch(`/items/${id}/toggle`, {
      method: "PATCH",
      token,
    });
    if (!res.ok) {
      return NextResponse.json({ ok: false, error: "Failed to toggle item availability" }, { status: res.status });
    }
    const item = await res.json();
    return NextResponse.json({ 
      ok: true, 
      product: {
        ...item,
        id: item.id,
        name: item.name,
        price: String(item.price),
        available: item.available !== false,
        description: item.description || "",
        category: item.category || "",
        currency: item.currency || "USD",
        image_url: item.image_url || "",
        metadata: item.metadata || item.item_metadata || {},
        warranty_duration: item.warranty_duration || "",
        warranty_terms: item.warranty_terms || "",
        warranty_coverage: item.warranty_coverage || "",
        warranty_exclusions: item.warranty_exclusions || "",
        stock_quantity: item.stock_quantity ?? "",
        stock_status: item.stock_status || "in_stock"
      } 
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ ok: false, error: "Internal Error" }, { status: 500 });
  }
}

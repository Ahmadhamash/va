import { NextResponse } from "next/server";
import { backendFetch, getTokenFromRequest } from "@/lib/backend-api";

function mapProduct(item: Record<string, any>) {
  return {
    ...item,
    id: item.id,
    name: item.name,
    price: item.price == null ? "" : String(item.price),
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
    stock_status: item.stock_status || "in_stock",
  };
}

export async function GET(request: Request) {
  const token = getTokenFromRequest(request);
  if (!token) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const res = await backendFetch("/items", { token });
    if (!res.ok) {
      return NextResponse.json({ ok: false, error: "Failed to fetch items" }, { status: res.status });
    }
    const products = (await res.json()).map(mapProduct);
    return NextResponse.json({ ok: true, products });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ ok: false, error: "Internal Error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const token = getTokenFromRequest(request);
  if (!token) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const body = await request.json();

  try {
    const res = await backendFetch("/items", {
      method: "POST",
      body: {
        name: body.name,
        description: body.description || "",
        price: body.price === "" || body.price == null ? null : Number(body.price),
        currency: body.currency || "JOD",
        category: body.category || "عام",
        available: body.available !== false,
        image_url: body.image_url || null,
        metadata: body.metadata || {},
        warranty_duration: body.warranty_duration || null,
        warranty_terms: body.warranty_terms || null,
        warranty_coverage: body.warranty_coverage || null,
        warranty_exclusions: body.warranty_exclusions || null,
        stock_quantity: body.stock_quantity === "" || body.stock_quantity == null ? null : Number(body.stock_quantity),
        stock_status: body.stock_status || "in_stock",
      },
      token,
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return NextResponse.json({ ok: false, error: data.detail || "Failed to create item" }, { status: res.status });
    }
    const item = await res.json();
    return NextResponse.json({ ok: true, product: mapProduct(item) });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ ok: false, error: "Internal Error" }, { status: 500 });
  }
}

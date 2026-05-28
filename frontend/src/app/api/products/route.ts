import { NextResponse } from "next/server";
import { backendFetch, getTokenFromRequest } from "@/lib/backend-api";

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
    const items = await res.json();
    const products = items.map((item: Record<string, unknown>) => ({
      id: item.id,
      name: item.name,
      price: item.price ? String(item.price) : "0",
      available: item.is_available !== false,
      description: item.description || "",
      category: item.category || "",
    }));
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
        price: parseFloat(body.price) || 0,
        category: body.category || "عام",
      },
      token,
    });
    
    if (!res.ok) {
        return NextResponse.json({ ok: false, error: "Failed to create item" }, { status: res.status });
    }
    const item = await res.json();
    return NextResponse.json({ ok: true, product: item });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ ok: false, error: "Internal Error" }, { status: 500 });
  }
}

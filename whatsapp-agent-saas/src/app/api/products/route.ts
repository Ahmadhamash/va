import { NextResponse } from "next/server";
import { backendFetch, getTokenFromRequest } from "@/lib/backend-api";
import { mockProducts } from "@/lib/mock-data";

export async function GET(request: Request) {
  const token = getTokenFromRequest(request);
  if (!token) {
    return NextResponse.json({ ok: true, products: mockProducts });
  }

  try {
    const res = await backendFetch("/items", { token });
    if (res.ok) {
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
    }
  } catch {
    // Fall back to mock
  }
  return NextResponse.json({ ok: true, products: mockProducts });
}

export async function POST(request: Request) {
  const token = getTokenFromRequest(request);
  const body = await request.json();

  if (!token) {
    return NextResponse.json({
      ok: true,
      product: { id: "prod_" + Date.now(), available: true, ...body },
    });
  }

  try {
    const res = await backendFetch("/items", {
      method: "POST",
      body: {
        name: body.name,
        description: body.description || "",
        price: parseFloat(body.price) || 0,
        category: body.category || "\u0639\u0627\u0645",
      },
      token,
    });
    if (res.ok) {
      const item = await res.json();
      return NextResponse.json({ ok: true, product: item });
    }
  } catch {
    // Fall back
  }
  return NextResponse.json({
    ok: true,
    product: { id: "prod_" + Date.now(), available: true, ...body },
  });
}

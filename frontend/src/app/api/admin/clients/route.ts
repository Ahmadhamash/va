import { NextResponse } from "next/server";
import { backendFetch, getTokenFromRequest } from "@/lib/backend-api";

export async function GET(request: Request) {
  const token = getTokenFromRequest(request);
  if (!token) {
    return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
  }
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") || "";
  try {
    const path = q ? `/admin/clients?q=${encodeURIComponent(q)}` : "/admin/clients";
    const res = await backendFetch(path, { token });
    if (!res.ok) {
      return NextResponse.json({ detail: "Failed to fetch clients" }, { status: res.status });
    }
    const data = await res.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Error fetching clients in BFF:", error);
    return NextResponse.json({ detail: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const token = getTokenFromRequest(request);
  if (!token) {
    return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
  }
  try {
    const body = await request.json();
    const res = await backendFetch("/admin/clients", {
      method: "POST",
      token,
      body,
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error: any) {
    console.error("Error creating client in BFF:", error);
    return NextResponse.json({ detail: "Internal Server Error" }, { status: 500 });
  }
}

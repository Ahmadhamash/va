import { NextResponse } from "next/server";
import { backendFetch } from "@/lib/backend-api";

export async function POST(request: Request) {
  const body = await request.json();
  const res = await backendFetch("/auth/login", { method: "POST", body });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}

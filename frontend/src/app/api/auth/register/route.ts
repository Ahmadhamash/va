import { NextResponse } from "next/server";
import { backendFetch } from "@/lib/backend-api";

export async function POST(request: Request) {
  const body = await request.json();
  const res = await backendFetch("/auth/register", { method: "POST", body });
  const data = await res.json();
  const nextRes = NextResponse.json(data, { status: res.status });
  const setCookie = res.headers.get("set-cookie");
  if (setCookie) {
    nextRes.headers.append("set-cookie", setCookie);
  }
  return nextRes;
}

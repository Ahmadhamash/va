import { NextResponse } from "next/server";
import { backendFetch } from "@/lib/backend-api";

export async function POST(request: Request) {
  const res = await backendFetch("/auth/refresh", {
    method: "POST",
    headers: {
      Cookie: request.headers.get("cookie") || "",
    },
  });
  const data = await res.json().catch(() => ({}));
  const nextRes = NextResponse.json(data, { status: res.status });
  const setCookie = res.headers.get("set-cookie");
  if (setCookie) {
    nextRes.headers.append("set-cookie", setCookie);
  }
  return nextRes;
}

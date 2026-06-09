import { NextResponse } from "next/server";
import { backendFetch } from "@/lib/backend-api";

export async function GET() {
  try {
    const res = await backendFetch("/business-types");
    const data = await res.json().catch(() => []);
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    console.error("Error fetching business types in BFF:", error);
    return NextResponse.json([], { status: 500 });
  }
}

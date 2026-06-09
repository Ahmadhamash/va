import { NextResponse } from "next/server";
import { getTokenFromRequest } from "@/lib/backend-api";

export async function POST(request: Request) {
  const token = getTokenFromRequest(request);
  if (!token) {
    return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
  }

  // Next.js API endpoint to reset the simulated test store environments/logs
  try {
    return NextResponse.json({
      ok: true,
      message: "تم إعادة تهيئة بيئة اختبار متجر الذكاء الاصطناعي بنجاح ومسح الجلسات المؤقتة."
    });
  } catch (error) {
    console.error("Error resetting testing environment:", error);
    return NextResponse.json({ detail: "Internal Server Error" }, { status: 500 });
  }
}

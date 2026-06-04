import { NextResponse } from "next/server";
import { backendFetch, getTokenFromRequest } from "@/lib/backend-api";

export async function POST(request: Request) {
  try {
    const token = getTokenFromRequest(request);
    
    // Forward the POST request to the backend /auth/logout endpoint
    // It returns 204 No Content
    const res = await backendFetch("/auth/logout", {
      method: "POST",
      token: token || undefined,
    });
    
    // We return a 200/204 to the client to confirm successful proxy
    if (res.ok) {
      return new NextResponse(null, { status: 204 });
    }
    
    return NextResponse.json(
      { detail: "Logout failed on backend" }, 
      { status: res.status }
    );
  } catch (error: any) {
    console.error("Error logging out in BFF:", error);
    return NextResponse.json({ detail: "Internal Server Error" }, { status: 500 });
  }
}

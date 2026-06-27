import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    service: "Phantom Reach API",
    version: "0.1.0",
    timestamp: new Date().toISOString(),
    endpoints: [
      "POST /api/audit",
      "GET /api/report/[id]",
      "GET /api/health",
    ],
  });
}

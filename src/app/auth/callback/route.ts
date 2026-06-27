import { NextRequest, NextResponse } from "next/server";

export function GET(request: NextRequest) {
  const next = request.nextUrl.searchParams.get("next");
  const targetPath = next?.startsWith("/") ? next : "/audits";
  return NextResponse.redirect(new URL(targetPath, request.url));
}

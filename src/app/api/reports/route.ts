import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRouteUser } from "@/lib/auth/route";

export const dynamic = "force-dynamic";

/**
 * GET /api/reports?type=audit|scout
 *
 * Returns all reports for the current user, optionally filtered by type.
 * Used by the audits and scouts listing pages.
 */
export async function GET(request: NextRequest) {
  try {
    const { user, response } = await requireRouteUser();
    if (response) {
      return response;
    }

    const reports = await db.getReportsByUser(user.id);

    const typeFilter = request.nextUrl.searchParams.get("type");
    const filtered = typeFilter
      ? reports.filter((r) => r.type === typeFilter)
      : reports;

    return NextResponse.json(filtered);
  } catch (err: any) {
    return NextResponse.json(
      { error: "Failed to fetch reports", message: err.message },
      { status: 500 }
    );
  }
}

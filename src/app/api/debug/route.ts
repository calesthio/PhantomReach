import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRouteUser } from "@/lib/auth/route";

/**
 * GET /api/debug — Dev-only diagnostic endpoint.
 * Shows: current user, all reports, user_id matches, and credits.
 * Hit this in the browser to diagnose missing reports.
 */
export async function GET() {
  if (process.env.ENABLE_DEBUG_API !== "true") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const { user, response } = await requireRouteUser();
    if (response) {
      return response;
    }

    const reports = await db.getReportsByUser(user.id);
    const audits = reports.filter(r => r.type === "audit");
    const scouts = reports.filter(r => r.type === "scout");

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        plan: user.plan,
        audit_credits: user.audit_credits_remaining,
        scout_credits: user.scout_credits_remaining,
      },
      reports: {
        total: reports.length,
        audits: audits.length,
        scouts: scouts.length,
        list: reports.map(r => ({
          id: r.id,
          type: r.type,
          status: r.status,
          user_id: r.user_id,
          user_id_matches: r.user_id === user.id,
          businessName: (r.input as any)?.businessName || "unknown",
          created_at: r.created_at,
        })),
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

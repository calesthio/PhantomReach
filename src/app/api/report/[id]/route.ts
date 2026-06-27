import { NextRequest, NextResponse } from "next/server";
import { requireOwnedReport, requireRouteUser } from "@/lib/auth/route";
import { sanitizeAuditResultContent } from "@/lib/reports/content-contract";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { user, response } = await requireRouteUser();
  if (response) {
    return response;
  }

  const ownedReport = await requireOwnedReport(id, user.id);
  if (ownedReport.response) {
    return ownedReport.response;
  }

  const report = ownedReport.report;
  const sanitizedReport = report.result && report.type === "audit"
    ? { ...report, result: sanitizeAuditResultContent(report.result as any) }
    : report;

  return NextResponse.json(sanitizedReport);
}

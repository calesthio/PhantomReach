import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import type { Report, User } from "@/lib/db/types";
import { getLocalWorkspaceUser } from "./local-workspace";

export async function requireRouteUser(): Promise<
  | { user: User; response?: never }
  | { user?: never; response: NextResponse }
> {
  const user = await getLocalWorkspaceUser();
  return { user };
}

export async function requireOwnedReport(
  reportId: string,
  userId: string,
): Promise<
  | { report: Report; response?: never }
  | { report?: never; response: NextResponse }
> {
  const report = await db.getReport(reportId);

  if (!report) {
    return {
      response: NextResponse.json({ error: "Report not found" }, { status: 404 }),
    };
  }

  if (report.user_id !== userId) {
    return {
      response: NextResponse.json({ error: "Report not found" }, { status: 404 }),
    };
  }

  return { report };
}

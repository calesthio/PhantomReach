import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireRouteUser } from "@/lib/auth/route";
import { runAuditPipeline } from "@/lib/agents/orchestrator";

export const dynamic = "force-dynamic";

const auditRequestSchema = z.object({
  businessName: z.string().min(1, "Business name is required"),
  city: z.string().optional(),
  state: z.string().optional(),
  url: z.string().url().optional().or(z.literal("")),
  googleMapsUrl: z.string().url().optional().or(z.literal("")),
  customDirection: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = auditRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const input = parsed.data;
    const { user, response } = await requireRouteUser();
    if (response) {
      return response;
    }

    const userId = user.id;

    if (user.audit_credits_remaining <= 0) {
      return NextResponse.json(
        { error: "No audit credits remaining. Please upgrade your plan." },
        { status: 403 }
      );
    }

    // Create report record via unified DB
    const report = await db.createReport({
      user_id: userId,
      type: "audit",
      input: {
        businessName: input.businessName,
        city: input.city,
        state: input.state,
        url: input.url || undefined,
        googleMapsUrl: input.googleMapsUrl || undefined,
        customDirection: input.customDirection || undefined,
      },
    });

    // Track usage
    await db.trackUsage({
      user_id: userId,
      action: "audit",
      credits_consumed: 1,
    });

    // Fire-and-forget the pipeline so the client gets the
    // reportId immediately and can redirect to the progress tracker page.
    // The audit page polls /api/report/{id} until status flips to completed.
    await db.updateReport(report.id, { status: "processing" });

    // Run pipeline in background — DO NOT await
    runAuditPipeline({
      businessName: input.businessName,
      city: input.city,
      state: input.state,
      url: input.url || undefined,
      googleMapsUrl: input.googleMapsUrl || undefined,
      customDirection: input.customDirection || undefined,
    })
      .then(async ({ result, scores }) => {
        await db.updateReport(report.id, {
          status: "completed",
          result,
          scores,
        });
        console.log(`[api/audit] Pipeline completed for report ${report.id}`);
      })
      .catch(async (pipelineError: any) => {
        await db.updateReport(report.id, {
          status: "failed",
        });
        console.error(`[api/audit] Pipeline failed for report ${report.id}:`, pipelineError.message);
      });

    // Return immediately so the client can navigate to the progress page
    return NextResponse.json({
      reportId: report.id,
      status: "processing",
      async: false,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Internal server error", message: err.message },
      { status: 500 }
    );
  }
}

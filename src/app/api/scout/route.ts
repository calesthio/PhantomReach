import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireRouteUser } from "@/lib/auth/route";
import { runScoutPipeline } from "@/lib/agents/scout-orchestrator";

export const dynamic = "force-dynamic";

const scoutRequestSchema = z.object({
  city: z.string().min(1, "City is required"),
  category: z.string().min(1, "Business category is required"),
  resultCount: z.number().min(5).max(100).default(10),
  customDirection: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = scoutRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { user, response } = await requireRouteUser();
    if (response) {
      return response;
    }

    const input = parsed.data;
    const userId = user.id;

    if (user.scout_credits_remaining <= 0) {
      return NextResponse.json(
        { error: "No scout credits remaining. Please upgrade your plan." },
        { status: 403 }
      );
    }

    const report = await db.createReport({
      user_id: userId,
      type: "scout",
      input: {
        city: input.city,
        category: input.category,
        resultCount: input.resultCount,
        customDirection: input.customDirection,
      },
    });

    await db.trackUsage({
      user_id: userId,
      action: "scout",
      credits_consumed: 1,
    });

    await db.updateReport(report.id, { status: "processing" });

    try {
      // TODO(scaling): This pipeline currently executes synchronously on the Vercel edge/serverless function.
      // If the LLM takes over 10s (Free) or 60s (Pro), Vercel will kill this process with a 504 Gateway Timeout.
      // We should dispatch this to Inngest (like we do in the `/api/audit` route) so it runs durably in the background.
      const { result } = await runScoutPipeline({
        city: input.city,
        category: input.category,
        resultCount: input.resultCount,
        customDirection: input.customDirection,
      });

      await db.updateReport(report.id, {
        status: "completed",
        result,
        scores: {
          overall_grade: result.avg_digital_maturity >= 70 ? "A" : result.avg_digital_maturity >= 50 ? "B" : result.avg_digital_maturity >= 30 ? "C" : "D",
          overall_score: result.avg_digital_maturity,
          module_grades: {},
        },
      });

      return NextResponse.json({
        reportId: report.id,
        status: "completed",
        totalScanned: result.total_scanned,
        city: result.city,
        category: result.category,
      });
    } catch (pipelineError: any) {
      await db.updateReport(report.id, { status: "failed" });
      return NextResponse.json(
        { reportId: report.id, status: "failed", error: pipelineError.message },
        { status: 500 }
      );
    }
  } catch (err: any) {
    return NextResponse.json(
      { error: "Internal server error", message: err.message },
      { status: 500 }
    );
  }
}

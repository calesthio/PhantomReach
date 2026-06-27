import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireRouteUser } from "@/lib/auth/route";

export const dynamic = "force-dynamic";

const settingsUpdateSchema = z.object({
  company_name: z.string().optional(),
  logo_url: z.string().url().optional().or(z.literal("")),
  primary_color: z.string().optional(),
  secondary_color: z.string().optional(),
  contact_email: z.string().email().optional().or(z.literal("")),
  contact_phone: z.string().optional(),
});

export async function GET() {
  try {
    const { user, response } = await requireRouteUser();
    if (response) {
      return response;
    }

    return NextResponse.json({
      id: user.id,
      email: user.email,
      name: user.name,
      white_label_config: user.white_label_config || {},
      widget_api_key: user.widget_api_key,
      audit_credits_remaining: user.audit_credits_remaining,
      scout_credits_remaining: user.scout_credits_remaining,
    });
  } catch (error) {
    console.error("Settings GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch settings" },
      { status: 500 },
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = settingsUpdateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { user, response } = await requireRouteUser();
    if (response) {
      return response;
    }

    const updated = await db.updateUser(user.id, {
      white_label_config: {
        ...user.white_label_config,
        ...parsed.data,
      },
    });

    return NextResponse.json({
      id: updated?.id,
      email: updated?.email,
      name: updated?.name,
      white_label_config: updated?.white_label_config || {},
      widget_api_key: updated?.widget_api_key,
      message: "Settings updated successfully",
    });
  } catch (error) {
    console.error("Settings PUT error:", error);
    return NextResponse.json(
      { error: "Failed to update settings", details: String(error) },
      { status: 500 },
    );
  }
}

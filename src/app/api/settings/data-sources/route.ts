import { NextResponse } from "next/server";
import { listDataSources } from "@/lib/config/provider-config";

export async function GET() {
  try {
    const sources = await listDataSources();
    return NextResponse.json({ sources });
  } catch (error) {
    console.error("[data-sources] list failed:", error);
    return NextResponse.json(
      { error: "Failed to load data sources" },
      { status: 500 }
    );
  }
}

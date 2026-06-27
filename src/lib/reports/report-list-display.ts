import type { ReportStatus } from "@/lib/db/types";

export function reportListActionLabel(status: ReportStatus): string {
  if (status === "completed") return "View Report";
  if (status === "failed") return "Failed";
  return "Processing...";
}

export function reportStatusBadgeClass(status: ReportStatus): string {
  if (status === "completed") return "bg-emerald-100 text-emerald-800 hover:bg-emerald-100";
  if (status === "failed") return "bg-red-100 text-red-800 hover:bg-red-100";
  return "";
}

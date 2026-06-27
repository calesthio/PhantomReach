import type { ExecutiveSummaryData, RevenueImpactResult } from "@/lib/db/types";

type RevenueBasis = NonNullable<RevenueImpactResult["revenue_basis"]>;

const VERIFIED_REVENUE_BASES: RevenueBasis[] = ["verified_public", "user_provided"];

export function shouldShowRevenueDollars(revenue?: Pick<RevenueImpactResult, "revenue_basis" | "show_revenue_dollars"> | null): boolean {
  if (!revenue) return false;
  if (!revenue.revenue_basis || !VERIFIED_REVENUE_BASES.includes(revenue.revenue_basis)) return false;
  return revenue.show_revenue_dollars !== false;
}

export function revenueDisplayMode(revenue?: Pick<RevenueImpactResult, "revenue_basis" | "show_revenue_dollars"> | null): "dollars" | "signals" {
  return shouldShowRevenueDollars(revenue) ? "dollars" : "signals";
}

export function filterUnverifiedRevenueStats(
  stats: ExecutiveSummaryData["key_stats"] | undefined,
  revenue?: Pick<RevenueImpactResult, "revenue_basis" | "show_revenue_dollars"> | null
): ExecutiveSummaryData["key_stats"] {
  if (!Array.isArray(stats)) return [];
  if (shouldShowRevenueDollars(revenue)) return stats;

  return stats.filter((stat) => {
    const label = String(stat.label ?? "").toLowerCase();
    const value = String(stat.value ?? "");
    const looksLikeRevenueStat = /(revenue|leak|risk|at risk|impact|roi)/i.test(label);
    const hasCurrency = /\$|\/mo|annual/i.test(value);
    return !(looksLikeRevenueStat && hasCurrency);
  });
}

export function stripDollarClaims(text: string): string {
  return text
    .replace(/\$[\d,.]+(?:k|m)?(?:\s*-\s*\$?[\d,.]+(?:k|m)?)?(?:\/month|\/mo| monthly| annually| annual)?/gi, "a directional amount")
    .replace(/\b\d+(?:\.\d+)?%\s+of\s+the\s+monthly\s+revenue\s+baseline\b/gi, "a directional share of estimated revenue")
    .replace(/\brevenue leakage\b/gi, "business impact")
    .replace(/\bleakage\b/gi, "impact");
}

export function visibleRevenueFindings(
  findings: string[] | undefined,
  revenue?: Pick<RevenueImpactResult, "revenue_basis" | "show_revenue_dollars"> | null
): string[] {
  if (!Array.isArray(findings)) return [];
  if (shouldShowRevenueDollars(revenue)) return findings;
  return findings.map(stripDollarClaims);
}

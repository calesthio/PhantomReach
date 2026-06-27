import type {
  AIAnalysisResult,
  AuditResult,
  EnhancedRecommendation,
  ExecutiveSummaryData,
  Recommendation,
} from "@/lib/db/types";
import { filterClientFacingReportItems, isClientFacingReportItem } from "@/lib/reports/content-quality";
import { humanizeModuleKey, humanizeModuleReferences } from "@/lib/reports/display-labels";
import {
  filterUnverifiedRevenueStats,
  shouldShowRevenueDollars,
  stripDollarClaims,
  visibleRevenueFindings,
} from "@/lib/reports/revenue-display";

function cleanGeneratedText(value: string, showRevenueDollars: boolean): string {
  if (!isClientFacingReportItem(value)) return "";

  const revenueSafe = showRevenueDollars ? value : stripDollarClaims(value);
  const humanized = humanizeModuleReferences(revenueSafe)
    .replace(/\bthis\s+module\b/gi, "this area")
    .replace(/\bthe\s+module\b/gi, "the area")
    .replace(/\bmodule\b/gi, "area")
    .replace(/\bthe\s+model\b/gi, "the analysis")
    .replace(/\bthis\s+model\b/gi, "this analysis")
    .replace(/\bthe\s+report\b/gi, "the analysis")
    .replace(/\bthis\s+report\b/gi, "this analysis")
    .replace(/\breported\s+total\b/gi, "estimated")
    .replace(/\brevenue\s+leakage\b/gi, "business impact")
    .replace(/\bleakage\b/gi, "impact")
    .replace(/\bfull\s+directory\s+audit\b/gi, "dedicated directory scan")
    .replace(/\bfull\s+review\s+corpus\b/gi, "larger review sample")
    .replace(/\bROI\b/g, showRevenueDollars ? "ROI" : "business impact")
    .replace(/\s+/g, " ")
    .trim();

  return isClientFacingReportItem(humanized) ? humanized : "";
}

function cleanStringArray(values: string[] | undefined, showRevenueDollars: boolean): string[] {
  if (!Array.isArray(values)) return [];
  const cleaned = values
    .map((value) => cleanGeneratedText(String(value), showRevenueDollars))
    .filter(Boolean);
  return filterClientFacingReportItems(cleaned);
}

function cleanGeneratedValue<T>(value: T, showRevenueDollars: boolean): T {
  if (typeof value === "string") {
    return cleanGeneratedText(value, showRevenueDollars) as T;
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => cleanGeneratedValue(item, showRevenueDollars))
      .filter((item) => {
        if (typeof item === "string") return item.length > 0;
        return item !== null && item !== undefined;
      }) as T;
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => {
        if (key === "module") return [key, humanizeModuleKey(String(item))];
        if (key === "modules_involved" || key === "involved_modules") {
          return [key, Array.isArray(item) ? item.map((module) => humanizeModuleKey(String(module))) : item];
        }
        if (/^modules_with_/.test(key)) {
          return [key, Array.isArray(item) ? item.map((module) => humanizeModuleKey(String(module))) : item];
        }
        return [key, cleanGeneratedValue(item, showRevenueDollars)];
      })
    ) as T;
  }

  return value;
}

export function sanitizeExecutiveSummaryContent(
  summary: AuditResult["executive_summary"],
  revenue: AuditResult["revenue_impact"]
): AuditResult["executive_summary"] {
  const showRevenueDollars = shouldShowRevenueDollars(revenue);

  if (typeof summary === "string") {
    return cleanGeneratedText(summary, showRevenueDollars);
  }

  const prefilteredSummary = {
    ...summary,
    key_stats: filterUnverifiedRevenueStats(summary.key_stats, revenue),
    key_data_points: summary.key_data_points
      ? filterUnverifiedRevenueStats(summary.key_data_points, revenue)
      : summary.key_data_points,
  };
  const cleaned = cleanGeneratedValue(prefilteredSummary, showRevenueDollars) as ExecutiveSummaryData;
  cleaned.key_stats = filterUnverifiedRevenueStats(cleaned.key_stats, revenue);
  if (cleaned.key_data_points) {
    cleaned.key_data_points = filterUnverifiedRevenueStats(cleaned.key_data_points, revenue);
  }
  return cleaned;
}

export function sanitizeAIAnalysisContent(
  analysis: AIAnalysisResult | undefined,
  revenue: AuditResult["revenue_impact"]
): AIAnalysisResult | undefined {
  if (!analysis) return undefined;
  return cleanGeneratedValue(analysis, shouldShowRevenueDollars(revenue));
}

export function sanitizeEnhancedRecommendations(
  recommendations: EnhancedRecommendation[] | undefined,
  revenue: AuditResult["revenue_impact"]
): EnhancedRecommendation[] | undefined {
  if (!recommendations) return undefined;
  return cleanGeneratedValue(recommendations, shouldShowRevenueDollars(revenue));
}

export function sanitizeRecommendations(
  recommendations: Recommendation[] | undefined,
  revenue: AuditResult["revenue_impact"]
): Recommendation[] {
  if (!recommendations) return [];
  return cleanGeneratedValue(recommendations, shouldShowRevenueDollars(revenue));
}

export function sanitizeAuditResultContent(result: AuditResult): AuditResult {
  const revenue = result.revenue_impact;
  const showRevenueDollars = shouldShowRevenueDollars(revenue);
  const sanitizedRevenue = revenue
    ? {
        ...revenue,
        findings: showRevenueDollars ? cleanStringArray(revenue.findings, true) : visibleRevenueFindings(revenue.findings, revenue),
        recommendations: cleanStringArray(revenue.recommendations, showRevenueDollars),
        leaks: revenue.leaks.map((leak) => ({
          ...leak,
          category: cleanGeneratedText(leak.category, showRevenueDollars) || leak.category,
          description: cleanGeneratedText(leak.description, showRevenueDollars),
          contributing_factors: cleanStringArray(leak.contributing_factors, showRevenueDollars),
        })),
        roi_if_fixed: showRevenueDollars ? cleanGeneratedText(revenue.roi_if_fixed, true) : "",
        opportunity_assessment: revenue.opportunity_assessment
          ? cleanGeneratedValue(revenue.opportunity_assessment, showRevenueDollars)
          : revenue.opportunity_assessment,
      }
    : undefined;

  return {
    ...result,
    executive_summary: sanitizeExecutiveSummaryContent(result.executive_summary, sanitizedRevenue),
    revenue_impact: sanitizedRevenue,
    business_enrichment: result.business_enrichment
      ? cleanGeneratedValue(result.business_enrichment, showRevenueDollars)
      : undefined,
    recommendations: sanitizeRecommendations(result.recommendations, sanitizedRevenue),
    ai_analysis: sanitizeAIAnalysisContent(result.ai_analysis, sanitizedRevenue),
    enhanced_recommendations: sanitizeEnhancedRecommendations(result.enhanced_recommendations, sanitizedRevenue),
  };
}

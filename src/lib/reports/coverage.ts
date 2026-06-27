import type { AuditResult, EvidenceModuleKey, EvidenceStatus } from "@/lib/db/types";

export type CoverageKind = "checked" | "sampled" | "not_checked";
export type CoverageConfidence = "high" | "medium" | "low";

export interface AuditCoverageItem {
  key: EvidenceModuleKey;
  label: string;
  coverage: CoverageKind;
  confidence: CoverageConfidence;
  detail: string;
}

export interface AuditCoverageSummary {
  counts: Record<"checked" | "sampled" | "notChecked", number>;
  confidence: {
    label: "Strong" | "Directional" | "Limited";
    detail: string;
  };
  items: AuditCoverageItem[];
  notes: string[];
}

const AREA_LABELS: Partial<Record<EvidenceModuleKey, string>> = {
  gbp_health: "Google profile",
  review_sentiment: "Reviews",
  website_performance: "Website",
  tech_stack: "Tech stack",
  social_presence: "Social",
  citation_consistency: "Directories",
  competitive_comparison: "Competition",
  revenue_impact: "Business impact",
  business_intelligence: "Business signals",
  business_enrichment: "Business context",
};

function evidenceStatus(result: AuditResult, key: EvidenceModuleKey): EvidenceStatus | undefined {
  return result.evidence?.modules.find((module) => module.key === key)?.status;
}

function hasCollected(result: AuditResult, key: EvidenceModuleKey): boolean {
  return evidenceStatus(result, key) === "collected";
}

function notCheckedItem(key: EvidenceModuleKey, detail: string): AuditCoverageItem {
  return {
    key,
    label: AREA_LABELS[key] ?? key,
    coverage: "not_checked",
    confidence: "low",
    detail,
  };
}

function statusToNotCheckedDetail(status: EvidenceStatus | undefined): string {
  if (status === "unavailable") return "Needs setup before this area can be checked locally.";
  if (status === "failed") return "Attempted, but collection failed during this audit.";
  if (status === "skipped") return "Skipped because the required source was not available.";
  if (status === "not_implemented") return "Not available in the local app yet.";
  return "No source data was available for this audit.";
}

export function buildAuditCoverageSummary(result: AuditResult): AuditCoverageSummary {
  const items: AuditCoverageItem[] = [];

  if (result.gbp_health && hasCollected(result, "gbp_health")) {
    items.push({
      key: "gbp_health",
      label: "Google profile",
      coverage: "checked",
      confidence: result.gbp_health.review_count != null ? "high" : "medium",
      detail: "Checked current Google profile fields, rating, review count, photos, hours, and linked website.",
    });
  } else {
    items.push(notCheckedItem("gbp_health", statusToNotCheckedDetail(evidenceStatus(result, "gbp_health"))));
  }

  if (result.review_sentiment && hasCollected(result, "review_sentiment")) {
    items.push({
      key: "review_sentiment",
      label: "Reviews",
      coverage: "sampled",
      confidence: result.review_sentiment.google_review_count && result.review_sentiment.google_review_count >= 50 ? "medium" : "low",
      detail: "Checked rating, review volume, owner response, velocity, and sampled review themes.",
    });
  } else {
    items.push(notCheckedItem("review_sentiment", statusToNotCheckedDetail(evidenceStatus(result, "review_sentiment"))));
  }

  if (result.website_performance && hasCollected(result, "website_performance")) {
    items.push({
      key: "website_performance",
      label: "Website",
      coverage: "sampled",
      confidence: "medium",
      detail: "Checked a mobile PageSpeed and Core Web Vitals snapshot for the available URL.",
    });
  } else {
    items.push(notCheckedItem("website_performance", statusToNotCheckedDetail(evidenceStatus(result, "website_performance"))));
  }

  if (result.tech_stack && hasCollected(result, "tech_stack")) {
    items.push({
      key: "tech_stack",
      label: "Tech stack",
      coverage: "sampled",
      confidence: "medium",
      detail: "Checked homepage HTML and visible technology signals; this is not a backend inventory.",
    });
  } else if (result.tech_stack) {
    items.push(notCheckedItem("tech_stack", statusToNotCheckedDetail(evidenceStatus(result, "tech_stack"))));
  }

  if (result.social_presence && hasCollected(result, "social_presence")) {
    items.push({
      key: "social_presence",
      label: "Social",
      coverage: "sampled",
      confidence: result.social_presence.platforms_found > 0 ? "medium" : "low",
      detail: "Checked website-linked social profiles and visible activity signals, not all posting history.",
    });
  } else if (result.social_presence) {
    items.push(notCheckedItem("social_presence", statusToNotCheckedDetail(evidenceStatus(result, "social_presence"))));
  }

  const citationStatus = evidenceStatus(result, "citation_consistency");
  if (result.citation_consistency && hasCollected(result, "citation_consistency") && !result.citation_consistency.is_mock) {
    items.push({
      key: "citation_consistency",
      label: "Directories",
      coverage: "sampled",
      confidence: "medium",
      detail: "Checked available directory rows from the configured source.",
    });
  } else {
    items.push(notCheckedItem("citation_consistency", statusToNotCheckedDetail(citationStatus)));
  }

  if (result.competitive_comparison && hasCollected(result, "competitive_comparison")) {
    items.push({
      key: "competitive_comparison",
      label: "Competition",
      coverage: "sampled",
      confidence: result.competitive_comparison.agentic_reconciled ? "medium" : "low",
      detail: result.competitive_comparison.agentic_reconciled
        ? "Checked a category-aware peer shortlist gathered during research."
        : "Checked a nearby competitor sample; peer relevance may vary.",
    });
  } else if (result.competitive_comparison) {
    items.push(notCheckedItem("competitive_comparison", statusToNotCheckedDetail(evidenceStatus(result, "competitive_comparison"))));
  }

  if (result.revenue_impact && hasCollected(result, "revenue_impact")) {
    items.push({
      key: "revenue_impact",
      label: "Business impact",
      coverage: "sampled",
      confidence: result.revenue_impact.show_revenue_dollars ? "medium" : "low",
      detail: result.revenue_impact.show_revenue_dollars
        ? "Checked impact estimates against the available verified revenue basis."
        : "Checked qualitative impact signals only because revenue was not verified.",
    });
  }

  if (result.business_enrichment && hasCollected(result, "business_enrichment")) {
    const citedResearchCount = result.business_enrichment.research_findings.length;
    items.push({
      key: "business_enrichment",
      label: "Business context",
      coverage: citedResearchCount > 0 ? "sampled" : "checked",
      confidence: result.business_enrichment.facts.length > 0 ? "medium" : "low",
      detail: citedResearchCount > 0
        ? "Checked public facts and a cited research sample for business and market context."
        : "Checked deterministic public facts for business and market context.",
    });
  } else if (evidenceStatus(result, "business_enrichment")) {
    items.push(notCheckedItem("business_enrichment", statusToNotCheckedDetail(evidenceStatus(result, "business_enrichment"))));
  }

  const counts = {
    checked: items.filter((item) => item.coverage === "checked").length,
    sampled: items.filter((item) => item.coverage === "sampled").length,
    notChecked: items.filter((item) => item.coverage === "not_checked").length,
  };

  const confidence =
    counts.notChecked >= 3
      ? {
          label: "Limited" as const,
          detail: "Several sources were unavailable, so use this as a starting point for follow-up research.",
        }
      : counts.sampled > counts.checked
        ? {
            label: "Directional" as const,
            detail: "Enough source data exists to prioritize action, but several areas are snapshots or samples.",
          }
        : {
            label: "Strong" as const,
            detail: "Most available sources were checked directly for this audit.",
          };

  const notes = [
    "Website and competitor results are point-in-time snapshots.",
    "Review and social findings use sampled visible signals, not an all-time history.",
    counts.notChecked > 0
      ? "Expand the not-checked areas to see what needs setup or future local support."
      : "No local gaps were reported for the configured sources.",
  ];

  return { counts, confidence, items, notes };
}

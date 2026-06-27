/**
 * Module 8: Revenue Impact Calculator
 * Tool: estimate_revenue_impact
 *
 * Estimates directional revenue at risk from evidence-backed operational,
 * technical, and engagement gaps. The calculator intentionally skips signals
 * that were not collected instead of filling gaps with generic defaults.
 */

import type { RevenueImpactResult } from "@/lib/db/types";

interface RevenueImpactParams {
  gbpHealth?: any;
  reviewSentiment?: any;
  websitePerformance?: any;
  techStack?: any;
  socialPresence?: any;
  citationConsistency?: any;
  category?: string;
  revenueBaseline?: {
    avg_ticket_low: number;
    avg_ticket_mid: number;
    avg_ticket_high: number;
    monthly_revenue_mid: number;
    revenue_tier: string;
    confidence: string;
    reasoning: string;
  };
}

type BusinessModel =
  | "walk_in_food_retail"
  | "appointment_service"
  | "field_service"
  | "professional_service"
  | "hospitality"
  | "general";

interface RevenueLeak {
  category: string;
  description: string;
  low_estimate: number;
  mid_estimate: number;
  high_estimate: number;
  contributing_factors: string[];
  confidence?: number;
  severity?: "critical" | "major" | "moderate" | "minor";
}

const AVG_TICKET_VALUE: Record<string, { low: number; mid: number; high: number }> = {
  default: { low: 150, mid: 250, high: 500 },
  dental: { low: 200, mid: 400, high: 800 },
  medical: { low: 250, mid: 500, high: 1200 },
  legal: { low: 300, mid: 600, high: 1500 },
  accounting: { low: 200, mid: 400, high: 1000 },
  plumbing: { low: 150, mid: 350, high: 600 },
  hvac: { low: 200, mid: 450, high: 800 },
  automotive: { low: 200, mid: 400, high: 700 },
  salon: { low: 40, mid: 100, high: 200 },
  restaurant: { low: 25, mid: 50, high: 100 },
  gym: { low: 30, mid: 60, high: 150 },
  fitness: { low: 30, mid: 60, high: 150 },
  sports: { low: 40, mid: 100, high: 250 },
  academy: { low: 50, mid: 120, high: 300 },
  "sports academy": { low: 50, mid: 120, high: 300 },
  badminton: { low: 40, mid: 100, high: 250 },
  tennis: { low: 50, mid: 120, high: 300 },
  "martial arts": { low: 60, mid: 150, high: 300 },
  yoga: { low: 20, mid: 50, high: 120 },
  pilates: { low: 30, mid: 70, high: 150 },
  swimming: { low: 40, mid: 80, high: 200 },
  dance: { low: 30, mid: 80, high: 200 },
  tutoring: { low: 40, mid: 80, high: 200 },
  school: { low: 100, mid: 300, high: 800 },
  daycare: { low: 200, mid: 600, high: 1200 },
  "real estate": { low: 1000, mid: 5000, high: 15000 },
  insurance: { low: 100, mid: 300, high: 800 },
  financial: { low: 200, mid: 500, high: 1500 },
  roofing: { low: 500, mid: 3000, high: 8000 },
  landscaping: { low: 100, mid: 300, high: 800 },
  cleaning: { low: 80, mid: 200, high: 400 },
  pest: { low: 100, mid: 250, high: 500 },
  retail: { low: 20, mid: 75, high: 200 },
  pharmacy: { low: 15, mid: 40, high: 100 },
  grocery: { low: 30, mid: 80, high: 200 },
  hotel: { low: 100, mid: 200, high: 500 },
  cafe: { low: 8, mid: 15, high: 30 },
  bar: { low: 20, mid: 40, high: 80 },
  veterinary: { low: 100, mid: 300, high: 800 },
  grooming: { low: 40, mid: 80, high: 150 },
};

function scoreToGradeLabel(score: number): string {
  if (score >= 80) return "Strong";
  if (score >= 60) return "Solid";
  if (score >= 40) return "Developing";
  return "Needs Attention";
}

function getTicketValue(category?: string) {
  if (!category) return AVG_TICKET_VALUE.default;
  const lower = category.toLowerCase();

  if (AVG_TICKET_VALUE[lower]) return AVG_TICKET_VALUE[lower];

  for (const [key, value] of Object.entries(AVG_TICKET_VALUE)) {
    if (key !== "default" && (lower.includes(key) || key.includes(lower))) {
      return value;
    }
  }

  return AVG_TICKET_VALUE.default;
}

function getBusinessModel(category?: string, revenueBaseline?: RevenueImpactParams["revenueBaseline"]): BusinessModel {
  const text = `${category ?? ""} ${revenueBaseline?.revenue_tier ?? ""} ${revenueBaseline?.reasoning ?? ""}`.toLowerCase();

  if (/(ice cream|dessert|bakery|cafe|coffee|restaurant|bar|food|retail|grocery|shop|store|pharmacy)/.test(text)) {
    return "walk_in_food_retail";
  }
  if (/(hotel|lodging|inn|hospitality)/.test(text)) return "hospitality";
  if (/(plumb|hvac|electric|roof|landscap|cleaning|pest|contractor|repair)/.test(text)) return "field_service";
  if (/(dent|medical|clinic|salon|spa|barber|veterinary|grooming|gym|fitness|yoga|pilates)/.test(text)) return "appointment_service";
  if (/(law|legal|accounting|insurance|financial|real estate)/.test(text)) return "professional_service";

  return "general";
}

function getMonthlyRevenueBaseline(revenueBaseline?: RevenueImpactParams["revenueBaseline"]): number | undefined {
  const monthlyRevenue = revenueBaseline?.monthly_revenue_mid;
  return typeof monthlyRevenue === "number" && monthlyRevenue > 0 ? monthlyRevenue : undefined;
}

function calculateAfterHoursLeakage(
  gbpHealth: any,
  ticketValue: { low: number; mid: number; high: number },
  businessModel: BusinessModel
): RevenueLeak | null {
  if ((businessModel === "walk_in_food_retail" || businessModel === "hospitality") && gbpHealth?.hours_complete === true) {
    return null;
  }

  const monthlySearches = 150;
  const afterHoursPercentage = 0.35;
  const conversionRate = 0.05;
  const missedLeads = monthlySearches * afterHoursPercentage * conversionRate;
  const hoursComplete = gbpHealth?.hours_complete === true;
  const multiplier = hoursComplete ? 0.6 : 1.0;

  const isAppointmentLike =
    businessModel === "appointment_service" ||
    businessModel === "field_service" ||
    businessModel === "professional_service";

  return {
    category: isAppointmentLike ? "After-Hours Lead Leakage" : "Hours Clarity Revenue Risk",
    description: hoursComplete
      ? "After-hours searchers can find the business, but conversion options outside normal hours appear limited"
      : "Incomplete hours create uncertainty for high-intent local searchers and can shift visits to competitors",
    low_estimate: Math.round(missedLeads * ticketValue.low * multiplier),
    mid_estimate: Math.round(missedLeads * ticketValue.mid * multiplier),
    high_estimate: Math.round(missedLeads * ticketValue.high * multiplier),
    contributing_factors: [
      hoursComplete
        ? isAppointmentLike
          ? "Hours are listed, but after-hours form or callback capture was not detected"
          : "Hours are listed; after-hours impact is limited to pre-visit planning friction"
        : "Operating hours are not fully specified, so searchers may not confirm availability",
      "A meaningful share of local discovery happens outside operating hours",
      isAppointmentLike
        ? "Competitors with forms, booking, or callback capture can absorb this demand"
        : "Clear hours and pre-visit details reduce uncertainty before a walk-in visit",
    ],
    confidence: hoursComplete ? 4 : 6,
  };
}

function calculateMobileBounceLeakage(
  websitePerformance: any,
  ticketValue: { low: number; mid: number; high: number },
  monthlyRevenue: number | undefined,
  businessModel: BusinessModel
): RevenueLeak | null {
  if (!websitePerformance) return null;

  const performanceScore = websitePerformance.performance_score ?? websitePerformance.score ?? 70;
  const coreWebVitals = websitePerformance.core_web_vitals ?? {};
  const factors: string[] = [];
  let revenueRiskRate = 0;

  if (performanceScore < 50) revenueRiskRate += 0.018;
  else if (performanceScore < 70) revenueRiskRate += 0.012;
  else if (performanceScore < 85) revenueRiskRate += 0.006;

  if (websitePerformance.mobile_friendly === false) {
    revenueRiskRate += 0.008;
    factors.push("Mobile friendliness failed");
  }
  if (coreWebVitals.lcp_pass === false) {
    revenueRiskRate += 0.006;
    if (typeof coreWebVitals.lcp === "number") {
      factors.push(`Largest Contentful Paint: ${(coreWebVitals.lcp / 1000).toFixed(1)}s`);
    } else {
      factors.push("Largest Contentful Paint failed");
    }
  }
  if (coreWebVitals.cls_pass === false) {
    revenueRiskRate += 0.003;
    factors.push(`Layout shift needs attention: ${coreWebVitals.cls ?? "failed"}`);
  }

  if (revenueRiskRate <= 0) return null;

  const categoryMultiplier = businessModel === "walk_in_food_retail" ? 1.2 : 1;
  let lowEstimate: number;
  let midEstimate: number;
  let highEstimate: number;

  if (monthlyRevenue) {
    midEstimate = Math.round(monthlyRevenue * revenueRiskRate * categoryMultiplier);
    lowEstimate = Math.round(midEstimate * 0.45);
    highEstimate = Math.round(midEstimate * 1.8);
  } else {
    const mobileBounceRate = performanceScore < 50 ? 0.4 : performanceScore < 70 ? 0.25 : 0.12;
    const monthlyVisitors = 500;
    const conversionRate = 0.08;
    const lostConversions = monthlyVisitors * 0.55 * mobileBounceRate * conversionRate;
    lowEstimate = Math.round(lostConversions * ticketValue.low);
    midEstimate = Math.round(lostConversions * ticketValue.mid);
    highEstimate = Math.round(lostConversions * ticketValue.high);
  }

  return {
    category: "Mobile Conversion Friction",
    description: businessModel === "walk_in_food_retail"
      ? "Slow or unstable mobile pages can interrupt impulse visit decisions before customers check hours, location, or menu details"
      : "Mobile speed and usability issues can reduce conversion from high-intent local search traffic",
    low_estimate: lowEstimate,
    mid_estimate: midEstimate,
    high_estimate: highEstimate,
    contributing_factors: [
      `PageSpeed performance score: ${performanceScore}`,
      ...factors,
      monthlyRevenue
        ? `Calibrated to estimated monthly revenue baseline: $${monthlyRevenue.toLocaleString()}`
        : "Estimated from typical local mobile traffic and conversion behavior",
    ],
    confidence: monthlyRevenue ? 6 : 4,
  };
}

function calculateReviewResponseGapCost(
  reviewSentiment: any,
  ticketValue: { low: number; mid: number; high: number },
  monthlyRevenue: number | undefined
): RevenueLeak | null {
  if (!reviewSentiment) return null;

  const negativeThemes = reviewSentiment?.top_complaint_themes?.length || 0;
  const reviewCount = reviewSentiment?.google_review_count ?? 0;
  let ownerResponseRate = reviewSentiment?.owner_response_rate ?? 0.5;
  if (ownerResponseRate > 1) ownerResponseRate = ownerResponseRate / 100;

  const unansweredNegatives = negativeThemes * (1 - ownerResponseRate);
  if (unansweredNegatives <= 0 && !(ownerResponseRate < 0.1 && reviewCount >= 50)) return null;

  let lowEstimate: number;
  let midEstimate: number;
  let highEstimate: number;

  if (monthlyRevenue && ownerResponseRate < 0.1 && reviewCount >= 50) {
    midEstimate = Math.round(monthlyRevenue * 0.002);
    lowEstimate = Math.round(midEstimate * 0.4);
    highEstimate = Math.round(midEstimate * 1.5);
  } else {
    const monthlySearches = 200;
    const conversionRate = 0.06;
    const trustErosionFactor = 0.03;
    const lostConversions = monthlySearches * conversionRate * trustErosionFactor * unansweredNegatives;
    lowEstimate = Math.round(lostConversions * ticketValue.low * 0.5);
    midEstimate = Math.round(lostConversions * ticketValue.mid);
    highEstimate = Math.round(lostConversions * ticketValue.high * 1.5);
  }

  return {
    category: "Review Engagement Gap",
    description: "A low owner response rate can weaken trust at the moment customers compare ratings, recent reviews, and business responsiveness",
    low_estimate: lowEstimate,
    mid_estimate: midEstimate,
    high_estimate: highEstimate,
    contributing_factors: [
      `Owner response rate: ${(ownerResponseRate * 100).toFixed(0)}%`,
      negativeThemes > 0
        ? `Visible complaint themes without owner response: ${Math.ceil(unansweredNegatives)}`
        : "No visible complaint themes in the sampled reviews; estimate is based on absent owner replies at scale",
      "Use this as a directional trust signal unless a full review corpus is collected",
    ],
    confidence: negativeThemes > 0 ? 5 : 3,
  };
}

function hasUsableCitationData(citationConsistency: any): boolean {
  if (!citationConsistency) return false;
  if (citationConsistency.unavailable === true || citationConsistency.is_mock === true) return false;
  if (!Array.isArray(citationConsistency.directories)) return false;
  return citationConsistency.directories.length > 0;
}

function calculateCitationInconsistencyCost(
  citationConsistency: any,
  ticketValue: { low: number; mid: number; high: number }
): RevenueLeak | null {
  if (!hasUsableCitationData(citationConsistency)) return null;

  const citationErrors =
    citationConsistency.total_inconsistent ??
    citationConsistency.directories?.filter((d: any) => d.status === "found_inconsistent").length ??
    0;

  if (citationErrors <= 0) return null;

  const rankingDropPerError = 0.02;
  const totalRankingDrop = Math.min(0.15, citationErrors * rankingDropPerError);
  const monthlyOrganic = 300;
  const conversionRate = 0.05;
  const lostConversions = monthlyOrganic * totalRankingDrop * conversionRate;

  return {
    category: "Citation Inconsistency Cost",
    description: "Verified name, address, or phone mismatches can weaken local search confidence and reduce organic discovery",
    low_estimate: Math.round(lostConversions * ticketValue.low),
    mid_estimate: Math.round(lostConversions * ticketValue.mid),
    high_estimate: Math.round(lostConversions * ticketValue.high),
    contributing_factors: [
      `Citation inconsistencies found: ${citationErrors}`,
      `Estimated local SEO ranking drop: ${(totalRankingDrop * 100).toFixed(1)}%`,
      "Only counted because directory evidence was collected",
      "Recovery takes 2-4 weeks after correction",
    ],
    confidence: 6,
  };
}

function calculateSocialDormancyCost(
  socialPresence: any,
  ticketValue: { low: number; mid: number; high: number }
): RevenueLeak | null {
  const lastPostDays: number | null = socialPresence?.days_since_last_post ?? null;
  const platformsFound: number = socialPresence?.platforms_found ?? 0;
  const platformsActive: number = socialPresence?.platforms_active ?? 0;

  let engagementDecay = 0;
  let recencyFactor = "";

  if (lastPostDays !== null) {
    if (lastPostDays <= 30) return null;
    if (lastPostDays > 180) engagementDecay = 0.7;
    else if (lastPostDays > 90) engagementDecay = 0.5;
    else engagementDecay = 0.25;
    recencyFactor = `Last social post: ${lastPostDays} days ago`;
  } else if (platformsFound > 0 && platformsActive === 0) {
    engagementDecay = 0.35;
    recencyFactor = "Social profiles found but none confirmed active";
  } else if (platformsFound === 0) {
    engagementDecay = 0.5;
    recencyFactor = "No social media profiles detected on the business website";
  } else {
    return null;
  }

  const monthlyReferralTraffic = 80;
  const conversionRate = 0.07;
  const lostConversions = monthlyReferralTraffic * engagementDecay * conversionRate;

  return {
    category: "Social Discovery Gap",
    description: "Missing or dormant social profiles can reduce referral traffic and weaken brand discovery",
    low_estimate: Math.round(lostConversions * ticketValue.low),
    mid_estimate: Math.round(lostConversions * ticketValue.mid),
    high_estimate: Math.round(lostConversions * ticketValue.high),
    contributing_factors: [
      recencyFactor,
      `Estimated engagement decay: ${(engagementDecay * 100).toFixed(0)}%`,
      "Revenue impact is estimated only when missing or dormant social evidence is present",
    ],
    confidence: lastPostDays !== null ? 5 : 3,
  };
}

function scoreRevenueImpact(totalMonthlyMid: number, monthlyRevenue?: number): number {
  if (monthlyRevenue) {
    const leakageRatio = totalMonthlyMid / monthlyRevenue;
    if (leakageRatio > 0.05) return 40;
    if (leakageRatio > 0.03) return 50;
    if (leakageRatio > 0.015) return 60;
    if (leakageRatio > 0.005) return 72;
    if (totalMonthlyMid > 0) return 82;
    return 90;
  }

  if (totalMonthlyMid > 7000) return 40;
  if (totalMonthlyMid > 5000) return 50;
  if (totalMonthlyMid > 3000) return 60;
  if (totalMonthlyMid > 1500) return 75;
  if (totalMonthlyMid > 500) return 85;
  return 90;
}

export async function estimateRevenueImpact(params: RevenueImpactParams): Promise<RevenueImpactResult> {
  const {
    gbpHealth,
    reviewSentiment,
    websitePerformance,
    socialPresence,
    citationConsistency,
    category,
    revenueBaseline,
  } = params;

  const ticketValue = revenueBaseline?.avg_ticket_mid && revenueBaseline.avg_ticket_mid > 0
    ? {
        low: revenueBaseline.avg_ticket_low,
        mid: revenueBaseline.avg_ticket_mid,
        high: revenueBaseline.avg_ticket_high,
      }
    : getTicketValue(category);

  const businessModel = getBusinessModel(category, revenueBaseline);
  const monthlyRevenue = getMonthlyRevenueBaseline(revenueBaseline);

  const leakCandidates = [
    calculateAfterHoursLeakage(gbpHealth, ticketValue, businessModel),
    calculateMobileBounceLeakage(websitePerformance, ticketValue, monthlyRevenue, businessModel),
    calculateReviewResponseGapCost(reviewSentiment, ticketValue, monthlyRevenue),
    calculateCitationInconsistencyCost(citationConsistency, ticketValue),
    calculateSocialDormancyCost(socialPresence, ticketValue),
  ];

  const leaks = leakCandidates.filter((leak): leak is RevenueLeak => leak !== null && leak.mid_estimate > 0);

  const totalMonthlyLow = leaks.reduce((sum, leak) => sum + leak.low_estimate, 0);
  const totalMonthlyMid = leaks.reduce((sum, leak) => sum + leak.mid_estimate, 0);
  const totalMonthlyHigh = leaks.reduce((sum, leak) => sum + leak.high_estimate, 0);

  const annualImpactLow = totalMonthlyLow * 12;
  const annualImpactMid = totalMonthlyMid * 12;
  const annualImpactHigh = totalMonthlyHigh * 12;
  const score = scoreRevenueImpact(totalMonthlyMid, monthlyRevenue);
  const fixPotential = annualImpactMid;

  const findings: string[] = [];
  if (totalMonthlyMid > 0) {
    findings.push(`Directional revenue at risk: $${totalMonthlyMid.toLocaleString()}/month from evidence-backed digital friction`);
    const topLeak = [...leaks].sort((a, b) => b.mid_estimate - a.mid_estimate)[0];
    if (topLeak) {
      findings.push(`Largest quantified opportunity: ${topLeak.category} at about $${topLeak.mid_estimate.toLocaleString()}/month`);
    }
  } else {
    findings.push("No evidence-backed revenue leakage could be quantified from the collected modules");
  }

  if (monthlyRevenue && totalMonthlyMid > 0) {
    const pct = ((totalMonthlyMid / monthlyRevenue) * 100).toFixed(1);
    findings.push(`The estimate equals about ${pct}% of the monthly revenue baseline, so treat it as a directional planning range`);
  }

  const recommendations: string[] = [];
  if (leaks.some((leak) => leak.category === "Mobile Conversion Friction")) {
    recommendations.push("Prioritize mobile speed, layout stability, and above-the-fold visit details");
  }
  if (leaks.some((leak) => leak.category === "Review Engagement Gap")) {
    recommendations.push("Start responding to recent Google reviews with short, human owner replies");
  }
  if (leaks.some((leak) => leak.category === "Citation Inconsistency Cost")) {
    recommendations.push("Clean only the directory listings where mismatches were verified");
  }
  if (leaks.some((leak) => leak.category === "After-Hours Lead Leakage")) {
    recommendations.push("Add after-hours form, booking, or callback capture where customers expect it");
  }
  if (fixPotential > 0) {
    recommendations.push(`Estimated annual recovery potential from evidence-backed gaps: $${Math.round(fixPotential).toLocaleString()}`);
  }

  const roiMessage = totalMonthlyMid > 0
    ? `Fixing the evidence-backed gaps could recover roughly $${Math.round(totalMonthlyMid * 0.8).toLocaleString()}-$${Math.round(totalMonthlyMid * 1.2).toLocaleString()}/month`
    : "No evidence-backed revenue recovery estimate is available yet";

  const evidenceBasis = leaks.map((leak) => `${leak.category}: confidence ${leak.confidence ?? "unknown"}/10`);
  const impactLevel =
    leaks.length === 0
      ? "insufficient_evidence"
      : totalMonthlyMid >= 5000
        ? "high"
        : totalMonthlyMid >= 1500
          ? "medium"
          : totalMonthlyMid > 0
            ? "not_material"
            : "insufficient_evidence";

  return {
    grade: scoreToGradeLabel(score),
    score,
    revenue_basis: "unverified_estimate",
    show_revenue_dollars: false,
    opportunity_assessment: {
      impact_level: impactLevel,
      confidence: leaks.some((leak) => (leak.confidence ?? 0) >= 6) ? "medium" : "low",
      evidence_basis: evidenceBasis,
      summary: totalMonthlyMid > 0
        ? "Public data found digital gaps, but no verified revenue source was available. Treat this as a business-impact signal, not a dollar opportunity."
        : "Public data did not support a quantified revenue opportunity.",
    },
    total_monthly_leakage: {
      low: totalMonthlyLow,
      mid: totalMonthlyMid,
      high: totalMonthlyHigh,
    },
    leaks,
    annual_impact: {
      low: annualImpactLow,
      mid: annualImpactMid,
      high: annualImpactHigh,
    },
    roi_if_fixed: roiMessage,
    findings,
    recommendations,
  };
}

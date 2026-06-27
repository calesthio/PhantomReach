import { describe, expect, it } from "vitest";

import { estimateRevenueImpact } from "@/lib/agents/tools/revenue-calc";
import { getMasterAnalysisPrompt } from "@/lib/agents/prompts/master-analysis";
import { filterClientFacingReportItems } from "@/lib/reports/content-quality";
import { detectTechStack } from "@/lib/agents/tools/tech-detect";
import { scanSocialProfiles } from "@/lib/agents/tools/social-scan";
import {
  filterUnverifiedRevenueStats,
  shouldShowRevenueDollars,
  visibleRevenueFindings,
} from "@/lib/reports/revenue-display";
import {
  cleanCategorySkillLabel,
  humanizeModuleKey,
  humanizeModuleReferences,
  priorityPlanSubtitle,
} from "@/lib/reports/display-labels";
import { sanitizeAuditResultContent } from "@/lib/reports/content-contract";
import { buildAuditCoverageSummary } from "@/lib/reports/coverage";
import {
  createMockAIAnalysis,
  createMockAuditResult,
  createMockCitationConsistency,
  createMockCompetitiveComparison,
  createMockExecutiveSummary,
  createMockRevenueImpact,
} from "../test-utils/mock-factories";

function collectStringValues(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(collectStringValues);
  if (value && typeof value === "object") {
    return Object.values(value).flatMap(collectStringValues);
  }
  return [];
}

describe("report content quality guardrails", () => {
  it("does not fabricate citation or booking leakage for a walk-in retail food business", async () => {
    const result = await estimateRevenueImpact({
      category: "Ice cream shop",
      revenueBaseline: {
        avg_ticket_low: 8,
        avg_ticket_mid: 11,
        avg_ticket_high: 16,
        monthly_revenue_mid: 160000,
        revenue_tier: "regional_premium_retail",
        confidence: "medium",
        reasoning: "Popular walk-in dessert business with high review volume.",
      },
      gbpHealth: {
        hours_complete: true,
      },
      websitePerformance: {
        score: 86,
        performance_score: 70,
        mobile_friendly: false,
        core_web_vitals: {
          lcp: 4203,
          cls: 0.2,
          lcp_pass: false,
          inp_pass: true,
          cls_pass: false,
        },
        has_clear_cta: true,
      },
      reviewSentiment: {
        owner_response_rate: 0,
        top_complaint_themes: [],
      },
      socialPresence: {
        platforms_found: 1,
        platforms_active: 1,
      },
      citationConsistency: undefined,
    });

    const leakCategories = result.leaks.map((leak) => leak.category);

    expect(leakCategories).not.toContain("Citation Inconsistency Cost");
    expect(leakCategories).not.toContain("After-Hours Lead Leakage");
    expect(result.leaks.some((leak) => /booking|callback|call-back/i.test(leak.description))).toBe(false);
    expect(result.total_monthly_leakage.mid).toBeGreaterThanOrEqual(800);
    expect(result.findings.join(" ")).not.toMatch(/citation inconsistencies|booking|callback|call-back/i);
  });

  it("removes internal model critique from user-facing module findings", () => {
    const filtered = filterClientFacingReportItems([
      "The reported total monthly leakage of $53 is not credible relative to this business's estimated revenue baseline.",
      "This module is best treated as prioritization logic, not financial truth.",
      "The citation estimate cannot be independently validated because no citation module was provided.",
      "Mobile load friction is likely costing walk-in visits during warm evening dessert searches.",
    ]);

    expect(filtered).toEqual([
      "Mobile load friction is likely costing walk-in visits during warm evening dessert searches.",
    ]);
  });

  it("keeps the deep-analysis schema client-facing and separates data quality from visible findings", () => {
    const prompt = getMasterAnalysisPrompt("Molly Moon's Homemade Ice Cream", "Ice cream shop", {
      gbpHealth: { rating: 4.5, review_count: 2900 },
      revenueImpact: { total_monthly_leakage: { mid: 1800 } },
    });

    expect(prompt).not.toContain("data_quality_note");
    expect(prompt).not.toContain("modules_with_mock_data");
    expect(prompt).not.toContain("$3,200");
    expect(prompt).toContain("Use internal snake_case names only as JSON object keys");
    expect(prompt).toContain("client-facing");
  });

  it("keeps raw fallback module copy category-neutral and nontechnical", async () => {
    const tech = await detectTechStack({
      url: "https://example.com",
      html: "<html><head><script src=\"https://www.googletagmanager.com/gtag/js?id=G-ABC\"></script></head><body></body></html>",
    });

    expect("analysis" in tech).toBe(true);
    if ("analysis" in tech) {
      expect([...tech.analysis.technology_gaps, ...tech.analysis.recommendations].join(" ")).not.toMatch(/booking|schedule|calendly/i);
    }

    const social = await scanSocialProfiles({
      businessName: "Example",
      website: undefined,
    });

    expect(social.findings.join(" ")).not.toMatch(/AI analysis phase|module|mock/i);
    expect(social.platforms_active).toBe(0);
  });

  it("does not expose dollar opportunity claims for unverified revenue estimates", () => {
    const revenue = {
      revenue_basis: "unverified_estimate" as const,
      show_revenue_dollars: false,
    };

    expect(shouldShowRevenueDollars(revenue)).toBe(false);
    expect(
      shouldShowRevenueDollars({
        revenue_basis: "unverified_estimate",
        show_revenue_dollars: true,
      })
    ).toBe(false);
    expect(
      shouldShowRevenueDollars({
        revenue_basis: "verified_public",
        show_revenue_dollars: true,
      })
    ).toBe(true);
    expect(
      filterUnverifiedRevenueStats(
        [
          { label: "Rating", value: "4.5", sentiment: "positive" },
          { label: "At Risk", value: "$330/mo", sentiment: "negative" },
          { label: "Reviews", value: "2900", sentiment: "positive" },
        ],
        revenue
      )
    ).toEqual([
      { label: "Rating", value: "4.5", sentiment: "positive" },
      { label: "Reviews", value: "2900", sentiment: "positive" },
    ]);

    expect(
      visibleRevenueFindings(
        [
          "Directional revenue at risk: $330/month from evidence-backed digital friction",
          "The estimate equals about 0.2% of the monthly revenue baseline",
        ],
        revenue
      ).join(" ")
    ).not.toMatch(/\$330|0\.2%|revenue leakage/i);
  });

  it("keeps report presentation labels client-facing", () => {
    expect(humanizeModuleKey("website_performance")).toBe("Website");
    expect(humanizeModuleKey("revenue_impact")).toBe("Business impact");
    expect(humanizeModuleReferences("Fix website_performance before revenue_impact decisions.")).toBe(
      "Fix Website before Business impact decisions."
    );
    expect(humanizeModuleReferences("revenue_basis is unverified_estimate")).toBe(
      "revenue basis is unverified estimate"
    );
    expect(cleanCategorySkillLabel("dynamic:Independent general, cosmetic, and family dental practice")).toBe(
      "Dental practice"
    );
    expect(priorityPlanSubtitle(false)).not.toMatch(/ROI|revenue/i);
    expect(priorityPlanSubtitle(true)).toMatch(/ROI/i);
  });

  it("sanitizes generated report content before storage or rendering", () => {
    const result = createMockAuditResult({
      revenue_impact: createMockRevenueImpact({
        revenue_basis: "unverified_estimate",
        show_revenue_dollars: false,
      }),
      executive_summary: createMockExecutiveSummary({
        verdict_subline: "The report shows website_performance is costing $3,200/mo in revenue leakage.",
        key_stats: [
          { label: "Leak/mo", value: "$3.2k", sentiment: "negative" },
          { label: "Reviews", value: "612", sentiment: "positive" },
        ],
        top_strength: {
          module: "review_sentiment",
          headline: "review_sentiment is strong",
          detail: "The model found reviews are strong.",
        },
        critical_gap: {
          module: "website_performance",
          headline: "website_performance is weak",
          detail: "The module says speed is bad.",
        },
        three_insights: [
          "The reported total monthly leakage of $53 is not credible.",
          "Fix website_performance before revenue_impact decisions.",
        ],
        hidden_opportunity: "Capture $1,600/mo if the model is right.",
        path_forward: [
          {
            priority: 1,
            action: "Fix website_performance",
            outcome: "Capture $1,600/mo in patient demand",
          },
        ],
      }),
      ai_analysis: createMockAIAnalysis({
        cross_module_synthesis: {
          causal_chains: [
            {
              chain: "website_performance -> revenue_impact",
              modules_involved: ["website_performance", "revenue_impact"],
              business_impact: "The report estimates $3,200/mo leakage.",
              fix_sequence: "Fix website_performance first.",
            },
          ],
          compounding_gaps: [
            {
              description: "This module cannot be independently validated.",
              combined_impact: "$3,200/mo revenue leakage.",
              involved_modules: ["website_performance"],
            },
          ],
          hidden_strengths: [
            {
              strength: "review_sentiment is strong.",
              leverage_opportunity: "Use reviews without mentioning the model.",
            },
          ],
          contradictions: [
            {
              observation: "The model contradicts itself.",
              possible_explanation: "Data quality is limited.",
              investigation_needed: "Rebuild the model.",
            },
          ],
          competitive_narrative: "The model says website_performance is the issue.",
        },
        priority_action_plan: [
          {
            priority: 1,
            action: "Fix website_performance",
            rationale: "The model says this unlocks $3,200/mo.",
            expected_roi: "$3,200/mo revenue recovery",
            unlocks: "Better revenue_impact",
            timeframe: "1 week",
          },
        ],
        data_quality_assessment: {
          modules_with_rich_data: ["website_performance"],
          modules_with_limited_data: ["revenue_impact"],
          modules_with_no_data: [],
          overall_confidence: 0.7,
          caveats: [
            "Revenue basis is unverified_estimate.",
            "This model cannot be independently validated.",
            "Citation consistency findings are based on gathered identifiers rather than a full directory audit.",
          ],
        },
      }),
    });

    const sanitized = sanitizeAuditResultContent(result);
    const text = collectStringValues({
      executive_summary: sanitized.executive_summary,
      ai_analysis: sanitized.ai_analysis,
      enhanced_recommendations: sanitized.enhanced_recommendations,
      recommendations: sanitized.recommendations,
      revenue_findings: sanitized.revenue_impact?.findings,
      revenue_recommendations: sanitized.revenue_impact?.recommendations,
      revenue_leaks: sanitized.revenue_impact?.leaks.map((leak) => ({
        category: leak.category,
        description: leak.description,
        contributing_factors: leak.contributing_factors,
      })),
    }).join(" ");

    expect(sanitized).not.toBe(result);
    expect(sanitized.executive_summary).toMatchObject({
      key_stats: [{ label: "Reviews", value: "612", sentiment: "positive" }],
      top_strength: expect.objectContaining({ module: "Reviews" }),
      critical_gap: expect.objectContaining({ module: "Website" }),
    });
    expect(text).not.toMatch(/\$3,200|\$1,600|\$3\.2k|\/mo|revenue leakage/i);
    expect(text).not.toMatch(/website_performance|revenue_impact|review_sentiment|unverified_estimate/i);
    expect(text).not.toMatch(/the model|the report|this module|reported total|cannot be independently validated|rebuild the model|rebuild the analysis|\bROI\b|full directory audit/i);
    expect(text).toContain("Website");
    expect(text).toContain("Business impact");
    expect(text).toContain("dedicated directory scan");
  });

  it("summarizes audit coverage without implying exhaustive checks", () => {
    const result = createMockAuditResult({
      citation_consistency: createMockCitationConsistency({ is_mock: true }),
      competitive_comparison: createMockCompetitiveComparison({
        agentic_reconciled: false,
        competitors: [
          { name: "Peer One", rating: 4.7, review_count: 220, estimated_position: "leader" },
          { name: "Peer Two", rating: 4.3, review_count: 140, estimated_position: "challenger" },
        ],
      }),
      evidence: {
        generated_at: "2026-06-26T00:00:00.000Z",
        modules: [
          { key: "gbp_health", label: "Google Business Profile", source: "Google Places", status: "collected", reason: "Collected real data for this area." },
          { key: "review_sentiment", label: "Reviews & Reputation", source: "Google Places", status: "collected", reason: "Collected review metrics and sampled recent review themes." },
          { key: "website_performance", label: "Website Performance", source: "Google PageSpeed", status: "collected", reason: "Collected a mobile PageSpeed snapshot." },
          { key: "tech_stack", label: "Technology Stack", source: "Website HTML", status: "collected", reason: "Collected homepage technology signals." },
          { key: "social_presence", label: "Social Presence", source: "Website links", status: "collected", reason: "Collected website-linked social profile sample." },
          { key: "competitive_comparison", label: "Competitive Comparison", source: "Google Places", status: "collected", reason: "Collected nearby competitor sample." },
          { key: "citation_consistency", label: "Citation Consistency", source: "Directory listings", status: "not_implemented", reason: "Directory scan is not available in the local app yet." },
        ],
        summary: { collected: 6, unavailable: 0, skipped: 0, failed: 0, not_implemented: 1 },
      },
    });

    const coverage = buildAuditCoverageSummary(result);
    const labels = coverage.items.map((item) => item.label);
    const text = collectStringValues(coverage).join(" ");

    expect(coverage.counts).toEqual({ checked: 1, sampled: 5, notChecked: 1 });
    expect(coverage.confidence.label).toBe("Directional");
    expect(labels).toContain("Google profile");
    expect(labels).toContain("Reviews");
    expect(labels).toContain("Website");
    expect(labels).toContain("Directories");
    expect(coverage.items.find((item) => item.label === "Reviews")).toMatchObject({
      coverage: "sampled",
      confidence: "medium",
    });
    expect(coverage.items.find((item) => item.label === "Website")?.detail).toMatch(/snapshot/i);
    expect(coverage.items.find((item) => item.label === "Directories")).toMatchObject({
      coverage: "not_checked",
      confidence: "low",
    });
    expect(text).toMatch(/sample|snapshot|not available/i);
    expect(text).not.toMatch(/\bfull\b|\bexhaustive\b|\bcomplete check\b/i);
  });

  it("includes business context in audit coverage when enrichment is collected", () => {
    const result = createMockAuditResult({
      business_enrichment: {
        generated_at: "2026-06-26T00:00:00.000Z",
        facts: [
          {
            id: "entity-registered-name",
            kind: "entity",
            label: "Registered entity",
            value: "BELLEVUE DENTAL ARTS LLC",
            source: {
              label: "OpenCorporates",
              url: "https://opencorporates.com/",
              source_type: "api",
              collected_at: "2026-06-26T00:00:00.000Z",
            },
            confidence: "high",
            relevance: "medium",
          },
        ],
        research_findings: [
          {
            claim: "The practice promotes emergency dental care.",
            source: {
              label: "Services page",
              url: "https://www.bellevuedentalarts.com/services/emergency-dentistry",
              source_type: "public_web",
              collected_at: "2026-06-26T00:00:00.000Z",
            },
            confidence: "high",
            relevance: "high",
            evidence_excerpt: "Emergency dental care is available for urgent tooth pain.",
            why_it_matters: "Emergency searches are high intent.",
            verified_status: "verified",
          },
        ],
        warnings: [],
        coverage: {
          deterministic_sources_checked: ["OpenCorporates"],
          agent_searches_run: ["Bellevue Dental Arts emergency dentistry"],
          pages_fetched: ["https://www.bellevuedentalarts.com/services/emergency-dentistry"],
        },
      },
      evidence: {
        generated_at: "2026-06-26T00:00:00.000Z",
        modules: [
          { key: "gbp_health", label: "Google Business Profile", source: "Google Places", status: "collected", reason: "Collected real data for this area." },
          { key: "business_enrichment", label: "Business Context", source: "Public sources", status: "collected", reason: "Collected public business facts and cited research." },
        ],
        summary: {
          collected: 2,
          unavailable: 0,
          skipped: 0,
          failed: 0,
          not_implemented: 0,
        },
      },
    });

    const coverage = buildAuditCoverageSummary(result);
    const businessContext = coverage.items.find((item) => item.label === "Business context");

    expect(businessContext).toMatchObject({
      coverage: "sampled",
      confidence: "medium",
    });
    expect(businessContext?.detail).toMatch(/public facts/i);
  });
});

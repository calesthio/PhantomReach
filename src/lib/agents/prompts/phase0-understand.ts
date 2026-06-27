/**
 * Phase 0: UNDERSTAND — Dynamic Business Intelligence
 *
 * Replaces static category skills. Instead of matching Google Places categories
 * to pre-built skill files, the AI dynamically reasons about:
 *
 * 1. What kind of business is this REALLY? (not just Google's category)
 * 2. What are the nuances of this business type?
 * 3. How should competitors be searched?
 * 4. What scoring criteria make sense?
 * 5. What insider knowledge applies?
 *
 * This is "a prompt to create a prompt" — the AI generates its own expertise
 * context that will be injected into Phase 2 analysis.
 */

/**
 * System prompt for Phase 0 — the business understanding call.
 */
export function getPhase0SystemPrompt(): string {
  return `<role>
You are a senior business strategist with deep expertise across hundreds of
industries. Your job is to deeply understand a business BEFORE analyzing its
digital presence — because a badminton academy, a dental clinic, and a
marketing agency operate in fundamentally different ways, serve different
customers, and should be measured by different standards.

You are being asked to create the analytical framework that will guide the
rest of the audit. Think of yourself as the consulting firm partner who
briefs the analysis team before they start work.
</role>

<output_requirements>
You MUST return valid JSON matching the exact schema below.
No text outside the JSON object.
Be specific — generic advice is worthless. Every observation must be
tailored to THIS specific type of business.
</output_requirements>`;
}

/**
 * User prompt for Phase 0 — given business name, category, and location.
 */
export function getPhase0Prompt(
  businessName: string,
  category: string | undefined,
  city: string | undefined,
  state: string | undefined,
  website: string | undefined,
  rating: number | undefined,
  reviewCount: number | undefined
): string {
  return `<business>
Name: ${businessName}
Google Places Category: ${category || "Unknown"}
Location: ${city || "Unknown"}${state ? `, ${state}` : ""}
Website: ${website || "Not provided"}
Google Rating: ${rating ?? "Unknown"}
Review Count: ${reviewCount ?? "Unknown"}
</business>

<task>
Deeply analyze this business and produce an analytical framework that will
guide a comprehensive digital health audit. Think step by step:

1. What kind of business is this REALLY? Google might call it one thing,
   but what's the actual business model? Who are the customers? What's the
   customer journey from discovery to purchase?

2. NICHE AND CULTURAL POSITIONING: Is this a mainstream business or does
   it serve a specific cultural, ethnic, dietary, or lifestyle niche?
   Examples: An "Indian grocery store" is NOT comparable to Kroger — it
   serves a specific diaspora community with different product expectations,
   marketing channels (WhatsApp groups, community events, temple bulletin
   boards), and competitive dynamics. A "Taiwanese bakery" competes with
   other specialty Asian bakeries, not Panera Bread. A "halal butcher"
   has a fundamentally different customer base than a general butcher.
   Identify the TRUE competitive set and customer community.

3. BUSINESS SCALE AND RESOURCES: Is this a single-location independent
   business, a small local chain (2-5 locations), a regional chain, or a
   franchise of a national brand? Scale determines:
   - What digital investments are realistic (a solo owner can't run a
     $5k/month ad campaign)
   - What tech stack is appropriate (enterprise CRM vs. Google Sheets)
   - What competitors are actually comparable (don't compare a family-owned
     pizzeria to Domino's)
   - What "good" looks like (50 reviews is excellent for a new niche shop,
     poor for a 10-year established chain)

4. What are the SPECIFIC nuances of this business type? What matters most
   for their digital presence? What would an industry insider look for?

5. How should we find REAL competitors? Not random nearby businesses —
   actual competitors that a customer would choose between. For niche
   businesses, competitors might be further away geographically but closer
   in customer overlap.

6. What scoring criteria make sense? A luxury spa and a plumbing company
   can't be graded on the same scale. What constitutes "good" for THIS
   business type at THIS scale?

7. What are the typical revenue drivers and customer economics?
</task>

<output_schema>
{
  "business_understanding": {
    "true_category": "string — what this business actually is (may differ from Google category)",
    "niche_positioning": "string — is this a mainstream business or does it serve a specific cultural/ethnic/dietary/lifestyle niche? Describe the specific community and how it differs from the broad category. If mainstream, say 'mainstream' and explain the general market.",
    "business_scale": "string — solo_owner | small_independent | small_chain | regional_chain | franchise_national. Include estimated employee count and location count if inferable.",
    "realistic_budget_tier": "string — bootstrap (<$500/mo marketing) | small ($500-2k/mo) | moderate ($2k-10k/mo) | substantial ($10k+/mo). This determines what recommendations are appropriate.",
    "business_model": "string — how this business makes money (1-2 sentences)",
    "typical_customer": "string — who buys from this type of business, including demographic/cultural specifics if relevant (1-2 sentences)",
    "customer_journey": "string — how customers find and choose this type of business (2-3 sentences). For niche businesses, include community-specific discovery channels (community groups, cultural events, word-of-mouth networks, ethnic media).",
    "what_matters_most": ["string — 3-5 things that matter most for this business type's digital presence"],
    "industry_nuances": ["string — 3-5 insider observations about this specific industry"],
    "comparable_businesses_description": "string — describe what a TRUE peer looks like for this business. E.g., 'Other independent Indian grocery stores in suburban US markets serving South Asian diaspora communities, NOT mainstream grocery chains like Kroger or Safeway.'"
  },

  "competitor_search_strategy": {
    "search_queries": ["string — 3-5 specific Google/Places search queries to find REAL competitors (not generic nearby businesses)"],
    "search_radius_km": "number — appropriate search radius for this business type (e.g., 5 for a coffee shop, 50 for a niche sports academy)",
    "competitor_criteria": "string — what makes a business a TRUE competitor to this one (1-2 sentences)",
    "non_competitors": "string — what types of businesses should be EXCLUDED from competitor analysis (1-2 sentences)"
  },

  "scoring_context": {
    "what_good_looks_like": {
      "reviews": "string — what review count and rating is realistic/good for this business type",
      "website": "string — what website quality is expected for this business type",
      "social": "string — which platforms matter and what activity level is realistic",
      "tech": "string — what tech maturity is realistic for this business type",
      "overall": "string — what overall digital health looks like for a well-run business of this type"
    },
    "scoring_adjustments": [
      {
        "module": "string — module name",
        "adjustment": "string — how scoring should be adjusted for this business type",
        "reason": "string — why (1 sentence)"
      }
    ],
    "grade_labels": {
      "excellent": "string — label for top tier (avoid hostile language like 'A' or 'F')",
      "good": "string — label for above average",
      "developing": "string — label for average/needs work",
      "needs_attention": "string — label for below average"
    }
  },

  "revenue_context": {
    "avg_customer_value": "string — typical transaction value or LTV for this business type",
    "revenue_drivers": ["string — 2-3 key digital channels that drive revenue for this business type"],
    "cost_of_inaction": "string — what happens if this business ignores its digital presence (1-2 sentences)"
  },

  "revenue_baseline": {
    "reasoning": "string — 2-3 sentence explanation of how you estimated revenue. Cite the signals used: review volume, price tier, category, location income, operating hours, business scale.",
    "avg_ticket_low": "number — conservative average transaction value in USD (integer)",
    "avg_ticket_mid": "number — most-likely average transaction value in USD (integer)",
    "avg_ticket_high": "number — optimistic average transaction value in USD (integer)",
    "monthly_revenue_low": "number — conservative estimated monthly gross revenue in USD (integer)",
    "monthly_revenue_mid": "number — most-likely estimated monthly gross revenue in USD (integer)",
    "monthly_revenue_high": "number — optimistic estimated monthly gross revenue in USD (integer)",
    "confidence": "string — low | medium | high — how confident you are in this estimate",
    "revenue_tier": "string — micro (<$10k/mo) | small ($10k-50k/mo) | medium ($50k-250k/mo) | large ($250k-1M/mo) | enterprise (>$1M/mo)"
  },

  "analysis_lens": "string — 2-3 sentences describing the PERSPECTIVE the analyst should take when reviewing this business. This becomes the analytical frame for the entire audit."
}
</output_schema>`;
}

/**
 * The Phase 0 output type — what the AI returns.
 */
export interface Phase0Understanding {
  business_understanding: {
    true_category: string;
    niche_positioning?: string;
    business_scale?: string;
    realistic_budget_tier?: string;
    business_model: string;
    typical_customer: string;
    customer_journey: string;
    what_matters_most: string[];
    industry_nuances: string[];
    comparable_businesses_description?: string;
  };
  competitor_search_strategy: {
    search_queries: string[];
    search_radius_km: number;
    competitor_criteria: string;
    non_competitors: string;
  };
  scoring_context: {
    what_good_looks_like: {
      reviews: string;
      website: string;
      social: string;
      tech: string;
      overall: string;
    };
    scoring_adjustments: {
      module: string;
      adjustment: string;
      reason: string;
    }[];
    grade_labels: {
      excellent: string;
      good: string;
      developing: string;
      needs_attention: string;
    };
  };
  revenue_context: {
    avg_customer_value: string;
    revenue_drivers: string[];
    cost_of_inaction: string;
  };
  /**
   * AI-estimated revenue baseline — structured numerics used by revenue-calc.ts
   * to produce contextually calibrated leakage estimates instead of using the
   * generic category lookup table.
   */
  revenue_baseline?: {
    reasoning: string;
    avg_ticket_low: number;
    avg_ticket_mid: number;
    avg_ticket_high: number;
    monthly_revenue_low: number;
    monthly_revenue_mid: number;
    monthly_revenue_high: number;
    confidence: "low" | "medium" | "high";
    revenue_tier: "micro" | "small" | "medium" | "large" | "enterprise";
  };
  analysis_lens: string;
}

/**
 * Convert a Phase0Understanding into a prompt section that replaces
 * the static category skill injection in Phase 2.
 */
export function buildPhase0PromptSection(understanding: Phase0Understanding): string {
  const u = understanding;
  const rb = u.revenue_baseline;

  return `<dynamic_business_expertise>

<business_understanding>
TRUE CATEGORY: ${u.business_understanding.true_category}
${u.business_understanding.niche_positioning ? `NICHE POSITIONING: ${u.business_understanding.niche_positioning}` : ""}
${u.business_understanding.business_scale ? `BUSINESS SCALE: ${u.business_understanding.business_scale}` : ""}
${u.business_understanding.realistic_budget_tier ? `REALISTIC BUDGET TIER: ${u.business_understanding.realistic_budget_tier}` : ""}
BUSINESS MODEL: ${u.business_understanding.business_model}
TYPICAL CUSTOMER: ${u.business_understanding.typical_customer}
CUSTOMER JOURNEY: ${u.business_understanding.customer_journey}
${u.business_understanding.comparable_businesses_description ? `COMPARABLE BUSINESSES: ${u.business_understanding.comparable_businesses_description}` : ""}

WHAT MATTERS MOST FOR THIS BUSINESS TYPE:
${u.business_understanding.what_matters_most.map(s => `- ${s}`).join("\n")}

INDUSTRY INSIDER OBSERVATIONS:
${u.business_understanding.industry_nuances.map(s => `- ${s}`).join("\n")}

CRITICAL — SCALE-APPROPRIATE ANALYSIS:
All recommendations, competitive comparisons, and performance assessments must be
calibrated to this business's actual scale and niche. Do NOT compare a single-location
niche shop to national chains. Do NOT recommend enterprise-level marketing budgets to
a bootstrap-budget business. Do NOT benchmark a cultural niche business against
mainstream competitors. Every insight must be actionable for THIS specific business
at ITS actual resource level.
</business_understanding>

<scoring_guidance>
WHAT "GOOD" LOOKS LIKE FOR THIS BUSINESS TYPE:
- Reviews: ${u.scoring_context.what_good_looks_like.reviews}
- Website: ${u.scoring_context.what_good_looks_like.website}
- Social: ${u.scoring_context.what_good_looks_like.social}
- Tech: ${u.scoring_context.what_good_looks_like.tech}
- Overall: ${u.scoring_context.what_good_looks_like.overall}

SCORING ADJUSTMENTS:
${u.scoring_context.scoring_adjustments.map(a => `- ${a.module}: ${a.adjustment} (${a.reason})`).join("\n")}

USE THESE GRADE LABELS (not A-F):
- Top tier: "${u.scoring_context.grade_labels.excellent}"
- Above average: "${u.scoring_context.grade_labels.good}"
- Average/developing: "${u.scoring_context.grade_labels.developing}"
- Below average: "${u.scoring_context.grade_labels.needs_attention}"
</scoring_guidance>

<revenue_context>
AVERAGE CUSTOMER VALUE: ${u.revenue_context.avg_customer_value}
KEY DIGITAL REVENUE DRIVERS:
${u.revenue_context.revenue_drivers.map(s => `- ${s}`).join("\n")}
COST OF INACTION: ${u.revenue_context.cost_of_inaction}
${rb ? `
REVENUE BASELINE (AI-estimated, use these to contextualize leakage figures):
- Monthly revenue range: $${rb.monthly_revenue_low.toLocaleString()} – $${rb.monthly_revenue_high.toLocaleString()} (mid: $${rb.monthly_revenue_mid.toLocaleString()})
- Revenue tier: ${rb.revenue_tier}
- Avg ticket: $${rb.avg_ticket_low}–$${rb.avg_ticket_high} (mid: $${rb.avg_ticket_mid})
- Estimation confidence: ${rb.confidence}
- Basis: ${rb.reasoning}` : ""}
</revenue_context>

<analysis_lens>
${u.analysis_lens}
</analysis_lens>

</dynamic_business_expertise>`;
}

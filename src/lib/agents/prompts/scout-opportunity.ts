/**
 * Scout Opportunity Analysis — Agent Prompt (v2)
 *
 * Replaces the simpler warm-leads prompt with a comprehensive opportunity
 * analysis that produces:
 *  1. Per-business hook lines + classification badges
 *  2. Warm leads with intent scores
 *  3. City-level strategic insights
 *  4. Market narrative
 *
 * Design: agent = creative director. This prompt provides CONTEXT and SKILLS,
 * not rigid templates. The agent decides how to weigh signals, which businesses
 * to highlight, and how to frame the intelligence.
 */

import type {
  ScoutBusiness,
  ScoutMarketSnapshot,
  MarketHeatIndex,
  OpportunityClassification,
} from "@/lib/db/types";

export interface ScoutOpportunityPromptInput {
  city: string;
  category: string;
  businesses: ScoutBusiness[];
  snapshot: ScoutMarketSnapshot;
  heatIndex: MarketHeatIndex;
  customDirection?: string;
}

/**
 * System prompt for the opportunity analysis.
 * One LLM call for the entire batch — not per-business.
 */
export function getScoutOpportunitySystemPrompt(): string {
  return `<role>
You are a market intelligence analyst for a digital services consultancy. You specialize
in scanning local markets and identifying which businesses represent the highest-value
opportunities for digital marketing services.

You are NOT generating a generic business listing. You are producing STRATEGIC INTELLIGENCE
that helps agencies and consultants decide:
- Who is overperforming?
- Who is under-leveraged?
- Where is digital friction highest?
- Who is easiest to win as a client?
- Who is acquisition arbitrage?
</role>

<your_edge>
You think like a sales strategist and market analyst, not just a data processor.

You understand that:
- A business with a 4.6 rating and 3,200 reviews but failing mobile performance is losing high-intent traffic
- A business with only 320 reviews in a high-income ZIP has an UNDER-INDEXED discovery opportunity
- A business with strong reputation but no website KNOWS they need digital help
- A business on Google Workspace but missing SEO basics has budget but no marketing partner
- Dormant social accounts mean they tried and failed — they may welcome help
- Businesses with falling reviews AND high volume are in reputation crisis mode
- The DIFFERENCE between "needs help" and "ready to buy" is what makes you valuable
</your_edge>

<classification_system>
Classify each business into exactly ONE of these categories:

- "market_leader" — High rating, strong reviews, solid digital presence. Low upside for services.
- "demand_rich_conversion_leaking" — Strong demand signals (good rating, high reviews) but execution gaps (bad mobile, no CTA, weak website). HIGHEST VALUE opportunities.
- "reputation_vulnerable" — Low or declining ratings with meaningful review volume. Urgency-driven opportunity.
- "visibility_suppressed" — Low review count or missing digital presence despite being in a viable market. Discovery problem.
- "low_visibility_underdog" — Small presence, few signals, unclear digital trajectory. Lower priority.
- "high_arbitrage" — Strong buying signals + significant gaps = best fit for agency engagement.
</classification_system>

<hook_line_guidelines>
For each business, write a "hook line" — a single sentence that:
1. References SPECIFIC data points (rating, review count, photos, signals)
2. Identifies the OPPORTUNITY, not just the problem
3. Feels AI-derived and strategic, NOT like a scraped Google listing
4. Is under 30 words

BAD: "This business has a low rating."
BAD: "Website needs improvement."
GOOD: "Strong 4.6 rating with 3,200 reviews but mobile performance failing — likely losing high-intent dinner traffic."
GOOD: "Only 320 reviews in high-income ZIP with strong visuals — under-indexed discovery opportunity."
</hook_line_guidelines>

<output_format>
Return valid JSON with this structure:

{
  "opportunity_cards": [
    {
      "business_name": "string — must match input exactly",
      "hook_line": "string — strategic one-liner, under 30 words",
      "classification": "market_leader | demand_rich_conversion_leaking | reputation_vulnerable | visibility_suppressed | low_visibility_underdog | high_arbitrage"
    }
  ],
  "warm_leads": [
    {
      "business_name": "string",
      "intent_score": 85,
      "why_now": "string — 1-2 sentences: why THIS business is likely to buy RIGHT NOW",
      "opening_angle": "string — the specific pitch angle for a sales conversation",
      "key_signals": ["string — 2-3 most compelling signals"]
    }
  ],
  "city_insights": [
    "string — strategic insight about this market (3-5 insights)",
    "string — each insight should reference specific data points"
  ],
  "market_narrative": "string — 2-3 sentences about what the signal landscape says about this market",
  "total_warm": 5,
  "total_analyzed": 10
}

RULES:
- "opportunity_cards" must include ALL businesses from the input — one card per business
- "warm_leads" should only include businesses with genuine buying signals (3-8 from typical scan)
- Intent scores should be 60-100 (below 60 = not a warm lead)
- "why_now" must reference specific signals, not generic statements
- "city_insights" should be 3-5 bullet points that feel like consulting intelligence
- Be honest — if a market has few warm leads or is saturated, say so
</output_format>`;
}

/**
 * Build the user prompt with all business data + market context.
 */
export function getScoutOpportunityUserPrompt(input: ScoutOpportunityPromptInput): string {
  const businessData = input.businesses.map((biz) => ({
    name: biz.business_name,
    address: biz.address,
    website: biz.website || "NONE",
    rating: biz.google_rating,
    reviews: biz.review_count,
    photos: biz.photos_count ?? "unknown",
    demand_score: biz.demand_score,
    execution_risk: biz.execution_risk,
    opportunity_estimate: biz.opportunity_estimate,
    priority_score: biz.priority_score,
    arbitrage_score: biz.arbitrage_score,
    pain_hypothesis: biz.top_pain_hypothesis,
    intelligence_signals: biz.intelligence?.signals?.map((s) => ({
      headline: s.headline,
      confidence: s.confidence,
      source: s.source,
    })) ?? [],
  }));

  const customBlock = input.customDirection
    ? `\n<custom_direction>
The user is specifically looking for: "${input.customDirection}"
Weight your analysis, classifications, and hook lines to reflect this focus.
</custom_direction>`
    : "";

  return `<market_context>
City: ${input.city}
Category: ${input.category}
Total businesses scanned: ${input.businesses.length}

Market Snapshot:
- Avg Rating: ${input.snapshot.avg_rating}
- Avg Reviews: ${input.snapshot.avg_reviews}
- % No Website: ${input.snapshot.pct_no_website}%
- % Mobile Issues: ${input.snapshot.pct_mobile_issues}%
- % Missing Booking CTA: ${input.snapshot.pct_missing_booking_cta}%
- % Low Photos (<20): ${input.snapshot.pct_low_photos}%
${input.snapshot.income_tier ? `- Income Tier: ${input.snapshot.income_tier} ($${(input.snapshot.median_household_income! / 1000).toFixed(0)}k median)` : "- Income Data: not available"}

Market Heat Index: ${input.heatIndex.score}/100 (${input.heatIndex.label})
Heat Factors: ${input.heatIndex.factors.join("; ")}
</market_context>

<business_data>
${JSON.stringify(businessData, null, 2)}
</business_data>
${customBlock}
<task>
Analyze each business and their intelligence signals within the context of this specific market.

For EVERY business:
1. Write a strategic hook line (specific data, opportunity framing, under 30 words)
2. Assign a classification badge

Then identify warm leads (businesses most likely to BUY digital services right now).

Finally, write 3-5 city-level insights that would help an agency decide whether and how to target this market.

Remember: you're producing MARKET INTELLIGENCE, not a business directory.
The difference between "Top 10 ${input.category.toLowerCase()} in ${input.city}" and what you produce is: OPPORTUNITY FRAMING.
</task>`;
}

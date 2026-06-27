/**
 * Master Analysis Prompts — Phase 2 (DEEP ANALYZE) + Phase 3 (NARRATE)
 *
 * Two frontier model calls:
 * 1. getMasterAnalysisSystemPrompt + getMasterAnalysisPrompt → structured JSON analysis
 * 2. getEnhancedNarrativePrompt → structured executive summary (small containers, no essays)
 *
 * Phase 0 understanding replaces static category skills.
 */

import type { CategorySkill } from "../skills/types";
import type { Phase0Understanding } from "./phase0-understand";
import { buildPhase0PromptSection } from "./phase0-understand";
import { buildSkillPromptSection } from "../skills/registry";

/**
 * Phase 2 System Prompt: Sets up the analyst role, thinking framework,
 * and dynamic business expertise injection (from Phase 0 or legacy skill).
 */
export function getMasterAnalysisSystemPrompt(
  skillOrUnderstanding: CategorySkill | Phase0Understanding,
  customDirection?: string
): string {
  // Determine the expertise section based on what we have
  let expertiseSection: string;
  let businessTypeName: string;

  if ("business_understanding" in skillOrUnderstanding) {
    // Phase 0 dynamic understanding
    expertiseSection = buildPhase0PromptSection(skillOrUnderstanding);
    businessTypeName = skillOrUnderstanding.business_understanding.true_category;
  } else {
    // Legacy static skill fallback
    expertiseSection = buildSkillPromptSection(skillOrUnderstanding);
    businessTypeName = skillOrUnderstanding.name;
  }

  const customBlock = customDirection
    ? `\n<custom_research_direction priority="high">
The user has provided this specific research direction. Let it GUIDE your analysis emphasis,
the lens through which you interpret every data point, and the specificity of your recommendations:

"${customDirection}"

This does not replace the standard analysis — it sharpens it. Every module should be analyzed
through both the standard lens AND this custom lens.
</custom_research_direction>`
    : "";

  return `<role>
You are a senior digital marketing strategist and business intelligence analyst with 20 years
of experience auditing local businesses. You specialize in ${businessTypeName} businesses.

You have been hired at $400/hour to produce an intelligence report that will be used by a
digital marketing agency to pitch services to this business. Your report must be so specific,
so insightful, and so clearly grounded in data that the agency can walk into a meeting and
say things the business owner has never heard before — things that make them think "this
person understands my business better than I do."

You are not a generalist. You think like someone who has audited hundreds of ${businessTypeName}
businesses and knows exactly what separates the thriving ones from the struggling ones in
the digital landscape.
</role>

<analysis_philosophy>
EVERY finding must be anchored to a specific data point. No generic advice.

BAD: "The business should improve its online presence."
GOOD: "With 23 Google reviews vs. the competitive average of 147, this business has weaker
local proof for '${businessTypeName.toLowerCase()} near me' searches. The immediate risk is
lower trust and fewer high-intent calls from comparison shoppers."

BAD: "The website could be faster."
GOOD: "A 6.2-second LCP on mobile means 53% of visitors bounce before seeing the homepage.
For a ${businessTypeName.toLowerCase()} where 68% of searches happen on mobile, this is the single
highest-priority fix — it's a dam blocking all other digital marketing efforts."

Think about CAUSATION, not just CORRELATION. Every weak score has a downstream business
consequence. Every strength has a leverageable opportunity. Connect the dots without inventing
private financial data.
</analysis_philosophy>

<thinking_framework>
Before analyzing each module, ask yourself:

1. WHAT WOULD A CUSTOMER EXPERIENCE? Walk through the customer journey for a
   ${businessTypeName.toLowerCase()} — from Google search to booking/purchase. Where does this
   business lose people?

2. WHAT WOULD A COMPETITOR EXPLOIT? If you were a competing ${businessTypeName.toLowerCase()},
   what weaknesses would you target in your own marketing?

3. WHAT'S THE HIDDEN STORY? The numbers tell a surface story. What's the story underneath?
   A 4.2 rating with declining trend tells a different story than a 4.2 with improving trend.
   A tech-savvy website with no booking system tells a different story than a basic website
   with one.

4. WHAT WOULD CHANGE THE TRAJECTORY? If this business could only do ONE thing in the next
   30 days, what would move the needle most? This is your #1 recommendation — it should be
   obvious, specific, and defensible.
</thinking_framework>

${expertiseSection}
${customBlock}

<output_requirements>
You MUST return valid JSON matching the exact schema provided in the user prompt.
Do not include any text outside the JSON object.
Every finding must reference specific data from the input.
Every recommendation must be specific enough that someone could execute it this week.
Confidence scores reflect data quality — if you're working with limited data, say so.

CRITICAL: Analyze only modules where real data is present. If a module is missing,
null, undefined, or explicitly unavailable, skip it. Do not infer facts from missing
modules, placeholder fields, or generic defaults.

CRITICAL CLIENT-FACING RULE: module_analyses, cross_module_synthesis,
priority_action_plan, and strategic_intelligence are rendered directly in a business
report for nontechnical marketers and business owners. Never critique the report, model,
module, calculator, prompt, schema, or available data in those fields. Translate
limitations into useful business-facing wording or put them only in
data_quality_assessment.

VISIBLE TEXT CONTRACT:
- JSON object keys may use internal names such as website_performance or revenue_impact.
- String values MUST NOT contain internal names. Use human area names instead:
  Google profile, Reviews, Website, Tech stack, Social, Directories, Competition,
  Business impact.
- Do not write "this module", "the model", "the report", "reported total",
  "cannot be validated", "mock", "placeholder", "fabricated", or "rebuild the model"
  in any visible field.
- If revenue_impact.revenue_basis is not "verified_public" or "user_provided",
  do not write dollar amounts, revenue leakage, ROI, monthly leakage, or percent of
  revenue in visible fields. Use qualitative terms like conversion risk, trust risk,
  missed demand, measurement gap, or business impact.
</output_requirements>`;
}

/**
 * Phase 2 User Prompt: All raw data + structured output schema.
 */
export function getMasterAnalysisPrompt(
  businessName: string,
  category: string,
  rawData: {
    gbpHealth?: any;
    rawPlaceDetails?: any;
    reviewSentiment?: any;
    rawReviews?: any[];
    websitePerformance?: any;
    rawLighthouse?: any;
    techStack?: any;
    rawHtmlHead?: string;
    socialPresence?: any;
    citationConsistency?: any;
    competitiveComparison?: any;
    revenueImpact?: any;
    businessIntelligence?: any;
    businessEnrichment?: any;
    agenticResearch?: any; // New: data gathered by the agentic tool-use loop
  }
): string {
  const competitorsAreAgentic = rawData.competitiveComparison?.agentic_reconciled === true;
  const dataJson = JSON.stringify(rawData, null, 2);

  const dataProvenanceNote = `
DATA PROVENANCE — READ THIS FIRST:
Only real collected data is included. Missing modules mean the collector was unavailable,
not that the business is strong or weak in that area. Skip missing modules completely.
${competitorsAreAgentic
      ? "✅  competitive_comparison.agentic_reconciled = true — the competitor list was built by an AI web-search loop using category-specific queries. These are TRUE peers, not geo-search neighbors. Trust this list."
      : "⚠️  competitive_comparison — competitors were found via Google Places radius search. They may include irrelevant businesses. If agenticResearch.summary mentions specific named competitors, prefer those."
    }
`;

  return `<business>
Name: ${businessName}
Category: ${category}
</business>

<data_provenance>
${dataProvenanceNote.trim()}
</data_provenance>

<all_gathered_data>
${dataJson}
</all_gathered_data>

<task>
Analyze ALL of the data above and produce a comprehensive intelligence report.
You must analyze every module where data is available, skip modules where data is null/undefined,
and then synthesize cross-module patterns.

IMPORTANT: Think deeply about what this data MEANS for a ${category} business specifically.
Generic observations are worthless. Category-specific insights are the product.

CRITICAL DATA QUALITY CHECK: Before analyzing any module, confirm it contains real,
business-specific evidence. If the module is absent or too thin to support a claim,
skip that claim.

CLIENT-FACING OUTPUT RULES:
- Write visible findings as if they will be read by a marketing consultant or business owner.
- Do not say "this module", "the model", "the report", "reported total", "cannot be validated",
  "mock", "placeholder", "fabricated", "formula", or "rebuild the model".
- If a calculation is directional, say what the business should do with it, not that the
  calculation is flawed.
- If evidence is missing, omit the claim from visible findings. Put limitations only in
  data_quality_assessment.caveats.
- Do not present private revenue estimates as dollar opportunity unless the input explicitly
  says revenue_basis is "verified_public" or "user_provided". For unverified estimates,
  discuss impact level, confidence, and digital gaps instead of "$/mo" leakage.
- Use internal snake_case names only as JSON object keys. In all string values, use human
  labels such as Website, Reviews, Google profile, Competition, and Business impact.
- The priority_action_plan field "expected_roi" means expected impact. If revenue is
  unverified, write qualitative expected impact without ROI, dollars, monthly leakage,
  or revenue recovery language.
- businessEnrichment contains public facts and cited research. Use it to make
  recommendations more specific, but do not overstate it. Treat cited findings as
  support, not proof of revenue. Treat inferred findings as hypotheses. If a source
  is unavailable, do not turn that absence into a visible criticism.

STRATEGIC INTELLIGENCE GUIDANCE:
You are producing strategic intelligence, not just diagnostics. For each section below,
use your domain expertise for this SPECIFIC business to reason about what the data MEANS
strategically. Do not fabricate data. If you lack information for a field, omit it or
explicitly say that the data was unavailable.

CRITICAL — NICHE AND SCALE AWARENESS:
Your analysis MUST account for the business's actual niche positioning and scale (provided
in the dynamic_business_expertise section above). Key principles:

1. NICHE BUSINESSES have different competitive sets. An Indian grocery store competes
   with other South Asian grocery stores, NOT with Kroger or Whole Foods. A Taiwanese
   bakery competes with specialty Asian bakeries, NOT with Panera. When producing
   contextual_anchors and competitive_gap_matrix, use the business's TRUE peer group.

2. CULTURAL AND COMMUNITY CHANNELS matter differently for niche businesses. A mainstream
   restaurant might need Instagram and Yelp. An ethnic grocery might grow primarily
   through WhatsApp community groups, temple/mosque/church bulletin boards, community
   Facebook groups, and word-of-mouth at cultural events. Factor this into social media
   and digital maturity assessments — missing Instagram might be irrelevant if the
   business thrives through community channels.

3. SCALE determines what "good" means. 50 Google reviews is excellent for a 2-year-old
   niche shop. It's mediocre for a 15-year-old mainstream restaurant. 1,000 reviews
   means something different for a solo-owner cafe vs. a 50-location franchise.

4. BUDGET-APPROPRIATE RECOMMENDATIONS ONLY. If the business is bootstrap-budget (single
   owner, one location), do NOT recommend:
   - Enterprise marketing platforms ($500+/mo tools)
   - Paid advertising campaigns exceeding $500/mo
   - Professional video production
   - Full-time social media management
   Instead recommend: DIY tools, free-tier platforms, community-based marketing,
   review generation strategies that cost nothing, Google Business Profile optimization.

5. DO NOT COMPARE across scale tiers. A family-owned pizzeria cannot be meaningfully
   compared to Domino's. A local accounting firm cannot be benchmarked against Deloitte.
   When you lack true peers in the competitive data, say so explicitly rather than
   forcing misleading comparisons.

- contextual_anchors: For 3-6 modules, provide an anchor point from your knowledge of
  what "good" looks like for this SPECIFIC business type at THIS scale in THIS niche.
  Example for a niche business: "For an independent Indian grocery store in a US suburban
  market, 40-60 Google reviews from the local South Asian community represents strong
  social proof. At 23 reviews, this store is still building its digital reputation but
  may have strong word-of-mouth that doesn't show online."
  Example for mainstream: "For an established dentist in a mid-size market, 100+ Google
  reviews is the threshold for consistent local pack visibility."
  Do NOT claim these are statistical percentiles — frame them as expert judgment
  calibrated to the business's specific niche and scale.

- digital_maturity_tier: Assess holistically but RELATIVE TO SCALE. A solo-owner niche
  shop with Google Business Profile + a basic website + WhatsApp for orders might be
  "competent" for its tier — don't penalize it for not having enterprise automation.
  Consider: Does the business have the tools appropriate for its scale? A bootstrap
  business with analytics + tag manager but no booking/chat/email might be "developing"
  for a mainstream business but "competent" for a niche micro-business.

- sentiment_momentum: Synthesize from review velocity, trend direction, recent review
  quality, and response rate. A business with declining velocity AND poor response rate
  has strongly negative momentum. Score -100 to +100. For niche businesses with low
  review volume, weight individual reviews more heavily — one bad review out of 20
  matters more than one bad review out of 2,000.

- do_nothing_projection: Only project cumulative revenue loss when revenue_impact.revenue_basis
  is "verified_public" or "user_provided". If revenue is unverified, set the numeric fields to
  0 and explain the qualitative risk: what trust, visibility, conversion, measurement, or
  retention issue gets worse if nothing changes.

- competitive_gap_matrix: For top 2-3 competitors (from competitive_comparison data),
  build a gap analysis across whichever dimensions you have real data for. ONLY use
  competitors that are TRUE peers (same niche, similar scale). If the competitive data
  includes non-comparable businesses (national chains vs. local shop), exclude them and
  note why. Common dimensions: rating, review_count, website_speed, gbp_completeness.
  Only include dimensions where you have data for BOTH the target and competitor.

- upside_projections: For 2-3 highest-impact fixes, describe the upside and timeline. Use
  dollar revenue upside only when revenue_impact.revenue_basis is "verified_public" or
  "user_provided". Otherwise describe the expected business outcome qualitatively.

SIGNAL ENRICHMENT:
When analyzing business intelligence signals, also reason about:
- What category does each signal fall into? (demand_mismatch, technical_debt,
  reputation_risk, authority_gap, visibility_loss, growth_signal, competitive_threat)
- How severe is it? (1-10 scale, calibrated to the business's niche and scale)
- Does it form a recognizable pattern? If so, name it (e.g., "Demand-Execution Gap",
  "Silent Reputation Erosion", "Infrastructure Bottleneck", "Community-Digital Disconnect")
Include these enrichments in your module_analyses for the relevant modules.
</task>

<output_schema>
Return a single JSON object with this exact structure:

{
  "module_analyses": {
    "gbp_health": {
      "expert_findings": ["string — client-facing finding for a marketer/business owner, anchored to specific data"],
      "hidden_insights": ["string — client-facing interpretation of what the numbers imply"],
      "category_specific_observations": ["string — industry-specific, client-facing observation"],
      "score_override": null,
      "score_rationale": "string — internal score calibration note; do not critique the report/model",
      "recommendations": [
        {
          "title": "string — specific action (max 10 words)",
          "description": "string — exactly what to do and why (1-2 sentences)",
          "impact": "high | medium | low",
          "effort": "high | medium | low",
          "expected_outcome": "string — what changes if they do this (1 sentence)",
          "timeframe": "string — how long until results"
        }
      ],
      "confidence": 0.0
    },
    "review_sentiment": { "...same structure as above..." },
    "website_performance": { "...same structure as above..." },
    "tech_stack": { "...same structure as above..." },
    "social_presence": { "...same structure as above..." },
    "citation_consistency": { "...same structure as above..." },
    "competitive_comparison": { "...same structure as above..." },
    "revenue_impact": { "...same structure as above..." }
  },

  "cross_module_synthesis": {
    "causal_chains": [
      {
        "chain": "string — e.g., 'Low review count → poor local pack ranking → low website traffic → low conversion'",
        "modules_involved": ["string - human area names, not snake_case keys"],
        "business_impact": "string — quantified where possible",
        "fix_sequence": "string — which link in the chain to break first"
      }
    ],
    "compounding_gaps": [
      {
        "description": "string — two or more weaknesses that multiply each other's damage",
        "combined_impact": "string — the multiplied effect",
        "involved_modules": ["string - human area names, not snake_case keys"]
      }
    ],
    "hidden_strengths": [
      {
        "strength": "string — an overlooked positive",
        "leverage_opportunity": "string — how to exploit this advantage"
      }
    ],
    "contradictions": [
      {
        "observation": "string — e.g., 'High ratings but declining review velocity'",
        "possible_explanation": "string",
        "investigation_needed": "string"
      }
    ],
    "competitive_narrative": "string — 2-3 sentences positioning this business in its local market"
  },

  "priority_action_plan": [
    {
      "priority": 1,
      "action": "string — THE single most impactful action",
      "rationale": "string — why this first, referencing cross-module evidence",
      "expected_roi": "string - expected impact. If revenue is unverified, do not mention ROI, dollars, revenue leakage, or monthly recovery",
      "unlocks": "string — what downstream improvements this enables",
      "timeframe": "string"
    }
  ],

  "data_quality_assessment": {
    "modules_with_rich_data": ["string"],
    "modules_with_limited_data": ["string"],
    "modules_with_no_data": ["string"],
    "overall_confidence": 0.0,
    "caveats": ["string — internal limitations. Do not write these as report/model critique."]
  },

  "strategic_intelligence": {
    "contextual_anchors": [
      {
        "module": "string - human area name, not a snake_case key",
        "anchor": "string — what typical/good looks like for this category (from your expertise)",
        "business_position": "string — where this business falls relative to that anchor"
      }
    ],
    "digital_maturity_tier": "foundational | developing | competent | advanced | leading",
    "digital_maturity_rationale": "string — MAX 30 WORDS, why this tier",
    "sentiment_momentum": 0,
    "sentiment_momentum_label": "string — MAX 15 WORDS, trajectory + implication",
    "do_nothing_projection": {
      "month_3_cumulative": 0,
      "month_6_cumulative": 0,
      "month_12_cumulative": 0,
      "narrative": "string — MAX 50 WORDS, what specifically degrades if nothing changes"
    },
    "competitive_gap_matrix": [
      {
        "competitor_name": "string",
        "dimensions": {
          "dimension_name": {
            "target_value": "string",
            "competitor_value": "string",
            "gap": "string — e.g., '-1,196 reviews'",
            "gap_severity": "critical | major | moderate | minor"
          }
        }
      }
    ],
    "upside_projections": [
      {
        "action": "string — what to fix",
        "estimated_weeks": 0,
        "revenue_upside": "string — expected upside. Do not use dollar amounts unless revenue_basis is verified_public or user_provided",
        "secondary_benefits": "string — non-revenue benefits"
      }
    ]
  }
}

Include analyses ONLY for modules where data was provided. Omit modules with null/undefined data.
Include 3-5 priority actions in the action plan.
</output_schema>`;
}

/**
 * Phase 3: Enhanced Narrative Prompt — generates the executive summary.
 *
 * KEY CHANGE: Schema uses SMALL CONTAINERS to prevent essays.
 * Every field has a strict max length. The UI renders these as
 * visual components, not paragraphs.
 */
export function getEnhancedNarrativePrompt(
  businessName: string,
  category: string,
  overallScore: number,
  analysisOutput: any,
  skillOrUnderstanding: CategorySkill | Phase0Understanding
): string {
  const analysisJson = JSON.stringify(analysisOutput, null, 2);

  // Get insider knowledge from either Phase 0 or legacy skill
  let insiderKnowledge: string[];
  if ("business_understanding" in skillOrUnderstanding) {
    insiderKnowledge = skillOrUnderstanding.business_understanding.industry_nuances;
  } else {
    insiderKnowledge = skillOrUnderstanding.insider_knowledge;
  }

  // Determine grade label
  let gradeTier: string;
  if (overallScore >= 80) gradeTier = "strong";
  else if (overallScore >= 60) gradeTier = "solid";
  else if (overallScore >= 40) gradeTier = "developing";
  else gradeTier = "needs_attention";

  return `<role>
You are a senior business consultant delivering a presentation to ${businessName}'s
owner/stakeholders. You have just completed a comprehensive digital health audit.
Your job is to write the executive summary that opens the report.

This is not a data dump. This is a STORY — the story of where this business stands
digitally, what it's costing them, and what the path forward looks like.
</role>

<analysis_data>
${analysisJson}
</analysis_data>

<business_context>
Name: ${businessName}
Category: ${category}
Overall Score: ${overallScore}/100
</business_context>

<instructions>
Write the executive summary. You MUST return EXACTLY this JSON structure.

CRITICAL FORMATTING RULES:
- verdict_headline: MAX 8 WORDS. This is a bold headline, not a sentence.
- verdict_subline: MAX 20 WORDS. One punchy line.
- Each stat in key_stats: label MAX 3 WORDS, value MAX 6 CHARACTERS.
- Each insight: MAX 25 WORDS. Period. Not a paragraph.
- Each action: MAX 15 WORDS for the action, MAX 20 WORDS for the outcome.
- bottom_line: MAX 25 WORDS.

If you exceed these limits, the UI will truncate your text. Write TIGHT.

{
  "verdict_tier": "${gradeTier}",
  "verdict_headline": "string — MAX 8 WORDS, bold verdict (e.g., 'Solid Foundation, Missing Key Growth Levers')",
  "verdict_subline": "string — MAX 20 WORDS, one-line context",

  "key_stats": [
    {
      "label": "string — MAX 3 WORDS (e.g., 'Google Rating', 'Reviews', 'Page Speed')",
      "value": "string — MAX 6 CHARS (e.g., '4.2★', '17', '58/100', '67%')",
      "sentiment": "positive | negative | neutral"
    }
  ],

  "top_strength": {
    "module": "string - human area name, not a snake_case key",
    "headline": "string — MAX 10 WORDS (e.g., 'Strong Google presence with 4.8-star rating')",
    "detail": "string — MAX 25 WORDS"
  },

  "critical_gap": {
    "module": "string - human area name, not a snake_case key",
    "headline": "string — MAX 10 WORDS (e.g., 'Website losing 40% of mobile visitors')",
    "detail": "string — MAX 25 WORDS"
  },

  "three_insights": [
    "string — MAX 25 WORDS each. Three punchy observations that show deep understanding.",
    "string — MAX 25 WORDS each.",
    "string — MAX 25 WORDS each."
  ],

  "hidden_opportunity": "string — MAX 25 WORDS. One surprising positive the owner probably doesn't know.",

  "path_forward": [
    {
      "priority": 1,
      "action": "string — MAX 15 WORDS, specific and executable",
      "outcome": "string — MAX 20 WORDS, what changes"
    },
    {
      "priority": 2,
      "action": "string — MAX 15 WORDS",
      "outcome": "string — MAX 20 WORDS"
    },
    {
      "priority": 3,
      "action": "string — MAX 15 WORDS",
      "outcome": "string — MAX 20 WORDS"
    }
  ],

  "bottom_line": "string — MAX 25 WORDS. Honest, forward-looking wrap-up."
}

STYLE RULES:
- Write like a consultant presenting to a business owner, not a marketer pitching
- Every word must earn its place — ruthlessly cut filler
- Use specific non-revenue numbers: "23 reviews" not "few reviews". Use dollar revenue numbers only when revenue_basis is verified_public or user_provided.
- Never put internal snake_case keys such as website_performance, review_sentiment, or revenue_impact in string values.
- If revenue is unverified, do not use dollar opportunity, ROI, revenue leakage, monthly leakage, or percent-of-revenue language.
- Do NOT use marketing buzzwords ("leverage", "synergy", "optimize", "unlock potential")
- key_stats: Include 4-6 of the most impactful numbers. These render as a dashboard strip.
- three_insights: These are the "aha moments" — things that make the reader think "they really understand my business"

INSIDER KNOWLEDGE TO WEAVE IN (use 1 naturally, don't force it):
${insiderKnowledge.map(s => `- ${s}`).join("\n")}
</instructions>`;
}

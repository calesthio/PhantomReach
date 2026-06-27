/**
 * Audit Orchestrator — Agentic Pipeline v3
 *
 * Architecture:
 * Phase 0: UNDERSTAND — AI dynamically reasons about the business type (replaces static skills)
 * Phase 1: GATHER — GBP lookup + parallel fan-out (modules) + revenue/intel
 * Phase 1.5: AGENTIC RESEARCH — AI uses tools (web search, Places API) to find
 *            real competitors, verify social profiles, and gather intelligence
 * Phase 2: DEEP ANALYZE — 1 frontier model call (all data + Phase 0 context)
 * Phase 3: NARRATE — 1 frontier model call (executive summary, small containers)
 * Phase 4: ASSEMBLE — Weighted scoring, sort recommendations, build final result
 *
 * Key changes from v2:
 * - Phase 0 replaces static category skills with dynamic business understanding
 * - Agentic tool-use loop lets AI search for real competitors and social profiles
 * - Context-aware scoring (no more universal A-F, no "F" grades)
 * - Executive summary uses small containers (no essays)
 * - Unavailable collectors are skipped instead of fabricated
 */

import { lookupGoogleMaps } from "./tools/google-maps";
import { fetchGoogleReviews, fetchYelpReviews, analyzeReviews } from "./tools/reviews";
import { runPageSpeedAudit } from "./tools/pagespeed";
import { detectTechStack } from "./tools/tech-detect";
import { scanSocialProfiles } from "./tools/social-scan";
import { checkCitations } from "./tools/citations";
import { searchCompetitors } from "./tools/competitors";
import { estimateRevenueImpact } from "./tools/revenue-calc";
import { gatherBusinessIntelligence } from "./tools/intent-signals";
import { gatherBusinessEnrichment } from "./tools/business-enrichment";
import { complete, extractJSON, isAIConfigured, completeWithTools } from "@/lib/ai/claude";
import { getNarrativePrompt } from "./prompts/narrative";
import { getOrchestratorSystemPrompt } from "./prompts/orchestrator-system";
import {
  getMasterAnalysisSystemPrompt,
  getMasterAnalysisPrompt,
  getEnhancedNarrativePrompt,
} from "./prompts/master-analysis";
import {
  getPhase0SystemPrompt,
  getPhase0Prompt,
  buildPhase0PromptSection,
} from "./prompts/phase0-understand";
import type { Phase0Understanding } from "./prompts/phase0-understand";
import { matchCategorySkill } from "./skills/registry";
import { scoreToGrade, scoreToLetter, calculateWeightedScore, moduleScoreToGradeLabel } from "./scoring";
import { AGENTIC_TOOL_DEFINITIONS, executeAgenticTool } from "./tools/agentic-tools";
import { isUnavailable } from "./tools/unavailable";
import {
  buildEvidenceReport,
  collectedEvidence,
  evidenceModule,
  failedEvidence,
  notImplementedEvidence,
  skippedEvidence,
  unavailableEvidence,
} from "./evidence";
import { sanitizeAuditResultContent } from "@/lib/reports/content-contract";
import type {
  AuditInput,
  AuditResult,
  Recommendation,
  ReportScores,
  GBPHealthResult,
  ReviewSentimentResult,
  WebsitePerformanceResult,
  TechStackResult,
  SocialPresenceResult,
  CitationConsistencyResult,
  CompetitiveComparisonResult,
  RevenueImpactResult,
  BusinessIntelligenceResult,
  BusinessEnrichmentResult,
  AIAnalysisResult,
  EnhancedRecommendation,
  DigitalMaturityTier,
  EvidenceModule,
} from "@/lib/db/types";
import { repairMojibakeText } from "@/lib/text/repair";

export interface OrchestratorProgress {
  step: string;
  detail: string;
  progress: number; // 0-100
}

export type ProgressCallback = (progress: OrchestratorProgress) => void;

function addRecs(
  allRecs: Recommendation[],
  recs: string[],
  moduleName: string,
  defaultImpact: "high" | "medium" | "low" = "medium"
) {
  recs.forEach((rec, i) => {
    allRecs.push({
      title: rec,
      description: rec,
      impact: i === 0 ? "high" : defaultImpact,
      effort: i < 2 ? "low" : "medium",
      module: moduleName,
    });
  });
}

function truncateForPrompt(value: string | undefined, max = 240): string | undefined {
  if (!value) return value;
  return value.length > max ? `${value.slice(0, max)}...` : value;
}

function compactBusinessEnrichmentForPrompt(enrichment: BusinessEnrichmentResult | undefined) {
  if (!enrichment) return undefined;

  return {
    generated_at: enrichment.generated_at,
    facts: enrichment.facts.slice(0, 10).map((fact) => ({
      kind: fact.kind,
      label: fact.label,
      value: fact.value,
      detail: truncateForPrompt(fact.detail),
      source: fact.source.label,
      source_url: fact.source.url,
      confidence: fact.confidence,
      relevance: fact.relevance,
      why_it_matters: truncateForPrompt(fact.why_it_matters),
    })),
    research_findings: enrichment.research_findings.slice(0, 5).map((finding) => ({
      claim: finding.claim,
      source: finding.source.label,
      source_url: finding.source.url,
      confidence: finding.confidence,
      relevance: finding.relevance,
      evidence_excerpt: truncateForPrompt(finding.evidence_excerpt, 280),
      why_it_matters: truncateForPrompt(finding.why_it_matters, 220),
      verified_status: finding.verified_status,
    })),
    warnings: enrichment.warnings.slice(0, 4),
    coverage: {
      deterministic_sources_checked: enrichment.coverage.deterministic_sources_checked,
      agent_searches_run: enrichment.coverage.agent_searches_run.slice(0, 6),
      pages_fetched_count: enrichment.coverage.pages_fetched.length,
    },
  };
}

function formatRevenueLeakValue(monthlyMid?: number): string {
  if (!monthlyMid || monthlyMid <= 0) {
    return "$0";
  }

  if (monthlyMid < 1000) {
    return `$${Math.round(monthlyMid)}`;
  }

  const roundedK = Math.round(monthlyMid / 100) / 10;
  return `$${roundedK}k`;
}

/**
 * Attempt to extract competitor names (and optionally ratings/review counts) from
 * the agentic research summary text. The summary is natural language produced by the
 * AI tool-use loop, so we look for common patterns like:
 *   - "1. Serenity Moon Tea — 4.5★, 312 reviews"
 *   - "• S Level Tea (4.3/5, 89 reviews)"
 *   - "Competitor: BobaLust Kent"
 * Returns an array of competitor objects ready to replace the geo-search list.
 */
function extractAgenticCompetitors(
  summary: string,
  gbpHealth: GBPHealthResult | undefined
): CompetitiveComparisonResult["competitors"] {
  const competitors: CompetitiveComparisonResult["competitors"] = [];
  const seen = new Set<string>();

  // Match lines that look like competitor entries.
  // Patterns we look for:
  //   "1. Business Name — 4.5★, 312 reviews"
  //   "• Business Name (4.3/5, 89 reviews)"
  //   "- Business Name: 4.2 stars, 150 reviews"
  //   "Competitor: Business Name"
  const lines = summary.split(/\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Skip header/footer-like lines
    if (/^(competitor|social|business|verification|summary|findings|note|source|overall)/i.test(trimmed)) continue;

    // Try to extract rating and review count
    const ratingMatch = trimmed.match(/(\d+\.\d+)\s*(?:★|stars?|\/5|\/10)/i);
    const reviewMatch = trimmed.match(/(\d{2,}(?:,\d{3})*)\s*(?:reviews?|ratings?)/i);

    const rating = ratingMatch ? parseFloat(ratingMatch[1]) : undefined;
    const reviewCount = reviewMatch
      ? parseInt(reviewMatch[1].replace(/,/g, ""), 10)
      : undefined;

    // Extract business name — strip leading bullets, numbers, labels
    let namePart = trimmed
      .replace(/^[\d]+\.\s*/, "")          // "1. Business" → "Business"
      .replace(/^[•\-–*]\s*/, "")          // "• Business" → "Business"
      .replace(/^competitor:\s*/i, "")     // "Competitor: Business" → "Business"
      .replace(/\s*[—–-].*$/, "")           // Strip everything after em-dash
      .replace(/\s*\(.*?\)/, "")           // Strip parenthetical
      .replace(/\s*:\s*\d.*$/, "")         // Strip ":4.2 stars…" suffix
      .trim();

    // Must be a plausible business name: 2-60 chars, at least 2 words or one capitalised word
    if (
      namePart.length < 2 ||
      namePart.length > 60 ||
      /^(https?|www\.|@|#)/i.test(namePart)
    ) continue;

    // Deduplicate
    const key = namePart.toLowerCase();
    if (seen.has(key)) continue;

    // Exclude the target business itself
    if (gbpHealth?.business_name && key.includes(gbpHealth.business_name.toLowerCase())) continue;

    seen.add(key);
    competitors.push({
      name: namePart,
      rating: rating && rating >= 1 && rating <= 5 ? rating : undefined,
      review_count: reviewCount,
      estimated_position: "challenger",
      data_source: "agentic_research",
    });

    if (competitors.length >= 6) break;
  }

  return competitors;
}

function parseCompetitorRating(value: string): number | undefined {
  const match = value.match(/(\d+(?:\.\d+)?)\s*(?:stars?|\/5|\*)/i);
  if (!match) return undefined;

  const rating = Number.parseFloat(match[1]);
  return rating >= 1 && rating <= 5 ? rating : undefined;
}

function parseCompetitorReviewCount(value: string): number | undefined {
  const match = value.match(/(\d{1,3}(?:,\d{3})*|\d+)\s*(?:reviews?|ratings?)/i);
  if (!match) return undefined;

  return Number.parseInt(match[1].replace(/,/g, ""), 10);
}

function sanitizeCompetitorName(value: string): string {
  return value
    .replace(/^\d+\.\s*/, "")
    .replace(/^[-*]\s*/, "")
    .replace(/^competitor:\s*/i, "")
    .replace(/\s*[-:]\s*(?:\d+(?:\.\d+)?\s*(?:stars?|\/5|\*)?.*)$/i, "")
    .replace(/\s*\((?:[^)]*?(?:reviews?|ratings?|stars?|\/5)[^)]*)\)\s*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isPlausibleCompetitorName(name: string, targetBusinessName?: string): boolean {
  const normalized = name.replace(/[*_`]/g, "").replace(/\s+/g, " ").trim();
  const lower = normalized.toLowerCase();
  const words = normalized.split(/\s+/).filter(Boolean);

  if (!normalized || normalized.length < 2 || normalized.length > 80) return false;
  if (words.length > 8) return false;
  if (!/[a-z]/i.test(normalized)) return false;
  if (/[|]/.test(normalized)) return false;
  if (/^(business|notes?|rating|review count|location)$/i.test(normalized)) return false;
  if (/(here('|’)s|i used|requested|structured|observation|summary|table|analysis|search|tourism|competitor list)/i.test(lower)) return false;
  if (/(reviews?|ratings?|stars?|location|notes?|requested|structured|table|business\s+\|)/i.test(lower)) return false;
  if (targetBusinessName && lower.includes(targetBusinessName.toLowerCase())) return false;

  return true;
}

export function extractAgenticCompetitorsSafe(
  summary: string,
  gbpHealth: GBPHealthResult | undefined,
): CompetitiveComparisonResult["competitors"] {
  const competitors: CompetitiveComparisonResult["competitors"] = [];
  const seen = new Set<string>();
  const normalizedSummary = repairMojibakeText(summary);

  function addCompetitor(candidateName: string, rating?: number, reviewCount?: number): void {
    const name = sanitizeCompetitorName(candidateName);
    if (!isPlausibleCompetitorName(name, gbpHealth?.business_name)) return;

    const key = name.toLowerCase();
    if (seen.has(key)) return;

    seen.add(key);
    competitors.push({
      name,
      rating,
      review_count: reviewCount,
      estimated_position: "challenger",
      data_source: "agentic_research",
    });
  }

  const lines = normalizedSummary.split(/\n+/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (/^\|/.test(trimmed)) {
      const cells = trimmed.split("|").map((cell) => cell.trim()).filter(Boolean);
      if (cells.length >= 3 && !cells.every((cell) => /^:?-{2,}:?$/.test(cell))) {
        const headerCell = cells[0].toLowerCase();
        if (!["business", "notes", "rating", "review count", "location"].includes(headerCell)) {
          const joined = cells.join(" ");
          addCompetitor(cells[0], parseCompetitorRating(joined), parseCompetitorReviewCount(joined));
        }
      }
    } else {
      if (/^(competitor|social|verification|summary|findings|note|source|overall|analysis)/i.test(trimmed)) continue;
      if (/^(here('|’)s|i used|the following)/i.test(trimmed)) continue;
      if (trimmed.length > 120 && !/(reviews?|ratings?|stars?|\/5|\*)/i.test(trimmed)) continue;

      const rating = parseCompetitorRating(trimmed);
      const reviewCount = parseCompetitorReviewCount(trimmed);
      const hasExplicitCompetitorCue = /^competitor:/i.test(trimmed);
      const hasStructuredCue = /^(\d+\.\s*|[-*]\s*)/.test(trimmed);

      if (!hasExplicitCompetitorCue && !hasStructuredCue && rating === undefined && reviewCount === undefined) {
        continue;
      }

      addCompetitor(trimmed, rating, reviewCount);
    }

    if (competitors.length >= 6) break;
  }

  return competitors;
}

export async function runAuditPipeline(
  input: AuditInput,
  onProgress?: ProgressCallback
): Promise<{ result: AuditResult; scores: ReportScores }> {
  const report = (step: string, detail: string, progress: number) => {
    onProgress?.({ step, detail, progress });
  };

  const allRecommendations: Recommendation[] = [];
  const evidence: EvidenceModule[] = [];

  // ========== Phase 0: UNDERSTAND (Dynamic Business Intelligence) ==========
  report("understand", "Understanding your business type...", 2);

  let phase0: Phase0Understanding | null = null;

  // ========== Phase 1: Google Maps Lookup ==========
  report("gbp", "Searching Google Maps...", 5);

  let gbpHealth: GBPHealthResult | undefined;
  let placeId: string | undefined;
  let businessWebsite = input.url;
  let businessAddress: string | undefined;
  let businessPhone: string | undefined;
  let businessLat: number | undefined;
  let businessLng: number | undefined;

  try {
    const gmapResult = await lookupGoogleMaps({
      businessName: input.businessName,
      city: input.city,
      state: input.state,
      googleMapsUrl: input.googleMapsUrl,
    });

    if ("analysis" in gmapResult) {
      gbpHealth = gmapResult.analysis;
      evidence.push(collectedEvidence("gbp_health"));
      placeId = gmapResult.raw.place_id;
      if (!businessWebsite && gmapResult.analysis.website) {
        businessWebsite = gmapResult.analysis.website;
      }
      businessAddress = gmapResult.analysis.address;
      businessPhone = gmapResult.analysis.phone;
      if (gmapResult.raw.gps_coordinates) {
        businessLat = gmapResult.raw.gps_coordinates.latitude;
        businessLng = gmapResult.raw.gps_coordinates.longitude;
      }
      addRecs(allRecommendations, gbpHealth.recommendations, "Google Business Profile");
    } else if (isUnavailable(gmapResult)) {
      evidence.push(unavailableEvidence("gbp_health", gmapResult));
    }
  } catch (_e) {
    evidence.push(
      failedEvidence(
        "gbp_health",
        "Google Business Profile lookup failed unexpectedly."
      )
    );
    // GBP lookup failed — continue
  }

  report("gbp", "Google Business Profile analyzed", 15);

  // Now run Phase 0 with GBP data (category, rating, etc.)
  if (isAIConfigured()) {
    try {
      phase0 = await extractJSON<Phase0Understanding>({
        system: getPhase0SystemPrompt(),
        prompt: getPhase0Prompt(
          input.businessName,
          gbpHealth?.category,
          input.city,
          input.state,
          businessWebsite,
          gbpHealth?.rating,
          gbpHealth?.review_count
        ),
      }) ?? null;

      if (phase0) {
        console.log(
          `[orchestrator] Phase 0 complete: "${phase0.business_understanding.true_category}" ` +
          `(search radius: ${phase0.competitor_search_strategy.search_radius_km}km)`
        );
      }
    } catch (e) {
      console.error("[orchestrator] Phase 0 failed:", e);
      // Continue without Phase 0 — fall back to static skills
    }
  }

  report("understand", "Business type analyzed", 18);

  // ========== Phase 1: Parallel Fan-Out (Modules 2-7) ==========
  report("parallel", "Running parallel analysis modules...", 20);

  // Raw data collectors for AI analysis
  let rawReviews: any[] | undefined;
  let rawLighthouse: any | undefined;
  let rawHtmlHead: string | undefined;

  // Module 2: Reviews
  const reviewsTask = (async (): Promise<ReviewSentimentResult | undefined> => {
    try {
      const [googleReviewsResult, yelpResult] = await Promise.all([
        fetchGoogleReviews({
          placeId,
          businessName: input.businessName,
          city: input.city,
        }),
        fetchYelpReviews({
          businessName: input.businessName,
          city: input.city,
        }),
      ]);

      const googleReviews = "reviews" in googleReviewsResult ? googleReviewsResult.reviews : [];
      const googleTotal = "total" in googleReviewsResult ? googleReviewsResult.total : 0;
      const yelpReviews = "reviews" in yelpResult ? yelpResult.reviews : [];
      const yelpRating = "rating" in yelpResult ? (yelpResult.rating as number | undefined) : undefined;
      const yelpReviewCount = "reviewCount" in yelpResult ? (yelpResult.reviewCount as number | undefined) : undefined;

      const hasReviewEvidence =
        googleReviews.length > 0 ||
        yelpReviews.length > 0 ||
        gbpHealth?.rating !== undefined ||
        gbpHealth?.review_count !== undefined ||
        yelpRating !== undefined ||
        yelpReviewCount !== undefined;

      if (!hasReviewEvidence) {
        if (isUnavailable(googleReviewsResult)) {
          evidence.push(unavailableEvidence("review_sentiment", googleReviewsResult));
        } else if (isUnavailable(yelpResult)) {
          evidence.push(unavailableEvidence("review_sentiment", yelpResult));
        } else {
          evidence.push(
            skippedEvidence(
              "review_sentiment",
              "Reviews were skipped because no usable review source was available."
            )
          );
        }
        return undefined;
      }

      if ("rawReviews" in googleReviewsResult && googleReviewsResult.rawReviews) {
        rawReviews = googleReviewsResult.rawReviews as any[];
      }

      const sentiment = analyzeReviews(
        googleReviews,
        yelpReviews,
        gbpHealth?.rating,
        gbpHealth?.review_count,
        yelpRating,
        yelpReviewCount
      );
      addRecs(allRecommendations, sentiment.recommendations, "Reviews & Reputation");
      evidence.push(collectedEvidence("review_sentiment"));
      return sentiment;
    } catch (_e) {
      evidence.push(
        failedEvidence(
          "review_sentiment",
          "Reviews and reputation analysis failed unexpectedly."
        )
      );
      return undefined;
    }
  })();

  // Module 3: PageSpeed
  const pagespeedTask = (async (): Promise<WebsitePerformanceResult | undefined> => {
    if (!businessWebsite) {
      evidence.push(
        skippedEvidence(
          "website_performance",
          "Website performance was skipped because no website URL was found."
        )
      );
      return undefined;
    }
    try {
      const psiResult = await runPageSpeedAudit({ url: businessWebsite });
      if ("analysis" in psiResult) {
        addRecs(allRecommendations, psiResult.analysis.recommendations, "Website Performance");
        if ("rawLighthouse" in psiResult && psiResult.rawLighthouse) {
          rawLighthouse = psiResult.rawLighthouse;
        }
        evidence.push(collectedEvidence("website_performance"));
        return psiResult.analysis;
      }
      if (isUnavailable(psiResult)) {
        evidence.push(unavailableEvidence("website_performance", psiResult));
      }
      return undefined;
    } catch (_e) {
      evidence.push(
        failedEvidence(
          "website_performance",
          "Website performance analysis failed unexpectedly."
        )
      );
      return undefined;
    }
  })();

  // Module 4: Tech Stack
  const techTask = (async (): Promise<TechStackResult | undefined> => {
    if (!businessWebsite) {
      evidence.push(
        skippedEvidence(
          "tech_stack",
          "Technology stack analysis was skipped because no website URL was found."
        )
      );
      return undefined;
    }
    try {
      const techResult = await detectTechStack({ url: businessWebsite });
      if ("analysis" in techResult) {
        addRecs(allRecommendations, techResult.analysis.recommendations, "Technology Stack");
        if ("rawHtmlHead" in techResult && techResult.rawHtmlHead) {
          rawHtmlHead = techResult.rawHtmlHead;
        }
        evidence.push(collectedEvidence("tech_stack"));
        return techResult.analysis;
      }
      if (isUnavailable(techResult)) {
        evidence.push(unavailableEvidence("tech_stack", techResult));
      }
      return undefined;
    } catch (_e) {
      evidence.push(
        failedEvidence(
          "tech_stack",
          "Technology stack analysis failed unexpectedly."
        )
      );
      return undefined;
    }
  })();

  // Module 5: Social Profiles (now honest — extracts real links from website)
  const socialTask = (async (): Promise<SocialPresenceResult | undefined> => {
    try {
      const social = await scanSocialProfiles({
        businessName: input.businessName,
        website: businessWebsite,
        city: input.city,
      });
      addRecs(allRecommendations, social.recommendations, "Social Presence");
      evidence.push(collectedEvidence("social_presence"));
      return social;
    } catch (_e) {
      evidence.push(
        failedEvidence(
          "social_presence",
          "Social presence analysis failed unexpectedly."
        )
      );
      return undefined;
    }
  })();

  // Module 6: Citations
  const citationsTask = (async (): Promise<CitationConsistencyResult | undefined> => {
    try {
      const citations = await checkCitations({
        businessName: input.businessName,
        address: businessAddress,
        phone: businessPhone,
        city: input.city,
        category: gbpHealth?.category,
      });
      if (isUnavailable(citations)) {
        evidence.push(
          notImplementedEvidence(
            "citation_consistency",
            "Directory scan is not available in the local app yet."
          )
        );
        return undefined;
      }
      addRecs(allRecommendations, citations.recommendations, "Citation Consistency");
      evidence.push(collectedEvidence("citation_consistency"));
      return citations;
    } catch (_e) {
      evidence.push(
        failedEvidence(
          "citation_consistency",
          "Citation consistency analysis failed unexpectedly."
        )
      );
      return undefined;
    }
  })();

  // Module 7: Competitors (Phase 0 enhances with AI-generated search queries for true competitors)
  const competitorsTask = (async (): Promise<CompetitiveComparisonResult | undefined> => {
    try {
      const competitors = await searchCompetitors({
        businessName: input.businessName,
        category: gbpHealth?.category,
        city: input.city,
        lat: businessLat,
        lng: businessLng,
        targetRating: gbpHealth?.rating,
        targetReviewCount: gbpHealth?.review_count,
        // Phase 0 enhancements: true category + AI-generated search queries
        trueCategory: phase0?.business_understanding?.true_category,
        competitorSearchQueries: phase0?.competitor_search_strategy?.search_queries,
        nonCompetitorsNote: phase0?.competitor_search_strategy?.non_competitors,
      });
      if (isUnavailable(competitors)) {
        evidence.push(unavailableEvidence("competitive_comparison", competitors));
        return undefined;
      }
      addRecs(allRecommendations, competitors.recommendations, "Competitive Analysis");
      evidence.push(collectedEvidence("competitive_comparison"));
      return competitors;
    } catch (_e) {
      evidence.push(
        failedEvidence(
          "competitive_comparison",
          "Competitive comparison failed unexpectedly."
        )
      );
      return undefined;
    }
  })();

  // Wait for all parallel modules
  const [
    reviewSentiment,
    websitePerformance,
    techStack,
    socialPresence,
    citationConsistency,
    _competitiveComparisonInitial,
  ] = await Promise.all([
    reviewsTask,
    pagespeedTask,
    techTask,
    socialTask,
    citationsTask,
    competitorsTask,
  ]);
  // Declare as let so Phase 1.75 reconciliation can replace geo-search results with agentic peers
  let competitiveComparison = _competitiveComparisonInitial;

  report("parallel", "Parallel modules complete", 55);

  // ========== Phase 1.5: AGENTIC RESEARCH (AI-directed web search) ==========
  report("research", "AI researching your business and competitors...", 58);

  let agenticResearch: any = null;

  if (isAIConfigured() && phase0) {
    try {
      const competitorQueries = phase0.competitor_search_strategy.search_queries;
      const businessType = phase0.business_understanding.true_category;
      const location = `${input.city || ""}${input.state ? `, ${input.state}` : ""}`;

      const researchPrompt = `You are researching "${input.businessName}" (a ${businessType} in ${location}) for a digital health audit.

Your task: Use the available tools to gather REAL information about:

1. COMPETITORS: Find 3-5 actual competitors (other ${businessType.toLowerCase()} businesses) that a customer would realistically choose between. Use these search queries:
${competitorQueries.map((q: string) => `   - "${q}"`).join("\n")}

   For each competitor found, get their name, rating, review count, and location.
   IMPORTANT: ${phase0.competitor_search_strategy.non_competitors}

2. SOCIAL MEDIA: Search for "${input.businessName}" social media profiles. Try:
   - "${input.businessName} ${location} facebook"
   - "${input.businessName} ${location} instagram"
   - "${input.businessName} site:yelp.com"

3. BUSINESS VERIFICATION: Look up any additional intelligence:
   - "${input.businessName} ${location}" (general web presence)
   - Check their website if available: ${businessWebsite || "no website found"}

Return your findings as a structured summary. Be honest about what you found vs. didn't find.`;

      const researchResult = await completeWithTools({
        system: `You are a thorough business researcher. Use the tools to find real, verifiable information. Never fabricate data — if you can't find something, say so. Be efficient with tool calls — 5-10 calls should be sufficient.`,
        prompt: researchPrompt,
        tools: AGENTIC_TOOL_DEFINITIONS,
        executeTools: executeAgenticTool,
        maxTurns: 12,
      });

      if (researchResult.text) {
        agenticResearch = {
          summary: researchResult.text,
          tool_calls_made: researchResult.toolCalls.length,
          tools_used: researchResult.toolCalls.map((tc) => ({
            tool: tc.name,
            input: tc.input,
            result_preview: typeof tc.result === "string" ? tc.result.slice(0, 300) : JSON.stringify(tc.result).slice(0, 300),
          })),
        };
        console.log(`[orchestrator] Agentic research complete: ${researchResult.toolCalls.length} tool calls`);
      }
    } catch (e) {
      console.error("[orchestrator] Agentic research failed:", e);
      // Continue without agentic research — graceful degradation
    }
  }

  // ========== Phase 1.75: COMPETITOR RECONCILIATION ==========
  // If agentic research found real peers, replace the Phase 1 geo-search competitors.
  // This eliminates the contradiction where Phase 2 AI sees two conflicting competitor lists
  // (geo-search returns nearby restaurants of any type while agentic lookup finds true peers).
  if (agenticResearch?.summary && competitiveComparison) {
    const agenticCompetitors = extractAgenticCompetitorsSafe(agenticResearch.summary, gbpHealth);
    if (agenticCompetitors.length >= 2) {
      console.log(`[orchestrator] Reconciling competitors: replacing ${competitiveComparison.competitors.length} geo-search results with ${agenticCompetitors.length} agentic peers`);
      competitiveComparison = {
        ...competitiveComparison,
        competitors: agenticCompetitors,
        agentic_reconciled: true,
        findings: [
          ...competitiveComparison.findings.filter(f => !f.includes("direct competitors identified")),
          `${agenticCompetitors.length} true category peers identified via AI-guided research`,
        ],
      };
    } else {
      console.log(`[orchestrator] Agentic research found <2 parseable competitors (${agenticCompetitors.length}) — keeping geo-search results`);
    }
  }

  report("research", "AI research complete", 65);

  // ========== Phase 2: Revenue Impact + Business Intelligence ==========
  report("revenue", "Estimating revenue impact...", 68);

  let revenueImpact: RevenueImpactResult | undefined;
  let businessIntelligence: BusinessIntelligenceResult | undefined;
  let businessEnrichment: BusinessEnrichmentResult | undefined;

  const [revenueResult, intelligenceResult, enrichmentResult] = await Promise.allSettled([
    estimateRevenueImpact({
      gbpHealth,
      reviewSentiment,
      websitePerformance,
      techStack,
      socialPresence,
      citationConsistency,
      category: gbpHealth?.category,
      // Pass Phase 0 AI revenue baseline — overrides generic category ticket lookup
      revenueBaseline: phase0?.revenue_baseline,
    }),
    gatherBusinessIntelligence({
      businessName: input.businessName,
      city: input.city,
      state: input.state,
      gbpHealth,
      reviewSentiment,
      websitePerformance,
      techStack,
      socialPresence,
      citationConsistency,
    }),
    gatherBusinessEnrichment({
      businessName: input.businessName,
      city: input.city,
      state: input.state,
      address: businessAddress,
      website: businessWebsite,
      phone: businessPhone,
      category: gbpHealth?.category,
      gbpHealth,
      phase0,
      agenticResearchSummary: agenticResearch?.summary,
    }),
  ]);

  if (revenueResult.status === "fulfilled") {
    revenueImpact = revenueResult.value;
    addRecs(allRecommendations, revenueImpact.recommendations, "Revenue Impact", "high");
    evidence.push(collectedEvidence("revenue_impact"));
  } else {
    evidence.push(
      failedEvidence("revenue_impact", "Revenue impact calculation failed unexpectedly.")
    );
  }

  if (intelligenceResult.status === "fulfilled") {
    businessIntelligence = intelligenceResult.value;
    evidence.push(collectedEvidence("business_intelligence"));
  } else {
    evidence.push(
      failedEvidence(
        "business_intelligence",
        "Business intelligence collection failed unexpectedly."
      )
    );
  }

  if (enrichmentResult.status === "fulfilled") {
    businessEnrichment = enrichmentResult.value;
    const enrichmentCount = businessEnrichment.facts.length + businessEnrichment.research_findings.length;
    evidence.push(
      enrichmentCount > 0
        ? collectedEvidence("business_enrichment", "Collected public business facts and cited research.")
        : evidenceModule("business_enrichment", "unavailable", "No reliable public enrichment facts were found.")
    );
  } else {
    evidence.push(
      failedEvidence(
        "business_enrichment",
        "Business context enrichment failed unexpectedly."
      )
    );
  }

  report("revenue", "Revenue impact & intelligence gathered", 70);

  // ========== Phase 2.5: DEEP ANALYZE (1 frontier model call) ==========
  report("analyze", "Running deep AI analysis...", 72);

  let aiAnalysis: AIAnalysisResult | undefined;
  const category = gbpHealth?.category || phase0?.business_understanding.true_category || "local business";

  // Use Phase 0 understanding if available, otherwise fall back to static skills
  const skillOrUnderstanding = phase0 || matchCategorySkill(category);

  if (isAIConfigured()) {
    try {
      const rawDataBundle = {
        gbpHealth,
        rawPlaceDetails: undefined,
        reviewSentiment,
        rawReviews: rawReviews ? rawReviews.slice(0, 10) : undefined, // Limit reviews to avoid huge prompts
        websitePerformance,
        rawLighthouse,
        techStack,
        rawHtmlHead: rawHtmlHead ? rawHtmlHead.slice(0, 5000) : undefined, // Limit HTML head
        socialPresence,
        citationConsistency,
        competitiveComparison,
        revenueImpact,
        businessIntelligence,
        businessEnrichment: compactBusinessEnrichmentForPrompt(businessEnrichment),
        agenticResearch: agenticResearch ? {
          summary: agenticResearch.summary,
          tool_calls_made: agenticResearch.tool_calls_made,
          // Truncate tool results to avoid huge prompts
          tools_used: agenticResearch.tools_used?.slice(0, 5),
        } : null,
      };

      const systemPrompt = getMasterAnalysisSystemPrompt(skillOrUnderstanding, input.customDirection);
      const userPrompt = getMasterAnalysisPrompt(input.businessName, category, rawDataBundle);

      console.log(`[orchestrator] Phase 2.5 DEEP ANALYZE: systemPrompt=${systemPrompt.length} chars, userPrompt=${userPrompt.length} chars, total=${systemPrompt.length + userPrompt.length} chars`);

      aiAnalysis = await extractJSON<AIAnalysisResult>({
        system: systemPrompt,
        prompt: userPrompt,
      }) ?? undefined;

      if (aiAnalysis) {
        console.log(`[orchestrator] Phase 2.5 SUCCESS: got aiAnalysis with ${Object.keys(aiAnalysis.module_analyses || {}).length} module analyses`);
      } else {
        console.error("[orchestrator] Phase 2.5 FAILED: extractJSON returned null (see [ai/anthropic] logs above for details)");
      }
    } catch (e) {
      console.error("[orchestrator] Phase 2.5 EXCEPTION:", e instanceof Error ? e.message : String(e));
    }
  }

  report("analyze", "Deep analysis complete", 82);

  // ========== Phase 3: NARRATE (1 frontier model call) ==========
  // Calculate weighted overall score
  const moduleScores: Record<string, number | undefined> = {
    gbp_health: gbpHealth?.score,
    review_sentiment: reviewSentiment?.score,
    website_performance: websitePerformance?.score,
    tech_stack: techStack?.score,
    social_presence: socialPresence?.score,
    citation_consistency: citationConsistency?.score,
    competitive_comparison: competitiveComparison?.score,
    revenue_impact: revenueImpact?.score,
  };

  const overallScore = calculateWeightedScore(moduleScores, phase0);
  const overallGrade = scoreToGrade(overallScore, phase0);

  const businessName = gbpHealth?.business_name || input.businessName;
  let executiveSummary: import("@/lib/db/types").ExecutiveSummaryData | string;

  report("narrate", "Writing executive summary...", 85);

  if (isAIConfigured() && aiAnalysis) {
    console.log("[orchestrator] Phase 3 NARRATE: Using STRUCTURED path (aiAnalysis available)");
    try {
      const parsedSummary = await extractJSON<import("@/lib/db/types").ExecutiveSummaryData>({
        system: "You are a senior business consultant. Write tight, punchy prose in the requested JSON structure. Every field has a STRICT word limit — respect it.",
        prompt: getEnhancedNarrativePrompt(
          businessName,
          category,
          overallScore,
          aiAnalysis,
          skillOrUnderstanding
        ),
      });

      if (parsedSummary && (parsedSummary.verdict_tier || parsedSummary.verdict_headline)) {
        console.log("[orchestrator] Phase 3 SUCCESS: Got structured ExecutiveSummaryData");
        executiveSummary = parsedSummary;
      } else {
        console.error("[orchestrator] Phase 3: extractJSON returned", parsedSummary === null ? "null" : "object without verdict_tier/headline", "— using template");
        executiveSummary = generateExecutiveSummaryTemplate(
          businessName, overallScore, overallGrade.label,
          gbpHealth, reviewSentiment, websitePerformance,
          techStack, socialPresence, citationConsistency,
          competitiveComparison, revenueImpact
        );
      }
    } catch (e) {
      console.error("[orchestrator] Phase 3 EXCEPTION:", e instanceof Error ? e.message : String(e));
      executiveSummary = generateExecutiveSummaryTemplate(
        businessName, overallScore, overallGrade.label,
        gbpHealth, reviewSentiment, websitePerformance,
        techStack, socialPresence, citationConsistency,
        competitiveComparison, revenueImpact
      );
    }
  } else if (isAIConfigured()) {
    console.warn("[orchestrator] Phase 3 NARRATE: Using PROSE path (aiAnalysis is undefined — Phase 2.5 failed)");
    try {
      const moduleResults = {
        overall_score: overallScore,
        overall_grade: overallGrade.label,
        gbp_health: gbpHealth ? { score: gbpHealth.score, grade: overallGrade.label, completeness_pct: gbpHealth.completeness_pct, rating: gbpHealth.rating, review_count: gbpHealth.review_count } : null,
        review_sentiment: reviewSentiment ? { score: reviewSentiment.score, grade: reviewSentiment.grade, google_rating: reviewSentiment.google_rating, google_review_count: reviewSentiment.google_review_count, trend_direction: reviewSentiment.trend_direction } : null,
        website_performance: websitePerformance ? { score: websitePerformance.score, grade: websitePerformance.grade, performance_score: websitePerformance.performance_score } : null,
        tech_stack: techStack ? { score: techStack.score, grade: techStack.grade, digital_maturity_score: techStack.digital_maturity_score, technology_gaps: techStack.technology_gaps } : null,
        social_presence: socialPresence ? { score: socialPresence.score, grade: socialPresence.grade, platforms_active: socialPresence.platforms_active, platforms_found: socialPresence.platforms_found } : null,
        citation_consistency: citationConsistency ? { score: citationConsistency.score, grade: citationConsistency.grade, total_found: citationConsistency.total_found, total_correct: citationConsistency.total_correct } : null,
        competitive_comparison: competitiveComparison ? { score: competitiveComparison.score, grade: competitiveComparison.grade, target_position: competitiveComparison.target_position } : null,
        revenue_impact: revenueImpact ? { score: revenueImpact.score, grade: revenueImpact.grade, total_monthly_leakage: revenueImpact.total_monthly_leakage } : null,
      };

      const aiSummary = await complete({
        system: getOrchestratorSystemPrompt(input.customDirection),
        prompt: getNarrativePrompt(businessName, moduleResults),
      });

      executiveSummary = aiSummary || generateExecutiveSummaryTemplate(
        businessName, overallScore, overallGrade.label,
        gbpHealth, reviewSentiment, websitePerformance,
        techStack, socialPresence, citationConsistency,
        competitiveComparison, revenueImpact
      );
    } catch (e) {
      console.error("[orchestrator] AI summary failed, using template:", e);
      executiveSummary = generateExecutiveSummaryTemplate(
        businessName, overallScore, overallGrade.label,
        gbpHealth, reviewSentiment, websitePerformance,
        techStack, socialPresence, citationConsistency,
        competitiveComparison, revenueImpact
      );
    }
  } else {
    executiveSummary = generateExecutiveSummaryTemplate(
      businessName, overallScore, overallGrade.label,
      gbpHealth, reviewSentiment, websitePerformance,
      techStack, socialPresence, citationConsistency,
      competitiveComparison, revenueImpact
    );
  }

  report("narrate", "Executive summary complete", 92);

  // ========== Phase 4: ASSEMBLE ==========
  report("assemble", "Assembling final report...", 95);

  // --- Strategic Intelligence mechanical fallbacks ---
  if (aiAnalysis?.strategic_intelligence) {
    const si = aiAnalysis.strategic_intelligence;

    // Fallback: digital maturity tier from tech_stack score if AI didn't produce one
    if (!si.digital_maturity_tier && techStack?.digital_maturity_score != null) {
      const dms = techStack.digital_maturity_score;
      si.digital_maturity_tier = (
        dms <= 25 ? "foundational" :
          dms <= 45 ? "developing" :
            dms <= 65 ? "competent" :
              dms <= 85 ? "advanced" : "leading"
      ) as DigitalMaturityTier;
      si.digital_maturity_rationale = `Derived from tech stack maturity score of ${dms}/100`;
    }

    // Fallback: ensure do_nothing_projection has numbers from revenue data
    if (si.do_nothing_projection && revenueImpact?.show_revenue_dollars) {
      const ml = revenueImpact.total_monthly_leakage.mid;
      if (!si.do_nothing_projection.month_3_cumulative) {
        si.do_nothing_projection.month_3_cumulative = Math.round(ml * 3);
      }
      if (!si.do_nothing_projection.month_6_cumulative) {
        si.do_nothing_projection.month_6_cumulative = Math.round(ml * 6 * 1.15);
      }
      if (!si.do_nothing_projection.month_12_cumulative) {
        si.do_nothing_projection.month_12_cumulative = Math.round(ml * 12 * 1.3);
      }
    } else if (si.do_nothing_projection && revenueImpact && !revenueImpact.show_revenue_dollars) {
      si.do_nothing_projection.month_3_cumulative = 0;
      si.do_nothing_projection.month_6_cumulative = 0;
      si.do_nothing_projection.month_12_cumulative = 0;
    }
  }

  // --- Revenue leak severity + confidence enrichment ---
  if (revenueImpact?.leaks) {
    revenueImpact.leaks = revenueImpact.leaks.map(leak => ({
      ...leak,
      severity: leak.severity ?? (
        leak.mid_estimate >= 2000 ? "critical" as const :
          leak.mid_estimate >= 1000 ? "major" as const :
            leak.mid_estimate >= 500 ? "moderate" as const : "minor" as const
      ),
      confidence: leak.confidence ?? (
        aiAnalysis?.module_analyses?.revenue_impact?.confidence != null
          ? Math.round(aiAnalysis.module_analyses.revenue_impact.confidence * 10)
          : undefined
      ),
    }));
  }

  // --- Business intelligence signal enrichment ---
  if (businessIntelligence?.signals) {
    businessIntelligence.signals = businessIntelligence.signals.map(signal => ({
      ...signal,
      severity_score: signal.severity_score ?? (
        signal.confidence === "high" ? 8 :
          signal.confidence === "medium" ? 5 : 3
      ),
    }));
  }

  // Sort recommendations: high impact first, then low effort first
  const impactOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
  const effortOrder: Record<string, number> = { low: 0, medium: 1, high: 2 };
  allRecommendations.sort((a, b) => {
    const impactDiff = (impactOrder[a.impact] ?? 1) - (impactOrder[b.impact] ?? 1);
    if (impactDiff !== 0) return impactDiff;
    return (effortOrder[a.effort] ?? 1) - (effortOrder[b.effort] ?? 1);
  });

  // Extract enhanced recommendations from AI analysis
  const enhancedRecs: EnhancedRecommendation[] = aiAnalysis?.priority_action_plan?.map((pa) => ({
    title: pa.action,
    description: pa.rationale,
    impact: (pa.priority <= 2 ? "high" : pa.priority <= 4 ? "medium" : "low") as "high" | "medium" | "low",
    effort: "medium" as const,
    expected_outcome: pa.expected_roi,
    timeframe: pa.timeframe,
    module: "cross-module",
  })) || [];

  const result: AuditResult = sanitizeAuditResultContent({
    executive_summary: executiveSummary,
    gbp_health: gbpHealth,
    review_sentiment: reviewSentiment,
    website_performance: websitePerformance,
    tech_stack: techStack,
    social_presence: socialPresence,
    citation_consistency: citationConsistency,
    competitive_comparison: competitiveComparison,
    revenue_impact: revenueImpact,
    business_intelligence: businessIntelligence,
    business_enrichment: businessEnrichment,
    recommendations: allRecommendations.slice(0, 20),
    ai_analysis: aiAnalysis,
    evidence: buildEvidenceReport(evidence),
    enhanced_recommendations: enhancedRecs.length > 0 ? enhancedRecs : undefined,
    category_skill_used: phase0
      ? `dynamic:${phase0.business_understanding.true_category}`
      : matchCategorySkill(category).id,
  });

  // Build scores with context-aware grading
  const scores: ReportScores = {
    overall_grade: overallGrade.label,
    overall_score: overallScore,
    module_grades: {
      gbp_health: gbpHealth ? moduleScoreToGradeLabel(gbpHealth.score) : undefined,
      review_sentiment: reviewSentiment ? moduleScoreToGradeLabel(reviewSentiment.score) : undefined,
      website_performance: websitePerformance ? moduleScoreToGradeLabel(websitePerformance.score) : undefined,
      tech_stack: techStack ? moduleScoreToGradeLabel(techStack.score) : undefined,
      social_presence: socialPresence ? moduleScoreToGradeLabel(socialPresence.score) : undefined,
      citation_consistency: citationConsistency ? moduleScoreToGradeLabel(citationConsistency.score) : undefined,
      competitive_position: competitiveComparison ? moduleScoreToGradeLabel(competitiveComparison.score) : undefined,
      revenue_impact: revenueImpact ? moduleScoreToGradeLabel(revenueImpact.score) : undefined,
    },
  };

  report("complete", "Audit complete!", 100);

  return { result, scores };
}

// ---------------------------------------------------------------------------
// Template fallback (used when AI is not configured)
// ---------------------------------------------------------------------------

function generateExecutiveSummaryTemplate(
  businessName: string,
  overallScore: number,
  gradeLabel: string,
  gbp?: GBPHealthResult,
  reviews?: ReviewSentimentResult,
  website?: WebsitePerformanceResult,
  tech?: TechStackResult,
  social?: SocialPresenceResult,
  citations?: CitationConsistencyResult,
  competitive?: CompetitiveComparisonResult,
  revenue?: RevenueImpactResult
): any {
  const verdict_tier = overallScore >= 80 ? "strong" : overallScore >= 60 ? "solid" : overallScore >= 40 ? "developing" : "needs_attention";

  // Build key stats from available module data
  const key_stats: { label: string; value: string; sentiment: "positive" | "negative" | "neutral" }[] = [];
  if (gbp?.rating) key_stats.push({ label: "Rating", value: `${gbp.rating}★`, sentiment: gbp.rating >= 4.0 ? "positive" : gbp.rating >= 3.0 ? "neutral" : "negative" });
  if (gbp?.review_count !== undefined) key_stats.push({ label: "Reviews", value: `${gbp.review_count}`, sentiment: gbp.review_count >= 50 ? "positive" : gbp.review_count >= 10 ? "neutral" : "negative" });
  if (website?.performance_score !== undefined) key_stats.push({ label: "Speed", value: `${website.performance_score}`, sentiment: website.performance_score >= 70 ? "positive" : website.performance_score >= 50 ? "neutral" : "negative" });
  if (tech?.digital_maturity_score !== undefined) key_stats.push({ label: "Tech", value: `${tech.digital_maturity_score}`, sentiment: tech.digital_maturity_score >= 60 ? "positive" : tech.digital_maturity_score >= 30 ? "neutral" : "negative" });
  if (citations) key_stats.push({ label: "Citations", value: `${citations.total_found > 0 ? Math.round((citations.total_correct / citations.total_found) * 100) : 0}%`, sentiment: citations.total_correct === citations.total_found ? "positive" : "negative" });
  if (revenue?.show_revenue_dollars) {
    key_stats.push({ label: "Leak/mo", value: formatRevenueLeakValue(revenue.total_monthly_leakage.mid), sentiment: "negative" });
  } else if (revenue?.opportunity_assessment) {
    key_stats.push({ label: "Impact", value: revenue.opportunity_assessment.impact_level === "not_material" ? "Minor" : revenue.opportunity_assessment.impact_level.replace(/_/g, " ").slice(0, 6), sentiment: revenue.opportunity_assessment.impact_level === "high" ? "negative" : "neutral" });
  }

  return {
    verdict_tier,
    verdict_headline: `${gradeLabel} Digital Foundation`,
    verdict_subline: `${businessName} scores ${overallScore}/100 on overall digital health.`,
    key_stats,
    top_strength: {
      module: "General",
      headline: `${overallScore}/100 overall score`,
      detail: "Baseline digital presence established."
    },
    critical_gap: {
      module: "General",
      headline: "Gaps costing revenue",
      detail: "Significant digital gaps are likely impacting customer acquisition."
    },
    three_insights: [
      `${businessName} has a ${overallScore}/100 digital health score.`,
      revenue?.show_revenue_dollars ? `Estimated $${revenue.total_monthly_leakage.mid.toLocaleString()}/mo revenue leakage.` : "Business impact is shown as digital signals because revenue was not verified.",
      "Foundational improvements can yield immediate visibility gains."
    ],
    hidden_opportunity: "Quick wins in directory optimization could provide immediate visibility boost.",
    path_forward: [
      { priority: 1, action: "Claim and optimize all directory listings", outcome: "Improved local search visibility" },
      { priority: 2, action: "Install analytics and conversion tracking", outcome: "Measure what's working" },
      { priority: 3, action: "Address top review themes", outcome: "Improve ratings and trust signals" },
    ],
    bottom_line: "Fixing foundational issues will provide a real starting point to build on.",
  };
}

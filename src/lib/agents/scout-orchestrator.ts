/**
 * City Scout Orchestrator v3 — Market Intelligence Pipeline
 *
 * Five-phase pipeline:
 * 1. DISCOVER  — Find businesses via Google Places Text Search (or mock fallback)
 * 2. ENRICH    — Place Details per-business (website, phone, photos, place_id)
 * 3. INTEL     — Run gatherQuickIntel per-business in parallel (free probes)
 * 4. COMPUTE   — Market aggregates, opportunity scores, classifications
 * 5. SYNTHESIZE — One AI call for hook lines, classifications, city insights
 *
 * Design: agent = creative director. The AI agent in Phase 5 receives all
 * raw signals and computes the strategic intelligence layer. We provide
 * tools and data — the agent decides how to interpret and present.
 */

import { gatherQuickIntel } from "./tools/intent-signals";
import { extractJSON } from "@/lib/ai/claude";
import { getProviderSecret } from "@/lib/config/provider-config";
import { getScoutOpportunitySystemPrompt, getScoutOpportunityUserPrompt } from "./prompts/scout-opportunity";
import { repairMojibakeValue } from "@/lib/text/repair";
import type {
  ScoutInput,
  ScoutResult,
  ScoutBusiness,
  ScoutWarmLead,
  ScoutMarketSnapshot,
  ScoutOpportunityDistribution,
  MarketHeatIndex,
  OpportunityClassification,
  SignalLevel,
  OpportunityEstimate,
} from "@/lib/db/types";

// ---------------------------------------------------------------------------
// Main pipeline
// ---------------------------------------------------------------------------

export async function runScoutPipeline(
  input: ScoutInput
): Promise<{ result: ScoutResult }> {
  // ── Phase 1: Discover businesses ──────────────────────────────────────
  const discovered = await discoverBusinesses(
    input.city,
    input.category,
    input.resultCount
  );

  // ── Phase 2: Enrich with Place Details (website, phone, photos) ───────
  const apiKey = await getProviderSecret("google_places_api_key");
  if (apiKey) {
    await enrichWithPlaceDetails(discovered, apiKey);
  }

  // ── Phase 3: Build ScoutBusiness objects + gather intel in parallel ───
  const scoutBusinesses: ScoutBusiness[] = discovered.map((biz, index) => ({
    rank: index + 1,
    business_name: biz.name,
    address: biz.address,
    phone: biz.phone,
    website: biz.website,
    google_rating: biz.rating,
    review_count: biz.reviewCount,
    photos_count: biz.photosCount,
    place_id: biz.placeId,
    priority_score: calculatePriority(biz.rating, biz.reviewCount, !!biz.website, biz.photosCount),
    top_pain_hypothesis: generatePainHypothesis(biz.rating, biz.reviewCount, !!biz.website),
    estimated_revenue_leak: estimateRevenueLeak(biz.rating, biz.reviewCount, !!biz.website),
    mini_audit: {
      executive_summary: `${biz.name} has a priority score indicating opportunity for improvement.`,
      recommendations: generateQuickRecs(biz.rating, biz.reviewCount, !!biz.website).map((r, i) => ({
        title: r,
        description: r,
        impact: (i === 0 ? "high" : "medium") as "high" | "medium" | "low",
        effort: "medium" as "high" | "medium" | "low",
        module: "Mini Audit",
      })),
    },
  }));

  // Gather quick intel per-business in parallel (all free HTTP probes)
  await gatherIntelBatch(scoutBusinesses, input.city);

  // ── Phase 4: Compute market aggregates + opportunity scores ───────────
  computeOpportunityScores(scoutBusinesses);

  // Sort by arbitrage score (highest opportunity first), then priority
  scoutBusinesses.sort((a, b) => (b.arbitrage_score ?? 0) - (a.arbitrage_score ?? 0));
  scoutBusinesses.forEach((b, i) => (b.rank = i + 1));

  const marketSnapshot = computeMarketSnapshot(scoutBusinesses);
  const opportunityDistribution = computeOpportunityDistribution(scoutBusinesses);
  const marketHeatIndex = computeMarketHeatIndex(scoutBusinesses, marketSnapshot);

  // ── Phase 5: AI opportunity synthesis (one LLM call) ──────────────────
  let warmLeads: ScoutWarmLead[] | undefined;
  let warmLeadsNarrative: string | undefined;
  let cityInsights: string[] | undefined;

  try {
    const aiResult = await synthesizeOpportunities(
      input.city,
      input.category,
      scoutBusinesses,
      marketSnapshot,
      marketHeatIndex,
      input.customDirection
    );
    if (aiResult) {
      warmLeads = aiResult.warm_leads;
      warmLeadsNarrative = aiResult.market_narrative;
      cityInsights = aiResult.city_insights;

      // Apply AI-generated per-business fields
      for (const biz of scoutBusinesses) {
        const aiCard = aiResult.opportunity_cards?.find(
          (c) => c.business_name === biz.business_name
        );
        if (aiCard) {
          biz.hook_line = aiCard.hook_line;
          if (aiCard.classification) biz.classification = aiCard.classification;
        }
      }
    }
  } catch (err) {
    console.warn("[scout] AI opportunity synthesis failed, continuing without:", err);
  }

  // If AI isn't configured, derive warm leads + classifications mechanically
  if (!warmLeads) {
    const fallback = deriveWarmLeadsFallback(scoutBusinesses);
    warmLeads = fallback.leads;
    warmLeadsNarrative = fallback.narrative;
  }

  // Derive classifications mechanically if AI didn't provide them
  for (const biz of scoutBusinesses) {
    if (!biz.classification) {
      biz.classification = deriveClassification(biz);
    }
    if (!biz.hook_line) {
      biz.hook_line = deriveHookLine(biz);
    }
  }

  const avgScore = scoutBusinesses.length > 0
    ? Math.round(
      scoutBusinesses.reduce((sum, b) => sum + b.priority_score, 0) /
      scoutBusinesses.length
    )
    : 0;

  const result: ScoutResult = {
    city: input.city,
    category: input.category,
    businesses: scoutBusinesses,
    market_summary: generateMarketSummary(
      input.city,
      input.category,
      scoutBusinesses,
      avgScore
    ),
    avg_digital_maturity: scoutBusinesses.length > 0 ? 100 - avgScore : 0,
    total_scanned: scoutBusinesses.length,
    warm_leads: warmLeads && warmLeads.length > 0 ? warmLeads : undefined,
    warm_leads_narrative: warmLeadsNarrative,

    // v2 fields
    market_snapshot: marketSnapshot,
    opportunity_distribution: opportunityDistribution,
    market_heat_index: marketHeatIndex,
    city_insights: cityInsights,
  };

  return { result: repairMojibakeValue(result) };
}

// ---------------------------------------------------------------------------
// Phase 2: Enrich via Place Details ($0.017 per call)
// ---------------------------------------------------------------------------

async function enrichWithPlaceDetails(
  businesses: DiscoveredBusiness[],
  apiKey: string
): Promise<void> {
  // Limit to 10 to cap cost at ~$0.17 per scout
  const toEnrich = businesses.slice(0, 10);
  const CONCURRENCY = 5;

  for (let i = 0; i < toEnrich.length; i += CONCURRENCY) {
    const batch = toEnrich.slice(i, i + CONCURRENCY);
    const results = await Promise.allSettled(
      batch.map(async (biz) => {
        if (!biz.placeId) return;

        const fields = [
          "name", "formatted_phone_number", "website", "photos",
          "formatted_address", "types",
        ].join(",");

        const params = new URLSearchParams({
          place_id: biz.placeId,
          fields,
          key: apiKey,
        });

        // Cost: $0.017 per Place Details call (Basic + Contact fields)
        const res = await fetch(
          `https://maps.googleapis.com/maps/api/place/details/json?${params}`,
          { signal: AbortSignal.timeout(8000) }
        );

        if (!res.ok) return;
        const data = await res.json();
        const detail = data.result;
        if (!detail) return;

        biz.website = detail.website || biz.website;
        biz.phone = detail.formatted_phone_number || biz.phone;
        biz.photosCount = detail.photos?.length || biz.photosCount;
        biz.address = detail.formatted_address || biz.address;
      })
    );

    // Silently handle failures — non-enriched businesses still work
    results.forEach((r) => {
      if (r.status === "rejected") {
        console.warn("[scout] Place Details enrichment failed:", r.reason);
      }
    });
  }
}

// ---------------------------------------------------------------------------
// Phase 3: Gather intel in batches (concurrent but throttled)
// ---------------------------------------------------------------------------

async function gatherIntelBatch(
  businesses: ScoutBusiness[],
  city: string
): Promise<void> {
  const CONCURRENCY = 5;

  for (let i = 0; i < businesses.length; i += CONCURRENCY) {
    const batch = businesses.slice(i, i + CONCURRENCY);
    const results = await Promise.allSettled(
      batch.map((biz) =>
        gatherQuickIntel({
          businessName: biz.business_name,
          website: biz.website,
          address: biz.address,
          city,
          rating: biz.google_rating,
          reviewCount: biz.review_count,
        })
      )
    );

    results.forEach((r, idx) => {
      if (r.status === "fulfilled" && r.value.signal_count > 0) {
        batch[idx].intelligence = r.value;
      }
    });
  }
}

// ---------------------------------------------------------------------------
// Phase 4: Compute opportunity scores + market aggregates
// ---------------------------------------------------------------------------

function computeOpportunityScores(businesses: ScoutBusiness[]): void {
  if (businesses.length === 0) {
    return;
  }

  // Compute peer averages for relative scoring
  const avgRating = businesses.reduce((s, b) => s + (b.google_rating ?? 0), 0) / businesses.length;
  const avgReviews = businesses.reduce((s, b) => s + (b.review_count ?? 0), 0) / businesses.length;

  for (const biz of businesses) {
    const rating = biz.google_rating ?? 0;
    const reviews = biz.review_count ?? 0;
    const hasWebsite = !!biz.website;
    const photosCount = biz.photos_count ?? 0;
    const intelSignals = biz.intelligence?.signals ?? [];
    const highConfSignals = intelSignals.filter((s) => s.confidence === "high");

    // Demand Score: rating + review volume + income proxy
    const highIncome = intelSignals.some((s) => s.headline.includes("high-income"));
    let demandRaw = 0;
    if (rating >= 4.0) demandRaw += 30;
    else if (rating >= 3.5) demandRaw += 15;
    if (reviews >= 100) demandRaw += 30;
    else if (reviews >= 30) demandRaw += 15;
    if (highIncome) demandRaw += 20;
    if (reviews > avgReviews * 1.5) demandRaw += 20;
    biz.demand_score = demandRaw >= 60 ? "high" : demandRaw >= 30 ? "medium" : "low";

    // Execution Risk: mobile issues, no website, low photos, no SEO basics
    let riskRaw = 0;
    if (!hasWebsite) riskRaw += 40;
    if (photosCount < 10) riskRaw += 15;
    if (photosCount < 5) riskRaw += 10;
    const hasMobileIssues = intelSignals.some(
      (s) => s.headline.includes("Core Web Vital") || s.headline.includes("No real-user")
    );
    if (hasMobileIssues) riskRaw += 20;
    const noSEO = intelSignals.some((s) => s.headline.includes("SEO basics missing"));
    if (noSEO) riskRaw += 15;
    biz.execution_risk = riskRaw >= 50 ? "high" : riskRaw >= 25 ? "moderate" as SignalLevel : "low";

    // Opportunity Estimate (revenue band)
    let oppRaw = 0;
    if (!hasWebsite) oppRaw += 40;
    if (rating >= 4.0 && !hasWebsite) oppRaw += 20;
    if (highConfSignals.length >= 3) oppRaw += 20;
    if (reviews >= 50 && riskRaw >= 30) oppRaw += 20;
    biz.opportunity_estimate = oppRaw >= 50 ? "high" : oppRaw >= 25 ? "moderate" : "low";

    // Arbitrage Score (sort key): high demand + high execution risk = highest arbitrage
    biz.arbitrage_score = Math.min(100, Math.round(demandRaw * 0.4 + riskRaw * 0.4 + highConfSignals.length * 5));

    // Ease Score: low effort fixes + medium upside
    const easySignals = intelSignals.filter((s) =>
      s.headline.includes("review") || s.headline.includes("SEO") || s.headline.includes("photo")
    ).length;
    biz.ease_score = Math.min(100, 30 + easySignals * 15 + (rating >= 3.5 ? 20 : 0));

    // Risk Score: declining trend, low rating, reputation issues
    let riskScore = 0;
    if (rating < 3.5) riskScore += 40;
    if (rating < 3.0) riskScore += 20;
    if (reviews >= 50 && rating < 3.5) riskScore += 20;
    if (highConfSignals.length >= 2) riskScore += 10;
    biz.risk_score = Math.min(100, riskScore);
  }
}

function computeMarketSnapshot(businesses: ScoutBusiness[]): ScoutMarketSnapshot {
  const n = businesses.length;
  if (n === 0) {
    return {
      businesses_scanned: 0,
      avg_rating: 0,
      avg_reviews: 0,
      avg_response_rate: null,
      pct_mobile_issues: 0,
      pct_missing_booking_cta: 0,
      pct_low_photos: 0,
      pct_no_website: 0,
      median_household_income: null,
      income_tier: null,
    };
  }

  const avgRating = parseFloat((businesses.reduce((s, b) => s + (b.google_rating ?? 0), 0) / n).toFixed(1));
  const avgReviews = Math.round(businesses.reduce((s, b) => s + (b.review_count ?? 0), 0) / n);

  const noWebsite = businesses.filter((b) => !b.website).length;
  const lowPhotos = businesses.filter((b) => (b.photos_count ?? 0) < 20).length;

  // Mobile issues: detected via CrUX or no-website signals
  const mobileIssues = businesses.filter((b) =>
    b.execution_risk === "high" || !b.website
  ).length;

  // Missing booking CTA: businesses without booking in their intel
  const missingBooking = businesses.filter((b) => {
    if (!b.website) return true;
    const signals = b.intelligence?.signals ?? [];
    return !signals.some((s) => s.headline.includes("booking"));
  }).length;

  // Income proxy from census signals
  const incomeSignals = businesses
    .flatMap((b) => b.intelligence?.signals ?? [])
    .filter((s) => s.headline.includes("income"));
  let medianIncome: number | null = null;
  let incomeTier: "high" | "moderate" | "value" | null = null;

  if (incomeSignals.length > 0) {
    const match = incomeSignals[0].headline.match(/\$(\d+(?:\.\d+)?)k/i);
    if (match) {
      medianIncome = Math.round(parseFloat(match[1]) * 1000);
      incomeTier = medianIncome >= 85000 ? "high" : medianIncome >= 40000 ? "moderate" : "value";
    }
  }

  return {
    businesses_scanned: n,
    avg_rating: avgRating,
    avg_reviews: avgReviews,
    avg_response_rate: null, // Place Details doesn't give this — future enhancement
    pct_mobile_issues: Math.round((mobileIssues / n) * 100),
    pct_missing_booking_cta: Math.round((missingBooking / n) * 100),
    pct_low_photos: Math.round((lowPhotos / n) * 100),
    pct_no_website: Math.round((noWebsite / n) * 100),
    median_household_income: medianIncome,
    income_tier: incomeTier,
  };
}

function computeOpportunityDistribution(businesses: ScoutBusiness[]): ScoutOpportunityDistribution {
  const dist: ScoutOpportunityDistribution = {
    market_leaders: 0,
    demand_rich_conversion_leaking: 0,
    reputation_vulnerable: 0,
    visibility_suppressed: 0,
    low_visibility_underdogs: 0,
    high_arbitrage: 0,
  };

  for (const biz of businesses) {
    const cls = biz.classification ?? deriveClassification(biz);
    switch (cls) {
      case "market_leader": dist.market_leaders++; break;
      case "demand_rich_conversion_leaking": dist.demand_rich_conversion_leaking++; break;
      case "reputation_vulnerable": dist.reputation_vulnerable++; break;
      case "visibility_suppressed": dist.visibility_suppressed++; break;
      case "low_visibility_underdog": dist.low_visibility_underdogs++; break;
      case "high_arbitrage": dist.high_arbitrage++; break;
    }
  }

  return dist;
}

function computeMarketHeatIndex(
  businesses: ScoutBusiness[],
  snapshot: ScoutMarketSnapshot
): MarketHeatIndex {
  if (businesses.length === 0) {
    return {
      score: 0,
      label: "No Data",
      factors: ["No businesses were available for this market scan."],
    };
  }

  let score = 50; // baseline
  const factors: string[] = [];

  // High execution gaps → higher opportunity
  if (snapshot.pct_no_website >= 30) {
    score += 15;
    factors.push(`${snapshot.pct_no_website}% of businesses have no website`);
  }
  if (snapshot.pct_mobile_issues >= 40) {
    score += 10;
    factors.push(`${snapshot.pct_mobile_issues}% have mobile/performance issues`);
  }
  if (snapshot.pct_low_photos >= 50) {
    score += 5;
    factors.push("Over half the market has under-invested in visual content");
  }

  // High income area amplifies ROI
  if (snapshot.income_tier === "high") {
    score += 10;
    factors.push("High-income service area amplifies digital ROI");
  }

  // Spread of opportunity (not all leaders)
  const highArb = businesses.filter((b) => (b.arbitrage_score ?? 0) >= 60).length;
  const pctHighArb = (highArb / businesses.length) * 100;
  if (pctHighArb >= 30) {
    score += 10;
    factors.push(`${Math.round(pctHighArb)}% of businesses show high arbitrage potential`);
  }

  // Average rating suggests room for improvement
  if (snapshot.avg_rating < 4.0) {
    score += 5;
    factors.push("Below-average market rating suggests reputation management opportunities");
  }

  score = Math.min(100, Math.max(0, score));

  const label = score >= 75 ? "High Opportunity" : score >= 50 ? "Moderate Opportunity" : score >= 30 ? "Competitive Market" : "Saturated Market";

  return { score, label, factors };
}

// ---------------------------------------------------------------------------
// Mechanical classification + hook line derivation
// ---------------------------------------------------------------------------

function deriveClassification(biz: ScoutBusiness): OpportunityClassification {
  const rating = biz.google_rating ?? 0;
  const reviews = biz.review_count ?? 0;
  const hasWebsite = !!biz.website;
  const highSignals = (biz.intelligence?.signals ?? []).filter((s) => s.confidence === "high").length;

  // Market leader: high rating + many reviews + website + low execution risk
  if (rating >= 4.3 && reviews >= 100 && hasWebsite && biz.execution_risk === "low") {
    return "market_leader";
  }

  // Demand-rich but conversion leaking: good demand + high execution risk
  if (biz.demand_score === "high" && (biz.execution_risk === "high" || biz.execution_risk === "moderate" as SignalLevel)) {
    return "demand_rich_conversion_leaking";
  }

  // High arbitrage: strong signals + significant gaps
  if (highSignals >= 3 && rating >= 3.5) {
    return "high_arbitrage";
  }

  // Reputation vulnerable: low rating with decent volume
  if (rating < 3.5 && reviews >= 20) {
    return "reputation_vulnerable";
  }

  // Visibility suppressed: low reviews or no website in a good area
  if (reviews < 20 || !hasWebsite) {
    return "visibility_suppressed";
  }

  // Low visibility underdog
  return "low_visibility_underdog";
}

function deriveHookLine(biz: ScoutBusiness): string {
  const rating = biz.google_rating ?? 0;
  const reviews = biz.review_count ?? 0;
  const hasWebsite = !!biz.website;
  const photosCount = biz.photos_count ?? 0;
  const signals = biz.intelligence?.signals ?? [];

  // Strong reputation + no website
  if (rating >= 4.0 && !hasWebsite) {
    return `${rating}-star rating with ${reviews} reviews but no website — virtually invisible to high-intent search traffic.`;
  }

  // Strong reputation + weak mobile
  const mobileIssue = signals.find((s) =>
    s.headline.includes("Core Web Vital") || s.headline.includes("No real-user")
  );
  if (rating >= 4.0 && reviews >= 50 && mobileIssue) {
    return `Strong ${rating} rating with ${reviews.toLocaleString()} reviews but mobile performance failing — likely leaking high-intent traffic.`;
  }

  // Low reviews in good area
  const incomeSignal = signals.find((s) => s.headline.includes("high-income"));
  if (reviews < 30 && incomeSignal) {
    return `Only ${reviews} reviews in a high-income area${photosCount < 10 ? " with minimal photos" : ""} — under-indexed discovery opportunity.`;
  }

  // Low rating with volume
  if (rating < 3.5 && reviews >= 50) {
    return `${reviews} reviews at ${rating} stars — volume suggests demand but reputation is actively suppressing visibility.`;
  }

  // No website at all
  if (!hasWebsite) {
    return `No website detected — this business is missing 70%+ of potential online leads in an increasingly digital market.`;
  }

  // Low photos
  if (photosCount < 5 && rating >= 3.5) {
    return `Decent ${rating} rating but only ${photosCount} photos — visual content gap reducing click-through from Google Maps.`;
  }

  // SEO basics missing
  const seoMissing = signals.find((s) => s.headline.includes("SEO basics missing"));
  if (seoMissing && hasWebsite) {
    return `Website exists but missing fundamental SEO infrastructure — unlikely to rank for valuable local search terms.`;
  }

  // Fallback
  return `Digital presence shows ${biz.intelligence?.signal_count ?? 0} improvement signals — run full audit for detailed opportunity analysis.`;
}

// ---------------------------------------------------------------------------
// Phase 5: AI opportunity synthesis
// ---------------------------------------------------------------------------

interface OpportunityAIOutput {
  warm_leads: ScoutWarmLead[];
  market_narrative: string;
  city_insights: string[];
  opportunity_cards: {
    business_name: string;
    hook_line: string;
    classification: OpportunityClassification;
  }[];
  total_warm: number;
  total_analyzed: number;
}

async function synthesizeOpportunities(
  city: string,
  category: string,
  businesses: ScoutBusiness[],
  snapshot: ScoutMarketSnapshot,
  heatIndex: MarketHeatIndex,
  customDirection?: string
): Promise<OpportunityAIOutput | null> {
  return extractJSON<OpportunityAIOutput>({
    system: getScoutOpportunitySystemPrompt(),
    prompt: getScoutOpportunityUserPrompt({
      city,
      category,
      businesses,
      snapshot,
      heatIndex,
      customDirection,
    }),
  });
}

// ---------------------------------------------------------------------------
// Fallback: mechanical warm lead derivation (when AI is not configured)
// ---------------------------------------------------------------------------

function deriveWarmLeadsFallback(
  businesses: ScoutBusiness[]
): { leads: ScoutWarmLead[]; narrative: string } {
  const leads: ScoutWarmLead[] = [];

  for (const biz of businesses) {
    if (!biz.intelligence || biz.intelligence.signal_count === 0) continue;

    const signals = biz.intelligence.signals;
    const highConfSignals = signals.filter((s) => s.confidence === "high");

    // Needs at least 2 high-confidence signals to be considered warm
    if (highConfSignals.length < 2) continue;

    const keySignals = highConfSignals.slice(0, 3).map((s) => s.headline);

    leads.push({
      business_name: biz.business_name,
      intent_score: Math.min(
        100,
        60 + highConfSignals.length * 8 + (biz.priority_score > 70 ? 10 : 0)
      ),
      why_now: `${biz.business_name} shows ${highConfSignals.length} strong buying signals: ${keySignals.slice(0, 2).join(" and ")}. Combined with a priority score of ${biz.priority_score}/100, this business is likely ready for digital services.`,
      opening_angle: biz.top_pain_hypothesis,
      key_signals: keySignals,
    });
  }

  // Sort by intent score descending
  leads.sort((a, b) => b.intent_score - a.intent_score);

  const narrative =
    leads.length > 0
      ? `Found ${leads.length} warm leads out of ${businesses.length} businesses scanned. These businesses show the strongest combination of digital gaps and buying intent signals.`
      : `No strong warm leads detected in this scan. The businesses in this market either have adequate digital presence or lack enough signals to indicate active buying intent.`;

  return { leads: leads.slice(0, 8), narrative };
}

// ---------------------------------------------------------------------------
// Phase 1: Discover businesses
// ---------------------------------------------------------------------------

interface DiscoveredBusiness {
  name: string;
  address: string;
  phone: string;
  website?: string;
  placeId?: string;
  rating: number;
  reviewCount: number;
  photosCount: number;
  priorityScore: number;
  painHypothesis: string;
  revenueLeak: string;
  recommendations: string[];
}

async function discoverBusinesses(
  city: string,
  category: string,
  count: number
): Promise<DiscoveredBusiness[]> {
  const apiKey = await getProviderSecret("google_places_api_key");

  if (!apiKey) {
    return [];
  }

  if (apiKey) {
    try {
      const query = `${category} in ${city}`;
      const params = new URLSearchParams({
        query,
        key: apiKey,
        language: "en",
      });

      const res = await fetch(
        `https://maps.googleapis.com/maps/api/place/textsearch/json?${params}`,
        { signal: AbortSignal.timeout(10000) }
      );

      if (res.ok) {
        const data = await res.json();
        const results = (data.results || []).slice(0, count);

        if (results.length > 0) {
          return results.map((r: any) => {
            const rating = r.rating || 0;
            const reviews = r.user_ratings_total || 0;
            const photosCount = r.photos?.length || 0;

            return {
              name: r.name || "Unknown Business",
              address: r.formatted_address || "",
              phone: "", // Text Search doesn't return phone — enriched in Phase 2
              website: undefined, // Enriched in Phase 2
              placeId: r.place_id,
              rating,
              reviewCount: reviews,
              photosCount,
              priorityScore: calculatePriority(rating, reviews, false, photosCount),
              painHypothesis: generatePainHypothesis(rating, reviews, false),
              revenueLeak: estimateRevenueLeak(rating, reviews, false),
              recommendations: generateQuickRecs(rating, reviews, false),
            };
          });
        }
      }
    } catch {
      // Fall through to mock
    }
  }

  return [];
}

// ---------------------------------------------------------------------------
// Scoring helpers
// ---------------------------------------------------------------------------

function calculatePriority(
  rating: number,
  reviews: number,
  hasWebsite: boolean,
  photosCount?: number
): number {
  let score = 50;
  if (rating < 4.0) score += 15;
  if (rating < 3.5) score += 10;
  if (reviews < 20) score += 15;
  if (reviews < 5) score += 10;
  if (!hasWebsite) score += 20;
  if (photosCount !== undefined && photosCount < 10) score += 5;
  return Math.min(100, score);
}

function generatePainHypothesis(
  rating: number,
  reviews: number,
  hasWebsite: boolean
): string {
  if (!hasWebsite)
    return "No website detected — losing all organic web traffic";
  if (rating < 3.5) return "Low ratings driving customers to competitors";
  if (reviews < 10)
    return "Low review count reducing trust signals for new customers";
  if (rating < 4.0)
    return "Below-average rating suppressing Google Maps visibility";
  return "Digital presence has room for optimization";
}

function estimateRevenueLeak(
  rating: number,
  reviews: number,
  hasWebsite: boolean
): string {
  let base = 1000;
  if (!hasWebsite) base += 3000;
  if (rating < 3.5) base += 2000;
  if (reviews < 10) base += 1500;
  return `$${base.toLocaleString()}-$${(base + 2000).toLocaleString()}/mo`;
}

function generateQuickRecs(
  rating: number,
  reviews: number,
  hasWebsite: boolean
): string[] {
  const recs: string[] = [];
  if (!hasWebsite) recs.push("Create a professional website immediately");
  if (reviews < 20) recs.push("Implement a review generation strategy");
  if (rating < 4.0)
    recs.push("Address negative review themes to improve rating");
  recs.push("Complete all Google Business Profile fields");
  recs.push("Add online booking capability");
  return recs.slice(0, 3);
}

// ---------------------------------------------------------------------------
// Market summary (template fallback)
// ---------------------------------------------------------------------------

function generateMarketSummary(
  city: string,
  category: string,
  businesses: ScoutBusiness[],
  avgPriorityScore: number
): string {
  if (businesses.length === 0) {
    return `No businesses were scanned for ${category.toLowerCase()} in ${city}. Add a Google Places API key to collect real Google Places data, or broaden the category and confirm the city name.`;
  }

  const highOpp = businesses.filter((b) => b.priority_score >= 70).length;
  const medOpp = businesses.filter(
    (b) => b.priority_score >= 40 && b.priority_score < 70
  ).length;
  const lowOpp = businesses.filter((b) => b.priority_score < 40).length;
  const avgRating = (
    businesses.reduce((sum, b) => sum + (b.google_rating || 0), 0) /
    businesses.length
  ).toFixed(1);

  return (
    `Scanned ${businesses.length} ${category.toLowerCase()} businesses in ${city}. ` +
    `The average Google rating is ${avgRating} stars. ` +
    `${highOpp} businesses have high opportunity scores (significant digital gaps), ` +
    `${medOpp} have moderate opportunities, and ${lowOpp} are relatively well-optimized. ` +
    `The average digital maturity for ${category.toLowerCase()} in ${city} is ${100 - avgPriorityScore}/100 — ` +
    `${avgPriorityScore >= 60 ? "well below" : avgPriorityScore >= 40 ? "slightly below" : "near"} the national average for this vertical.`
  );
}

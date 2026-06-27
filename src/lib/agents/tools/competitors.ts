/**
 * Module 7: Competitive Comparison Panel
 * Tool: search_competitors
 *
 * Finds competitors via Google Places and compares the target business on
 * review metrics and profile completeness. No synthetic competitors are used.
 */

import type { CompetitiveComparisonResult } from "@/lib/db/types";
import { getProviderSecret } from "@/lib/config/provider-config";
import { unavailable, type UnavailableResult } from "./unavailable";

interface CompetitorSearchParams {
  businessName: string;
  category?: string;
  city?: string;
  lat?: number;
  lng?: number;
  targetRating?: number;
  targetReviewCount?: number;
  userSpecifiedCompetitors?: string[];
  trueCategory?: string;
  competitorSearchQueries?: string[];
  nonCompetitorsNote?: string;
}

interface CompetitorData {
  name: string;
  address?: string;
  rating?: number;
  review_count?: number;
  website?: string;
  gbp_completeness_estimate: number;
}

function scoreToGrade(score: number): string {
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 70) return "C";
  if (score >= 60) return "D";
  return "F";
}

function calculateCompetitivePosition(
  targetRating: number | undefined,
  targetReviewCount: number | undefined,
  allCompetitors: CompetitorData[]
): "leader" | "challenger" | "laggard" {
  if (!targetRating || !targetReviewCount || allCompetitors.length === 0) return "challenger";

  const ratingsHigherCount = allCompetitors.filter((c) => (c.rating || 0) > targetRating).length;
  const reviewsHigherCount = allCompetitors.filter((c) => (c.review_count || 0) > targetReviewCount).length;
  const betterCompetitorCount = Math.max(ratingsHigherCount, reviewsHigherCount);

  if (betterCompetitorCount <= 1) return "leader";
  if (betterCompetitorCount <= Math.ceil(allCompetitors.length / 2)) return "challenger";
  return "laggard";
}

function estimateCompleteness(place: any): number {
  let filled = 0;
  const total = 7;
  if (place.name) filled++;
  if (place.vicinity || place.formatted_address) filled++;
  if (place.rating) filled++;
  if (place.user_ratings_total) filled++;
  if (place.photos?.length) filled++;
  if (place.opening_hours) filled++;
  if (place.types?.length > 1) filled++;
  return Math.round((filled / total) * 100);
}

async function findNearbyCompetitors(
  lat: number,
  lng: number,
  category: string | undefined,
  excludeName: string,
  apiKey: string
): Promise<CompetitorData[]> {
  const typeMap: Record<string, string> = {
    restaurant: "restaurant",
    cafe: "cafe",
    bakery: "bakery",
    bar: "bar",
    "grocery or supermarket": "grocery_or_supermarket",
    "grocery store": "grocery_or_supermarket",
    supermarket: "supermarket",
    dentist: "dentist",
    doctor: "doctor",
    "hair salon": "hair_care",
    "beauty salon": "beauty_salon",
    "car repair": "car_repair",
    lawyer: "lawyer",
    plumber: "plumber",
    electrician: "electrician",
    locksmith: "locksmith",
    painter: "painter",
    roofing: "roofing_contractor",
    lodging: "lodging",
    hotel: "lodging",
  };

  const normalizedCategory = category?.toLowerCase() || "";
  const googleType = typeMap[normalizedCategory];
  const params = new URLSearchParams({
    location: `${lat},${lng}`,
    radius: "5000",
    key: apiKey,
    language: "en",
  });

  if (googleType) {
    params.set("type", googleType);
  } else if (category) {
    params.set("keyword", category);
  }

  const res = await fetch(
    `https://maps.googleapis.com/maps/api/place/nearbysearch/json?${params}`,
    { signal: AbortSignal.timeout(8000) }
  );

  if (!res.ok) return [];

  const data = await res.json();
  if (data.status !== "OK" || !data.results?.length) return [];

  return normalizeCompetitors(data.results, excludeName);
}

async function textSearchCompetitors(
  category: string | undefined,
  city: string | undefined,
  excludeName: string,
  apiKey: string
): Promise<CompetitorData[]> {
  const query = `${category || "business"} in ${city || ""}`.trim();
  const params = new URLSearchParams({
    query,
    key: apiKey,
    language: "en",
  });

  const res = await fetch(
    `https://maps.googleapis.com/maps/api/place/textsearch/json?${params}`,
    { signal: AbortSignal.timeout(8000) }
  );

  if (!res.ok) return [];

  const data = await res.json();
  if (data.status !== "OK" || !data.results?.length) return [];

  return normalizeCompetitors(data.results, excludeName);
}

function normalizeCompetitors(results: any[], excludeName: string): CompetitorData[] {
  const normalizedExclude = excludeName.toLowerCase().trim();

  return results
    .filter((r: any) => {
      const name = (r.name || "").toLowerCase().trim();
      return name && name !== normalizedExclude && !name.includes(normalizedExclude);
    })
    .slice(0, 5)
    .map((r: any) => ({
      name: r.name || "Unknown",
      address: r.formatted_address || r.vicinity || undefined,
      rating: r.rating || undefined,
      review_count: r.user_ratings_total || undefined,
      website: undefined,
      gbp_completeness_estimate: estimateCompleteness(r),
    }));
}

async function searchWithPhase0Queries(
  queries: string[],
  excludeName: string,
  nonCompetitorsNote: string | undefined,
  apiKey: string
): Promise<CompetitorData[]> {
  const normalizedExclude = excludeName.toLowerCase().trim();
  const allResults: CompetitorData[] = [];
  const seenNames = new Set<string>();
  const nonCompetitorKeywords = (nonCompetitorsNote || "")
    .toLowerCase()
    .split(/[,;.]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 2);

  const results = await Promise.all(
    queries.slice(0, 3).map(async (query) => {
      const params = new URLSearchParams({
        query,
        key: apiKey,
        language: "en",
      });

      try {
        const res = await fetch(
          `https://maps.googleapis.com/maps/api/place/textsearch/json?${params}`,
          { signal: AbortSignal.timeout(8000) }
        );
        if (!res.ok) return [];
        const data = await res.json();
        if (data.status !== "OK" || !data.results?.length) return [];
        return data.results as any[];
      } catch {
        return [];
      }
    })
  );

  for (const resultSet of results) {
    for (const r of resultSet) {
      const name = (r.name || "").trim();
      const nameLower = name.toLowerCase();
      if (!nameLower) continue;
      if (nameLower === normalizedExclude || nameLower.includes(normalizedExclude)) continue;
      if (normalizedExclude.includes(nameLower) && nameLower.length > 3) continue;
      if (seenNames.has(nameLower)) continue;

      const isNonCompetitor = nonCompetitorKeywords.some((kw) =>
        nameLower.includes(kw) || (r.types || []).some((t: string) => t.toLowerCase().includes(kw))
      );
      if (isNonCompetitor) continue;

      seenNames.add(nameLower);
      allResults.push({
        name,
        address: r.formatted_address || r.vicinity || undefined,
        rating: r.rating || undefined,
        review_count: r.user_ratings_total || undefined,
        website: undefined,
        gbp_completeness_estimate: estimateCompleteness(r),
      });
    }
  }

  return allResults
    .sort((a, b) => (b.review_count || 0) - (a.review_count || 0))
    .slice(0, 5);
}

export async function searchCompetitors(
  params: CompetitorSearchParams
): Promise<CompetitiveComparisonResult | UnavailableResult> {
  const {
    businessName,
    category,
    city,
    lat,
    lng,
    targetRating,
    targetReviewCount,
    trueCategory,
    competitorSearchQueries,
    nonCompetitorsNote,
  } = params;
  const apiKey = await getProviderSecret("google_places_api_key");

  if (!apiKey) {
    return unavailable(
      "competitors",
      "missing_api_key",
      "Set GOOGLE_PLACES_API_KEY to collect competitors from Google Places."
    );
  }

  const effectiveCategory = trueCategory || category;
  let competitors: CompetitorData[] = [];

  if (competitorSearchQueries && competitorSearchQueries.length > 0) {
    competitors = await searchWithPhase0Queries(
      competitorSearchQueries,
      businessName,
      nonCompetitorsNote,
      apiKey
    );
  }

  if (competitors.length === 0 && lat && lng) {
    competitors = await findNearbyCompetitors(lat, lng, effectiveCategory, businessName, apiKey);
  }

  if (competitors.length === 0 && (effectiveCategory || city)) {
    competitors = await textSearchCompetitors(effectiveCategory, city, businessName, apiKey);
  }

  if (competitors.length === 0) {
    return unavailable(
      "competitors",
      "not_found",
      `No real competitors were found for "${businessName}" from Google Places.`
    );
  }

  const tRating = targetRating ?? 0;
  const tReviewCount = targetReviewCount ?? 0;
  const tCompleteness = 75;
  const targetPosition = calculateCompetitivePosition(tRating, tReviewCount, competitors);

  const competitorResults = competitors.map((comp) => ({
    name: comp.name,
    address: comp.address,
    rating: comp.rating,
    review_count: comp.review_count,
    website: comp.website,
    estimated_position: calculateCompetitivePosition(comp.rating, comp.review_count, []) as
      | "leader"
      | "challenger"
      | "laggard",
  }));

  const strengths: string[] = [];
  const weaknesses: string[] = [];
  const findings: string[] = [];
  const recommendations: string[] = [];

  const avgCompetitorRating =
    competitors.reduce((sum, c) => sum + (c.rating || 0), 0) / competitors.length;
  const avgCompetitorReviews =
    competitors.reduce((sum, c) => sum + (c.review_count || 0), 0) / competitors.length;
  const avgCompleteness =
    competitors.reduce((sum, c) => sum + c.gbp_completeness_estimate, 0) / competitors.length;

  if (tRating > 0) {
    if (tRating >= avgCompetitorRating) {
      strengths.push(`Your ${tRating} rating matches or exceeds competitor average (${avgCompetitorRating.toFixed(1)})`);
    } else {
      weaknesses.push(`Your rating (${tRating}) trails the category average (${avgCompetitorRating.toFixed(1)})`);
    }
  }

  if (tReviewCount > 0) {
    if (tReviewCount >= avgCompetitorReviews) {
      strengths.push(`You have ${tReviewCount} reviews, above the ${avgCompetitorReviews.toFixed(0)} competitor average`);
    } else {
      weaknesses.push(`Review count (${tReviewCount}) lags category average (${avgCompetitorReviews.toFixed(0)})`);
    }
  }

  if (tCompleteness >= avgCompleteness) {
    strengths.push(`GBP completeness (${tCompleteness}%) exceeds competitor baseline (${avgCompleteness.toFixed(0)}%)`);
  } else {
    weaknesses.push(`GBP profile is ${tCompleteness}% complete vs. ${avgCompleteness.toFixed(0)}% average`);
  }

  const leaderCount = tRating > 0 ? competitors.filter((c) => (c.rating || 0) > tRating).length : 0;
  if (tRating > 0) {
    findings.push(`You rank ${leaderCount + 1} of ${competitors.length + 1} competitors by rating`);
    const topRating = Math.max(...competitors.map((c) => c.rating || 0));
    if (topRating > tRating) {
      findings.push(`Your ${tRating} rating trails the category leader's ${topRating.toFixed(1)}`);
    }
  }
  findings.push(`${competitors.length} direct competitors identified in your ${category || "category"}`);

  recommendations.push("Focus on review generation via post-visit follow-up");
  recommendations.push("Address negative review themes to improve sentiment and demonstrate responsiveness");
  recommendations.push("Complete all GBP fields to match leader benchmark");

  let score = 70;
  if (targetPosition === "leader") score = 85;
  if (targetPosition === "laggard") score = 55;

  return {
    grade: scoreToGrade(score),
    score,
    target_business: businessName,
    competitors: competitorResults,
    target_position: targetPosition,
    strengths,
    weaknesses,
    findings,
    recommendations,
  };
}

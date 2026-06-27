/**
 * Module 2: Review Sentiment & Reputation Analysis
 * Tools: fetch_google_reviews, fetch_yelp_reviews, analyze_reviews
 *
 * Fetches reviews from Google (via Places API Place Details) and Yelp
 * (via Yelp Fusion API), then runs sentiment analysis.
 *
 * Google Places API returns up to 5 most-relevant reviews per Place Details
 * call. For deeper analysis the AI extraction prompts (Claude Haiku) can
 * enrich the data.
 */

import type { ReviewSentimentResult } from "@/lib/db/types";
import { getProviderSecret } from "@/lib/config/provider-config";
import { unavailable, type UnavailableResult } from "./unavailable";

interface ReviewData {
  source: "google" | "yelp";
  author: string;
  rating: number;
  text: string;
  date: string;
  owner_response?: string;
}

interface FetchReviewsParams {
  placeId?: string;
  businessName: string;
  city?: string;
}

// ---------------------------------------------------------------------------
// Google Places API — reviews come as part of Place Details
// ---------------------------------------------------------------------------

export async function fetchGoogleReviews(
  params: FetchReviewsParams
): Promise<{ reviews: ReviewData[]; total: number; rawReviews?: any[] } | UnavailableResult> {
  const apiKey = await getProviderSecret("google_places_api_key");

  if (!apiKey) {
    return unavailable(
      "google_reviews",
      "missing_api_key",
      "Set GOOGLE_PLACES_API_KEY to collect real Google reviews."
    );
  }

  if (!params.placeId) {
    return unavailable(
      "google_reviews",
      "not_applicable",
      "Google reviews require a real Google place_id from the Business Profile lookup."
    );
  }

  try {
    // Request reviews + user_ratings_total via Place Details
    const fields = "reviews,user_ratings_total,rating";
    const qs = new URLSearchParams({
      place_id: params.placeId,
      fields,
      key: apiKey,
      language: "en",
      reviews_sort: "newest",
    });

    const res = await fetch(
      `https://maps.googleapis.com/maps/api/place/details/json?${qs}`,
      { signal: AbortSignal.timeout(8000) }
    );

    if (!res.ok) {
      throw new Error(`Google Place Details returned ${res.status}`);
    }

    const data = await res.json();

    if (data.status !== "OK" || !data.result) {
      return unavailable(
        "google_reviews",
        "not_found",
        `Google Places returned status: ${data.status}`
      );
    }

    const result = data.result;

    const reviews: ReviewData[] = (result.reviews || []).map((r: any) => ({
      source: "google" as const,
      author: r.author_name || "Anonymous",
      rating: r.rating || 0,
      text: r.text || "",
      date: r.time ? new Date(r.time * 1000).toISOString().split("T")[0] : "",
      owner_response: r.owner_reply?.text || undefined,
    }));

    return {
      // Preserve raw review data for AI analysis
      rawReviews: (result.reviews || []).map((r: any) => ({
        author: r.author_name || "Anonymous",
        text: r.text || "",
        rating: r.rating || 0,
        time: r.time ? new Date(r.time * 1000).toISOString() : "",
        language: r.language || "en",
        owner_response: r.owner_reply?.text,
        owner_response_time: r.owner_reply?.time ? new Date(r.owner_reply.time * 1000).toISOString() : undefined,
      })),
      reviews,
      total: result.user_ratings_total || reviews.length,
    };
  } catch (err: any) {
    return unavailable(
      "google_reviews",
      "failed",
      `Failed to fetch Google reviews: ${err.message}`
    );
  }
}

// ---------------------------------------------------------------------------
// Yelp Fusion API — unchanged (no SerpAPI dependency)
// ---------------------------------------------------------------------------

export async function fetchYelpReviews(
  params: { businessName: string; city?: string }
): Promise<{ reviews: ReviewData[]; rating?: number; reviewCount?: number } | UnavailableResult> {
  const yelpApiKey = await getProviderSecret("yelp_api_key");

  if (!yelpApiKey) {
    return unavailable(
      "yelp_reviews",
      "missing_api_key",
      "Set YELP_API_KEY to collect real Yelp review data."
    );
  }

  try {
    // First search for the business
    const searchUrl = new URL("https://api.yelp.com/v3/businesses/search");
    searchUrl.searchParams.set("term", params.businessName);
    if (params.city) searchUrl.searchParams.set("location", params.city);
    searchUrl.searchParams.set("limit", "1");

    const searchRes = await fetch(searchUrl.toString(), {
      headers: { Authorization: `Bearer ${yelpApiKey}` },
    });

    if (!searchRes.ok) {
      throw new Error(`Yelp search error: ${searchRes.status}`);
    }

    const searchData = await searchRes.json();
    const business = searchData.businesses?.[0];

    if (!business) {
      return unavailable("yelp_reviews", "not_found", "Business not found on Yelp.");
    }

    // Fetch reviews
    const reviewsRes = await fetch(
      `https://api.yelp.com/v3/businesses/${business.id}/reviews?limit=20&sort_by=newest`,
      { headers: { Authorization: `Bearer ${yelpApiKey}` } }
    );

    if (!reviewsRes.ok) {
      throw new Error(`Yelp reviews error: ${reviewsRes.status}`);
    }

    const reviewsData = await reviewsRes.json();
    const reviews: ReviewData[] = (reviewsData.reviews || []).map((r: any) => ({
      source: "yelp" as const,
      author: r.user?.name || "Anonymous",
      rating: r.rating || 0,
      text: r.text || "",
      date: r.time_created || "",
    }));

    return {
      reviews,
      rating: business.rating,
      reviewCount: business.review_count,
    };
  } catch (err: any) {
    return unavailable(
      "yelp_reviews",
      "failed",
      `Failed to fetch Yelp data: ${err.message}`
    );
  }
}

// ---------------------------------------------------------------------------
// Sentiment analysis (Phase 0: keyword-based; Phase 1+: Claude Haiku)
// ---------------------------------------------------------------------------

export function analyzeReviews(
  googleReviews: ReviewData[],
  yelpReviews: ReviewData[],
  googleRating?: number,
  googleReviewCount?: number,
  yelpRating?: number,
  yelpReviewCount?: number
): ReviewSentimentResult {
  const allReviews = [...googleReviews, ...yelpReviews];

  // Basic sentiment breakdown by star rating
  const positive = allReviews.filter((r) => r.rating >= 4).length;
  const neutral = allReviews.filter((r) => r.rating === 3).length;
  const negative = allReviews.filter((r) => r.rating <= 2).length;
  const total = allReviews.length || 1;

  // Owner response rate
  const reviewsWithOwnerResponse = allReviews.filter((r) => r.owner_response).length;
  const ownerResponseRate = total > 0 ? Math.round((reviewsWithOwnerResponse / total) * 100) : 0;

  // Extract common themes from review text (simple keyword matching)
  const praiseKeywords = ["professional", "quality", "friendly", "fast", "great", "excellent", "recommend", "punctual", "fair price", "clean"];
  const complaintKeywords = ["wait", "slow", "expensive", "rude", "late", "dirty", "unprofessional", "no-show", "overcharged", "poor"];

  const praiseThemes = extractThemes(allReviews.filter((r) => r.rating >= 4), praiseKeywords);
  const complaintThemes = extractThemes(allReviews.filter((r) => r.rating <= 2), complaintKeywords);

  // Calculate review velocity (reviews per month)
  const reviewDates = allReviews
    .map((r) => new Date(r.date).getTime())
    .filter((d) => !isNaN(d))
    .sort();

  let reviewVelocity = 0;
  if (reviewDates.length >= 2) {
    const spanMs = reviewDates[reviewDates.length - 1] - reviewDates[0];
    const spanMonths = spanMs / (30 * 24 * 60 * 60 * 1000);
    reviewVelocity = spanMonths > 0 ? Math.round(reviewDates.length / spanMonths) : reviewDates.length;
  }

  // Trend detection (compare first half vs second half ratings)
  const midpoint = Math.floor(allReviews.length / 2);
  const olderAvg = average(allReviews.slice(0, midpoint).map((r) => r.rating));
  const newerAvg = average(allReviews.slice(midpoint).map((r) => r.rating));
  const trend: "improving" | "stable" | "declining" =
    newerAvg - olderAvg > 0.3 ? "improving" : newerAvg - olderAvg < -0.3 ? "declining" : "stable";

  // Composite score (0-100)
  const avgRating = googleRating || average(allReviews.map((r) => r.rating));
  const ratingScore = (avgRating / 5) * 40; // Max 40 points
  const volumeScore = Math.min(30, (googleReviewCount || allReviews.length) / 3); // Max 30 points
  const responseScore = (ownerResponseRate / 100) * 20; // Max 20 points
  const trendScore = trend === "improving" ? 10 : trend === "stable" ? 5 : 0; // Max 10 points
  const compositeScore = Math.round(ratingScore + volumeScore + responseScore + trendScore);

  // Build findings and recommendations
  const findings: string[] = [];
  const recommendations: string[] = [];

  if (avgRating < 4.0) {
    findings.push(`Average rating of ${avgRating.toFixed(1)} is below the 4.0 threshold for local search ranking boost`);
    recommendations.push("Focus on improving service quality to increase average rating above 4.0");
  }
  if (ownerResponseRate < 50) {
    findings.push(`Only ${ownerResponseRate}% of reviews have owner responses`);
    recommendations.push("Respond to all reviews — especially negative ones — within 24 hours");
  }
  if (negative > positive * 0.3) {
    findings.push(`${Math.round((negative / total) * 100)}% of reviews are negative (2 stars or below)`);
    recommendations.push("Investigate recurring complaint themes and address root causes");
  }
  if (reviewVelocity < 2) {
    findings.push(`Low review velocity: approximately ${reviewVelocity} reviews per month`);
    recommendations.push("Implement a review request workflow (post-service email/text with direct review link)");
  }
  if (trend === "declining") {
    findings.push("Review sentiment trend is declining — newer reviews are less positive than older ones");
    recommendations.push("Investigate recent service quality changes; consider customer satisfaction survey");
  }

  return {
    grade: scoreToGrade(compositeScore),
    score: compositeScore,
    google_rating: googleRating,
    google_review_count: googleReviewCount,
    yelp_rating: yelpRating,
    yelp_review_count: yelpReviewCount,
    sentiment_breakdown: {
      positive: Math.round((positive / total) * 100),
      neutral: Math.round((neutral / total) * 100),
      negative: Math.round((negative / total) * 100),
    },
    top_praise_themes: praiseThemes.slice(0, 5),
    top_complaint_themes: complaintThemes.slice(0, 5),
    owner_response_rate: ownerResponseRate,
    review_velocity: reviewVelocity,
    trend_direction: trend,
    findings,
    recommendations,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function extractThemes(reviews: ReviewData[], keywords: string[]): string[] {
  const counts: Record<string, number> = {};
  for (const review of reviews) {
    const text = review.text.toLowerCase();
    for (const keyword of keywords) {
      if (text.includes(keyword)) {
        counts[keyword] = (counts[keyword] || 0) + 1;
      }
    }
  }
  return Object.entries(counts)
    .sort(([, a], [, b]) => b - a)
    .map(([keyword]) => keyword);
}

function average(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function scoreToGrade(score: number): string {
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 70) return "C";
  if (score >= 60) return "D";
  return "F";
}

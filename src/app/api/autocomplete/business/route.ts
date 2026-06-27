import { NextRequest, NextResponse } from "next/server";
import { getProviderSecret } from "@/lib/config/provider-config";

/**
 * Business autocomplete — cascading strategy:
 *  1. Google Places Autocomplete (cheapest: $2.83/1K, $200/mo free credit)
 *     → then Place Details for website/phone on the selected result
 *  2. SerpAPI Google Maps (fallback: $10/1K)
 *  3. Empty unavailable response when no provider is configured
 *
 * GET /api/autocomplete/business?q=joes+plumbing&city=seattle&sessionToken=abc
 */

interface BusinessSuggestion {
  name: string;
  address?: string;
  city?: string;
  state?: string;
  phone?: string;
  website?: string;
  rating?: number;
  reviewCount?: number;
  category?: string;
  placeId?: string;
  googleMapsUrl?: string;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim();
  const city = searchParams.get("city")?.trim();
  const sessionToken = searchParams.get("sessionToken") || "";

  if (!query || query.length < 2) {
    return NextResponse.json({ suggestions: [] });
  }

  // Strategy 1: Google Places API (preferred — cheapest)
  const googleApiKey = await getProviderSecret("google_places_api_key");
  if (googleApiKey) {
    try {
      const suggestions = await googlePlacesAutocomplete(query, city, googleApiKey, sessionToken);
      if (suggestions.length > 0) {
        return NextResponse.json({ suggestions });
      }
    } catch (err) {
      console.error("Google Places autocomplete error:", err);
    }
  }

  // Strategy 2: SerpAPI (fallback)
  const serpApiKey = process.env.SERPAPI_KEY;
  if (serpApiKey) {
    try {
      const suggestions = await serpApiAutocomplete(query, city, serpApiKey);
      if (suggestions.length > 0) {
        return NextResponse.json({ suggestions });
      }
    } catch (err) {
      console.error("SerpAPI autocomplete error:", err);
    }
  }

  return NextResponse.json({
    suggestions: [],
    unavailable: {
      status: "missing_api_key",
      source: "business_autocomplete",
      reason: "Set GOOGLE_PLACES_API_KEY to collect real business suggestions.",
    },
  });
}

// ─── Google Places Autocomplete ─────────────────────────────────────────────

async function googlePlacesAutocomplete(
  query: string,
  city: string | undefined,
  apiKey: string,
  sessionToken: string
): Promise<BusinessSuggestion[]> {
  const input = city ? `${query} in ${city}` : query;

  const params = new URLSearchParams({
    input,
    types: "establishment",
    key: apiKey,
    language: "en",
    components: "country:us",
  });

  // Session tokens group autocomplete + place details into one billing session
  // ($0.017 total instead of $0.00283 + $0.017 separately)
  if (sessionToken) {
    params.set("sessiontoken", sessionToken);
  }

  const response = await fetch(
    `https://maps.googleapis.com/maps/api/place/autocomplete/json?${params}`,
    { signal: AbortSignal.timeout(5000) }
  );

  if (!response.ok) {
    throw new Error(`Google Places API returned ${response.status}`);
  }

  const data = await response.json();

  if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
    console.error("Google Places error status:", data.status, data.error_message);
    throw new Error(`Google Places status: ${data.status}`);
  }

  const predictions = data.predictions || [];

  return predictions.slice(0, 8).map(
    (p: {
      place_id: string;
      description: string;
      structured_formatting?: {
        main_text?: string;
        secondary_text?: string;
      };
      types?: string[];
    }) => {
      const parsed = parseGoogleDescription(p.structured_formatting?.secondary_text || p.description);
      return {
        name: p.structured_formatting?.main_text || p.description.split(",")[0],
        address: p.structured_formatting?.secondary_text || undefined,
        city: parsed.city,
        state: parsed.state,
        placeId: p.place_id,
        category: humanizeTypes(p.types),
      };
    }
  );
}

function parseGoogleDescription(desc: string): { city?: string; state?: string } {
  if (!desc) return {};
  // "Seattle, WA, USA" or "Bellevue, WA, United States"
  const parts = desc.split(",").map((p) => p.trim());
  if (parts.length >= 2) {
    const stateMatch = parts[1].match(/^([A-Z]{2})/);
    return {
      city: parts[0] || undefined,
      state: stateMatch ? stateMatch[1] : undefined,
    };
  }
  return { city: parts[0] || undefined };
}

function humanizeTypes(types?: string[]): string | undefined {
  if (!types || types.length === 0) return undefined;
  // Pick the most meaningful type
  const skip = new Set(["point_of_interest", "establishment", "premise", "geocode"]);
  const meaningful = types.find((t) => !skip.has(t));
  if (!meaningful) return undefined;
  return meaningful.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// ─── Fetch Place Details (called client-side after selection) ────────────────
// This is exposed as a separate endpoint: /api/autocomplete/place-details

// ─── SerpAPI Fallback ───────────────────────────────────────────────────────

async function serpApiAutocomplete(
  query: string,
  city: string | undefined,
  apiKey: string
): Promise<BusinessSuggestion[]> {
  const searchQuery = city ? `${query} in ${city}` : query;

  const params = new URLSearchParams({
    engine: "google_maps",
    q: searchQuery,
    api_key: apiKey,
    type: "search",
    hl: "en",
  });

  const response = await fetch(
    `https://serpapi.com/search.json?${params}`,
    { signal: AbortSignal.timeout(8000) }
  );

  if (!response.ok) return [];

  const data = await response.json();
  const localResults = data.local_results || [];

  return localResults
    .slice(0, 8)
    .map((result: Record<string, unknown>) => {
      const addressParts = parseAddress(result.address as string || "");
      return {
        name: (result.title as string) || "",
        address: (result.address as string) || undefined,
        city: addressParts.city,
        state: addressParts.state,
        phone: (result.phone as string) || undefined,
        website: (result.website as string) || undefined,
        rating: (result.rating as number) || undefined,
        reviewCount: (result.reviews as number) || undefined,
        category: (result.type as string) || undefined,
        placeId: (result.place_id as string) || undefined,
      };
    })
    .filter((s: BusinessSuggestion) => s.name);
}

function parseAddress(address: string): { city?: string; state?: string } {
  if (!address) return {};
  const parts = address.split(",").map((p) => p.trim());
  if (parts.length >= 3) {
    const stateMatch = parts[parts.length - 1].match(/^([A-Z]{2})/);
    return { city: parts[parts.length - 2] || undefined, state: stateMatch ? stateMatch[1] : undefined };
  }
  if (parts.length === 2) {
    const stateMatch = parts[1].match(/^([A-Z]{2})/);
    return { city: parts[0] || undefined, state: stateMatch ? stateMatch[1] : undefined };
  }
  return {};
}

// ─── Mock Data ──────────────────────────────────────────────────────────────

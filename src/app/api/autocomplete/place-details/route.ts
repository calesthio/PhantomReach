import { NextRequest, NextResponse } from "next/server";
import { getProviderSecret } from "@/lib/config/provider-config";

/**
 * Place Details — fetch website, phone, rating after user selects a business
 * from Google Places Autocomplete.
 *
 * GET /api/autocomplete/place-details?placeId=ChIJ...&sessionToken=abc
 *
 * When a session token is provided, this call is grouped with the preceding
 * autocomplete request into a single billing session ($0.017 total instead
 * of $0.00283 + $0.017 separately).
 */

interface PlaceDetails {
  name?: string;
  address?: string;
  city?: string;
  state?: string;
  phone?: string;
  website?: string;
  rating?: number;
  reviewCount?: number;
  googleMapsUrl?: string;
  category?: string;
  openNow?: boolean;
  hours?: string[];
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const placeId = searchParams.get("placeId")?.trim();
  const sessionToken = searchParams.get("sessionToken") || "";

  if (!placeId) {
    return NextResponse.json({ error: "placeId is required" }, { status: 400 });
  }

  // Strategy 1: Google Places Details API
  const googleApiKey = await getProviderSecret("google_places_api_key");
  if (googleApiKey) {
    try {
      const details = await fetchGooglePlaceDetails(placeId, googleApiKey, sessionToken);
      if (details) {
        return NextResponse.json({ details });
      }
    } catch (err) {
      console.error("Google Place Details error:", err);
    }
  }

  // Strategy 2: SerpAPI Place Details
  const serpApiKey = process.env.SERPAPI_KEY;
  if (serpApiKey) {
    try {
      const details = await fetchSerpApiPlaceDetails(placeId, serpApiKey);
      if (details) {
        return NextResponse.json({ details });
      }
    } catch (err) {
      console.error("SerpAPI Place Details error:", err);
    }
  }

  return NextResponse.json({ details: null });
}

// ─── Google Places Details ────────────────────────────────────────────────────

async function fetchGooglePlaceDetails(
  placeId: string,
  apiKey: string,
  sessionToken: string
): Promise<PlaceDetails | null> {
  // Only request the fields we need to minimize cost
  // Basic fields are free, Contact fields cost $0.003, Atmosphere $0.005
  const fields = [
    "name",
    "formatted_address",
    "formatted_phone_number",
    "website",
    "rating",
    "user_ratings_total",
    "url",
    "types",
    "opening_hours",
    "address_components",
  ].join(",");

  const params = new URLSearchParams({
    place_id: placeId,
    fields,
    key: apiKey,
    language: "en",
  });

  // Include session token to group with autocomplete request
  if (sessionToken) {
    params.set("sessiontoken", sessionToken);
  }

  const response = await fetch(
    `https://maps.googleapis.com/maps/api/place/details/json?${params}`,
    { signal: AbortSignal.timeout(5000) }
  );

  if (!response.ok) {
    throw new Error(`Google Place Details returned ${response.status}`);
  }

  const data = await response.json();

  if (data.status !== "OK") {
    console.error("Google Place Details error:", data.status, data.error_message);
    return null;
  }

  const result = data.result;
  if (!result) return null;

  // Extract city and state from address_components
  let city = "";
  let state = "";
  if (result.address_components) {
    for (const comp of result.address_components) {
      if (comp.types?.includes("locality")) {
        city = comp.long_name;
      }
      if (comp.types?.includes("administrative_area_level_1")) {
        state = comp.short_name; // "WA"
      }
    }
  }

  // Extract hours
  const hours: string[] = [];
  if (result.opening_hours?.weekday_text) {
    hours.push(...result.opening_hours.weekday_text);
  }

  return {
    name: result.name || undefined,
    address: result.formatted_address || undefined,
    city: city || undefined,
    state: state || undefined,
    phone: result.formatted_phone_number || undefined,
    website: result.website || undefined,
    rating: result.rating || undefined,
    reviewCount: result.user_ratings_total || undefined,
    googleMapsUrl: result.url || undefined,
    category: humanizeTypes(result.types),
    openNow: result.opening_hours?.open_now,
    hours: hours.length > 0 ? hours : undefined,
  };
}

function humanizeTypes(types?: string[]): string | undefined {
  if (!types || types.length === 0) return undefined;
  const skip = new Set(["point_of_interest", "establishment", "premise", "geocode"]);
  const meaningful = types.find((t: string) => !skip.has(t));
  if (!meaningful) return undefined;
  return meaningful.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase());
}

// ─── SerpAPI Place Details Fallback ───────────────────────────────────────────

async function fetchSerpApiPlaceDetails(
  placeId: string,
  apiKey: string
): Promise<PlaceDetails | null> {
  const params = new URLSearchParams({
    engine: "google_maps",
    place_id: placeId,
    api_key: apiKey,
    hl: "en",
  });

  const response = await fetch(
    `https://serpapi.com/search.json?${params}`,
    { signal: AbortSignal.timeout(8000) }
  );

  if (!response.ok) return null;

  const data = await response.json();
  const place = data.place_results;
  if (!place) return null;

  const addressParts = parseAddress(place.address || "");

  return {
    name: place.title || undefined,
    address: place.address || undefined,
    city: addressParts.city || undefined,
    state: addressParts.state || undefined,
    phone: place.phone || undefined,
    website: place.website || undefined,
    rating: place.rating || undefined,
    reviewCount: place.reviews || undefined,
    googleMapsUrl: place.gps_coordinates
      ? `https://www.google.com/maps/place/?q=place_id:${placeId}`
      : undefined,
    category: place.type || undefined,
  };
}

function parseAddress(address: string): { city?: string; state?: string } {
  if (!address) return {};
  const parts = address.split(",").map((p) => p.trim());
  if (parts.length >= 3) {
    const stateMatch = parts[parts.length - 1].match(/^([A-Z]{2})/);
    return {
      city: parts[parts.length - 2] || undefined,
      state: stateMatch ? stateMatch[1] : undefined,
    };
  }
  if (parts.length === 2) {
    const stateMatch = parts[1].match(/^([A-Z]{2})/);
    return { city: parts[0] || undefined, state: stateMatch ? stateMatch[1] : undefined };
  }
  return {};
}

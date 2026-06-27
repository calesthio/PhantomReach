/**
 * Module 1: Google Business Profile Health
 * Tool: lookup_google_maps
 *
 * Searches for a business on Google Maps via Google Places API and returns
 * structured profile data for GBP completeness analysis.
 */

import type { GBPHealthResult } from "@/lib/db/types";
import { getProviderSecret } from "@/lib/config/provider-config";
import { unavailable, type UnavailableResult } from "./unavailable";

interface GoogleMapsSearchParams {
  businessName: string;
  city?: string;
  state?: string;
  googleMapsUrl?: string;
}

interface PlaceResult {
  place_id: string;
  title: string;
  address?: string;
  phone?: string;
  website?: string;
  type?: string;
  category?: string;
  rating?: number;
  reviews?: number;
  operating_hours?: Record<string, string>;
  photos_count?: number;
  gps_coordinates?: { latitude: number; longitude: number };
  description?: string;
  service_options?: Record<string, boolean>;
  attributes?: string[];
}

async function getApiKey(): Promise<string | undefined> {
  return getProviderSecret("google_places_api_key");
}

async function textSearch(
  query: string,
  apiKey: string
): Promise<{ place_id: string; name: string } | null> {
  const params = new URLSearchParams({
    query,
    key: apiKey,
    language: "en",
  });

  const res = await fetch(
    `https://maps.googleapis.com/maps/api/place/textsearch/json?${params}`,
    { signal: AbortSignal.timeout(8000) }
  );

  if (!res.ok) throw new Error(`Text Search returned ${res.status}`);

  const data = await res.json();
  if (data.status !== "OK" || !data.results?.length) return null;

  const first = data.results[0];
  return { place_id: first.place_id, name: first.name };
}

async function placeDetails(
  placeId: string,
  apiKey: string
): Promise<PlaceResult | null> {
  const fields = [
    "name",
    "formatted_address",
    "place_id",
    "types",
    "geometry",
    "business_status",
    "photos",
    "formatted_phone_number",
    "website",
    "opening_hours",
    "url",
    "rating",
    "user_ratings_total",
    "reviews",
    "editorial_summary",
  ].join(",");

  const params = new URLSearchParams({
    place_id: placeId,
    fields,
    key: apiKey,
    language: "en",
  });

  const res = await fetch(
    `https://maps.googleapis.com/maps/api/place/details/json?${params}`,
    { signal: AbortSignal.timeout(8000) }
  );

  if (!res.ok) throw new Error(`Place Details returned ${res.status}`);

  const data = await res.json();
  if (data.status !== "OK" || !data.result) return null;

  const r = data.result;
  const operating_hours: Record<string, string> = {};
  if (r.opening_hours?.weekday_text) {
    for (const line of r.opening_hours.weekday_text as string[]) {
      const [day, ...rest] = line.split(": ");
      if (day) operating_hours[day.toLowerCase()] = rest.join(": ");
    }
  }

  const skip = new Set(["point_of_interest", "establishment", "premise", "geocode"]);
  const vague = new Set(["food", "store", "health", "finance", "general_contractor", "local_service"]);
  const allTypes = (r.types || []).filter((t: string) => !skip.has(t));
  const primaryType = allTypes.find((t: string) => !vague.has(t)) || allTypes[0];
  const category = primaryType
    ? primaryType.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase())
    : undefined;

  return {
    place_id: r.place_id || placeId,
    title: r.name || "",
    address: r.formatted_address || undefined,
    phone: r.formatted_phone_number || undefined,
    website: r.website || undefined,
    type: category,
    category,
    rating: r.rating || undefined,
    reviews: r.user_ratings_total || undefined,
    operating_hours: Object.keys(operating_hours).length > 0 ? operating_hours : undefined,
    photos_count: r.photos?.length || 0,
    gps_coordinates: r.geometry?.location
      ? { latitude: r.geometry.location.lat, longitude: r.geometry.location.lng }
      : undefined,
    description: r.editorial_summary?.overview || undefined,
    attributes: [],
  };
}

function calculateGBPCompleteness(data: PlaceResult): number {
  const fields = [
    !!data.title,
    !!data.address,
    !!data.phone,
    !!data.website,
    !!data.category || !!data.type,
    !!data.operating_hours && Object.keys(data.operating_hours).length > 0,
    (data.photos_count || 0) > 0,
    !!data.description,
    !!data.service_options && Object.keys(data.service_options).length > 0,
    !!data.gps_coordinates,
  ];

  return Math.round((fields.filter(Boolean).length / fields.length) * 100);
}

function scoreToGrade(score: number): string {
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 70) return "C";
  if (score >= 60) return "D";
  return "F";
}

export async function lookupGoogleMaps(
  params: GoogleMapsSearchParams
): Promise<{ raw: PlaceResult; analysis: GBPHealthResult } | UnavailableResult> {
  const apiKey = await getApiKey();

  if (!apiKey) {
    return unavailable(
      "google_maps",
      "missing_api_key",
      "Set GOOGLE_PLACES_API_KEY to collect Google Business Profile data."
    );
  }

  try {
    const query = `${params.businessName}${params.city ? ` ${params.city}` : ""}${params.state ? ` ${params.state}` : ""}`;
    const searchResult = await textSearch(query, apiKey);
    if (!searchResult) {
      return unavailable(
        "google_maps",
        "not_found",
        `No Google Maps results found for "${params.businessName}".`
      );
    }

    const details = await placeDetails(searchResult.place_id, apiKey);
    if (!details) {
      return unavailable(
        "google_maps",
        "not_found",
        `Could not load Google Business Profile details for "${params.businessName}".`
      );
    }

    const completenessScore = calculateGBPCompleteness(details);
    const findings: string[] = [];
    const recommendations: string[] = [];

    if (!details.website) {
      findings.push("No website linked to Google Business Profile");
      recommendations.push("Add a website URL to your Google Business Profile to drive traffic");
    }
    if (!details.phone) {
      findings.push("No phone number listed on Google Business Profile");
      recommendations.push("Add a phone number - it is the main way customers contact local businesses");
    }
    if ((details.photos_count || 0) < 5) {
      findings.push(`Only ${details.photos_count || 0} photos on profile (minimum 10 recommended)`);
      recommendations.push("Add more photos to improve engagement from Maps searchers");
    }
    if (!details.operating_hours || Object.keys(details.operating_hours).length === 0) {
      findings.push("Business hours not set on Google Business Profile");
      recommendations.push("Add complete business hours including special hours for holidays");
    }
    if (!details.description) {
      findings.push("No business description on Google Business Profile");
      recommendations.push("Write a clear business description highlighting services and differentiators");
    }

    const analysis: GBPHealthResult = {
      grade: scoreToGrade(completenessScore),
      score: completenessScore,
      business_name: details.title || params.businessName,
      address: details.address,
      phone: details.phone,
      website: details.website,
      category: details.category || details.type,
      rating: details.rating,
      review_count: details.reviews,
      hours_complete: !!details.operating_hours && Object.keys(details.operating_hours).length >= 5,
      photos_count: details.photos_count || 0,
      posts_recent: false,
      attributes_filled: (details.attributes || []).length,
      attributes_available: 15,
      completeness_pct: completenessScore,
      findings,
      recommendations,
    };

    return { raw: details, analysis };
  } catch (err: any) {
    return unavailable(
      "google_maps",
      "failed",
      `Google Maps lookup failed: ${err.message}`
    );
  }
}

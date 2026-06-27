import { NextRequest, NextResponse } from "next/server";
import { getProviderSecret } from "@/lib/config/provider-config";

/**
 * City autocomplete — cascading strategy:
 *  1. Google Places Autocomplete with type=(cities) — cheapest ($2.83/1K)
 *  2. SerpAPI Google Autocomplete (fallback: $10/1K)
 *  3. Static city list (no keys)
 *
 * GET /api/autocomplete/city?q=bellev&sessionToken=abc
 */

interface CitySuggestion {
  city: string;
  state: string;
  stateCode: string;
  label: string;
}

// US state name → code mapping
const STATE_CODES: Record<string, string> = {
  "alabama": "AL", "alaska": "AK", "arizona": "AZ", "arkansas": "AR",
  "california": "CA", "colorado": "CO", "connecticut": "CT", "delaware": "DE",
  "district of columbia": "DC", "florida": "FL", "georgia": "GA", "hawaii": "HI",
  "idaho": "ID", "illinois": "IL", "indiana": "IN", "iowa": "IA",
  "kansas": "KS", "kentucky": "KY", "louisiana": "LA", "maine": "ME",
  "maryland": "MD", "massachusetts": "MA", "michigan": "MI", "minnesota": "MN",
  "mississippi": "MS", "missouri": "MO", "montana": "MT", "nebraska": "NE",
  "nevada": "NV", "new hampshire": "NH", "new jersey": "NJ", "new mexico": "NM",
  "new york": "NY", "north carolina": "NC", "north dakota": "ND", "ohio": "OH",
  "oklahoma": "OK", "oregon": "OR", "pennsylvania": "PA", "rhode island": "RI",
  "south carolina": "SC", "south dakota": "SD", "tennessee": "TN", "texas": "TX",
  "utah": "UT", "vermont": "VT", "virginia": "VA", "washington": "WA",
  "west virginia": "WV", "wisconsin": "WI", "wyoming": "WY",
};

// Reverse lookup: code → full name
const STATE_NAMES: Record<string, string> = {};
for (const [name, code] of Object.entries(STATE_CODES)) {
  STATE_NAMES[code] = name.replace(/\b\w/g, (c) => c.toUpperCase());
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim();
  const sessionToken = searchParams.get("sessionToken") || "";

  if (!query || query.length < 1) {
    return NextResponse.json({ suggestions: [] });
  }

  // Strategy 1: Google Places Autocomplete with type=(cities)
  const googleApiKey = await getProviderSecret("google_places_api_key");
  if (googleApiKey) {
    try {
      const suggestions = await googlePlacesCityAutocomplete(query, googleApiKey, sessionToken);
      if (suggestions.length > 0) {
        return NextResponse.json({ suggestions });
      }
    } catch (err) {
      console.error("Google Places city autocomplete error:", err);
    }
  }

  // Strategy 2: SerpAPI (fallback)
  const serpApiKey = process.env.SERPAPI_KEY;
  if (serpApiKey) {
    try {
      const suggestions = await fetchFromSerpApi(query, serpApiKey);
      if (suggestions.length > 0) {
        return NextResponse.json({ suggestions });
      }
    } catch (err) {
      console.error("SerpAPI city autocomplete error:", err);
    }
  }

  // Strategy 3: Static fallback
  return NextResponse.json({ suggestions: getFallbackSuggestions(query) });
}

// ─── Google Places Autocomplete (cities) ──────────────────────────────────────

async function googlePlacesCityAutocomplete(
  query: string,
  apiKey: string,
  sessionToken: string
): Promise<CitySuggestion[]> {
  const params = new URLSearchParams({
    input: query,
    types: "(cities)",
    key: apiKey,
    language: "en",
    components: "country:us",
  });

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
    console.error("Google Places city error:", data.status, data.error_message);
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
      terms?: { value: string }[];
    }) => {
      // Google returns "Bellevue, WA, USA" — parse city + state
      const parsed = parseGoogleCityPrediction(p);
      return {
        city: parsed.city,
        state: parsed.state,
        stateCode: parsed.stateCode,
        label: parsed.stateCode
          ? `${parsed.city}, ${parsed.stateCode}`
          : parsed.city,
      };
    }
  );
}

function parseGoogleCityPrediction(p: {
  description: string;
  structured_formatting?: { main_text?: string; secondary_text?: string };
  terms?: { value: string }[];
}): { city: string; state: string; stateCode: string } {
  // Try using terms array first (most reliable)
  // Typically: [{value: "Bellevue"}, {value: "WA"}, {value: "USA"}]
  if (p.terms && p.terms.length >= 2) {
    const cityTerm = p.terms[0].value;
    const stateTerm = p.terms.length >= 3 ? p.terms[1].value : "";

    // Check if stateTerm is a state code or full name
    if (stateTerm.length === 2 && STATE_NAMES[stateTerm.toUpperCase()]) {
      const sc = stateTerm.toUpperCase();
      return { city: cityTerm, state: STATE_NAMES[sc], stateCode: sc };
    }
    const sc = STATE_CODES[stateTerm.toLowerCase()];
    if (sc) {
      return { city: cityTerm, state: STATE_NAMES[sc], stateCode: sc };
    }

    return { city: cityTerm, state: stateTerm, stateCode: "" };
  }

  // Fallback: parse from description "Bellevue, WA, USA"
  const city = p.structured_formatting?.main_text || p.description.split(",")[0].trim();
  const secondary = p.structured_formatting?.secondary_text || "";
  const parts = secondary.split(",").map((s) => s.trim());

  for (const part of parts) {
    const stateMatch = part.match(/^([A-Z]{2})$/);
    if (stateMatch && STATE_NAMES[stateMatch[1]]) {
      return { city, state: STATE_NAMES[stateMatch[1]], stateCode: stateMatch[1] };
    }
    const sc = STATE_CODES[part.toLowerCase()];
    if (sc) {
      return { city, state: STATE_NAMES[sc], stateCode: sc };
    }
  }

  return { city, state: "", stateCode: "" };
}

// ─── SerpAPI Fallback ─────────────────────────────────────────────────────────

async function fetchFromSerpApi(
  query: string,
  apiKey: string
): Promise<CitySuggestion[]> {
  const params = new URLSearchParams({
    engine: "google_autocomplete",
    q: `${query} city`,
    api_key: apiKey,
    hl: "en",
    gl: "us",
  });

  const response = await fetch(
    `https://serpapi.com/search.json?${params.toString()}`,
    { signal: AbortSignal.timeout(5000) }
  );

  if (!response.ok) {
    throw new Error(`SerpAPI returned ${response.status}`);
  }

  const data = await response.json();
  const rawSuggestions: { value: string }[] = data.suggestions || [];

  const results: CitySuggestion[] = [];
  for (const s of rawSuggestions) {
    const parsed = parseCitySuggestion(s.value);
    if (parsed) results.push(parsed);
  }

  return results.slice(0, 8);
}

function parseCitySuggestion(raw: string): CitySuggestion | null {
  if (!raw) return null;

  let cleaned = raw
    .replace(/\bcity\b/gi, "")
    .replace(/\btown\b/gi, "")
    .replace(/\bvillage\b/gi, "")
    .replace(/\bborough\b/gi, "")
    .replace(/\bunited states\b/gi, "")
    .replace(/\busa?\b/gi, "")
    .trim();

  const commaMatch = cleaned.match(/^(.+?),\s*(.+)$/);
  if (commaMatch) {
    const cityPart = commaMatch[1].trim();
    const statePart = commaMatch[2].trim();

    const stateCode =
      statePart.length === 2
        ? statePart.toUpperCase()
        : STATE_CODES[statePart.toLowerCase()];

    if (stateCode && STATE_NAMES[stateCode]) {
      return {
        city: cityPart,
        state: STATE_NAMES[stateCode],
        stateCode,
        label: `${cityPart}, ${stateCode}`,
      };
    }

    if (cityPart && statePart) {
      return {
        city: cityPart,
        state: statePart,
        stateCode: statePart.length === 2 ? statePart.toUpperCase() : "",
        label: `${cityPart}, ${statePart}`,
      };
    }
  }

  const words = cleaned.split(/\s+/);
  if (words.length >= 2) {
    const lastWord = words[words.length - 1];
    if (lastWord.length === 2 && STATE_NAMES[lastWord.toUpperCase()]) {
      const city = words.slice(0, -1).join(" ");
      const sc = lastWord.toUpperCase();
      return { city, state: STATE_NAMES[sc], stateCode: sc, label: `${city}, ${sc}` };
    }
  }

  if (cleaned.length > 1 && !cleaned.includes(",")) {
    return { city: cleaned, state: "", stateCode: "", label: cleaned };
  }

  return null;
}

// ─── Static Fallback ──────────────────────────────────────────────────────────

function getFallbackSuggestions(query: string): CitySuggestion[] {
  const q = query.toLowerCase();

  const cities: CitySuggestion[] = [
    { city: "New York", state: "New York", stateCode: "NY", label: "New York, NY" },
    { city: "Los Angeles", state: "California", stateCode: "CA", label: "Los Angeles, CA" },
    { city: "Chicago", state: "Illinois", stateCode: "IL", label: "Chicago, IL" },
    { city: "Houston", state: "Texas", stateCode: "TX", label: "Houston, TX" },
    { city: "Phoenix", state: "Arizona", stateCode: "AZ", label: "Phoenix, AZ" },
    { city: "San Antonio", state: "Texas", stateCode: "TX", label: "San Antonio, TX" },
    { city: "San Diego", state: "California", stateCode: "CA", label: "San Diego, CA" },
    { city: "Dallas", state: "Texas", stateCode: "TX", label: "Dallas, TX" },
    { city: "Austin", state: "Texas", stateCode: "TX", label: "Austin, TX" },
    { city: "San Francisco", state: "California", stateCode: "CA", label: "San Francisco, CA" },
    { city: "Seattle", state: "Washington", stateCode: "WA", label: "Seattle, WA" },
    { city: "Denver", state: "Colorado", stateCode: "CO", label: "Denver, CO" },
    { city: "Boston", state: "Massachusetts", stateCode: "MA", label: "Boston, MA" },
    { city: "Nashville", state: "Tennessee", stateCode: "TN", label: "Nashville, TN" },
    { city: "Portland", state: "Oregon", stateCode: "OR", label: "Portland, OR" },
    { city: "Las Vegas", state: "Nevada", stateCode: "NV", label: "Las Vegas, NV" },
    { city: "Atlanta", state: "Georgia", stateCode: "GA", label: "Atlanta, GA" },
    { city: "Miami", state: "Florida", stateCode: "FL", label: "Miami, FL" },
    { city: "Minneapolis", state: "Minnesota", stateCode: "MN", label: "Minneapolis, MN" },
    { city: "Tampa", state: "Florida", stateCode: "FL", label: "Tampa, FL" },
    { city: "Salt Lake City", state: "Utah", stateCode: "UT", label: "Salt Lake City, UT" },
    { city: "Charlotte", state: "North Carolina", stateCode: "NC", label: "Charlotte, NC" },
    { city: "Detroit", state: "Michigan", stateCode: "MI", label: "Detroit, MI" },
    { city: "Bellevue", state: "Washington", stateCode: "WA", label: "Bellevue, WA" },
    { city: "Raleigh", state: "North Carolina", stateCode: "NC", label: "Raleigh, NC" },
    { city: "Pittsburgh", state: "Pennsylvania", stateCode: "PA", label: "Pittsburgh, PA" },
    { city: "Indianapolis", state: "Indiana", stateCode: "IN", label: "Indianapolis, IN" },
    { city: "Columbus", state: "Ohio", stateCode: "OH", label: "Columbus, OH" },
    { city: "San Jose", state: "California", stateCode: "CA", label: "San Jose, CA" },
    { city: "Philadelphia", state: "Pennsylvania", stateCode: "PA", label: "Philadelphia, PA" },
  ];

  return cities
    .filter(
      (c) =>
        c.city.toLowerCase().startsWith(q) ||
        c.city.toLowerCase().includes(q) ||
        c.label.toLowerCase().includes(q)
    )
    .sort((a, b) => {
      const aStarts = a.city.toLowerCase().startsWith(q) ? 0 : 1;
      const bStarts = b.city.toLowerCase().startsWith(q) ? 0 : 1;
      if (aStarts !== bStarts) return aStarts - bStarts;
      return a.city.localeCompare(b.city);
    })
    .slice(0, 8);
}

/**
 * Agentic Tool Definitions + Executors
 *
 * These are the tools the AI agent can call during its tool-use loop.
 * The agent decides WHAT to search for and WHEN — we just execute.
 *
 * Tools:
 * - web_search: Search the web for information
 * - fetch_webpage: Fetch and extract text from a URL
 * - search_google_places: Search Google Places API
 * - get_place_details: Get detailed info about a Google Place
 */

import type { ToolDefinition, ToolExecutor } from "@/lib/ai/types";
import { getProviderSecret } from "@/lib/config/provider-config";
import { isIP } from "node:net";
import { lookup } from "node:dns/promises";

// ---------------------------------------------------------------------------
// SSRF guard
// ---------------------------------------------------------------------------
// Tool-driven URL fetches are an SSRF surface: the AI (or content it reads)
// could be steered into requesting internal services or cloud metadata
// endpoints. We only allow public http(s) targets and reject any URL that
// resolves to a private, loopback, link-local, or otherwise reserved address.
// This is a cheap scheme + IP-range check (one DNS lookup) with no impact on
// fetching legitimate public business websites.

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "metadata.google.internal",
]);

function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split(".").map((p) => parseInt(p, 10));
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) {
    return true; // malformed → treat as unsafe
  }
  const [a, b] = parts;
  return (
    a === 0 || // 0.0.0.0/8
    a === 10 || // 10.0.0.0/8 private
    a === 127 || // 127.0.0.0/8 loopback
    (a === 100 && b >= 64 && b <= 127) || // 100.64.0.0/10 CGNAT
    (a === 169 && b === 254) || // 169.254.0.0/16 link-local (incl. cloud metadata)
    (a === 172 && b >= 16 && b <= 31) || // 172.16.0.0/12 private
    (a === 192 && b === 168) || // 192.168.0.0/16 private
    a >= 224 // 224.0.0.0/4 multicast + 240.0.0.0/4 reserved
  );
}

function isPrivateIPv6(ip: string): boolean {
  const addr = ip.toLowerCase().replace(/^\[|\]$/g, "");
  if (addr === "::1" || addr === "::") return true; // loopback / unspecified
  if (addr.startsWith("fe80") || addr.startsWith("fec0")) return true; // link-local / site-local
  if (addr.startsWith("fc") || addr.startsWith("fd")) return true; // fc00::/7 unique-local
  // IPv4-mapped (::ffff:a.b.c.d) — validate the embedded IPv4
  const mapped = addr.match(/(?:::ffff:)(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isPrivateIPv4(mapped[1]);
  return false;
}

function isBlockedAddress(ip: string): boolean {
  const family = isIP(ip);
  if (family === 4) return isPrivateIPv4(ip);
  if (family === 6) return isPrivateIPv6(ip);
  return true; // not a valid IP → unsafe
}

/**
 * Throws if the URL is not a safe, public http(s) target. Resolves the host
 * and rejects private/loopback/link-local/reserved destinations to prevent
 * SSRF against internal services and cloud metadata endpoints.
 */
async function assertPublicHttpUrl(rawUrl: string): Promise<void> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error("Invalid URL");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Only http:// and https:// URLs are allowed");
  }
  if (parsed.username || parsed.password) {
    throw new Error("URLs with embedded credentials are not allowed");
  }

  const hostname = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (BLOCKED_HOSTNAMES.has(hostname) || hostname.endsWith(".localhost")) {
    throw new Error("Blocked host");
  }

  // Direct IP literal → check the literal itself.
  if (isIP(hostname)) {
    if (isBlockedAddress(hostname)) throw new Error("Blocked private/reserved IP address");
    return;
  }

  // Hostname → resolve every address and ensure none are private/reserved.
  let addresses: { address: string }[];
  try {
    addresses = await lookup(hostname, { all: true });
  } catch {
    throw new Error("Host could not be resolved");
  }
  if (addresses.length === 0 || addresses.some((a) => isBlockedAddress(a.address))) {
    throw new Error("Host resolves to a private/reserved address");
  }
}

// ---------------------------------------------------------------------------
// Tool Definitions (what the AI sees)
// ---------------------------------------------------------------------------

export const AGENTIC_TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: "web_search",
    description:
      "Search the web using Google Custom Search. Use this to find competitors, " +
      "social media profiles, directory listings, industry benchmarks, or any " +
      "information about a business. Returns top 5 search results with titles, " +
      "URLs, and snippets.",
    input_schema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "The search query. Be specific — e.g., 'badminton academies near Kirkland WA' not just 'competitors'.",
        },
        num_results: {
          type: "number",
          description: "Number of results to return (1-10). Default: 5.",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "fetch_webpage",
    description:
      "Fetch a webpage and extract its text content. Use this to read a business's " +
      "website, check their social media profiles, verify directory listings, or " +
      "gather detailed information from a specific URL. Returns extracted text " +
      "(truncated to 8000 chars).",
    input_schema: {
      type: "object",
      properties: {
        url: {
          type: "string",
          description: "The full URL to fetch (must start with http:// or https://).",
        },
      },
      required: ["url"],
    },
  },
  {
    name: "search_google_places",
    description:
      "Search Google Places API for businesses. Use this to find competitors, " +
      "verify business information, or discover nearby businesses of a specific type. " +
      "Returns place names, ratings, review counts, addresses, and place IDs.",
    input_schema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Search query — e.g., 'badminton academy near Kirkland WA' or 'dental clinic in Seattle'.",
        },
        location: {
          type: "string",
          description: "Optional lat,lng for location bias — e.g., '47.6815,-122.2087'.",
        },
        radius: {
          type: "number",
          description: "Search radius in meters. Default: 50000 (50km). Use larger for niche businesses.",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "get_place_details",
    description:
      "Get detailed information about a specific Google Place by place_id. " +
      "Returns name, rating, review count, address, phone, website, hours, " +
      "categories, and recent reviews.",
    input_schema: {
      type: "object",
      properties: {
        place_id: {
          type: "string",
          description: "The Google Place ID (from search_google_places results).",
        },
      },
      required: ["place_id"],
    },
  },
];

// ---------------------------------------------------------------------------
// Tool Executors (what actually happens when the AI calls a tool)
// ---------------------------------------------------------------------------

async function executeWebSearch(input: Record<string, unknown>): Promise<string> {
  const query = input.query as string;
  const numResults = Math.min(10, Math.max(1, (input.num_results as number) || 5));

  // Use Google Custom Search API if configured, otherwise use SerpAPI-lite approach
  const googleApiKey = await getProviderSecret("google_places_api_key");
  const cseId = process.env.GOOGLE_CSE_ID;

  if (googleApiKey && cseId) {
    try {
      const params = new URLSearchParams({
        key: googleApiKey,
        cx: cseId,
        q: query,
        num: String(numResults),
      });
      const res = await fetch(
        `https://www.googleapis.com/customsearch/v1?${params}`,
        { signal: AbortSignal.timeout(10000) }
      );
      if (res.ok) {
        const data = await res.json();
        const results = (data.items || []).map((item: any) => ({
          title: item.title,
          url: item.link,
          snippet: item.snippet,
        }));
        return JSON.stringify({ results, total: data.searchInformation?.totalResults || 0 });
      }
    } catch (err) {
      console.warn("[agentic-tools] Google CSE failed:", err);
    }
  }

  // Fallback: Google Places Text Search as a proxy for web search
  // (less ideal but still gets business results)
  if (googleApiKey) {
    try {
      const params = new URLSearchParams({
        query,
        key: googleApiKey,
        language: "en",
      });
      const res = await fetch(
        `https://maps.googleapis.com/maps/api/place/textsearch/json?${params}`,
        { signal: AbortSignal.timeout(8000) }
      );
      if (res.ok) {
        const data = await res.json();
        const results = (data.results || []).slice(0, numResults).map((r: any) => ({
          title: r.name,
          address: r.formatted_address,
          rating: r.rating,
          review_count: r.user_ratings_total,
          place_id: r.place_id,
          types: r.types,
          open_now: r.opening_hours?.open_now,
        }));
        return JSON.stringify({ results, source: "google_places_text_search" });
      }
    } catch (err) {
      console.warn("[agentic-tools] Places text search fallback failed:", err);
    }
  }

  return JSON.stringify({
    error: "Web search unavailable — no GOOGLE_CSE_ID configured and Google Places fallback failed",
    results: [],
  });
}

async function executeFetchWebpage(input: Record<string, unknown>): Promise<string> {
  const url = input.url as string;

  if (!url || (!url.startsWith("http://") && !url.startsWith("https://"))) {
    return JSON.stringify({ error: "Invalid URL — must start with http:// or https://" });
  }

  try {
    await assertPublicHttpUrl(url);
  } catch (e: any) {
    return JSON.stringify({ error: `Blocked URL: ${e?.message || "unsafe target"}`, url });
  }

  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(12000),
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; PhantomReach/2.0; +https://phantomreach.com/bot)",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });

    if (!res.ok) {
      return JSON.stringify({ error: `HTTP ${res.status} ${res.statusText}`, url });
    }

    const contentType = res.headers.get("content-type") || "";
    if (!contentType.includes("text/html") && !contentType.includes("text/plain") && !contentType.includes("application/json")) {
      return JSON.stringify({ error: `Non-text content type: ${contentType}`, url });
    }

    const html = await res.text();

    // Simple HTML to text extraction (strip tags, decode entities, clean whitespace)
    const text = html
      // Remove script/style blocks
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      // Remove HTML comments
      .replace(/<!--[\s\S]*?-->/g, "")
      // Replace block elements with newlines
      .replace(/<\/(p|div|h[1-6]|li|tr|br|hr)[^>]*>/gi, "\n")
      .replace(/<br\s*\/?>/gi, "\n")
      // Remove remaining tags
      .replace(/<[^>]+>/g, " ")
      // Decode basic HTML entities
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, " ")
      // Clean whitespace
      .replace(/[ \t]+/g, " ")
      .replace(/\n\s*\n\s*\n/g, "\n\n")
      .trim();

    // Truncate to 8000 chars to stay within token budget
    const truncated = text.length > 8000 ? text.slice(0, 8000) + "\n\n[TRUNCATED — page content exceeds 8000 chars]" : text;

    return JSON.stringify({
      url,
      title: (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1]?.trim() || "",
      text_content: truncated,
      content_length: text.length,
    });
  } catch (err) {
    return JSON.stringify({
      error: `Failed to fetch: ${err instanceof Error ? err.message : String(err)}`,
      url,
    });
  }
}

async function executeSearchGooglePlaces(input: Record<string, unknown>): Promise<string> {
  const query = input.query as string;
  const location = input.location as string | undefined;
  const radius = (input.radius as number) || 50000;

  const apiKey = await getProviderSecret("google_places_api_key");
  if (!apiKey) {
    return JSON.stringify({ error: "GOOGLE_PLACES_API_KEY not configured", results: [] });
  }

  try {
    const params = new URLSearchParams({
      query,
      key: apiKey,
      language: "en",
    });
    if (location) {
      params.set("location", location);
      params.set("radius", String(radius));
    }

    const res = await fetch(
      `https://maps.googleapis.com/maps/api/place/textsearch/json?${params}`,
      { signal: AbortSignal.timeout(8000) }
    );

    if (!res.ok) {
      return JSON.stringify({ error: `Google Places API error: ${res.status}`, results: [] });
    }

    const data = await res.json();
    if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
      return JSON.stringify({ error: `Google Places status: ${data.status}`, results: [] });
    }

    const results = (data.results || []).slice(0, 10).map((r: any) => ({
      name: r.name,
      address: r.formatted_address,
      rating: r.rating,
      review_count: r.user_ratings_total,
      place_id: r.place_id,
      types: r.types,
      open_now: r.opening_hours?.open_now,
      business_status: r.business_status,
    }));

    return JSON.stringify({ results, total: data.results?.length || 0 });
  } catch (err) {
    return JSON.stringify({
      error: `Search failed: ${err instanceof Error ? err.message : String(err)}`,
      results: [],
    });
  }
}

async function executeGetPlaceDetails(input: Record<string, unknown>): Promise<string> {
  const placeId = input.place_id as string;

  const apiKey = await getProviderSecret("google_places_api_key");
  if (!apiKey) {
    return JSON.stringify({ error: "GOOGLE_PLACES_API_KEY not configured" });
  }

  try {
    const fields = [
      "name", "formatted_address", "formatted_phone_number",
      "website", "rating", "user_ratings_total", "reviews",
      "opening_hours", "types", "url", "business_status",
      "price_level", "photos",
    ].join(",");

    const params = new URLSearchParams({
      place_id: placeId,
      fields,
      key: apiKey,
      language: "en",
      reviews_sort: "newest",
    });

    const res = await fetch(
      `https://maps.googleapis.com/maps/api/place/details/json?${params}`,
      { signal: AbortSignal.timeout(8000) }
    );

    if (!res.ok) {
      return JSON.stringify({ error: `Place Details API error: ${res.status}` });
    }

    const data = await res.json();
    if (data.status !== "OK") {
      return JSON.stringify({ error: `Place Details status: ${data.status}` });
    }

    const r = data.result;
    return JSON.stringify({
      name: r.name,
      address: r.formatted_address,
      phone: r.formatted_phone_number,
      website: r.website,
      rating: r.rating,
      review_count: r.user_ratings_total,
      types: r.types,
      business_status: r.business_status,
      price_level: r.price_level,
      hours: r.opening_hours?.weekday_text,
      photo_count: r.photos?.length || 0,
      google_maps_url: r.url,
      reviews: (r.reviews || []).slice(0, 5).map((rev: any) => ({
        author: rev.author_name,
        rating: rev.rating,
        text: rev.text?.slice(0, 300),
        time: rev.relative_time_description,
      })),
    });
  } catch (err) {
    return JSON.stringify({
      error: `Failed: ${err instanceof Error ? err.message : String(err)}`,
    });
  }
}

// ---------------------------------------------------------------------------
// Master executor — routes tool calls to the right function
// ---------------------------------------------------------------------------

export const executeAgenticTool: ToolExecutor = async (
  toolName: string,
  input: Record<string, unknown>
): Promise<string> => {
  switch (toolName) {
    case "web_search":
      return executeWebSearch(input);
    case "fetch_webpage":
      return executeFetchWebpage(input);
    case "search_google_places":
      return executeSearchGooglePlaces(input);
    case "get_place_details":
      return executeGetPlaceDetails(input);
    default:
      return JSON.stringify({ error: `Unknown tool: ${toolName}` });
  }
};

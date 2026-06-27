import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";

import { GET as businessAutocomplete } from "@/app/api/autocomplete/business/route";
import { lookupGoogleMaps } from "@/lib/agents/tools/google-maps";
import { fetchGoogleReviews, fetchYelpReviews } from "@/lib/agents/tools/reviews";
import { runPageSpeedAudit } from "@/lib/agents/tools/pagespeed";
import { detectTechStack } from "@/lib/agents/tools/tech-detect";
import { checkCitations } from "@/lib/agents/tools/citations";
import { searchCompetitors } from "@/lib/agents/tools/competitors";
import { runScoutPipeline } from "@/lib/agents/scout-orchestrator";
import { clearAllApiKeys } from "../test-utils/test-helpers";

describe("runtime collectors without providers", () => {
  it("returns unavailable results instead of fabricated audit data", async () => {
    const restore = clearAllApiKeys();

    try {
      const gbp = await lookupGoogleMaps({ businessName: "Example Dental", city: "Seattle" });
      expect(gbp).toMatchObject({ unavailable: true, status: "missing_api_key" });
      expect("analysis" in gbp).toBe(false);

      const googleReviews = await fetchGoogleReviews({ businessName: "Example Dental" });
      expect(googleReviews).toMatchObject({ unavailable: true });
      expect("reviews" in googleReviews).toBe(false);

      const yelpReviews = await fetchYelpReviews({ businessName: "Example Dental" });
      expect(yelpReviews).toMatchObject({ unavailable: true });
      expect("reviews" in yelpReviews).toBe(false);

      const pagespeed = await runPageSpeedAudit({ url: "https://example.com" });
      expect(pagespeed).toMatchObject({ unavailable: true, status: "missing_api_key" });
      expect("analysis" in pagespeed).toBe(false);

      const citations = await checkCitations({ businessName: "Example Dental" });
      expect(citations).toMatchObject({ unavailable: true, status: "not_applicable" });
      expect("directories" in citations).toBe(false);

      const competitors = await searchCompetitors({ businessName: "Example Dental", city: "Seattle" });
      expect(competitors).toMatchObject({ unavailable: true, status: "missing_api_key" });
      expect("competitors" in competitors).toBe(false);
    } finally {
      restore();
    }
  });

  it("returns unavailable for website fetch failures instead of guessed tech stack", async () => {
    const result = await detectTechStack({ url: "http://127.0.0.1:1/no-server" });

    expect(result).toMatchObject({ unavailable: true, status: "failed" });
    expect("analysis" in result).toBe(false);
  });

  it("returns an empty scout result when discovery has no real provider", async () => {
    const restore = clearAllApiKeys();

    try {
      const { result } = await runScoutPipeline({
        city: "Seattle",
        category: "Dentists",
        resultCount: 10,
      });

      expect(result.businesses).toEqual([]);
      expect(result.total_scanned).toBe(0);
      expect(result.market_summary).toContain("Google Places API key");
    } finally {
      restore();
    }
  });

  it("returns no business autocomplete suggestions without a real provider", async () => {
    const restore = clearAllApiKeys();

    try {
      const request = new NextRequest("http://localhost/api/autocomplete/business?q=joe&city=Seattle");
      const response = await businessAutocomplete(request);
      const body = await response.json();

      expect(body).toEqual({
        suggestions: [],
        unavailable: {
          status: "missing_api_key",
          source: "business_autocomplete",
          reason: expect.stringContaining("GOOGLE_PLACES_API_KEY"),
        },
      });
    } finally {
      restore();
    }
  });
});

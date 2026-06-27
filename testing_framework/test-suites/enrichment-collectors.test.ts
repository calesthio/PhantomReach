import { describe, expect, it } from "vitest";

import {
  collectCensus,
  collectCrux,
  collectOpenCorporates,
  collectWayback,
} from "@/lib/agents/tools/business-enrichment";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("business enrichment collectors", () => {
  it("does not call the OpenCorporates API without a token", async () => {
    let calls = 0;
    const result = await collectOpenCorporates(
      { businessName: "Bellevue Dental Arts", state: "WA" },
      "2026-06-26T00:00:00.000Z",
      {
        fetchFn: async () => {
          calls += 1;
          return jsonResponse({});
        },
        getSecretFn: async () => undefined,
      }
    );

    expect(calls).toBe(0);
    expect(result.facts).toEqual([]);
    expect(result.warnings).toEqual(["OpenCorporates API token is not configured."]);
  });

  it("treats Census HTML missing-key responses as unavailable instead of throwing", async () => {
    const result = await collectCensus(
      "13333 NE Bel Red Rd #200, Bellevue, WA 98005, USA",
      "2026-06-26T00:00:00.000Z",
      {
        fetchFn: async () =>
          new Response("<html><title>Missing Key</title><body>A valid key must be included.</body></html>", {
            status: 200,
            headers: { "content-type": "text/html" },
          }),
        getSecretFn: async () => "test-census-key",
      }
    );

    expect(result.facts).toEqual([]);
    expect(result.warnings).toEqual(["US Census returned a non-JSON response. Check the configured Census API key."]);
  });

  it("falls back to Wayback availability when CDX times out", async () => {
    const result = await collectWayback("http://www.bellevuedentalarts.com/", "2026-06-26T00:00:00.000Z", {
      fetchFn: async (input) => {
        const url = String(input);
        if (url.includes("/cdx?")) throw new DOMException("The operation was aborted due to timeout", "TimeoutError");
        return jsonResponse({
          archived_snapshots: {
            closest: {
              available: true,
              timestamp: "20100221210813",
              url: "https://web.archive.org/web/20100221210813/http://www.bellevuedentalarts.com/",
            },
          },
        });
      },
    });

    expect(result.warnings).toEqual([]);
    expect(result.facts[0]).toMatchObject({
      id: "website-wayback-known-snapshot",
      label: "Web archive snapshot",
      value: "2010",
    });
  });

  it("classifies CrUX permission errors instead of returning raw HTTP 403", async () => {
    const result = await collectCrux("http://www.bellevuedentalarts.com/", "2026-06-26T00:00:00.000Z", {
      fetchFn: async () =>
        jsonResponse(
          {
            error: {
              code: 403,
              message: "Requests to this API chromeuxreport.googleapis.com method google.chrome.uxreport.v1.ChromeUXReport.QueryRecord are blocked.",
              status: "PERMISSION_DENIED",
            },
          },
          403
        ),
      getSecretFn: async () => "test-google-key",
    });

    expect(result.facts).toEqual([]);
    expect(result.warnings).toEqual(["Chrome UX Report API is blocked or not enabled for the configured Google key."]);
  });
});

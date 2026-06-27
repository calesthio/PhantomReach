import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runPageSpeedAudit } from "@/lib/agents/tools/pagespeed";
import { setTestEnv } from "../test-utils/test-helpers";

describe("PageSpeed Tool", () => {
  let restoreEnv: () => void;

  beforeEach(() => {
    restoreEnv = setTestEnv({
      GOOGLE_PAGESPEED_API_KEY: "test-pagespeed-key",
    });
  });

  afterEach(() => {
    restoreEnv();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("requests all Lighthouse categories and does not overstate mobile friendliness", async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const requestUrl = new URL(typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url);

      expect(requestUrl.searchParams.getAll("category")).toEqual([
        "performance",
        "accessibility",
        "seo",
        "best-practices",
      ]);

      return new Response(
        JSON.stringify({
          lighthouseResult: {
            categories: {
              performance: { score: 0.91 },
              accessibility: { score: 0.8 },
              seo: { score: 0.77 },
              "best-practices": { score: 0.83 },
            },
            audits: {
              "largest-contentful-paint": { numericValue: 2200, score: 1 },
              "cumulative-layout-shift": { numericValue: 0.05, score: 1 },
              "interaction-to-next-paint": { numericValue: 180, score: 1 },
              "is-on-https": { score: 1 },
              "total-byte-weight": { numericValue: 1024 * 1024, score: 1 },
              "structured-data": { score: 1 },
              viewport: { score: 1 },
              "font-size": { score: 0 },
            },
          },
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      );
    });

    vi.stubGlobal("fetch", fetchMock);

    const result = await runPageSpeedAudit({ url: "https://example.com" });

    expect("analysis" in result).toBe(true);
    if (!("analysis" in result)) {
      return;
    }

    expect(result.analysis.performance_score).toBe(91);
    expect(result.analysis.accessibility_score).toBe(80);
    expect(result.analysis.mobile_friendly).toBe(false);
  });
});

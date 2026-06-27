import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearAllApiKeys } from "../test-utils/test-helpers";

vi.mock("@/lib/agents/tools/intent-signals", () => ({
  gatherQuickIntel: vi.fn(async () => ({
    signals: [],
    signal_count: 0,
  })),
}));

vi.mock("@/lib/ai/claude", () => ({
  extractJSON: vi.fn(async () => null),
}));

import { runScoutPipeline } from "@/lib/agents/scout-orchestrator";
import { gatherQuickIntel } from "@/lib/agents/tools/intent-signals";

describe("Scout Orchestrator", () => {
  let restoreEnv: () => void;

  beforeEach(() => {
    restoreEnv = clearAllApiKeys();
    vi.mocked(gatherQuickIntel).mockResolvedValue({
      signals: [],
      signal_count: 0,
    } as any);
  });

  afterEach(() => {
    restoreEnv();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("returns a safe empty-market result when no businesses are scanned", async () => {
    const { result } = await runScoutPipeline({
      city: "Seattle",
      category: "Dentists",
      resultCount: 0,
    });

    expect(result.total_scanned).toBe(0);
    expect(result.businesses).toEqual([]);
    expect(result.avg_digital_maturity).toBe(0);
    expect(result.market_snapshot?.businesses_scanned).toBe(0);
    expect(result.market_heat_index?.label).toBe("No Data");
    expect(result.market_summary).toContain("Google Places API key");
  });

  it("parses decimal income signals into a numeric market snapshot", async () => {
    vi.mocked(gatherQuickIntel).mockResolvedValue({
      signals: [
        {
          headline: "Median household income: $65.5k",
          confidence: "high",
        },
      ],
      signal_count: 1,
    } as any);
    process.env.GOOGLE_PLACES_API_KEY = "test-google-places-key";
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.includes("/textsearch/")) {
          return {
            ok: true,
            json: async () => ({
              status: "OK",
              results: [
                {
                  name: "Seattle Dental Studio",
                  formatted_address: "100 Pine St, Seattle, WA",
                  place_id: "place-1",
                  rating: 4.4,
                  user_ratings_total: 82,
                  photos: [{}],
                },
              ],
            }),
          };
        }

        return {
          ok: true,
          json: async () => ({
            result: {
              formatted_phone_number: "(206) 555-0100",
              website: "https://seattledental.example",
              photos: [{}],
              formatted_address: "100 Pine St, Seattle, WA",
            },
          }),
        };
      }) as any
    );

    const { result } = await runScoutPipeline({
      city: "Seattle",
      category: "Dentists",
      resultCount: 1,
    });

    expect(result.total_scanned).toBe(1);
    expect(result.market_snapshot?.median_household_income).toBe(65500);
    expect(result.market_snapshot?.income_tier).toBe("moderate");
  });
});

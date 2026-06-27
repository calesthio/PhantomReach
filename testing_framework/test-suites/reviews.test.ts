import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { analyzeReviews, fetchGoogleReviews } from "@/lib/agents/tools/reviews";
import { setTestEnv } from "../test-utils/test-helpers";

describe("Reviews Tool", () => {
  let restoreEnv: () => void;

  beforeEach(() => {
    restoreEnv = setTestEnv({
      GOOGLE_PLACES_API_KEY: "test-google-places-key",
    });
  });

  afterEach(() => {
    restoreEnv();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("preserves owner replies from Google reviews for response-rate analysis", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            status: "OK",
            result: {
              user_ratings_total: 2,
              reviews: [
                {
                  author_name: "Ava",
                  rating: 5,
                  text: "Great service.",
                  time: 1735689600,
                  owner_reply: {
                    text: "Thanks for the review!",
                    time: 1735776000,
                  },
                },
                {
                  author_name: "Ben",
                  rating: 2,
                  text: "Long wait.",
                  time: 1735603200,
                },
              ],
            },
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        ),
      ),
    );

    const result = await fetchGoogleReviews({
      placeId: "test-place-id",
      businessName: "Test Business",
      city: "Seattle",
    });

    expect("reviews" in result).toBe(true);
    if (!("reviews" in result)) {
      return;
    }

    expect(result.reviews[0].owner_response).toBe("Thanks for the review!");
    expect(result.rawReviews?.[0]?.owner_response).toBe("Thanks for the review!");

    const analysis = analyzeReviews(result.reviews, [], 4.5, 2);
    expect(analysis.owner_response_rate).toBe(50);
  });
});

import { describe, expect, it } from "vitest";
import { runAuditPipeline } from "@/lib/agents/orchestrator";
import { unavailable } from "@/lib/agents/tools/unavailable";
import {
  buildEvidenceReport,
  collectedEvidence,
  notImplementedEvidence,
  skippedEvidence,
  unavailableEvidence,
} from "@/lib/agents/evidence";
import { clearAllApiKeys } from "../test-utils/test-helpers";

describe("audit evidence builder", () => {
  it("builds evidence summaries across all statuses", () => {
    const report = buildEvidenceReport([
      collectedEvidence("gbp_health"),
      unavailableEvidence(
        "competitive_comparison",
        unavailable(
          "competitors",
          "missing_api_key",
          "Set Google Places to collect competitors."
        )
      ),
      skippedEvidence("website_performance", "No website URL was found."),
      notImplementedEvidence(
        "citation_consistency",
        "Citation consistency is not implemented in the local version yet."
      ),
    ]);

    expect(report.summary).toEqual({
      collected: 1,
      unavailable: 1,
      skipped: 1,
      failed: 0,
      not_implemented: 1,
    });
    expect(report.modules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "gbp_health",
          label: "Google Business Profile",
          status: "collected",
        }),
        expect.objectContaining({
          key: "competitive_comparison",
          status: "unavailable",
          settings_key: "google_places_api_key",
        }),
      ])
    );
  });

  it("maps missing setup items to Settings keys", () => {
    const pageSpeed = unavailableEvidence(
      "website_performance",
      unavailable(
        "pagespeed",
        "missing_api_key",
        "Set GOOGLE_PAGESPEED_API_KEY to collect real PageSpeed Insights data."
      )
    );

    expect(pageSpeed).toMatchObject({
      key: "website_performance",
      status: "unavailable",
      settings_key: "google_pagespeed_api_key",
    });
  });

  it("uses nontechnical copy in default evidence reasons", () => {
    expect(collectedEvidence("gbp_health").reason).toBe("Collected real data for this area.");
    expect(
      notImplementedEvidence(
        "citation_consistency",
        "Directory scan is not available in the local app yet."
      ).reason
    ).not.toMatch(/module|implemented/i);
  });
});

describe("audit pipeline evidence", () => {
  it("records unavailable and skipped modules without fake data", async () => {
    const restore = clearAllApiKeys();
    try {
      const { result } = await runAuditPipeline({
        businessName: "Example Dental",
        city: "Seattle",
      });

      expect(result.evidence).toBeDefined();
      expect(result.evidence?.modules).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            key: "gbp_health",
            status: "unavailable",
            settings_key: "google_places_api_key",
          }),
          expect.objectContaining({
            key: "website_performance",
            status: "skipped",
          }),
          expect.objectContaining({
            key: "tech_stack",
            status: "skipped",
          }),
          expect.objectContaining({
            key: "citation_consistency",
            status: "not_implemented",
          }),
          expect.objectContaining({
            key: "competitive_comparison",
            status: "unavailable",
            settings_key: "google_places_api_key",
          }),
        ])
      );
    } finally {
      restore();
    }
  });
});

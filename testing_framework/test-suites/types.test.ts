/**
 * Types & Utility Function Tests
 *
 * Tests for src/lib/db/types.ts — the getExecutiveSummaryText utility
 * and type-level invariants.
 */

import { describe, it, expect } from "vitest";
import {
  getExecutiveSummaryText,
  TIER_LIMITS,
  type ExecutiveSummaryData,
  type Plan,
} from "@/lib/db/types";
import {
  createMockExecutiveSummary,
} from "../test-utils/mock-factories";

describe("getExecutiveSummaryText", () => {
  it("should return the string directly for legacy string summaries", () => {
    const result = getExecutiveSummaryText("This is a legacy summary.");
    expect(result).toBe("This is a legacy summary.");
  });

  it("should extract text from v2 ExecutiveSummaryData", () => {
    const summary = createMockExecutiveSummary();
    const result = getExecutiveSummaryText(summary);
    expect(result).toContain(summary.verdict_headline);
    expect(result).toContain(summary.verdict_subline);
    expect(result).toContain(summary.bottom_line);
  });

  it("should include three_insights in extracted text", () => {
    const summary = createMockExecutiveSummary({
      three_insights: ["Insight A", "Insight B", "Insight C"],
    });
    const result = getExecutiveSummaryText(summary);
    expect(result).toContain("Insight A");
    expect(result).toContain("Insight B");
    expect(result).toContain("Insight C");
  });

  it("should include hidden_opportunity", () => {
    const summary = createMockExecutiveSummary({
      hidden_opportunity: "Big hidden opportunity here",
    });
    const result = getExecutiveSummaryText(summary);
    expect(result).toContain("Big hidden opportunity here");
  });

  it("should fall back to legacy fields when v2 fields are empty", () => {
    const summary: ExecutiveSummaryData = {
      verdict_tier: "moderate",
      verdict_headline: "",
      verdict_subline: "",
      key_stats: [],
      top_strength: { module: "", headline: "", detail: "" },
      critical_gap: { module: "", headline: "", detail: "" },
      three_insights: [],
      hidden_opportunity: "",
      path_forward: [],
      bottom_line: "",
      // Legacy fields
      verdict_context: "Legacy context here",
      core_story: ["Legacy story part 1", "Legacy story part 2"],
      closing_statement: "Legacy closing",
    };
    const result = getExecutiveSummaryText(summary);
    expect(result).toContain("Legacy context here");
    expect(result).toContain("Legacy story part 1");
    expect(result).toContain("Legacy closing");
  });

  it("should handle empty string input", () => {
    const result = getExecutiveSummaryText("");
    expect(result).toBe("");
  });

  it("should handle summary with all fields empty", () => {
    const summary: ExecutiveSummaryData = {
      verdict_tier: "weak",
      verdict_headline: "",
      verdict_subline: "",
      key_stats: [],
      top_strength: { module: "", headline: "", detail: "" },
      critical_gap: { module: "", headline: "", detail: "" },
      three_insights: [],
      hidden_opportunity: "",
      path_forward: [],
      bottom_line: "",
    };
    const result = getExecutiveSummaryText(summary);
    expect(result).toBe("");
  });
});

describe("TIER_LIMITS", () => {
  it("should define all four plans", () => {
    const plans: Plan[] = ["free", "starter", "pro", "agency"];
    for (const plan of plans) {
      expect(TIER_LIMITS[plan]).toBeDefined();
    }
  });

  it("should have ascending module counts (free < starter < pro)", () => {
    expect(TIER_LIMITS.free.modules_available).toBeLessThan(
      TIER_LIMITS.starter.modules_available
    );
    expect(TIER_LIMITS.starter.modules_available).toBeLessThan(
      TIER_LIMITS.pro.modules_available
    );
  });

  it("should have ascending audit limits", () => {
    expect(TIER_LIMITS.free.audits_per_month).toBeLessThan(
      TIER_LIMITS.starter.audits_per_month
    );
    expect(TIER_LIMITS.starter.audits_per_month).toBeLessThan(
      TIER_LIMITS.pro.audits_per_month
    );
    expect(TIER_LIMITS.pro.audits_per_month).toBeLessThan(
      TIER_LIMITS.agency.audits_per_month
    );
  });

  it("pro and agency should have same module count", () => {
    expect(TIER_LIMITS.pro.modules_available).toBe(
      TIER_LIMITS.agency.modules_available
    );
  });

  it("free plan should only have web format", () => {
    expect(TIER_LIMITS.free.report_formats).toEqual(["web"]);
  });

  it("pro plan should have pdf format", () => {
    expect(TIER_LIMITS.pro.report_formats).toContain("pdf");
  });

  it("agency should have white label", () => {
    expect(TIER_LIMITS.agency.has_white_label).toBe(true);
  });

  it("free and starter should NOT have white label", () => {
    expect(TIER_LIMITS.free.has_white_label).toBe(false);
    expect(TIER_LIMITS.starter.has_white_label).toBe(false);
  });
});

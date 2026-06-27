/**
 * Mock Factory Self-Tests
 *
 * Ensures all mock factories produce valid, well-shaped objects.
 * This catches regressions when types.ts changes.
 */

import { describe, it, expect } from "vitest";
import {
  createMockUser,
  createMockAuditInput,
  createMockScoutInput,
  createMockGBPHealth,
  createMockReviewSentiment,
  createMockWebsitePerformance,
  createMockTechStack,
  createMockSocialPresence,
  createMockCitationConsistency,
  createMockCompetitiveComparison,
  createMockRevenueImpact,
  createMockBusinessIntelligence,
  createMockExecutiveSummary,
  createMockRecommendation,
  createMockAuditResult,
  createMockReport,
  createMockScoutBusiness,
  createMockScoutResult,
  createMockReportScores,
  createEmptyAuditResult,
  createLegacyAuditResult,
  createFailedReport,
  createExhaustedUser,
  createBareScoutBusiness,
} from "../test-utils/mock-factories";

describe("Mock Factories — Shape Validation", () => {
  it("createMockUser produces valid User", () => {
    const user = createMockUser();
    expect(user.id).toBeDefined();
    expect(user.email).toContain("@");
    expect(["free", "starter", "pro", "agency"]).toContain(user.plan);
    expect(user.audit_credits_remaining).toBeGreaterThanOrEqual(0);
    expect(user.scout_credits_remaining).toBeGreaterThanOrEqual(0);
  });

  it("createMockUser respects overrides", () => {
    const user = createMockUser({ plan: "free", audit_credits_remaining: 0 });
    expect(user.plan).toBe("free");
    expect(user.audit_credits_remaining).toBe(0);
  });

  it("createMockAuditInput produces valid AuditInput", () => {
    const input = createMockAuditInput();
    expect(input.businessName.length).toBeGreaterThan(0);
  });

  it("createMockScoutInput produces valid ScoutInput", () => {
    const input = createMockScoutInput();
    expect(input.city.length).toBeGreaterThan(0);
    expect(input.category.length).toBeGreaterThan(0);
    expect(input.resultCount).toBeGreaterThanOrEqual(5);
  });

  it("all module results have grade and score", () => {
    const modules = [
      createMockGBPHealth(),
      createMockReviewSentiment(),
      createMockWebsitePerformance(),
      createMockTechStack(),
      createMockSocialPresence(),
      createMockCitationConsistency(),
      createMockCompetitiveComparison(),
      createMockRevenueImpact(),
    ];
    for (const mod of modules) {
      expect(mod.grade).toBeDefined();
      expect(mod.score).toBeGreaterThanOrEqual(0);
      expect(mod.score).toBeLessThanOrEqual(100);
      expect(mod.findings).toBeDefined();
      expect(Array.isArray(mod.findings)).toBe(true);
      expect(mod.recommendations).toBeDefined();
      expect(Array.isArray(mod.recommendations)).toBe(true);
    }
  });

  it("createMockExecutiveSummary has all required v2 fields", () => {
    const summary = createMockExecutiveSummary();
    expect(summary.verdict_tier).toBeDefined();
    expect(summary.verdict_headline).toBeDefined();
    expect(summary.key_stats.length).toBeGreaterThan(0);
    expect(summary.three_insights.length).toBe(3);
    expect(summary.path_forward.length).toBeGreaterThan(0);
    expect(summary.bottom_line.length).toBeGreaterThan(0);
  });

  it("createMockAuditResult has executive_summary + recommendations", () => {
    const result = createMockAuditResult();
    expect(result.executive_summary).toBeDefined();
    expect(Array.isArray(result.recommendations)).toBe(true);
  });

  it("createMockReport produces complete report", () => {
    const report = createMockReport();
    expect(report.id).toBeDefined();
    expect(report.type).toBe("audit");
    expect(report.status).toBe("completed");
    expect(report.result).toBeDefined();
    expect(report.scores).toBeDefined();
  });

  it("createMockScoutResult has businesses array", () => {
    const result = createMockScoutResult();
    expect(result.businesses.length).toBeGreaterThan(0);
    expect(result.city).toBeDefined();
    expect(result.category).toBeDefined();
  });

  // Edge case factories
  it("createEmptyAuditResult has minimal valid shape", () => {
    const result = createEmptyAuditResult();
    expect(result.executive_summary).toBeDefined();
    expect(result.recommendations).toEqual([]);
  });

  it("createLegacyAuditResult has string executive_summary", () => {
    const result = createLegacyAuditResult();
    expect(typeof result.executive_summary).toBe("string");
  });

  it("createFailedReport has no result or scores", () => {
    const report = createFailedReport();
    expect(report.status).toBe("failed");
    expect(report.result).toBeUndefined();
    expect(report.scores).toBeUndefined();
  });

  it("createExhaustedUser has zero credits", () => {
    const user = createExhaustedUser();
    expect(user.audit_credits_remaining).toBe(0);
    expect(user.scout_credits_remaining).toBe(0);
  });

  it("createBareScoutBusiness has only required fields", () => {
    const biz = createBareScoutBusiness();
    expect(biz.business_name).toBeDefined();
    expect(biz.rank).toBeDefined();
    expect(biz.website).toBeUndefined();
    expect(biz.google_rating).toBeUndefined();
  });
});
